import pool from '../config/db.js';
import * as Q from '../db/queries/products.js';
import { createError } from '../middleware/errorHandler.js';

// ── Products ──────────────────────────────────────────────────

export const getAll = async (req, res) => {
  const { category_id, subcategory_id, active_only = 'true' } = req.query;
  const { rows } = await Q.findAll({
    categoryId:    category_id    ? Number(category_id)    : null,
    subcategoryId: subcategory_id ? Number(subcategory_id) : null,
    activeOnly:    active_only !== 'false',
  });
  res.json({ data: rows });
};

export const getById = async (req, res, next) => {
  const id = req.params.id;
  const [{ rows: product }, { rows: tiers }, { rows: specs }, { rows: pricingRules }] = await Promise.all([
    Q.findById(id),
    Q.getTiers(id),
    Q.getSpecs(id),
    Q.getPricingRules(id),
  ]);
  if (!product.length) return next(createError(404, 'Product not found'));
  res.json({ data: { ...product[0], tiers, specs, pricingRules } });
};

export const create = async (req, res) => {
  const { categoryId, subcategoryId, name, description, pricingModel, basePrice, unit } = req.body;
  const { rows } = await Q.create({
    categoryId, subcategoryId: subcategoryId || null,
    name: name.trim(), description, pricingModel, basePrice, unit,
  });
  res.status(201).json({ data: rows[0] });
};

export const update = async (req, res, next) => {
  const { categoryId, subcategoryId, name, description, pricingModel, basePrice, unit, isActive } = req.body;
  const { rows } = await Q.update(req.params.id, {
    categoryId, subcategoryId: subcategoryId || null,
    name, description, pricingModel, basePrice, unit, isActive,
  });
  if (!rows.length) return next(createError(404, 'Product not found'));
  res.json({ data: rows[0] });
};

export const remove = async (req, res, next) => {
  const { rows } = await Q.remove(req.params.id);
  if (!rows.length) return next(createError(404, 'Product not found'));
  res.json({ message: 'Product deleted', id: rows[0].id });
};

// ── Quantity Tiers ────────────────────────────────────────────

export const getTiers = async (req, res) => {
  const { rows } = await Q.getTiers(req.params.id);
  res.json({ data: rows });
};

export const addTier = async (req, res) => {
  const { minQty, maxQty, price } = req.body;
  const { rows } = await Q.addTier(req.params.id, { minQty, maxQty, price });
  res.status(201).json({ data: rows[0] });
};

export const removeTier = async (req, res, next) => {
  const { rows } = await Q.removeTier(req.params.tierId, req.params.id);
  if (!rows.length) return next(createError(404, 'Tier not found'));
  res.json({ message: 'Tier deleted', id: rows[0].id });
};

// PATCH /api/products/:id/tiers/bulk
// Body: { tiers: [{ minQty, maxQty?, price }] }
// Atomically replaces all tiers — admin uses this to configure pricing in one shot.
export const replaceTiersBulk = async (req, res, next) => {
  const productId = req.params.id;
  const tiers     = req.body.tiers;

  if (!Array.isArray(tiers)) return next(createError(400, 'tiers must be an array'));

  // Validate each tier
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    if (!t.minQty || t.minQty < 1)      return next(createError(400, `Tier ${i + 1}: minQty must be >= 1`));
    if (t.price == null || t.price < 0) return next(createError(400, `Tier ${i + 1}: price must be >= 0`));
    if (t.maxQty !== undefined && t.maxQty !== null && t.maxQty < t.minQty)
      return next(createError(400, `Tier ${i + 1}: maxQty must be >= minQty`));
  }

  const { rows: product } = await Q.findById(productId);
  if (!product.length) return next(createError(404, 'Product not found'));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rows = await Q.replaceTiers(client, productId, tiers);
    await client.query('COMMIT');
    res.json({ data: rows, count: rows.length });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ── Pricing Rules ─────────────────────────────────────────────

export const getPricingRules = async (req, res) => {
  const { rows } = await Q.getPricingRules(req.params.id);
  res.json({ data: rows });
};

export const addPricingRule = async (req, res) => {
  const { pricePerSqft, minSqft, fixedPrice, effectiveFrom, effectiveTo } = req.body;
  const { rows } = await Q.addPricingRule(req.params.id, { pricePerSqft, minSqft, fixedPrice, effectiveFrom, effectiveTo });
  res.status(201).json({ data: rows[0] });
};

// ── Specifications ────────────────────────────────────────────

export const getSpecs = async (req, res) => {
  const { rows } = await Q.getSpecs(req.params.id);
  res.json({ data: rows });
};

export const upsertSpec = async (req, res) => {
  const { specKey, specValue } = req.body;
  const { rows } = await Q.upsertSpec(req.params.id, specKey, specValue);
  res.json({ data: rows[0] });
};

export const removeSpec = async (req, res, next) => {
  const { rows } = await Q.removeSpec(req.params.id, req.params.specKey);
  if (!rows.length) return next(createError(404, 'Spec not found'));
  res.json({ message: 'Spec deleted' });
};
