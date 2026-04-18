import pool from '../../config/db.js';

export const getSummary = () =>
  pool.query(
    `SELECT
       -- Today's sales
       (SELECT COALESCE(SUM(total_amount), 0) FROM bills WHERE DATE(created_at) = CURRENT_DATE)                     AS today_sales,
       (SELECT COUNT(*)                        FROM bills WHERE DATE(created_at) = CURRENT_DATE)                     AS today_bill_count,
       -- This month
       (SELECT COALESCE(SUM(total_amount), 0) FROM bills WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())) AS month_sales,
       (SELECT COUNT(*)                       FROM bills WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())) AS month_bill_count,
       -- Pending orders
       (SELECT COUNT(*) FROM bills WHERE status = 'pending')     AS pending_count,
       (SELECT COUNT(*) FROM bills WHERE status = 'in_progress') AS in_progress_count,
       -- Outstanding balances
       (SELECT COALESCE(SUM(remaining_balance), 0) FROM bills WHERE remaining_balance > 0) AS total_outstanding,
       -- Total customers
       (SELECT COUNT(*) FROM customers)                           AS total_customers`
  );

export const getDailySales = ({ days = 30 } = {}) =>
  pool.query(
    `SELECT * FROM daily_sales
     WHERE sale_date >= CURRENT_DATE - INTERVAL '${days} days'
     ORDER BY sale_date DESC`
  );

export const getMonthlySales = ({ months = 12 } = {}) =>
  pool.query(
    `SELECT
       DATE_TRUNC('month', created_at)           AS month,
       COUNT(id)                                 AS bill_count,
       COALESCE(SUM(total_amount), 0)            AS total_sales,
       COALESCE(SUM(advance_paid), 0)            AS total_collected,
       COALESCE(SUM(remaining_balance), 0)       AS total_outstanding
     FROM bills
     WHERE created_at >= NOW() - INTERVAL '${months} months'
     GROUP BY DATE_TRUNC('month', created_at)
     ORDER BY month DESC`
  );

export const getPendingOrders = ({ limit = 20 } = {}) =>
  pool.query(
    `SELECT b.id, b.bill_number, b.status, b.total_amount, b.remaining_balance,
            b.due_date, b.created_at,
            c.name AS customer_name, c.phone AS customer_phone
     FROM   bills b
     JOIN   customers c ON c.id = b.customer_id
     WHERE  b.status IN ('pending', 'in_progress')
     ORDER  BY b.due_date ASC NULLS LAST, b.created_at ASC
     LIMIT  $1`,
    [limit]
  );

export const getStockAlerts = () =>
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
       current_stock ASC
     LIMIT 10`
  );

export const getTopProducts = ({ limit = 10, days = 30 } = {}) =>
  pool.query(
    `SELECT p.id, p.name, cat.name AS category_name,
            COUNT(bi.id)               AS order_count,
            SUM(bi.quantity)           AS total_qty,
            SUM(bi.item_total)         AS total_revenue
     FROM   bill_items bi
     JOIN   products   p   ON p.id   = bi.product_id
     JOIN   categories cat ON cat.id = p.category_id
     JOIN   bills      b   ON b.id   = bi.bill_id
     WHERE  b.created_at >= NOW() - INTERVAL '${days} days'
     GROUP  BY p.id, p.name, cat.name
     ORDER  BY total_revenue DESC
     LIMIT  $1`,
    [limit]
  );
