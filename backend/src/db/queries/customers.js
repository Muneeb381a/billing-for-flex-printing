import pool from '../../config/db.js';

export const findAll = ({ search = '', limit = 50, offset = 0 } = {}) => {
  const term = `%${search}%`;
  return pool.query(
    `SELECT id, name, phone, email, address, discount_type, discount_percentage, created_at
     FROM   customers
     WHERE  ($1 = '' OR name ILIKE $1 OR phone ILIKE $1)
     ORDER  BY name ASC
     LIMIT  $2 OFFSET $3`,
    [term, limit, offset]
  );
};

export const findById = (id) =>
  pool.query(
    `SELECT id, name, phone, email, address, discount_type, discount_percentage, created_at, updated_at
     FROM   customers
     WHERE  id = $1`,
    [id]
  );

export const create = ({ name, phone, email = null, address = null, discountType = 'normal', discountPercentage = 0 }) =>
  pool.query(
    `INSERT INTO customers (name, phone, email, address, discount_type, discount_percentage)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [name, phone, email, address, discountType, discountPercentage]
  );

export const update = (id, { name, phone, email, address, discountType, discountPercentage }) =>
  pool.query(
    `UPDATE customers
     SET    name                = COALESCE($2, name),
            phone               = COALESCE($3, phone),
            email               = COALESCE($4, email),
            address             = COALESCE($5, address),
            discount_type       = COALESCE($6, discount_type),
            discount_percentage = COALESCE($7, discount_percentage)
     WHERE  id = $1
     RETURNING *`,
    [id, name, phone, email, address, discountType, discountPercentage]
  );

export const remove = (id) =>
  pool.query(`DELETE FROM customers WHERE id = $1 RETURNING id`, [id]);

export const getLedger = (customerId) =>
  pool.query(
    `SELECT * FROM customer_ledger WHERE customer_id = $1`,
    [customerId]
  );

export const getBillHistory = (customerId) =>
  pool.query(
    `SELECT b.id, b.bill_number, b.status, b.total_amount,
            b.advance_paid, b.remaining_balance, b.created_at,
            COALESCE(SUM(p.amount), 0) AS total_paid
     FROM   bills b
     LEFT   JOIN payments p ON p.bill_id = b.id
     WHERE  b.customer_id = $1
     GROUP  BY b.id
     ORDER  BY b.created_at DESC`,
    [customerId]
  );
