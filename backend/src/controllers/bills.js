import pool from '../config/db.js';
import * as Q from '../db/queries/bills.js';
import * as PayQ from '../db/queries/payments.js';
import * as ProdQ from '../db/queries/products.js';
import {
  calcAreaPrice, calcFixedPrice, calcCustomPrice,
  calcBillTotals, resolveQuantityTier,
} from '../utils/pricing.js';
import { createError } from '../middleware/errorHandler.js';
import * as invSvc from '../services/inventoryService.js';

// ── Helper: sync totals (always called inside a transaction) ──
const syncTotals = async (client, billId, { discountType, discountValue }) => {
  const [{ rows: items }, { rows: extraCharges }, { rows: paid }] = await Promise.all([
    client.query(`SELECT item_total, design_fee, urgent_fee FROM bill_items WHERE bill_id = $1`, [billId]),
    client.query(`SELECT amount FROM bill_extra_charges WHERE bill_id = $1`, [billId]),
    client.query(`SELECT COALESCE(SUM(amount),0) AS total_paid FROM payments WHERE bill_id = $1`, [billId]),
  ]);

  const totals = calcBillTotals({
    items,
    extraCharges,
    discountType:  discountType  || 'fixed',
    discountValue: discountValue || 0,
    totalPaid:     paid[0].total_paid,
  });

  await Q.updateTotals(client, billId, {
    subtotal:         totals.subtotal,
    discountType:     discountType  || 'fixed',
    discountValue:    discountValue || 0,
    discountAmount:   totals.discountAmount,
    extraCharges:     totals.extraCharges,
    totalAmount:      totals.totalAmount,
    advancePaid:      paid[0].total_paid,
    remainingBalance: totals.remainingBalance,
  });

  return totals;
};

// ── Helper: resolve price for a bill item ─────────────────────
const resolveItemPrice = async (productId, pricingModel, body) => {
  switch (pricingModel) {
    case 'area_based': {
      const { rows: rules } = await ProdQ.getActivePricingRule(productId);
      const rule = rules[0];
      if (!rule) throw createError(422, `No active pricing rule for product ${productId}`);
      return calcItemPrice({
        pricingModel: 'area_based',
        width:        body.width,
        height:       body.height,
        qty:          body.quantity ?? 1,
        pricePerSqft: rule.price_per_sqft,
        minSqft:      rule.min_sqft ?? 1,
      });
    }
    case 'quantity_based': {
      const { rows: tiers } = await ProdQ.getTiers(productId);
      const resolved = resolveQuantityTier(tiers, body.quantity);
      if (!resolved) throw createError(422, `No pricing tier matches quantity ${body.quantity} for product ${productId}`);
      return resolved;
    }
    case 'fixed_charge': {
      const { rows: rules } = await ProdQ.getActivePricingRule(productId);
      const rule = rules[0];
      if (!rule) throw createError(422, `No active pricing rule for product ${productId}`);
      return calcItemPrice({ pricingModel: 'fixed_charge', fixedPrice: rule.fixed_price, qty: body.quantity ?? 1 });
    }
    case 'custom':
      if (body.unitPrice == null) throw createError(400, 'unitPrice is required for custom pricing');
      return calcItemPrice({ pricingModel: 'custom', unitPrice: body.unitPrice, qty: body.quantity ?? 1 });
    default:
      throw createError(400, `Unknown pricingModel: ${pricingModel}`);
  }
};

// ── Check bill number availability ────────────────────────────
export const checkBillNumber = async (req, res) => {
  const raw = (req.query.value ?? '').toString().trim().toUpperCase();
  if (!raw) return res.json({ available: false, reason: 'empty' });

  const { rows } = await pool.query(
    `SELECT id FROM bills WHERE UPPER(bill_number) = $1 LIMIT 1`,
    [raw]
  );
  res.json({ available: rows.length === 0 });
};

// ── CRUD ──────────────────────────────────────────────────────

export const getAll = async (req, res) => {
  const { customer_id, status, search = '', limit = 50, offset = 0 } = req.query;
  const { rows } = await Q.findAll({
    customerId: customer_id ? Number(customer_id) : null,
    status:     status || null,
    search:     search.trim(),
    limit:      Number(limit),
    offset:     Number(offset),
  });
  const total = rows[0] ? parseInt(rows[0].total_count, 10) : 0;
  res.json({ data: rows, count: rows.length, total });
};

export const getById = async (req, res, next) => {
  const result = await Q.findByIdWithItems(req.params.id);
  if (!result.bill) return next(createError(404, 'Bill not found'));
  res.json({ data: result });
};

export const create = async (req, res) => {
  const { customerId, notes, dueDate } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Generate bill number inside transaction
    const { rows: numRows } = await client.query(`SELECT generate_bill_number() AS num`);
    const billNumber = numRows[0].num;

    const { rows } = await Q.create(client, { billNumber, customerId });
    const bill = rows[0];

    if (notes || dueDate) {
      await client.query(
        `UPDATE bills SET notes = $2, due_date = $3 WHERE id = $1`,
        [bill.id, notes ?? null, dueDate ?? null]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ data: bill });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ── Update bill metadata (notes, due_date) ────────────────────

export const update = async (req, res, next) => {
  const { notes, dueDate } = req.body;
  const { rows } = await pool.query(
    `UPDATE bills SET notes = COALESCE($2, notes), due_date = COALESCE($3, due_date)
     WHERE id = $1 RETURNING id, bill_number, notes, due_date`,
    [req.params.id, notes ?? null, dueDate ?? null]
  );
  if (!rows.length) return next(createError(404, 'Bill not found'));
  res.json({ data: rows[0] });
};

// ── Invoice (print-ready snapshot) ───────────────────────────

export const getInvoice = async (req, res, next) => {
  const result = await Q.findByIdWithItems(req.params.id);
  if (!result.bill) return next(createError(404, 'Bill not found'));

  const { bill, items, extraCharges, payments } = result;
  const totalPaid = payments.reduce((s, p) => s + parseFloat(p.amount), 0);

  res.json({
    data: {
      invoice: {
        billNumber:       bill.bill_number,
        date:             bill.created_at,
        dueDate:          bill.due_date,
        status:           bill.status,
      },
      customer: {
        id:      bill.customer_id,
        name:    bill.customer_name,
        phone:   bill.customer_phone,
        address: bill.customer_address,
      },
      items: items.map((it) => ({
        id:           it.id,
        product:      it.product_name,
        category:     it.category_name,
        description:  it.description,
        pricingModel: it.pricing_model,
        width:        it.width,
        height:       it.height,
        sqft:         it.sqft,
        quantity:     it.quantity,
        unitPrice:    it.unit_price,
        designFee:    it.design_fee,
        urgentFee:    it.urgent_fee,
        itemTotal:    it.item_total,
      })),
      extraCharges,
      totals: {
        subtotal:         bill.subtotal,
        discountType:     bill.discount_type,
        discountValue:    bill.discount_value,
        discountAmount:   bill.discount_amount,
        extraCharges:     bill.extra_charges,
        totalAmount:      bill.total_amount,
        totalPaid:        parseFloat(totalPaid.toFixed(2)),
        remainingBalance: bill.remaining_balance,
      },
      payments,
    },
  });
};

// ── Complete bill — optimized: O(7) queries regardless of item count ──
// Before: ~21 sequential round-trips (N+1 per item + re-fetch after COMMIT)
// After:  7 queries max — batch product fetch, in-memory pricing, batch INSERT

const ITEM_COLS = [
  'bill_id', 'product_id', 'description', 'pricing_model',
  'width', 'height', 'sqft', 'quantity',
  'unit_price', 'item_total', 'design_fee', 'urgent_fee',
  'notes', 'sort_order',
];

export const completeBill = async (req, res, next) => {
  const {
    customerId,
    items        = [],
    extraCharges = [],
    discountType  = 'fixed',
    discountValue = 0,
    advance       = 0,
    paymentMethod = 'cash',
    notes,
    dueDate,
    billDate,
    billNumber: rawCustomBillNumber,
  } = req.body;

  // Normalize custom bill number: trim + uppercase, treat blank as absent
  const customBillNumber = rawCustomBillNumber?.toString().trim().toUpperCase() || null;

  if (!customerId)   return next(createError(400, 'customerId is required'));
  if (!items.length) return next(createError(400, 'At least one item is required'));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Query 1+2 (parallel): product configs + bill number ────────
    const productIds = [...new Set(items.map((it) => Number(it.productId)))];

    const [{ rows: configs }, billNumResult] = await Promise.all([
      client.query(
        `SELECT
           p.id, p.pricing_model,
           pr.price_per_sqft, pr.min_sqft, pr.fixed_price,
           COALESCE(
             json_agg(DISTINCT jsonb_build_object(
               'id',      qt.id,
               'min_qty', qt.min_qty,
               'max_qty', qt.max_qty,
               'price',   qt.price::text
             )) FILTER (WHERE qt.id IS NOT NULL),
             '[]'::json
           ) AS tiers
         FROM   products p
         LEFT   JOIN pricing_rules pr
                ON  pr.product_id = p.id
                AND pr.effective_from <= CURRENT_DATE
                AND (pr.effective_to IS NULL OR pr.effective_to >= CURRENT_DATE)
         LEFT   JOIN quantity_tiers qt ON qt.product_id = p.id
         WHERE  p.id = ANY($1::int[])
         GROUP  BY p.id, p.pricing_model, pr.price_per_sqft, pr.min_sqft, pr.fixed_price`,
        [productIds]
      ),
      // Custom bill number: check uniqueness. Auto: generate from sequence.
      customBillNumber
        ? client.query(`SELECT id FROM bills WHERE UPPER(bill_number) = $1 LIMIT 1`, [customBillNumber])
        : client.query(`SELECT generate_bill_number() AS num`),
    ]);

    // Resolve final bill number (or reject duplicate)
    let billNumber;
    if (customBillNumber) {
      if (billNumResult.rows.length > 0)
        throw createError(409, `Bill number "${customBillNumber}" already exists`);
      billNumber = customBillNumber;
    } else {
      billNumber = billNumResult.rows[0].num;
    }

    const configMap = new Map(configs.map((c) => [c.id, c]));

    // ── Resolve ALL prices in memory — zero DB calls ────────────────
    const resolvedItems = items.map((item, sortOrder) => {
      const cfg   = configMap.get(Number(item.productId));
      if (!cfg) throw createError(404, `Product ${item.productId} not found`);

      const model = item.pricingModel ?? cfg.pricing_model;
      let priced;

      switch (model) {
        case 'area_based':
          if (!cfg.price_per_sqft)
            throw createError(422, `No active pricing rule for product ${item.productId}`);
          priced = calcAreaPrice({
            width:        item.width,
            height:       item.height,
            qty:          item.quantity ?? 1,
            pricePerSqft: cfg.price_per_sqft,
            minSqft:      cfg.min_sqft ?? 1,
          });
          break;

        case 'quantity_based': {
          const tiers = (cfg.tiers || []).map((t) => ({
            id:      Number(t.id),
            min_qty: Number(t.min_qty),
            max_qty: t.max_qty != null ? Number(t.max_qty) : null,
            price:   parseFloat(t.price),
          }));
          priced = resolveQuantityTier(tiers, item.quantity);
          if (!priced)
            throw createError(422, `No tier matches qty ${item.quantity} for product ${item.productId}`);
          break;
        }

        case 'fixed_charge':
          if (!cfg.fixed_price)
            throw createError(422, `No active pricing rule for product ${item.productId}`);
          priced = calcFixedPrice({ fixedPrice: cfg.fixed_price, qty: item.quantity ?? 1 });
          break;

        case 'custom':
          if (item.unitPrice == null)
            throw createError(400, 'unitPrice is required for custom pricing');
          priced = calcCustomPrice({ unitPrice: item.unitPrice, qty: item.quantity ?? 1 });
          break;

        default:
          throw createError(400, `Unknown pricingModel: ${model}`);
      }

      return { item, model, priced, sortOrder };
    });

    // ── Query 3: create bill shell ─────────────────────────────────
    const { rows: billRows } = await client.query(
      `INSERT INTO bills (bill_number, customer_id, discount_type, discount_value, notes, due_date, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::date, NOW())) RETURNING *`,
      [billNumber, customerId, discountType, discountValue, notes ?? null, dueDate ?? null, billDate ?? null]
    );
    const bill = billRows[0];

    // ── Query 4+5 (parallel): batch-insert items + extra charges ───
    const C = ITEM_COLS.length;
    const itemPlaceholders = resolvedItems
      .map((_, i) => `(${ITEM_COLS.map((__, c) => `$${i * C + c + 1}`).join(', ')})`)
      .join(', ');
    const itemParams = resolvedItems.flatMap(({ item, model, priced, sortOrder }) => [
      bill.id,
      Number(item.productId),
      item.description ?? null,
      model,
      item.width  != null ? parseFloat(item.width)  : null,
      item.height != null ? parseFloat(item.height) : null,
      priced.sqft ?? null,
      parseInt(item.quantity, 10) || 1,
      priced.unitPrice,
      priced.itemTotal,
      parseFloat(item.designFee || 0),
      parseFloat(item.urgentFee || 0),
      item.notes ?? null,
      sortOrder,
    ]);

    const ecParams = extraCharges.length
      ? [bill.id, ...extraCharges.flatMap((ec) => [ec.label, parseFloat(ec.amount || 0)])]
      : null;
    const ecPlaceholders = extraCharges
      .map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`)
      .join(', ');

    const [{ rows: insertedItems }, { rows: insertedCharges }] = await Promise.all([
      client.query(
        `INSERT INTO bill_items (${ITEM_COLS.join(', ')}) VALUES ${itemPlaceholders} RETURNING *`,
        itemParams
      ),
      ecParams
        ? client.query(
            `INSERT INTO bill_extra_charges (bill_id, label, amount) VALUES ${ecPlaceholders} RETURNING *`,
            ecParams
          )
        : Promise.resolve({ rows: [] }),
    ]);

    // ── Compute totals in memory — no re-fetch needed ───────────────
    const advanceAmount = parseFloat(advance) || 0;
    const totals = calcBillTotals({
      items:        insertedItems.map((it) => ({
        item_total: it.item_total,
        design_fee: it.design_fee,
        urgent_fee: it.urgent_fee,
      })),
      extraCharges: insertedCharges.map((ec) => ({ amount: ec.amount })),
      discountType,
      discountValue,
      totalPaid:    advanceAmount,
    });
    const remaining = Math.max(0, parseFloat((totals.totalAmount - advanceAmount).toFixed(2)));

    // ── Query 6+7 (parallel when advance): update totals + record payment ──
    let paymentRow = null;
    if (advanceAmount > 0) {
      const [, { rows: pRows }] = await Promise.all([
        client.query(
          `UPDATE bills
           SET subtotal=$2, discount_amount=$3, extra_charges=$4, total_amount=$5,
               advance_paid=$6, remaining_balance=$7
           WHERE id=$1`,
          [bill.id, totals.subtotal, totals.discountAmount, totals.extraCharges,
           totals.totalAmount, advanceAmount, remaining]
        ),
        client.query(
          `INSERT INTO payments (bill_id, customer_id, amount, payment_method)
           VALUES ($1,$2,$3,$4) RETURNING *`,
          [bill.id, customerId, advanceAmount, paymentMethod]
        ),
      ]);
      paymentRow = pRows[0];
    } else {
      await client.query(
        `UPDATE bills
         SET subtotal=$2, discount_amount=$3, extra_charges=$4, total_amount=$5,
             advance_paid=0, remaining_balance=$5
         WHERE id=$1`,
        [bill.id, totals.subtotal, totals.discountAmount, totals.extraCharges, totals.totalAmount]
      );
    }

    await client.query('COMMIT');

    // Build response from memory — no post-COMMIT queries needed
    res.status(201).json({
      data: {
        bill: {
          ...bill,
          bill_number:       billNumber,
          subtotal:          totals.subtotal,
          discount_amount:   totals.discountAmount,
          extra_charges:     totals.extraCharges,
          total_amount:      totals.totalAmount,
          advance_paid:      advanceAmount,
          remaining_balance: remaining,
        },
        items:        insertedItems,
        extraCharges: insertedCharges,
        payments:     paymentRow ? [paymentRow] : [],
      },
      payment: paymentRow,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const updateStatus = async (req, res, next) => {
  const { status } = req.body;
  const valid = ['pending', 'in_progress', 'completed', 'delivered', 'cancelled'];
  if (!valid.includes(status)) return next(createError(400, `Invalid status. Must be one of: ${valid.join(', ')}`));

  const billId = Number(req.params.id);

  // Stock-impacting transitions need a transaction
  if (status === 'in_progress' || status === 'cancelled') {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: billRows } = await Q.findById(billId);
      if (!billRows.length) { await client.query('ROLLBACK'); return next(createError(404, 'Bill not found')); }

      const prevStatus = billRows[0].status;

      if (status === 'in_progress' && prevStatus === 'pending') {
        // Deduct stock — fetch bill items first
        const { rows: items } = await client.query(
          `SELECT id, product_id, quantity, sqft FROM bill_items WHERE bill_id = $1`, [billId]
        );
        await invSvc.deductForBill(client, billId, items);
      }

      if (status === 'cancelled' && ['in_progress', 'completed'].includes(prevStatus)) {
        // Reverse stock deductions
        await invSvc.reverseForBill(client, billId);
      }

      const { rows } = await client.query(
        `UPDATE bills SET status = $2 WHERE id = $1 RETURNING id, status`, [billId, status]
      );

      await client.query('COMMIT');
      return res.json({ data: rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // Non-stock transitions (completed, delivered, pending)
  const { rows } =
    status === 'delivered'
      ? await Q.updateDelivered(billId)
      : await Q.updateStatus(billId, status);

  if (!rows.length) return next(createError(404, 'Bill not found'));
  res.json({ data: rows[0] });
};

export const markDelivered = async (req, res, next) => {
  const { rows } = await Q.updateDelivered(req.params.id);
  if (!rows.length) return next(createError(404, 'Bill not found'));
  res.json({ data: rows[0] });
};

export const remove = async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: bill } = await client.query('SELECT id FROM bills WHERE id=$1', [req.params.id]);
    if (!bill.length) { await client.query('ROLLBACK'); return next(createError(404, 'Bill not found')); }
    await client.query('DELETE FROM payments    WHERE bill_id=$1', [req.params.id]);
    await client.query('DELETE FROM bill_extra_charges WHERE bill_id=$1', [req.params.id]);
    await client.query('DELETE FROM bill_items  WHERE bill_id=$1', [req.params.id]);
    await client.query('DELETE FROM bills       WHERE id=$1',      [req.params.id]);
    await client.query('COMMIT');
    res.json({ message: 'Bill deleted', id: Number(req.params.id) });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ── Bill Items ────────────────────────────────────────────────

export const addItem = async (req, res, next) => {
  const billId = Number(req.params.id);
  const { productId, pricingModel, width, height, quantity, description, designFee, urgentFee, notes, sortOrder } = req.body;

  const { rows: prod } = await ProdQ.findById(productId);
  if (!prod.length) return next(createError(404, 'Product not found'));

  const priced = await resolveItemPrice(productId, pricingModel, req.body);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: bill } = await Q.findById(billId);
    if (!bill.length) throw createError(404, 'Bill not found');

    const { rows: item } = await Q.addItem(client, billId, {
      productId, description, pricingModel,
      width: width ?? null, height: height ?? null,
      sqft:       priced.sqft ?? null,
      quantity:   quantity ?? 1,
      unitPrice:  priced.unitPrice,
      itemTotal:  priced.itemTotal,
      designFee:  designFee ?? 0,
      urgentFee:  urgentFee ?? 0,
      notes, sortOrder,
    });

    const totals = await syncTotals(client, billId, {
      discountType:  bill[0].discount_type,
      discountValue: bill[0].discount_value,
    });

    await client.query('COMMIT');
    res.status(201).json({ data: item[0], totals });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const updateItem = async (req, res, next) => {
  const billId  = Number(req.params.id);
  const itemId  = Number(req.params.itemId);
  const { productId, pricingModel, quantity, description, designFee, urgentFee, notes } = req.body;

  const priced = productId && pricingModel
    ? await resolveItemPrice(productId, pricingModel, req.body)
    : null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: bill } = await Q.findById(billId);
    if (!bill.length) throw createError(404, 'Bill not found');

    const { rows: item } = await Q.updateItem(client, itemId, billId, {
      productId, description, pricingModel,
      width:     req.body.width ?? null,
      height:    req.body.height ?? null,
      sqft:      priced?.sqft ?? null,
      quantity,
      unitPrice: priced?.unitPrice,
      itemTotal: priced?.itemTotal,
      designFee, urgentFee, notes,
    });
    if (!item.length) throw createError(404, 'Bill item not found');

    const totals = await syncTotals(client, billId, {
      discountType:  bill[0].discount_type,
      discountValue: bill[0].discount_value,
    });

    await client.query('COMMIT');
    res.json({ data: item[0], totals });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const removeItem = async (req, res, next) => {
  const billId = Number(req.params.id);
  const itemId = Number(req.params.itemId);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: bill } = await Q.findById(billId);
    if (!bill.length) throw createError(404, 'Bill not found');

    const { rows } = await Q.removeItem(client, itemId, billId);
    if (!rows.length) throw createError(404, 'Bill item not found');

    const totals = await syncTotals(client, billId, {
      discountType:  bill[0].discount_type,
      discountValue: bill[0].discount_value,
    });

    await client.query('COMMIT');
    res.json({ message: 'Item removed', id: rows[0].id, totals });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ── Extra Charges ─────────────────────────────────────────────

export const addExtraCharge = async (req, res, next) => {
  const billId = Number(req.params.id);
  const { label, amount } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: bill } = await Q.findById(billId);
    if (!bill.length) throw createError(404, 'Bill not found');

    const { rows: charge } = await Q.addExtraCharge(client, billId, { label, amount });

    const totals = await syncTotals(client, billId, {
      discountType:  bill[0].discount_type,
      discountValue: bill[0].discount_value,
    });

    await client.query('COMMIT');
    res.status(201).json({ data: charge[0], totals });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const removeExtraCharge = async (req, res, next) => {
  const billId   = Number(req.params.id);
  const chargeId = Number(req.params.chargeId);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: bill } = await Q.findById(billId);
    if (!bill.length) throw createError(404, 'Bill not found');

    const { rows } = await Q.removeExtraCharge(client, chargeId, billId);
    if (!rows.length) throw createError(404, 'Extra charge not found');

    const totals = await syncTotals(client, billId, {
      discountType:  bill[0].discount_type,
      discountValue: bill[0].discount_value,
    });

    await client.query('COMMIT');
    res.json({ message: 'Extra charge removed', id: rows[0].id, totals });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ── Discount ──────────────────────────────────────────────────

// ── Duplicate ─────────────────────────────────────────────────
export const duplicateBill = async (req, res, next) => {
  const sourceId = Number(req.params.id);
  const { rows: source } = await Q.findById(sourceId);
  if (!source.length) return next(createError(404, 'Bill not found'));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: numRows } = await client.query('SELECT generate_bill_number() AS num');
    const newBill = await Q.duplicate(client, sourceId, numRows[0].num);
    await client.query('COMMIT');
    res.status(201).json({ data: newBill, message: `Duplicated as ${newBill.bill_number}` });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ── Bulk status update ────────────────────────────────────────
export const bulkStatus = async (req, res, next) => {
  const { ids = [], status } = req.body;
  const valid = ['pending', 'in_progress', 'completed', 'delivered', 'cancelled'];
  if (!valid.includes(status)) return next(createError(400, `Invalid status`));
  const billIds = [...new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (!billIds.length) return next(createError(400, 'No valid bill IDs provided'));
  const { rows } = await Q.bulkUpdateStatus(billIds, status);
  res.json({ data: rows, updated: rows.length });
};

export const applyDiscount = async (req, res, next) => {
  const billId = Number(req.params.id);
  const { discountType = 'fixed', discountValue = 0 } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: bill } = await Q.findById(billId);
    if (!bill.length) throw createError(404, 'Bill not found');

    await client.query(
      `UPDATE bills SET discount_type = $2, discount_value = $3 WHERE id = $1`,
      [billId, discountType, discountValue]
    );

    const totals = await syncTotals(client, billId, { discountType, discountValue });

    await client.query('COMMIT');
    res.json({ data: totals });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
