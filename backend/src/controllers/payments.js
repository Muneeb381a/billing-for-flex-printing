import pool from '../config/db.js';
import * as Q from '../db/queries/payments.js';
import * as BillQ from '../db/queries/bills.js';
import { createError } from '../middleware/errorHandler.js';
import { calcBillTotals } from '../utils/pricing.js';

export const getAll = async (req, res) => {
  const { bill_id, customer_id, limit = 50, offset = 0 } = req.query;
  const { rows } = await Q.findAll({
    billId:     bill_id     ? Number(bill_id)     : null,
    customerId: customer_id ? Number(customer_id) : null,
    limit:      Number(limit),
    offset:     Number(offset),
  });
  res.json({ data: rows });
};

export const create = async (req, res, next) => {
  const { billId, amount, paymentMethod, paymentDate, referenceNumber, notes } = req.body;

  const { rows: bill } = await BillQ.findById(billId);
  if (!bill.length) return next(createError(404, 'Bill not found'));

  if (bill[0].status === 'cancelled') {
    return next(createError(400, 'Cannot add payment to a cancelled bill'));
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: payment } = await Q.create(client, {
      billId,
      customerId:      bill[0].customer_id,
      amount,
      paymentMethod:   paymentMethod || 'cash',
      paymentDate,
      referenceNumber,
      notes,
    });

    // Recalculate remaining balance
    const { rows: items }        = await client.query(`SELECT item_total, design_fee, urgent_fee FROM bill_items WHERE bill_id = $1`, [billId]);
    const { rows: extraCharges } = await client.query(`SELECT amount FROM bill_extra_charges WHERE bill_id = $1`, [billId]);
    const { rows: paid }         = await client.query(`SELECT COALESCE(SUM(amount),0) AS total_paid FROM payments WHERE bill_id = $1`, [billId]);

    const totals = calcBillTotals({
      items,
      extraCharges,
      discountType:  bill[0].discount_type,
      discountValue: bill[0].discount_value,
      totalPaid:     paid[0].total_paid,
    });

    await client.query(
      `UPDATE bills SET advance_paid = $2, remaining_balance = $3 WHERE id = $1`,
      [billId, paid[0].total_paid, totals.remainingBalance]
    );

    // Auto-mark as completed when fully paid
    if (totals.remainingBalance <= 0 && bill[0].status === 'pending') {
      await client.query(`UPDATE bills SET status = 'completed' WHERE id = $1`, [billId]);
    }

    await client.query('COMMIT');
    res.status(201).json({ data: payment[0], remainingBalance: totals.remainingBalance });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const remove = async (req, res, next) => {
  const { rows } = await Q.remove(req.params.id);
  if (!rows.length) return next(createError(404, 'Payment not found'));

  // Recalculate bill remaining balance after deletion
  const billId = rows[0].bill_id;
  const { rows: paid } = await Q.getTotalPaidForBill(billId);
  const { rows: bill } = await BillQ.findById(billId);
  if (bill.length) {
    const remaining = parseFloat(bill[0].total_amount) - parseFloat(paid[0].total_paid);
    await pool.query(
      `UPDATE bills SET advance_paid = $2, remaining_balance = $3 WHERE id = $1`,
      [billId, paid[0].total_paid, remaining]
    );
  }

  res.json({ message: 'Payment deleted', id: rows[0].id });
};
