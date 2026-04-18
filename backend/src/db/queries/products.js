import pool from '../../config/db.js';

// ── Products ──────────────────────────────────────────────────

export const findAll = ({ categoryId = null, activeOnly = true } = {}) =>
  pool.query(
    `SELECT p.id, p.name, p.description, p.pricing_model, p.base_price, p.unit, p.is_active,
            c.id AS category_id, c.name AS category_name, c.slug AS category_slug
     FROM   products p
     JOIN   categories c ON c.id = p.category_id
     WHERE  ($1::int IS NULL OR p.category_id = $1)
       AND  ($2 = FALSE    OR p.is_active = TRUE)
     ORDER  BY c.sort_order, p.name`,
    [categoryId, activeOnly]
  );

export const findById = (id) =>
  pool.query(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug
     FROM   products p
     JOIN   categories c ON c.id = p.category_id
     WHERE  p.id = $1`,
    [id]
  );

export const create = ({ categoryId, name, description = null, pricingModel, basePrice = null, unit = 'sqft' }) =>
  pool.query(
    `INSERT INTO products (category_id, name, description, pricing_model, base_price, unit)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [categoryId, name, description, pricingModel, basePrice, unit]
  );

export const update = (id, { categoryId, name, description, pricingModel, basePrice, unit, isActive }) =>
  pool.query(
    `UPDATE products
     SET    category_id   = COALESCE($2, category_id),
            name          = COALESCE($3, name),
            description   = COALESCE($4, description),
            pricing_model = COALESCE($5, pricing_model),
            base_price    = COALESCE($6, base_price),
            unit          = COALESCE($7, unit),
            is_active     = COALESCE($8, is_active)
     WHERE  id = $1
     RETURNING *`,
    [id, categoryId, name, description, pricingModel, basePrice, unit, isActive]
  );

export const remove = (id) =>
  pool.query(`DELETE FROM products WHERE id = $1 RETURNING id`, [id]);

// ── Quantity Tiers ────────────────────────────────────────────

export const getTiers = (productId) =>
  pool.query(
    `SELECT id, min_qty, max_qty, price
     FROM   quantity_tiers
     WHERE  product_id = $1
     ORDER  BY min_qty ASC`,
    [productId]
  );

export const addTier = (productId, { minQty, maxQty = null, price }) =>
  pool.query(
    `INSERT INTO quantity_tiers (product_id, min_qty, max_qty, price)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [productId, minQty, maxQty, price]
  );

export const removeTier = (tierId, productId) =>
  pool.query(
    `DELETE FROM quantity_tiers WHERE id = $1 AND product_id = $2 RETURNING id`,
    [tierId, productId]
  );

// Atomically replaces ALL tiers for a product.
// Runs inside a passed client so caller controls the transaction.
export const replaceTiers = async (client, productId, tiers) => {
  await client.query(`DELETE FROM quantity_tiers WHERE product_id = $1`, [productId]);
  if (!tiers.length) return [];

  const values = tiers
    .map((_, i) => `($1, $${i * 3 + 2}, $${i * 3 + 3}, $${i * 3 + 4})`)
    .join(', ');

  const params = [productId, ...tiers.flatMap((t) => [t.minQty, t.maxQty ?? null, t.price])];

  const { rows } = await client.query(
    `INSERT INTO quantity_tiers (product_id, min_qty, max_qty, price) VALUES ${values} RETURNING *`,
    params
  );
  return rows;
};

// ── Pricing Rules ─────────────────────────────────────────────

export const getPricingRules = (productId) =>
  pool.query(
    `SELECT id, price_per_sqft, min_sqft, fixed_price, effective_from, effective_to
     FROM   pricing_rules
     WHERE  product_id = $1
     ORDER  BY effective_from DESC`,
    [productId]
  );

export const getActivePricingRule = (productId) =>
  pool.query(
    `SELECT * FROM pricing_rules
     WHERE  product_id = $1
       AND  effective_from <= CURRENT_DATE
       AND  (effective_to IS NULL OR effective_to >= CURRENT_DATE)
     ORDER  BY effective_from DESC
     LIMIT  1`,
    [productId]
  );

export const addPricingRule = (productId, { pricePerSqft = null, minSqft = 1, fixedPrice = null, effectiveFrom, effectiveTo = null }) =>
  pool.query(
    `INSERT INTO pricing_rules (product_id, price_per_sqft, min_sqft, fixed_price, effective_from, effective_to)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [productId, pricePerSqft, minSqft, fixedPrice, effectiveFrom, effectiveTo]
  );

// ── Product Specifications ────────────────────────────────────

export const getSpecs = (productId) =>
  pool.query(
    `SELECT id, spec_key, spec_value FROM product_specifications WHERE product_id = $1 ORDER BY spec_key`,
    [productId]
  );

export const upsertSpec = (productId, specKey, specValue) =>
  pool.query(
    `INSERT INTO product_specifications (product_id, spec_key, spec_value)
     VALUES ($1, $2, $3)
     ON CONFLICT (product_id, spec_key)
     DO UPDATE SET spec_value = EXCLUDED.spec_value
     RETURNING *`,
    [productId, specKey, specValue]
  );

export const removeSpec = (productId, specKey) =>
  pool.query(
    `DELETE FROM product_specifications WHERE product_id = $1 AND spec_key = $2 RETURNING id`,
    [productId, specKey]
  );
