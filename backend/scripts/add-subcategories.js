/**
 * One-time migration: adds subcategories table, links products to subcategories,
 * and seeds realistic product data for a printing press.
 *
 * Safe to run on an existing database — uses IF NOT EXISTS + ON CONFLICT DO NOTHING.
 * Run: node backend/scripts/add-subcategories.js
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join }  from 'path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const { Pool } = pg;
const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host:     process.env.DB_HOST     || 'localhost',
        port:     Number(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME     || 'printing_press',
        user:     process.env.DB_USER     || 'postgres',
        password: process.env.DB_PASSWORD || '',
      }
);

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 1. Create subcategories table ──────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS subcategories (
        id          SERIAL        PRIMARY KEY,
        category_id INTEGER       NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
        name        VARCHAR(255)  NOT NULL,
        description TEXT,
        sort_order  INTEGER       NOT NULL DEFAULT 0,
        is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        UNIQUE (category_id, name)
      );
      CREATE INDEX IF NOT EXISTS idx_subcategories_category ON subcategories (category_id);
    `);
    console.log('✓ subcategories table ready');

    // ── 2. Add subcategory_id to products ──────────────────────
    await client.query(`
      ALTER TABLE products
        ADD COLUMN IF NOT EXISTS subcategory_id INTEGER
          REFERENCES subcategories (id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_products_subcategory_id
        ON products (subcategory_id);
    `);
    console.log('✓ products.subcategory_id column ready');

    // ── 3. Seed subcategories ──────────────────────────────────
    const subcats = [
      // Flex Printing
      { slug: 'flex-printing',    name: 'Star Flex',       sort: 1 },
      { slug: 'flex-printing',    name: 'China Flex',      sort: 2 },
      { slug: 'flex-printing',    name: 'Mesh Flex',       sort: 3 },
      { slug: 'flex-printing',    name: 'Backlit Flex',    sort: 4 },
      // Offset Printing
      { slug: 'offset-printing',  name: 'Business Cards',  sort: 1 },
      { slug: 'offset-printing',  name: 'Flyers',          sort: 2 },
      { slug: 'offset-printing',  name: 'Brochures',       sort: 3 },
      { slug: 'offset-printing',  name: 'Letterheads',     sort: 4 },
      // Digital Printing
      { slug: 'digital-printing', name: 'Stickers',        sort: 1 },
      { slug: 'digital-printing', name: 'Vinyl',           sort: 2 },
      { slug: 'digital-printing', name: 'Photo Prints',    sort: 3 },
      { slug: 'digital-printing', name: 'Banners',         sort: 4 },
    ];

    for (const s of subcats) {
      await client.query(
        `INSERT INTO subcategories (category_id, name, sort_order)
         SELECT id, $2, $3 FROM categories WHERE slug = $1
         ON CONFLICT (category_id, name) DO NOTHING`,
        [s.slug, s.name, s.sort]
      );
    }
    console.log('✓ subcategories seeded');

    // ── 4. Seed realistic products (skip if name already exists) ─
    const products = [
      // Star Flex
      { catSlug: 'flex-printing',    subName: 'Star Flex',      name: 'Star Flex Standard', model: 'area_based',     price: 120, unit: 'sqft' },
      { catSlug: 'flex-printing',    subName: 'Star Flex',      name: 'Star Flex Premium',  model: 'area_based',     price: 140, unit: 'sqft' },
      // China Flex
      { catSlug: 'flex-printing',    subName: 'China Flex',     name: 'China Flex Economy', model: 'area_based',     price:  80, unit: 'sqft' },
      { catSlug: 'flex-printing',    subName: 'China Flex',     name: 'China Flex Standard',model: 'area_based',     price:  90, unit: 'sqft' },
      // Mesh Flex
      { catSlug: 'flex-printing',    subName: 'Mesh Flex',      name: 'Mesh Flex',          model: 'area_based',     price: 110, unit: 'sqft' },
      // Backlit Flex
      { catSlug: 'flex-printing',    subName: 'Backlit Flex',   name: 'Backlit Flex',       model: 'area_based',     price: 150, unit: 'sqft' },
      // Business Cards
      { catSlug: 'offset-printing',  subName: 'Business Cards', name: 'Business Cards 350GSM', model: 'quantity_based', price: null, unit: 'pcs' },
      { catSlug: 'offset-printing',  subName: 'Business Cards', name: 'Business Cards 250GSM', model: 'quantity_based', price: null, unit: 'pcs' },
      // Flyers
      { catSlug: 'offset-printing',  subName: 'Flyers',         name: 'Flyers A5',          model: 'quantity_based', price: null, unit: 'pcs' },
      { catSlug: 'offset-printing',  subName: 'Flyers',         name: 'Flyers A4',          model: 'quantity_based', price: null, unit: 'pcs' },
      // Brochures
      { catSlug: 'offset-printing',  subName: 'Brochures',      name: 'Brochures A4 Tri-Fold', model: 'quantity_based', price: null, unit: 'pcs' },
      // Letterheads
      { catSlug: 'offset-printing',  subName: 'Letterheads',    name: 'Letterhead A4',      model: 'quantity_based', price: null, unit: 'pcs' },
      // Stickers
      { catSlug: 'digital-printing', subName: 'Stickers',       name: 'Vinyl Stickers',     model: 'area_based',     price: 200, unit: 'sqft' },
      { catSlug: 'digital-printing', subName: 'Stickers',       name: 'Paper Stickers',     model: 'area_based',     price: 150, unit: 'sqft' },
      // Vinyl
      { catSlug: 'digital-printing', subName: 'Vinyl',          name: 'Vinyl Banner',           model: 'area_based', price: 180, unit: 'sqft' },
      { catSlug: 'digital-printing', subName: 'Vinyl',          name: 'One-Way Vision Vinyl',   model: 'area_based', price: 250, unit: 'sqft' },
      // Photo Prints
      { catSlug: 'digital-printing', subName: 'Photo Prints',   name: 'Photo Print 4x6',    model: 'fixed_charge',   price:  50, unit: 'pcs' },
      { catSlug: 'digital-printing', subName: 'Photo Prints',   name: 'Photo Print 8x10',   model: 'fixed_charge',   price: 120, unit: 'pcs' },
    ];

    for (const p of products) {
      await client.query(
        `INSERT INTO products (category_id, subcategory_id, name, pricing_model, base_price, unit)
         SELECT
           c.id,
           s.id,
           $3,
           $4::pricing_model_type,
           $5,
           $6
         FROM categories c
         JOIN subcategories s ON s.category_id = c.id AND s.name = $2
         WHERE c.slug = $1
         ON CONFLICT DO NOTHING`,
        [p.catSlug, p.subName, p.name, p.model, p.price, p.unit]
      );
    }
    console.log('✓ products seeded');

    // ── 5. Assign existing legacy products to subcategories ────
    // (only updates rows where subcategory_id is still NULL)
    const legacyMappings = [
      { productName: 'Star Flex',       subcatName: 'Star Flex'      },
      { productName: 'China Flex',      subcatName: 'China Flex'     },
      { productName: 'Backlit Flex',    subcatName: 'Backlit Flex'   },
      { productName: 'Business Cards',  subcatName: 'Business Cards' },
      { productName: 'Flyers A5',       subcatName: 'Flyers'         },
      { productName: 'Brochures A4',    subcatName: 'Brochures'      },
      { productName: 'Vinyl Stickers',  subcatName: 'Stickers'       },
      { productName: 'Photo Print 4x6', subcatName: 'Photo Prints'   },
    ];

    for (const m of legacyMappings) {
      await client.query(
        `UPDATE products
         SET subcategory_id = (SELECT id FROM subcategories WHERE name = $2 LIMIT 1)
         WHERE name = $1 AND subcategory_id IS NULL`,
        [m.productName, m.subcatName]
      );
    }
    console.log('✓ legacy products linked to subcategories');

    // ── 6. Seed quantity tiers for new products ────────────────
    const tierSets = [
      { name: 'Business Cards 350GSM', tiers: [[100,199,500],[200,499,800],[500,999,1500],[1000,null,2500]] },
      { name: 'Business Cards 250GSM', tiers: [[100,199,400],[200,499,650],[500,999,1200],[1000,null,2000]] },
      { name: 'Flyers A4',             tiers: [[100,499,1200],[500,999,3500],[1000,null,6000]] },
      { name: 'Brochures A4 Tri-Fold', tiers: [[100,499,2000],[500,999,6000],[1000,null,10000]] },
      { name: 'Letterhead A4',         tiers: [[100,499,900],[500,999,3000],[1000,null,5000]] },
    ];

    for (const { name, tiers } of tierSets) {
      const { rows } = await client.query(`SELECT id FROM products WHERE name=$1`, [name]);
      if (!rows.length) continue;
      const pid = rows[0].id;
      for (const [min, max, price] of tiers) {
        await client.query(
          `INSERT INTO quantity_tiers (product_id, min_qty, max_qty, price)
           VALUES ($1,$2,$3,$4) ON CONFLICT (product_id, min_qty) DO NOTHING`,
          [pid, min, max, price]
        );
      }
    }
    console.log('✓ quantity tiers seeded');

    // ── 7. Add pricing rules for area_based products ──────────
    const areaPrices = [
      { name: 'Star Flex Standard', pricePerSqft: 120 },
      { name: 'Star Flex Premium',  pricePerSqft: 140 },
      { name: 'China Flex Economy', pricePerSqft:  80 },
      { name: 'China Flex Standard',pricePerSqft:  90 },
      { name: 'Mesh Flex',          pricePerSqft: 110 },
      { name: 'Backlit Flex',       pricePerSqft: 150 },
      { name: 'Vinyl Stickers',     pricePerSqft: 200 },
      { name: 'Paper Stickers',     pricePerSqft: 150 },
      { name: 'Vinyl Banner',       pricePerSqft: 180 },
      { name: 'One-Way Vision Vinyl', pricePerSqft: 250 },
    ];

    for (const { name, pricePerSqft } of areaPrices) {
      const { rows } = await client.query(`SELECT id FROM products WHERE name=$1`, [name]);
      if (!rows.length) continue;
      const pid = rows[0].id;
      const { rows: existingRules } = await client.query(
        `SELECT id FROM pricing_rules WHERE product_id=$1 AND effective_to IS NULL`, [pid]
      );
      if (existingRules.length) continue; // already has a rule
      await client.query(
        `INSERT INTO pricing_rules (product_id, price_per_sqft, min_sqft, effective_from)
         VALUES ($1,$2,1,CURRENT_DATE)`,
        [pid, pricePerSqft]
      );
    }
    console.log('✓ pricing rules seeded');

    await client.query('COMMIT');
    console.log('\n✅ Migration complete — subcategories are live!\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
