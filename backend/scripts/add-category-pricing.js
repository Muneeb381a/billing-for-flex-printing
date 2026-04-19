/**
 * Migration: flatten product hierarchy.
 * - Adds pricing_type, rate, unit, min_sqft to categories (categories = sellable items)
 * - Adds category_id to bill_items (product_id made nullable for backward compat)
 * - Adds category_id to quantity_tiers
 * - Adds discount_type, discount_percentage to customers
 * - Seeds flat item-level categories (China Flex, Star Flex, etc.)
 * - Seeds quantity tiers for quantity-based categories
 *
 * Safe to re-run — uses IF NOT EXISTS / ON CONFLICT.
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
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

    // ── 1. Add pricing columns to categories ──────────────────
    await client.query(`
      ALTER TABLE categories
        ADD COLUMN IF NOT EXISTS pricing_type VARCHAR(20) NOT NULL DEFAULT 'area_based',
        ADD COLUMN IF NOT EXISTS rate          NUMERIC(10,2),
        ADD COLUMN IF NOT EXISTS unit          VARCHAR(20) NOT NULL DEFAULT 'sqft',
        ADD COLUMN IF NOT EXISTS min_sqft      NUMERIC(10,3) NOT NULL DEFAULT 1;
    `);
    console.log('✓ categories: pricing columns added');

    // ── 2. Add category_id to bill_items, make product_id nullable ─
    await client.query(`
      ALTER TABLE bill_items
        ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;
    `);
    try {
      await client.query(`ALTER TABLE bill_items ALTER COLUMN product_id DROP NOT NULL`);
    } catch (_) { /* already nullable */ }
    console.log('✓ bill_items: category_id added, product_id made nullable');

    // ── 3. Add category_id to quantity_tiers, make product_id nullable ─
    await client.query(`
      ALTER TABLE quantity_tiers
        ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE;
    `);
    try {
      await client.query(`ALTER TABLE quantity_tiers ALTER COLUMN product_id DROP NOT NULL`);
    } catch (_) { /* already nullable */ }
    console.log('✓ quantity_tiers: category_id added, product_id made nullable');

    // ── 4. Seed flat item-level categories ─────────────────────
    const cats = [
      { name: 'China Flex',     slug: 'china-flex',     pricing_type: 'area_based',     rate: 80,   unit: 'sqft', min_sqft: 1,  sort: 1 },
      { name: 'Star Flex',      slug: 'star-flex',      pricing_type: 'area_based',     rate: 120,  unit: 'sqft', min_sqft: 1,  sort: 2 },
      { name: 'Backlit Flex',   slug: 'backlit-flex',   pricing_type: 'area_based',     rate: 150,  unit: 'sqft', min_sqft: 1,  sort: 3 },
      { name: 'Mesh Flex',      slug: 'mesh-flex',      pricing_type: 'area_based',     rate: 110,  unit: 'sqft', min_sqft: 1,  sort: 4 },
      { name: 'Vinyl',          slug: 'vinyl',          pricing_type: 'area_based',     rate: 180,  unit: 'sqft', min_sqft: 1,  sort: 5 },
      { name: 'Stickers',       slug: 'stickers',       pricing_type: 'area_based',     rate: 200,  unit: 'sqft', min_sqft: 0.25, sort: 6 },
      { name: 'Sublimation',    slug: 'sublimation',    pricing_type: 'area_based',     rate: 160,  unit: 'sqft', min_sqft: 1,  sort: 7 },
      { name: 'Business Cards', slug: 'business-cards', pricing_type: 'quantity_based', rate: null, unit: 'pcs',  min_sqft: 1,  sort: 8 },
      { name: 'Flyers',         slug: 'flyers',         pricing_type: 'quantity_based', rate: null, unit: 'pcs',  min_sqft: 1,  sort: 9 },
      { name: 'Brochures',      slug: 'brochures',      pricing_type: 'quantity_based', rate: null, unit: 'pcs',  min_sqft: 1,  sort: 10 },
      { name: 'Letterheads',    slug: 'letterheads',    pricing_type: 'quantity_based', rate: null, unit: 'pcs',  min_sqft: 1,  sort: 11 },
    ];

    for (const c of cats) {
      await client.query(
        `INSERT INTO categories (name, slug, pricing_type, rate, unit, min_sqft, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (slug) DO UPDATE SET
           pricing_type = EXCLUDED.pricing_type,
           rate         = EXCLUDED.rate,
           unit         = EXCLUDED.unit,
           min_sqft     = EXCLUDED.min_sqft,
           sort_order   = EXCLUDED.sort_order`,
        [c.name, c.slug, c.pricing_type, c.rate, c.unit, c.min_sqft, c.sort]
      );
    }
    console.log('✓ item-level categories seeded');

    // ── 5. Seed quantity tiers for quantity-based categories ───
    const tierGroups = [
      { slug: 'business-cards', tiers: [[100,199,500],[200,499,800],[500,999,1500],[1000,null,2500]] },
      { slug: 'flyers',         tiers: [[100,499,1200],[500,999,3500],[1000,null,6000]] },
      { slug: 'brochures',      tiers: [[100,499,2000],[500,999,6000],[1000,null,10000]] },
      { slug: 'letterheads',    tiers: [[100,499,900],[500,999,3000],[1000,null,5000]] },
    ];

    for (const { slug, tiers } of tierGroups) {
      const { rows } = await client.query(`SELECT id FROM categories WHERE slug=$1`, [slug]);
      if (!rows.length) continue;
      const catId = rows[0].id;
      for (const [min, max, price] of tiers) {
        await client.query(
          `INSERT INTO quantity_tiers (category_id, min_qty, max_qty, price)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT DO NOTHING`,
          [catId, min, max, price]
        );
      }
    }
    console.log('✓ category quantity tiers seeded');

    // ── 6. Add discount fields to customers ────────────────────
    await client.query(`
      ALTER TABLE customers
        ADD COLUMN IF NOT EXISTS discount_type       VARCHAR(20)  NOT NULL DEFAULT 'normal',
        ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 0;
    `);
    console.log('✓ customers: discount columns added');

    await client.query('COMMIT');
    console.log('\n✅ Migration complete!\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
