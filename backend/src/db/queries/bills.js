import pool from '../../config/db.js';

// ── Bills ─────────────────────────────────────────────────────

export const findAll = ({ customerId = null, status = null, search = '', limit = 50, offset = 0 } = {}) =>
  pool.query(
    `SELECT b.id, b.bill_number, b.status,
            b.subtotal, b.discount_amount, b.extra_charges, b.total_amount,
            b.advance_paid, b.remaining_balance, b.due_date, b.created_at,
            c.id AS customer_id, c.name AS customer_name, c.phone AS customer_phone,
            COUNT(*) OVER() AS total_count
     FROM   bills b
     JOIN   customers c ON c.id = b.customer_id
     WHERE  ($1::int IS NULL OR b.customer_id = $1)
       AND  ($2::text IS NULL OR b.status = $2::order_status)
       AND  ($3 = '' OR c.name ILIKE $3 OR c.phone ILIKE $3 OR b.bill_number ILIKE $3)
     ORDER  BY b.created_at DESC
     LIMIT  $4 OFFSET $5`,
    [customerId, status, search ? `%${search}%` : '', limit, offset]
  );

export const findById = (id) =>
  pool.query(
    `SELECT b.*,
            c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address
     FROM   bills b
     JOIN   customers c ON c.id = b.customer_id
     WHERE  b.id = $1`,
    [id]
  );

export const findByIdWithItems = async (id) => {
  const [bill, items, extraCharges, payments] = await Promise.all([
    pool.query(
      `SELECT b.*, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address
       FROM bills b JOIN customers c ON c.id = b.customer_id WHERE b.id = $1`,
      [id]
    ),
    pool.query(
      `SELECT bi.id, bi.bill_id, bi.product_id, bi.category_id, bi.description, bi.pricing_model,
              bi.width, bi.height, bi.sqft, bi.quantity,
              bi.unit_price, bi.item_total, bi.design_fee, bi.urgent_fee,
              bi.notes AS item_notes, bi.sort_order, bi.created_at,
              COALESCE(direct_cat.name, p.name) AS product_name,
              COALESCE(direct_cat.name, parent_cat.name) AS category_name
       FROM   bill_items bi
       LEFT JOIN products p       ON p.id   = bi.product_id
       LEFT JOIN categories parent_cat ON parent_cat.id = p.category_id
       LEFT JOIN categories direct_cat ON direct_cat.id = bi.category_id
       WHERE  bi.bill_id = $1
       ORDER  BY bi.sort_order, bi.id`,
      [id]
    ),
    pool.query(
      `SELECT id, label, amount FROM bill_extra_charges WHERE bill_id = $1 ORDER BY id`,
      [id]
    ),
    pool.query(
      `SELECT id, amount, payment_method, payment_date, reference_number, notes
       FROM payments WHERE bill_id = $1 ORDER BY payment_date DESC`,
      [id]
    ),
  ]);

  return {
    bill:         bill.rows[0]         || null,
    items:        items.rows,
    extraCharges: extraCharges.rows,
    payments:     payments.rows,
  };
};

export const create = (client, { billNumber, customerId }) =>
  client.query(
    `INSERT INTO bills (bill_number, customer_id)
     VALUES ($1, $2) RETURNING *`,
    [billNumber, customerId]
  );

export const updateTotals = (client, billId, { subtotal, discountType, discountValue, discountAmount, extraCharges, totalAmount, advancePaid, remainingBalance }) =>
  client.query(
    `UPDATE bills
     SET    subtotal          = $2,
            discount_type     = $3,
            discount_value    = $4,
            discount_amount   = $5,
            extra_charges     = $6,
            total_amount      = $7,
            advance_paid      = $8,
            remaining_balance = $9
     WHERE  id = $1
     RETURNING *`,
    [billId, subtotal, discountType, discountValue, discountAmount, extraCharges, totalAmount, advancePaid, remainingBalance]
  );

export const updateStatus = (id, status) =>
  pool.query(
    `UPDATE bills SET status = $2 WHERE id = $1 RETURNING id, status`,
    [id, status]
  );

export const updateDelivered = (id) =>
  pool.query(
    `UPDATE bills SET status = 'delivered', delivered_at = NOW()
     WHERE id = $1 RETURNING id, status, delivered_at`,
    [id]
  );

export const remove = (id) =>
  pool.query(`DELETE FROM bills WHERE id = $1 RETURNING id`, [id]);

// ── Duplicate ─────────────────────────────────────────────────
export const duplicate = async (client, sourceId, newBillNumber) => {
  // New bill shell — copy metadata, reset payments
  const { rows: billRows } = await client.query(
    `INSERT INTO bills (bill_number, customer_id, discount_type, discount_value, notes,
                        subtotal, discount_amount, extra_charges, total_amount, advance_paid, remaining_balance)
     SELECT $1, customer_id, discount_type, discount_value, notes,
            subtotal, discount_amount, extra_charges, total_amount, 0, total_amount
     FROM   bills WHERE id = $2
     RETURNING *`,
    [newBillNumber, sourceId]
  );
  const newId = billRows[0].id;

  // Copy items
  await client.query(
    `INSERT INTO bill_items
       (bill_id, product_id, description, pricing_model, width, height, sqft,
        quantity, unit_price, item_total, design_fee, urgent_fee, notes, sort_order)
     SELECT $1, product_id, description, pricing_model, width, height, sqft,
            quantity, unit_price, item_total, design_fee, urgent_fee, notes, sort_order
     FROM   bill_items WHERE bill_id = $2`,
    [newId, sourceId]
  );

  // Copy extra charges
  await client.query(
    `INSERT INTO bill_extra_charges (bill_id, label, amount)
     SELECT $1, label, amount FROM bill_extra_charges WHERE bill_id = $2`,
    [newId, sourceId]
  );

  return billRows[0];
};

// ── Bulk delete ───────────────────────────────────────────────
export const bulkDelete = async (client, ids) => {
  await client.query(`DELETE FROM payments          WHERE bill_id = ANY($1::int[])`, [ids]);
  await client.query(`DELETE FROM bill_extra_charges WHERE bill_id = ANY($1::int[])`, [ids]);
  await client.query(`DELETE FROM bill_items         WHERE bill_id = ANY($1::int[])`, [ids]);
  const { rows } = await client.query(`DELETE FROM bills WHERE id = ANY($1::int[]) RETURNING id`, [ids]);
  return rows;
};

// ── Bulk status ───────────────────────────────────────────────
export const bulkUpdateStatus = (ids, status) => {
  if (status === 'delivered') {
    return pool.query(
      `UPDATE bills SET status = 'delivered', delivered_at = NOW()
       WHERE id = ANY($1::int[]) AND status NOT IN ('cancelled', 'delivered')
       RETURNING id, status`,
      [ids]
    );
  }
  return pool.query(
    `UPDATE bills SET status = $1
     WHERE id = ANY($2::int[]) AND status NOT IN ('cancelled')
     RETURNING id, status`,
    [status, ids]
  );
};

// ── Bill Items ────────────────────────────────────────────────

export const getItems = (billId) =>
  pool.query(
    `SELECT bi.*, p.name AS product_name FROM bill_items bi
     JOIN products p ON p.id = bi.product_id
     WHERE bi.bill_id = $1 ORDER BY bi.sort_order, bi.id`,
    [billId]
  );

export const addItem = (client, billId, item) =>
  client.query(
    `INSERT INTO bill_items
       (bill_id, product_id, category_id, description, pricing_model, width, height, sqft, quantity, unit_price, item_total, design_fee, urgent_fee, notes, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING *`,
    [
      billId,
      item.productId   ?? null,
      item.categoryId  ?? null,
      item.description ?? null,
      item.pricingModel,
      item.width       ?? null,
      item.height      ?? null,
      item.sqft        ?? null,
      item.quantity    ?? 1,
      item.unitPrice,
      item.itemTotal,
      item.designFee   ?? 0,
      item.urgentFee   ?? 0,
      item.notes       ?? null,
      item.sortOrder   ?? 0,
    ]
  );

export const updateItem = (client, itemId, billId, item) =>
  client.query(
    `UPDATE bill_items
     SET    product_id    = COALESCE($3, product_id),
            description   = COALESCE($4, description),
            pricing_model = COALESCE($5, pricing_model),
            width         = COALESCE($6, width),
            height        = COALESCE($7, height),
            sqft          = COALESCE($8, sqft),
            quantity      = COALESCE($9, quantity),
            unit_price    = COALESCE($10, unit_price),
            item_total    = COALESCE($11, item_total),
            design_fee    = COALESCE($12, design_fee),
            urgent_fee    = COALESCE($13, urgent_fee),
            notes         = COALESCE($14, notes)
     WHERE  id = $1 AND bill_id = $2
     RETURNING *`,
    [
      itemId, billId,
      item.productId, item.description, item.pricingModel,
      item.width, item.height, item.sqft,
      item.quantity, item.unitPrice, item.itemTotal,
      item.designFee, item.urgentFee, item.notes,
    ]
  );

export const removeItem = (client, itemId, billId) =>
  client.query(
    `DELETE FROM bill_items WHERE id = $1 AND bill_id = $2 RETURNING id`,
    [itemId, billId]
  );

// ── Extra Charges ─────────────────────────────────────────────

export const getExtraCharges = (billId) =>
  pool.query(
    `SELECT id, label, amount FROM bill_extra_charges WHERE bill_id = $1 ORDER BY id`,
    [billId]
  );

export const addExtraCharge = (client, billId, { label, amount }) =>
  client.query(
    `INSERT INTO bill_extra_charges (bill_id, label, amount) VALUES ($1,$2,$3) RETURNING *`,
    [billId, label, amount]
  );

export const removeExtraCharge = (client, chargeId, billId) =>
  client.query(
    `DELETE FROM bill_extra_charges WHERE id = $1 AND bill_id = $2 RETURNING id`,
    [chargeId, billId]
  );
