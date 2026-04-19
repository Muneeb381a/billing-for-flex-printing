import pool from '../../config/db.js';

// ── Inventory Items ───────────────────────────────────────────

export const findAll = ({ activeOnly = true } = {}) =>
  pool.query(
    `SELECT i.*,
            CASE
              WHEN i.current_stock <= i.critical_threshold THEN 'critical'
              WHEN i.current_stock <= i.warning_threshold  THEN 'warning'
              ELSE 'ok'
            END AS alert_level
     FROM   inventory_items i
     WHERE  ($1 = FALSE OR i.is_active = TRUE)
     ORDER  BY i.name ASC`,
    [activeOnly]
  );

export const findById = (id) =>
  pool.query(
    `SELECT i.*,
            CASE
              WHEN i.current_stock <= i.critical_threshold THEN 'critical'
              WHEN i.current_stock <= i.warning_threshold  THEN 'warning'
              ELSE 'ok'
            END AS alert_level
     FROM   inventory_items i
     WHERE  i.id = $1`,
    [id]
  );

export const create = ({ name, unit, currentStock, warningThreshold, criticalThreshold, reorderPoint, costPerUnit, supplierName, notes }) =>
  pool.query(
    `INSERT INTO inventory_items
       (name, unit, current_stock, warning_threshold, critical_threshold, reorder_point, cost_per_unit, supplier_name, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [name, unit, currentStock ?? 0, warningThreshold ?? 0, criticalThreshold ?? 0, reorderPoint ?? 0, costPerUnit ?? null, supplierName ?? null, notes ?? null]
  );

export const update = (id, fields) =>
  pool.query(
    `UPDATE inventory_items
     SET    name               = COALESCE($2, name),
            unit               = COALESCE($3, unit),
            warning_threshold  = COALESCE($4, warning_threshold),
            critical_threshold = COALESCE($5, critical_threshold),
            reorder_point      = COALESCE($6, reorder_point),
            cost_per_unit      = COALESCE($7, cost_per_unit),
            supplier_name      = COALESCE($8, supplier_name),
            notes              = COALESCE($9, notes),
            is_active          = COALESCE($10, is_active)
     WHERE  id = $1
     RETURNING *`,
    [id, fields.name, fields.unit, fields.warningThreshold, fields.criticalThreshold,
     fields.reorderPoint, fields.costPerUnit, fields.supplierName, fields.notes, fields.isActive]
  );

// ── Stock movements (within a client for transaction safety) ──

export const getMovements = (itemId, { limit = 50, offset = 0 } = {}) =>
  pool.query(
    `SELECT sm.*, bi.description AS bill_item_desc
     FROM   stock_movements sm
     LEFT   JOIN bill_items bi ON bi.id = sm.bill_item_id
     WHERE  sm.item_id = $1
     ORDER  BY sm.created_at DESC
     LIMIT  $2 OFFSET $3`,
    [itemId, limit, offset]
  );

export const createMovement = (client, { itemId, movementType, quantity, referenceType, referenceId, billItemId, notes }) =>
  client.query(
    `INSERT INTO stock_movements (item_id, movement_type, quantity, reference_type, reference_id, bill_item_id, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [itemId, movementType, quantity, referenceType ?? null, referenceId ?? null, billItemId ?? null, notes ?? null]
  );

// Adjust current_stock and record movement atomically (called within transaction)
export const adjustStock = (client, itemId, delta) =>
  client.query(
    `UPDATE inventory_items
     SET    current_stock = current_stock + $2
     WHERE  id = $1
     RETURNING id, name, current_stock, warning_threshold, critical_threshold`,
    [itemId, delta]
  );

// Check if OUT movement already exists for a bill_item (dedup guard)
export const outMovementExists = (client, billItemId) =>
  client.query(
    `SELECT id FROM stock_movements
     WHERE  bill_item_id = $1 AND movement_type = 'OUT'
     LIMIT  1`,
    [billItemId]
  );

// ── Product → Inventory mapping ───────────────────────────────

export const getMappingsForProduct = (productId) =>
  pool.query(
    `SELECT pim.*, i.name AS item_name, i.unit, i.current_stock,
            i.warning_threshold, i.critical_threshold,
            CASE
              WHEN i.current_stock <= i.critical_threshold THEN 'critical'
              WHEN i.current_stock <= i.warning_threshold  THEN 'warning'
              ELSE 'ok'
            END AS alert_level
     FROM   product_inventory_map pim
     JOIN   inventory_items i ON i.id = pim.inventory_item_id
     WHERE  pim.product_id = $1`,
    [productId]
  );

export const getMappingsForProducts = (productIds) =>
  pool.query(
    `SELECT pim.*, i.name AS item_name, i.unit, i.current_stock,
            i.warning_threshold, i.critical_threshold,
            CASE
              WHEN i.current_stock <= i.critical_threshold THEN 'critical'
              WHEN i.current_stock <= i.warning_threshold  THEN 'warning'
              ELSE 'ok'
            END AS alert_level
     FROM   product_inventory_map pim
     JOIN   inventory_items i ON i.id = pim.inventory_item_id
     WHERE  pim.product_id = ANY($1::int[])`,
    [productIds]
  );

export const upsertMapping = (productId, inventoryItemId, { qtyPerUnit, useSqft }) =>
  pool.query(
    `INSERT INTO product_inventory_map (product_id, inventory_item_id, qty_per_unit, use_sqft)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (product_id, inventory_item_id)
     DO UPDATE SET qty_per_unit = EXCLUDED.qty_per_unit, use_sqft = EXCLUDED.use_sqft
     RETURNING *`,
    [productId, inventoryItemId, qtyPerUnit ?? 1, useSqft ?? false]
  );

export const deleteMapping = (productId, inventoryItemId) =>
  pool.query(
    `DELETE FROM product_inventory_map
     WHERE product_id = $1 AND inventory_item_id = $2
     RETURNING id`,
    [productId, inventoryItemId]
  );

// ── Dashboard: items below threshold ─────────────────────────

export const getLowStockAlerts = () =>
  pool.query(
    `SELECT id, name, unit, current_stock, warning_threshold, critical_threshold,
            CASE
              WHEN current_stock <= critical_threshold THEN 'critical'
              WHEN current_stock <= warning_threshold  THEN 'warning'
            END AS alert_level
     FROM   inventory_items
     WHERE  is_active = TRUE
       AND  current_stock <= warning_threshold
     ORDER  BY
       CASE WHEN current_stock <= critical_threshold THEN 0 ELSE 1 END,
       current_stock ASC`
  );
