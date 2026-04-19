import * as Q from '../db/queries/subcategories.js';
import { createError } from '../middleware/errorHandler.js';

export const getAll = async (req, res) => {
  const { category_id, active_only = 'true' } = req.query;
  const { rows } = await Q.findAll({
    categoryId: category_id ? Number(category_id) : null,
    activeOnly:  active_only !== 'false',
  });
  res.json({ data: rows });
};

export const getById = async (req, res, next) => {
  const { rows } = await Q.findById(req.params.id);
  if (!rows.length) return next(createError(404, 'Subcategory not found'));
  res.json({ data: rows[0] });
};

export const create = async (req, res, next) => {
  const { categoryId, name, description, sortOrder } = req.body;
  if (!categoryId) return next(createError(400, 'categoryId is required'));
  if (!name?.trim()) return next(createError(400, 'name is required'));
  try {
    const { rows } = await Q.create({ categoryId: Number(categoryId), name, description, sortOrder });
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    if (err.code === '23505') return next(createError(409, `Subcategory "${name}" already exists in this category`));
    throw err;
  }
};

export const update = async (req, res, next) => {
  const { name, description, isActive, sortOrder } = req.body;
  try {
    const { rows } = await Q.update(req.params.id, { name, description, isActive, sortOrder });
    if (!rows.length) return next(createError(404, 'Subcategory not found'));
    res.json({ data: rows[0] });
  } catch (err) {
    if (err.code === '23505') return next(createError(409, 'A subcategory with that name already exists'));
    throw err;
  }
};

export const remove = async (req, res, next) => {
  const { rows } = await Q.remove(req.params.id);
  if (!rows.length) return next(createError(404, 'Subcategory not found'));
  res.json({ success: true });
};
