/**
 * inventoryService — stock deduction / reversal logic.
 *
 * All public functions receive an already-open pg client so they
 * participate in the caller's transaction. Never BEGIN/COMMIT here.
 */

import * as Q from '../db/queries/inventory.js';
import { createError } from '../middleware/errorHandler.js';

// ── How much inventory a bill item consumes ───────────────────
const calcConsumption = (billItem, mapping) => {
  const qty = mapping.use_sqft
    ? parseFloat(billItem.sqft   || 0)
    : parseFloat(billItem.quantity || 1);
  return parseFloat((qty * parseFloat(mapping.qty_per_unit)).toFixed(4));
};

/**
 * Deduct stock for every item in a bill.
 * Called inside the transaction that flips the bill to 'in_progress'.
 *
 * @param {pg.Client} client
 * @param {number}    billId
 * @param {Array}     billItems  — rows from bill_items (must include id, product_id, quantity, sqft)
 */
export const deductForBill = async (client, billId, billItems) => {
  for (const item of billItems) {
    // Fetch all mappings for this product (a product may consume multiple materials)
    const { rows: mappings } = await client.query(
      `SELECT pim.*, i.current_stock, i.name AS item_name, i.warning_threshold, i.critical_threshold
       FROM   product_inventory_map pim
       JOIN   inventory_items i ON i.id = pim.inventory_item_id
       WHERE  pim.product_id = $1`,
      [item.product_id]
    );

    if (!mappings.length) continue; // product not tracked in inventory

    for (const mapping of mappings) {
      // Deduplication: skip if OUT already recorded for this bill_item
      const { rows: existing } = await Q.outMovementExists(client, item.id);
      if (existing.length) continue;

      const consumption = calcConsumption(item, mapping);
      if (consumption <= 0) continue;

      // Validate sufficient stock
      if (parseFloat(mapping.current_stock) < consumption) {
        throw createError(
          422,
          `Insufficient stock: "${mapping.item_name}" has ${mapping.current_stock} ${mapping.unit} — order needs ${consumption}`
        );
      }

      // Record OUT movement
      await Q.createMovement(client, {
        itemId:        mapping.inventory_item_id,
        movementType:  'OUT',
        quantity:      consumption,
        referenceType: 'bill',
        referenceId:   billId,
        billItemId:    item.id,
        notes:         `Bill #${billId} — product ${item.product_id}`,
      });

      // Decrement current_stock in same transaction
      await Q.adjustStock(client, mapping.inventory_item_id, -consumption);
    }
  }
};

/**
 * Reverse stock deductions for a cancelled bill.
 * Finds existing OUT movements for this bill and creates matching IN reversals.
 *
 * @param {pg.Client} client
 * @param {number}    billId
 */
export const reverseForBill = async (client, billId) => {
  const { rows: outMovements } = await client.query(
    `SELECT sm.id, sm.item_id, sm.quantity, sm.bill_item_id
     FROM   stock_movements sm
     WHERE  sm.reference_type = 'bill'
       AND  sm.reference_id   = $1
       AND  sm.movement_type  = 'OUT'`,
    [billId]
  );

  for (const movement of outMovements) {
    await Q.createMovement(client, {
      itemId:        movement.item_id,
      movementType:  'IN',
      quantity:      movement.quantity,
      referenceType: 'reversal',
      referenceId:   billId,
      billItemId:    null, // reversal has no bill_item anchor (allows re-deduction later)
      notes:         `Cancellation reversal of movement #${movement.id}`,
    });

    await Q.adjustStock(client, movement.item_id, +movement.quantity);
  }
};

/**
 * Manual stock IN (purchase / restock).
 * This IS its own transaction — it's a standalone operation.
 *
 * @param {pg.Pool}  pool
 * @param {number}   itemId
 * @param {number}   quantity
 * @param {string}   notes
 */
export const recordPurchase = async (pool, { itemId, quantity, notes }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await Q.createMovement(client, {
      itemId,
      movementType:  'IN',
      quantity,
      referenceType: 'purchase',
      referenceId:   null,
      billItemId:    null,
      notes:         notes || 'Manual restock',
    });

    const { rows } = await Q.adjustStock(client, itemId, +quantity);

    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Manual stock adjustment (damage, count correction, etc.).
 *
 * @param {pg.Pool}  pool
 * @param {number}   itemId
 * @param {number}   newStock  — the correct absolute stock level
 * @param {string}   notes
 */
export const adjustToAbsolute = async (pool, { itemId, newStock, notes }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: current } = await client.query(
      `SELECT current_stock FROM inventory_items WHERE id = $1 FOR UPDATE`,
      [itemId]
    );
    if (!current.length) throw createError(404, 'Inventory item not found');

    const delta = parseFloat(newStock) - parseFloat(current[0].current_stock);
    const absQty = Math.abs(delta);

    if (absQty > 0) {
      await Q.createMovement(client, {
        itemId,
        movementType:  'ADJUST',
        quantity:      absQty,
        referenceType: 'adjustment',
        referenceId:   null,
        billItemId:    null,
        notes:         notes || `Manual adjustment (delta: ${delta > 0 ? '+' : ''}${delta})`,
      });

      await Q.adjustStock(client, itemId, delta);
    }

    const { rows } = await client.query(
      `SELECT * FROM inventory_items WHERE id = $1`, [itemId]
    );

    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ── Alert helpers ─────────────────────────────────────────────

export const getAlertLevel = (item) => {
  const stock = parseFloat(item.current_stock);
  if (stock <= parseFloat(item.critical_threshold)) return 'critical';
  if (stock <= parseFloat(item.warning_threshold))  return 'warning';
  return 'ok';
};
