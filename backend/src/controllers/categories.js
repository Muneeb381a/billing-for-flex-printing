import slugify from '../utils/slugify.js';
import * as Q from '../db/queries/categories.js';
import pool from '../config/db.js';
import { createError } from '../middleware/errorHandler.js';

const PRICING_TYPES = ['area_based', 'quantity_based', 'fixed_charge', 'custom'];
const PRICING_MODES = ['per_unit', 'total'];
const UNITS         = ['sqft', 'pcs', 'set', 'sheet', 'm2'];

export const getAll = async (req, res) => {
  const { admin } = req.query;
  const { rows } = admin === 'true' ? await Q.findAllAdmin() : await Q.findAll();
  res.json({ data: rows });
};

export const getById = async (req, res, next) => {
  const { rows } = await Q.findById(req.params.id);
  if (!rows.length) return next(createError(404, 'Category not found'));
  res.json({ data: rows[0] });
};

export const create = async (req, res, next) => {
  const { name, description, pricingType, pricingMode, rate, unit, minSqft, sortOrder } = req.body;
  if (!name?.trim()) return next(createError(400, 'name is required'));
  if (pricingType && !PRICING_TYPES.includes(pricingType))
    return next(createError(400, `pricingType must be one of: ${PRICING_TYPES.join(', ')}`));
  if (pricingMode && !PRICING_MODES.includes(pricingMode))
    return next(createError(400, `pricingMode must be one of: ${PRICING_MODES.join(', ')}`));

  const slug = slugify(name);
  const existing = await Q.findBySlug(slug);
  if (existing.rows.length) return next(createError(409, `Category "${name}" already exists`));

  const { rows } = await Q.create({
    name: name.trim(), slug, description,
    pricingType:  pricingType  || 'area_based',
    pricingMode:  pricingMode  || 'total',
    rate:         rate     != null ? parseFloat(rate)    : null,
    unit:         unit     || 'sqft',
    minSqft:      minSqft  != null ? parseFloat(minSqft) : 1,
    sortOrder:    sortOrder != null ? parseInt(sortOrder) : 0,
  });
  res.status(201).json({ data: rows[0] });
};

export const update = async (req, res, next) => {
  const { name, description, isActive, pricingType, pricingMode, rate, unit, minSqft, sortOrder } = req.body;
  if (pricingType && !PRICING_TYPES.includes(pricingType))
    return next(createError(400, `pricingType must be one of: ${PRICING_TYPES.join(', ')}`));
  if (pricingMode && !PRICING_MODES.includes(pricingMode))
    return next(createError(400, `pricingMode must be one of: ${PRICING_MODES.join(', ')}`));

  const slug = name ? slugify(name) : undefined;
  const { rows } = await Q.update(req.params.id, {
    name, slug, description, isActive, pricingType,
    pricingMode: pricingMode || undefined,
    rate:        rate     != null ? parseFloat(rate)    : undefined,
    unit,
    minSqft:     minSqft  != null ? parseFloat(minSqft) : undefined,
    sortOrder:   sortOrder != null ? parseInt(sortOrder) : undefined,
  });
  if (!rows.length) return next(createError(404, 'Category not found'));
  res.json({ data: rows[0] });
};

export const remove = async (req, res, next) => {
  const { rows } = await Q.remove(req.params.id);
  if (!rows.length) return next(createError(404, 'Category not found'));
  res.json({ message: 'Category deleted', id: rows[0].id });
};

// ── Tier management ────────────────────────────────────────────
export const replaceTiers = async (req, res, next) => {
  const { id } = req.params;
  const { tiers = [] } = req.body;
  if (!Array.isArray(tiers)) return next(createError(400, 'tiers must be an array'));

  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    if (!t.minQty || t.minQty < 1) return next(createError(400, `Tier ${i+1}: minQty must be >= 1`));
    if (t.price == null || t.price < 0) return next(createError(400, `Tier ${i+1}: price must be >= 0`));
  }

  const { rows: cat } = await Q.findById(id);
  if (!cat.length) return next(createError(404, 'Category not found'));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rows = await Q.replaceTiers(client, id, tiers);
    await client.query('COMMIT');
    res.json({ data: rows, count: rows.length });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
