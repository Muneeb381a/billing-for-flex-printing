import * as Q from '../db/queries/customers.js';
import { createError } from '../middleware/errorHandler.js';

export const getAll = async (req, res) => {
  const { search = '', limit = 50, offset = 0 } = req.query;
  const { rows } = await Q.findAll({ search, limit: Number(limit), offset: Number(offset) });
  res.json({ data: rows, count: rows.length });
};

export const getById = async (req, res, next) => {
  const { rows } = await Q.findById(req.params.id);
  if (!rows.length) return next(createError(404, 'Customer not found'));
  res.json({ data: rows[0] });
};

export const create = async (req, res) => {
  const { name, phone, email, address } = req.body;
  const { rows } = await Q.create({ name: name.trim(), phone: phone.trim(), email, address });
  res.status(201).json({ data: rows[0] });
};

export const update = async (req, res, next) => {
  const { name, phone, email, address } = req.body;
  const { rows } = await Q.update(req.params.id, { name, phone, email, address });
  if (!rows.length) return next(createError(404, 'Customer not found'));
  res.json({ data: rows[0] });
};

export const remove = async (req, res, next) => {
  const { rows } = await Q.remove(req.params.id);
  if (!rows.length) return next(createError(404, 'Customer not found'));
  res.json({ message: 'Customer deleted', id: rows[0].id });
};

export const getLedger = async (req, res, next) => {
  const { rows: ledger } = await Q.getLedger(req.params.id);
  if (!ledger.length) return next(createError(404, 'Customer not found'));
  const { rows: bills }  = await Q.getBillHistory(req.params.id);
  res.json({ data: { ...ledger[0], bills } });
};
