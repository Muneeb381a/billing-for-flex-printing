import pool from '../../config/db.js';

export const findAll = ({ categoryId = null, activeOnly = true } = {}) =>
  pool.query(
    `SELECT s.id, s.name, s.description, s.sort_order, s.is_active, s.created_at,
            s.category_id,
            c.name AS category_name, c.slug AS category_slug,
            COUNT(p.id)::int AS product_count
     FROM   subcategories s
     JOIN   categories c ON c.id = s.category_id
     LEFT JOIN products p ON p.subcategory_id = s.id AND p.is_active = TRUE
     WHERE  ($1::int IS NULL OR s.category_id = $1)
       AND  ($2 = FALSE    OR s.is_active = TRUE)
     GROUP  BY s.id, c.name, c.slug, c.sort_order, s.sort_order
     ORDER  BY c.sort_order, s.sort_order, s.name`,
    [categoryId, activeOnly]
  );

export const findById = (id) =>
  pool.query(
    `SELECT s.*, c.name AS category_name, c.slug AS category_slug
     FROM   subcategories s
     JOIN   categories c ON c.id = s.category_id
     WHERE  s.id = $1`,
    [id]
  );

export const create = ({ categoryId, name, description = null, sortOrder = 0 }) =>
  pool.query(
    `INSERT INTO subcategories (category_id, name, description, sort_order)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [categoryId, name.trim(), description, sortOrder]
  );

export const update = (id, { name, description, isActive, sortOrder }) =>
  pool.query(
    `UPDATE subcategories
     SET    name        = COALESCE($2, name),
            description = COALESCE($3, description),
            is_active   = COALESCE($4, is_active),
            sort_order  = COALESCE($5, sort_order)
     WHERE  id = $1
     RETURNING *`,
    [id, name, description, isActive, sortOrder]
  );

export const remove = (id) =>
  pool.query(
    `DELETE FROM subcategories WHERE id = $1 RETURNING id`,
    [id]
  );
