import pool from '../config/db.js';

const parseRange = (from, to) => {
  const start = from ? new Date(from) : new Date(new Date().setDate(new Date().getDate() - 30));
  const end   = to   ? new Date(new Date(to).setHours(23, 59, 59, 999)) : new Date();
  return [start.toISOString(), end.toISOString()];
};

// Shared helper: parse optional date string for expense queries (YYYY-MM-DD)
const parseDate = (s) => (s ? s : null);

export const getSummary = async (req, res) => {
  const [start, end] = parseRange(req.query.from, req.query.to);

  const { rows } = await pool.query(
    `SELECT
       COUNT(*)                                     AS bill_count,
       COALESCE(SUM(total_amount),      0)          AS total_sales,
       COALESCE(AVG(total_amount),      0)          AS avg_bill,
       COALESCE(SUM(advance_paid),      0)          AS total_collected,
       COALESCE(SUM(remaining_balance), 0)          AS total_outstanding,
       COUNT(*) FILTER (WHERE status = 'pending')   AS pending_count,
       COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress_count,
       COUNT(*) FILTER (WHERE status = 'delivered') AS delivered_count
     FROM bills
     WHERE created_at >= $1 AND created_at <= $2`,
    [start, end]
  );
  res.json({ data: rows[0] });
};

export const getDaily = async (req, res) => {
  const [start, end] = parseRange(req.query.from, req.query.to);

  const { rows } = await pool.query(
    `SELECT
       DATE(created_at)                       AS sale_date,
       COUNT(*)                               AS bill_count,
       COALESCE(SUM(total_amount),      0)    AS total_sales,
       COALESCE(SUM(advance_paid),      0)    AS total_collected
     FROM bills
     WHERE created_at >= $1 AND created_at <= $2
     GROUP BY DATE(created_at)
     ORDER BY sale_date ASC`,
    [start, end]
  );
  res.json({ data: rows });
};

export const getMonthly = async (req, res) => {
  const months = Math.min(Number(req.query.months || 12), 24);

  const { rows } = await pool.query(
    `SELECT
       DATE_TRUNC('month', created_at)             AS month,
       COUNT(*)                                    AS bill_count,
       COALESCE(SUM(total_amount),       0)        AS total_sales,
       COALESCE(SUM(advance_paid),       0)        AS total_collected,
       COALESCE(SUM(remaining_balance),  0)        AS total_outstanding
     FROM bills
     WHERE created_at >= NOW() - ($1 * INTERVAL '1 month')
     GROUP BY DATE_TRUNC('month', created_at)
     ORDER BY month DESC`,
    [months]
  );
  res.json({ data: rows });
};

export const getTopProducts = async (req, res) => {
  const [start, end] = parseRange(req.query.from, req.query.to);
  const limit = Math.min(Number(req.query.limit || 15), 50);

  const { rows } = await pool.query(
    `SELECT
       p.id,
       p.name,
       cat.name                     AS category_name,
       COUNT(bi.id)                 AS order_count,
       COALESCE(SUM(bi.quantity),0) AS total_qty,
       COALESCE(SUM(bi.item_total),0) AS total_revenue
     FROM   bill_items bi
     JOIN   products   p   ON p.id   = bi.product_id
     JOIN   categories cat ON cat.id = p.category_id
     JOIN   bills      b   ON b.id   = bi.bill_id
     WHERE  b.created_at >= $1 AND b.created_at <= $2
     GROUP  BY p.id, p.name, cat.name
     ORDER  BY total_revenue DESC
     LIMIT  $3`,
    [start, end, limit]
  );
  res.json({ data: rows });
};

export const getTopCustomers = async (req, res) => {
  const [start, end] = parseRange(req.query.from, req.query.to);
  const limit = Math.min(Number(req.query.limit || 15), 50);

  const { rows } = await pool.query(
    `SELECT
       c.id,
       c.name                                  AS customer_name,
       c.phone                                 AS customer_phone,
       COUNT(DISTINCT b.id)                    AS bill_count,
       COALESCE(SUM(b.total_amount),      0)   AS total_billed,
       COALESCE(SUM(b.advance_paid),      0)   AS total_paid,
       COALESCE(SUM(b.remaining_balance), 0)   AS total_outstanding,
       COALESCE(AVG(b.total_amount),      0)   AS avg_bill
     FROM customers c
     JOIN bills b ON b.customer_id = c.id
     WHERE b.created_at >= $1 AND b.created_at <= $2
     GROUP BY c.id, c.name, c.phone
     ORDER BY total_billed DESC
     LIMIT $3`,
    [start, end, limit]
  );
  res.json({ data: rows });
};

export const getProfitLoss = async (req, res) => {
  const [start, end] = parseRange(req.query.from, req.query.to);
  const fromDate = req.query.from
    ? new Date(req.query.from).toISOString().split('T')[0]
    : new Date(start).toISOString().split('T')[0];
  const toDate = req.query.to
    ? new Date(req.query.to).toISOString().split('T')[0]
    : new Date(end).toISOString().split('T')[0];

  const [revenueResult, expenseResult, dailyResult] = await Promise.all([
    pool.query(
      `SELECT
         COALESCE(SUM(total_amount),      0) AS total_revenue,
         COALESCE(SUM(advance_paid),      0) AS total_collected,
         COALESCE(SUM(remaining_balance), 0) AS total_outstanding,
         COUNT(*)                            AS bill_count
       FROM bills
       WHERE created_at >= $1 AND created_at <= $2`,
      [start, end]
    ),
    pool.query(
      `SELECT
         COALESCE(SUM(amount), 0) AS total_expenses,
         COUNT(*)                 AS expense_count
       FROM expenses
       WHERE expense_date >= $1::date AND expense_date <= $2::date`,
      [fromDate, toDate]
    ),
    pool.query(
      `SELECT
         d.day::date                                              AS date,
         COALESCE(b.revenue,  0)                                 AS revenue,
         COALESCE(e.expenses, 0)                                 AS expenses,
         COALESCE(b.revenue, 0) - COALESCE(e.expenses, 0)       AS profit
       FROM generate_series(
         $1::date, $2::date, '1 day'::interval
       ) AS d(day)
       LEFT JOIN (
         SELECT DATE(created_at) AS day, SUM(total_amount) AS revenue
         FROM   bills
         WHERE  created_at >= $3 AND created_at <= $4
         GROUP  BY DATE(created_at)
       ) b ON b.day = d.day::date
       LEFT JOIN (
         SELECT expense_date AS day, SUM(amount) AS expenses
         FROM   expenses
         WHERE  expense_date >= $1::date AND expense_date <= $2::date
         GROUP  BY expense_date
       ) e ON e.day = d.day::date
       WHERE b.revenue IS NOT NULL OR e.expenses IS NOT NULL
       ORDER BY d.day ASC`,
      [fromDate, toDate, start, end]
    ),
  ]);

  const rev  = revenueResult.rows[0];
  const exp  = expenseResult.rows[0];
  const totalRevenue  = parseFloat(rev.total_revenue);
  const totalExpenses = parseFloat(exp.total_expenses);

  res.json({
    data: {
      total_revenue:     totalRevenue,
      total_collected:   parseFloat(rev.total_collected),
      total_outstanding: parseFloat(rev.total_outstanding),
      bill_count:        parseInt(rev.bill_count, 10),
      total_expenses:    totalExpenses,
      expense_count:     parseInt(exp.expense_count, 10),
      gross_profit:      totalRevenue - totalExpenses,
      profit_margin:     totalRevenue > 0
        ? parseFloat(((totalRevenue - totalExpenses) / totalRevenue * 100).toFixed(1))
        : 0,
      daily:             dailyResult.rows,
    },
  });
};
