import { Router } from 'express';
import { asyncWrap } from '../middleware/errorHandler.js';
import { validateId } from '../middleware/validate.js';
import pool from '../config/db.js';

const router = Router();

// ── GET /api/ledger ───────────────────────────────────────────
// Bill-level ledger across all customers.
// Supports search (bill#, customer name/phone), paymentStatus filter,
// and from/to date range.  Returns summary totals + paginated bill rows.
//
// Performance note: the category_summary correlated subquery runs once
// per bill but is indexed by bill_id, so it stays fast even at thousands
// of bills. The summary query hits only the customer_ledger view (aggregated).

router.get('/', asyncWrap(async (req, res) => {
  const { search = '', paymentStatus, from, to, limit = 200, offset = 0 } = req.query;

  const q        = search.trim() ? `%${search.trim()}%` : null;
  const status   = paymentStatus || null;
  const fromDate = from || null;
  const toDate   = to   || null;

  const [{ rows: summary }, { rows: bills }] = await Promise.all([
    // Overall financial totals (not filtered — always reflects full book)
    pool.query(
      `SELECT
         COALESCE(SUM(total_billed),       0) AS total_billed,
         COALESCE(SUM(total_paid),         0) AS total_paid,
         COALESCE(SUM(outstanding_balance),0) AS total_outstanding
       FROM customer_ledger`
    ),

    // Bill-level rows with customer name and category summary
    pool.query(
      `SELECT
         b.id,
         b.bill_number,
         b.status,
         b.total_amount,
         b.advance_paid,
         b.remaining_balance,
         b.created_at,
         b.due_date,
         c.id    AS customer_id,
         c.name  AS customer_name,
         c.phone,

         -- Category names for all items in this bill (no product table)
         (
           SELECT COALESCE(STRING_AGG(DISTINCT cat.name, ', ' ORDER BY cat.name), '—')
           FROM   bill_items bi
           JOIN   categories cat ON cat.id = bi.category_id
           WHERE  bi.bill_id = b.id
         ) AS category_summary,

         -- Payment status derived from remaining balance
         CASE
           WHEN b.remaining_balance <= 0 THEN 'paid'
           WHEN b.advance_paid        > 0 THEN 'partial'
           ELSE                                'unpaid'
         END AS payment_status,

         -- Overdue: still has balance AND past due date (default: 30 days)
         CASE
           WHEN b.remaining_balance > 0
            AND COALESCE(b.due_date,
                         (b.created_at + INTERVAL '30 days')::date
                ) < CURRENT_DATE
           THEN TRUE ELSE FALSE
         END AS is_overdue,

         -- Days since bill creation (unpaid bills only)
         CASE
           WHEN b.remaining_balance > 0
           THEN (CURRENT_DATE - DATE(b.created_at))
         END AS days_outstanding

       FROM   bills b
       JOIN   customers c ON c.id = b.customer_id

       WHERE  ($1::text IS NULL
               OR c.name ILIKE $1 OR c.phone ILIKE $1 OR b.bill_number ILIKE $1)
         AND  ($2::text IS NULL OR
               CASE
                 WHEN b.remaining_balance <= 0 THEN 'paid'
                 WHEN b.advance_paid        > 0 THEN 'partial'
                 ELSE                                'unpaid'
               END = $2)
         AND  ($3::date IS NULL OR DATE(b.created_at) >= $3)
         AND  ($4::date IS NULL OR DATE(b.created_at) <= $4)

       ORDER  BY b.created_at DESC
       LIMIT  $5 OFFSET $6`,
      [q, status, fromDate, toDate, Number(limit), Number(offset)]
    ),
  ]);

  res.json({ summary: summary[0], data: bills });
}));

// ── GET /api/ledger/:customerId ───────────────────────────────
// One customer: profile + summary + all bills with payments.
//
// Query params:
//   paymentStatus  'paid' | 'partial' | 'unpaid'
//   from           YYYY-MM-DD  (bill created_at range start)
//   to             YYYY-MM-DD  (bill created_at range end)
//   overdueOnly    'true'

router.get('/:id', validateId, asyncWrap(async (req, res, next) => {
  const id              = Number(req.params.id);
  const { paymentStatus, from, to, overdueOnly } = req.query;

  // ── 1. Fetch customer + summary in parallel ───────────────
  const [{ rows: customer }, { rows: summary }] = await Promise.all([
    pool.query(
      `SELECT id, name, phone, email, address, created_at FROM customers WHERE id = $1`,
      [id]
    ),
    pool.query(
      `SELECT * FROM customer_ledger WHERE customer_id = $1`,
      [id]
    ),
  ]);

  if (!customer.length) {
    const { createError } = await import('../middleware/errorHandler.js');
    return next(createError(404, 'Customer not found'));
  }

  // ── 2. Bills query — CTE so we can filter on computed cols ─
  //
  // Why CTE and not subquery?
  // payment_status is computed from SUM(payments). Postgres doesn't allow
  // WHERE aliases from the same SELECT level, so we need one wrap.
  //
  // product_summary: correlated subquery per bill — acceptable because
  // it runs only over bill_items for this one customer's bills.
  // Using STRING_AGG(DISTINCT) prevents duplicates when a product appears
  // multiple times in one bill.
  //
  // No N+1: all payments are aggregated inside the CTE with JSON_AGG.
  // The entire ledger is loaded in 2 round-trips regardless of bill count.

  const { rows: bills } = await pool.query(
    `
    WITH bill_data AS (
      SELECT
        b.id,
        b.bill_number,
        b.status,
        b.total_amount,
        b.advance_paid,
        b.remaining_balance,
        b.discount_type,
        b.discount_value,
        b.discount_amount,
        b.notes,
        b.due_date,
        b.delivered_at,
        b.created_at,

        -- Aggregate payments for this bill (no N+1)
        COALESCE(SUM(p.amount), 0) AS total_paid,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id',               p.id,
            'amount',           p.amount,
            'payment_method',   p.payment_method,
            'payment_date',     p.payment_date,
            'reference_number', p.reference_number,
            'notes',            p.notes
          ) ORDER BY p.payment_date ASC
        ) FILTER (WHERE p.id IS NOT NULL) AS payments,

        -- Category summary for this bill — joins categories directly, no product table
        (
          SELECT COALESCE(STRING_AGG(DISTINCT cat.name, ', ' ORDER BY cat.name), '—')
          FROM   bill_items bi
          JOIN   categories cat ON cat.id = bi.category_id
          WHERE  bi.bill_id = b.id
        ) AS category_summary,

        -- Payment status: derived, never stored
        CASE
          WHEN b.remaining_balance <= 0                      THEN 'paid'
          WHEN COALESCE(SUM(p.amount), 0) > 0               THEN 'partial'
          ELSE                                                    'unpaid'
        END AS payment_status,

        -- Overdue: unpaid AND past due_date (or 30 days old if no due_date)
        CASE
          WHEN b.remaining_balance > 0
           AND COALESCE(b.due_date,
                        (b.created_at + INTERVAL '30 days')::date
               ) < CURRENT_DATE
          THEN TRUE
          ELSE FALSE
        END AS is_overdue,

        -- How many days since bill creation (only for unpaid bills)
        CASE
          WHEN b.remaining_balance > 0
          THEN (CURRENT_DATE - DATE(b.created_at))
        END AS days_outstanding

      FROM   bills b
      LEFT   JOIN payments p ON p.bill_id = b.id
      WHERE  b.customer_id = $1
      GROUP  BY b.id
    )
    SELECT * FROM bill_data
    WHERE  ($2::text  IS NULL OR payment_status = $2)
      AND  ($3::date  IS NULL OR DATE(created_at) >= $3)
      AND  ($4::date  IS NULL OR DATE(created_at) <= $4)
      AND  ($5::bool  IS NULL OR ($5 = FALSE) OR is_overdue = TRUE)
    ORDER  BY
      is_overdue  DESC,          -- overdue bills surface first
      created_at  DESC
    `,
    [
      id,
      paymentStatus || null,
      from          || null,
      to            || null,
      overdueOnly === 'true' ? true : null,
    ]
  );

  // ── 3. Derived summary counts ─────────────────────────────
  const overdueCount  = bills.filter((b) => b.is_overdue).length;
  const unpaidCount   = bills.filter((b) => b.payment_status === 'unpaid').length;
  const partialCount  = bills.filter((b) => b.payment_status === 'partial').length;

  const summaryRow = summary[0] ?? {
    customer_id: id, total_bills: 0,
    total_billed: 0, total_paid: 0, outstanding_balance: 0,
  };

  res.json({
    data: {
      customer:    customer[0],
      summary: {
        ...summaryRow,
        overdue_count: overdueCount,
        unpaid_count:  unpaidCount,
        partial_count: partialCount,
      },
      bills,
    },
  });
}));

export default router;
