import slugify from '../utils/slugify.js';
import * as Q from '../db/queries/categories.js';
import { createError } from '../middleware/errorHandler.js';

export const getAll = async (_req, res) => {
  const { rows } = await Q.findAll();
  res.json({ data: rows });
};

export const getById = async (req, res, next) => {
  const { rows } = await Q.findById(req.params.id);
  if (!rows.length) return next(createError(404, 'Category not found'));
  res.json({ data: rows[0] });
};

export const create = async (req, res, next) => {
  const { name, description, sortOrder } = req.body;
  const slug = slugify(name);

  const existing = await Q.findBySlug(slug);
  if (existing.rows.length) return next(createError(409, `Category slug "${slug}" already exists`));

  const { rows } = await Q.create({ name: name.trim(), slug, description, sortOrder });
  res.status(201).json({ data: rows[0] });
};

export const update = async (req, res, next) => {
  const { name, description, isActive, sortOrder } = req.body;
  const slug = name ? slugify(name) : undefined;

  const { rows } = await Q.update(req.params.id, { name, slug, description, isActive, sortOrder });
  if (!rows.length) return next(createError(404, 'Category not found'));
  res.json({ data: rows[0] });
};

export const remove = async (req, res, next) => {
  const { rows } = await Q.remove(req.params.id);
  if (!rows.length) return next(createError(404, 'Category not found'));
  res.json({ message: 'Category deleted', id: rows[0].id });
};
