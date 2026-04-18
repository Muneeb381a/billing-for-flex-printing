import pool from '../../config/db.js';

export const findAll = () =>
  pool.query(
    `SELECT id, name, slug, description, is_active, sort_order, created_at
     FROM   categories
     ORDER  BY sort_order ASC, name ASC`
  );

export const findById = (id) =>
  pool.query(
    `SELECT id, name, slug, description, is_active, sort_order, created_at
     FROM   categories WHERE id = $1`,
    [id]
  );

export const findBySlug = (slug) =>
  pool.query(`SELECT * FROM categories WHERE slug = $1`, [slug]);

export const create = ({ name, slug, description = null, sortOrder = 0 }) =>
  pool.query(
    `INSERT INTO categories (name, slug, description, sort_order)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, slug, description, sortOrder]
  );

export const update = (id, { name, slug, description, isActive, sortOrder }) =>
  pool.query(
    `UPDATE categories
     SET    name        = COALESCE($2, name),
            slug        = COALESCE($3, slug),
            description = COALESCE($4, description),
            is_active   = COALESCE($5, is_active),
            sort_order  = COALESCE($6, sort_order)
     WHERE  id = $1
     RETURNING *`,
    [id, name, slug, description, isActive, sortOrder]
  );

export const remove = (id) =>
  pool.query(`DELETE FROM categories WHERE id = $1 RETURNING id`, [id]);
