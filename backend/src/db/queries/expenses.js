import pool from '../../config/db.js';

export const findAll = ({ category = null, from = null, to = null, search = '', limit = 100, offset = 0 } = {}) =>
  pool.query(
    `SELECT e.id, e.title, e.amount, e.category, e.payment_method,
            e.expense_date, e.notes, e.created_at,
            COUNT(*) OVER() AS total_count
     FROM   expenses e
     WHERE  ($1::text IS NULL OR e.category = $1)
       AND  ($2::date IS NULL OR e.expense_date >= $2::date)
       AND  ($3::date IS NULL OR e.expense_date <= $3::date)
       AND  ($4 = '' OR e.title ILIKE $4 OR e.notes ILIKE $4)
     ORDER  BY e.expense_date DESC, e.id DESC
     LIMIT  $5 OFFSET $6`,
    [category, from, to, search ? `%${search}%` : '', limit, offset]
  );

export const findById = (id) =>
  pool.query(`SELECT * FROM expenses WHERE id = $1`, [id]);

export const create = ({ title, amount, category, paymentMethod, expenseDate, notes }) =>
  pool.query(
    `INSERT INTO expenses (title, amount, category, payment_method, expense_date, notes)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [title, amount, category || null, paymentMethod || 'cash', expenseDate || new Date(), notes || null]
  );

export const update = (id, { title, amount, category, paymentMethod, expenseDate, notes }) =>
  pool.query(
    `UPDATE expenses
     SET title = COALESCE($2, title),
         amount = COALESCE($3, amount),
         category = COALESCE($4, category),
         payment_method = COALESCE($5, payment_method),
         expense_date = COALESCE($6, expense_date),
         notes = COALESCE($7, notes)
     WHERE id = $1
     RETURNING *`,
    [id, title, amount, category, paymentMethod, expenseDate, notes]
  );

export const remove = (id) =>
  pool.query(`DELETE FROM expenses WHERE id = $1 RETURNING id`, [id]);

export const getSummary = ({ from = null, to = null } = {}) =>
  pool.query(
    `SELECT
       COALESCE(SUM(amount), 0)                          AS total_expenses,
       COUNT(*)                                           AS expense_count,
       COALESCE(SUM(amount) FILTER (WHERE expense_date >= DATE_TRUNC('month', NOW())), 0) AS this_month,
       COALESCE(SUM(amount) FILTER (WHERE expense_date >= CURRENT_DATE), 0)               AS today
     FROM expenses
     WHERE ($1::date IS NULL OR expense_date >= $1::date)
       AND ($2::date IS NULL OR expense_date <= $2::date)`,
    [from, to]
  );

export const getByCategory = ({ from = null, to = null } = {}) =>
  pool.query(
    `SELECT
       COALESCE(category, 'Uncategorized') AS category,
       COUNT(*)                             AS count,
       COALESCE(SUM(amount), 0)            AS total
     FROM expenses
     WHERE ($1::date IS NULL OR expense_date >= $1::date)
       AND ($2::date IS NULL OR expense_date <= $2::date)
     GROUP BY category
     ORDER BY total DESC`,
    [from, to]
  );
