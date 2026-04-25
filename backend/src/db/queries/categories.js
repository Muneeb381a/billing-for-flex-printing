import pool from '../../config/db.js';

export const findAll = () =>
  pool.query(
    `SELECT c.id, c.name, c.slug, c.description, c.pricing_type, c.pricing_mode, c.rate, c.unit,
            c.min_sqft, c.is_active, c.sort_order, c.created_at,
            COALESCE(
              json_agg(
                jsonb_build_object('id', qt.id, 'min_qty', qt.min_qty, 'max_qty', qt.max_qty, 'price', qt.price::text)
                ORDER BY qt.min_qty
              ) FILTER (WHERE qt.id IS NOT NULL),
              '[]'::json
            ) AS tiers
     FROM   categories c
     LEFT   JOIN quantity_tiers qt ON qt.category_id = c.id
     WHERE  c.is_active = TRUE
     GROUP  BY c.id
     ORDER  BY c.sort_order ASC, c.name ASC`
  );

export const findAllAdmin = () =>
  pool.query(
    `SELECT c.id, c.name, c.slug, c.description, c.pricing_type, c.pricing_mode, c.rate, c.unit,
            c.min_sqft, c.is_active, c.sort_order, c.created_at,
            COALESCE(
              json_agg(
                jsonb_build_object('id', qt.id, 'min_qty', qt.min_qty, 'max_qty', qt.max_qty, 'price', qt.price::text)
                ORDER BY qt.min_qty
              ) FILTER (WHERE qt.id IS NOT NULL),
              '[]'::json
            ) AS tiers
     FROM   categories c
     LEFT   JOIN quantity_tiers qt ON qt.category_id = c.id
     GROUP  BY c.id
     ORDER  BY c.sort_order ASC, c.name ASC`
  );

export const findById = (id) =>
  pool.query(
    `SELECT c.id, c.name, c.slug, c.description, c.pricing_type, c.pricing_mode, c.rate, c.unit,
            c.min_sqft, c.is_active, c.sort_order, c.created_at,
            COALESCE(
              json_agg(
                jsonb_build_object('id', qt.id, 'min_qty', qt.min_qty, 'max_qty', qt.max_qty, 'price', qt.price::text)
                ORDER BY qt.min_qty
              ) FILTER (WHERE qt.id IS NOT NULL),
              '[]'::json
            ) AS tiers
     FROM   categories c
     LEFT   JOIN quantity_tiers qt ON qt.category_id = c.id
     WHERE  c.id = $1
     GROUP  BY c.id`,
    [id]
  );

export const findBySlug = (slug) =>
  pool.query(`SELECT * FROM categories WHERE slug = $1`, [slug]);

export const create = ({ name, slug, description = null, pricingType = 'area_based', pricingMode = 'total', rate = null, unit = 'sqft', minSqft = 1, sortOrder = 0 }) =>
  pool.query(
    `INSERT INTO categories (name, slug, description, pricing_type, pricing_mode, rate, unit, min_sqft, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [name, slug, description, pricingType, pricingMode, rate, unit, minSqft, sortOrder]
  );

export const update = (id, { name, slug, description, isActive, pricingType, pricingMode, rate, unit, minSqft, sortOrder }) =>
  pool.query(
    `UPDATE categories
     SET    name         = COALESCE($2, name),
            slug         = COALESCE($3, slug),
            description  = COALESCE($4, description),
            is_active    = COALESCE($5, is_active),
            pricing_type = COALESCE($6, pricing_type),
            pricing_mode = COALESCE($7, pricing_mode),
            rate         = COALESCE($8, rate),
            unit         = COALESCE($9, unit),
            min_sqft     = COALESCE($10, min_sqft),
            sort_order   = COALESCE($11, sort_order)
     WHERE  id = $1
     RETURNING *`,
    [id, name, slug, description, isActive, pricingType, pricingMode, rate, unit, minSqft, sortOrder]
  );

export const remove = (id) =>
  pool.query(`DELETE FROM categories WHERE id = $1 RETURNING id`, [id]);

// ── Category Tiers ─────────────────────────────────────────────
export const getTiers = (categoryId) =>
  pool.query(
    `SELECT id, min_qty, max_qty, price FROM quantity_tiers
     WHERE category_id = $1 ORDER BY min_qty ASC`,
    [categoryId]
  );

export const replaceTiers = async (client, categoryId, tiers) => {
  await client.query(`DELETE FROM quantity_tiers WHERE category_id = $1`, [categoryId]);
  if (!tiers.length) return [];
  const values = tiers.map((_, i) => `($1, $${i*3+2}, $${i*3+3}, $${i*3+4})`).join(', ');
  const params  = [categoryId, ...tiers.flatMap((t) => [t.minQty, t.maxQty ?? null, t.price])];
  const { rows } = await client.query(
    `INSERT INTO quantity_tiers (category_id, min_qty, max_qty, price) VALUES ${values} RETURNING *`,
    params
  );
  return rows;
};
