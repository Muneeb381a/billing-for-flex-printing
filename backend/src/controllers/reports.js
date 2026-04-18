import pool from '../config/db.js';

const parseRange = (from, to) => {
  const start = from ? new Date(from) : new Date(new Date().setDate(new Date().getDate() - 30));
  const end   = to   ? new Date(new Date(to).setHours(23, 59, 59, 999)) : new Date();
  return [start.toISOString(), end.toISOString()];
};

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
     WHERE created_at >= NOW() - INTERVAL '${months} months'
     GROUP BY DATE_TRUNC('month', created_at)
     ORDER BY month DESC`
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
