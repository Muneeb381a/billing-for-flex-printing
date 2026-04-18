import pool from '../../config/db.js';

export const findAll = ({ billId = null, customerId = null, limit = 50, offset = 0 } = {}) =>
  pool.query(
    `SELECT p.id, p.amount, p.payment_method, p.payment_date, p.reference_number, p.notes, p.created_at,
            b.bill_number, c.name AS customer_name
     FROM   payments p
     JOIN   bills b     ON b.id = p.bill_id
     JOIN   customers c ON c.id = p.customer_id
     WHERE  ($1::int IS NULL OR p.bill_id    = $1)
       AND  ($2::int IS NULL OR p.customer_id = $2)
     ORDER  BY p.payment_date DESC
     LIMIT  $3 OFFSET $4`,
    [billId, customerId, limit, offset]
  );

export const findById = (id) =>
  pool.query(
    `SELECT p.*, b.bill_number, c.name AS customer_name
     FROM payments p
     JOIN bills b ON b.id = p.bill_id
     JOIN customers c ON c.id = p.customer_id
     WHERE p.id = $1`,
    [id]
  );

export const getTotalPaidForBill = (billId) =>
  pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS total_paid FROM payments WHERE bill_id = $1`,
    [billId]
  );

export const create = (client, { billId, customerId, amount, paymentMethod = 'cash', paymentDate, referenceNumber = null, notes = null }) =>
  client.query(
    `INSERT INTO payments (bill_id, customer_id, amount, payment_method, payment_date, reference_number, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [billId, customerId, amount, paymentMethod, paymentDate || new Date(), referenceNumber, notes]
  );

export const remove = (id) =>
  pool.query(`DELETE FROM payments WHERE id = $1 RETURNING id, bill_id, customer_id, amount`, [id]);
