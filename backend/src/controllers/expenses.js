import * as Q from '../db/queries/expenses.js';
import { createError } from '../middleware/errorHandler.js';

export const getAll = async (req, res) => {
  const { category, from, to, search = '', limit = 100, offset = 0 } = req.query;
  const { rows } = await Q.findAll({ category, from, to, search, limit: Number(limit), offset: Number(offset) });
  const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;
  res.json({ data: rows, count: rows.length, total });
};

export const getOne = async (req, res, next) => {
  const { rows } = await Q.findById(req.params.id);
  if (!rows.length) return next(createError(404, 'Expense not found'));
  res.json({ data: rows[0] });
};

export const create = async (req, res, next) => {
  const { title, amount, category, paymentMethod, expenseDate, notes } = req.body;
  if (!title || amount == null) return next(createError(400, 'title and amount are required'));
  if (isNaN(Number(amount)) || Number(amount) < 0) return next(createError(400, 'amount must be a non-negative number'));
  const { rows } = await Q.create({ title, amount: Number(amount), category, paymentMethod, expenseDate, notes });
  res.status(201).json({ data: rows[0] });
};

export const update = async (req, res, next) => {
  const { rows: existing } = await Q.findById(req.params.id);
  if (!existing.length) return next(createError(404, 'Expense not found'));
  const { title, amount, category, paymentMethod, expenseDate, notes } = req.body;
  if (amount != null && (isNaN(Number(amount)) || Number(amount) < 0)) {
    return next(createError(400, 'amount must be a non-negative number'));
  }
  const { rows } = await Q.update(req.params.id, {
    title, amount: amount != null ? Number(amount) : undefined, category, paymentMethod, expenseDate, notes,
  });
  res.json({ data: rows[0] });
};

export const remove = async (req, res, next) => {
  const { rows } = await Q.remove(req.params.id);
  if (!rows.length) return next(createError(404, 'Expense not found'));
  res.json({ success: true });
};

export const getSummary = async (req, res) => {
  const { from, to } = req.query;
  const { rows } = await Q.getSummary({ from, to });
  res.json({ data: rows[0] });
};

export const getByCategory = async (req, res) => {
  const { from, to } = req.query;
  const { rows } = await Q.getByCategory({ from, to });
  res.json({ data: rows });
};
