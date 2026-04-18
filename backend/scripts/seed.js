/**
 * Seed script — Printing Press ERP
 *
 * Wipes and re-seeds: categories, products, pricing, customers, bills, payments.
 * Safe to run multiple times — always starts from a clean state.
 *
 * Usage:
 *   node scripts/seed.js
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join }  from 'path';
import pg from 'pg';

// ── Load .env from backend root ───────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const { Pool } = pg;

// ── Build pool using same logic as src/config/db.js ──────────
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

// ── Helpers ───────────────────────────────────────────────────
const log  = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => console.warn(`  ⚠ ${msg}`);

// ── Main ──────────────────────────────────────────────────────
async function seed() {
  const client = await pool.connect();
  console.log('\n[Seed] Connected to database\n');

  try {
    await client.query('BEGIN');

    // ── 1. Wipe existing data (order matters for FK constraints) ──
    console.log('[Seed] Clearing existing data…');
    await client.query(`
      TRUNCATE TABLE
        payments, bill_extra_charges, bill_items, bills,
        customers, quantity_tiers, pricing_rules,
        product_specifications, products, categories
      RESTART IDENTITY CASCADE
    `);
    // Reset the bill number sequence separately (it's not a SERIAL column)
    await client.query(`ALTER SEQUENCE bill_number_seq RESTART WITH 1001`);
    log('All tables cleared and sequences reset');

    // ── 2. Categories ─────────────────────────────────────────
    console.log('\n[Seed] Inserting categories…');

    const { rows: cats } = await client.query(`
      INSERT INTO categories (name, slug, description, sort_order) VALUES
        ('Flex Printing',    'flex-printing',    'Large format flex banners and signage',    1),
        ('Offset Printing',  'offset-printing',  'Business cards, flyers, brochures',        2),
        ('Digital Printing', 'digital-printing', 'Stickers, vinyl, photo prints',            3)
      RETURNING id, slug
    `);

    const catId = Object.fromEntries(cats.map((r) => [r.slug, r.id]));
    log(`Categories: ${cats.map((c) => c.slug).join(', ')}`);

    // ── 3. Products ───────────────────────────────────────────
    console.log('\n[Seed] Inserting products…');

    const { rows: prods } = await client.query(`
      INSERT INTO products (category_id, name, pricing_model, base_price, unit) VALUES
        ($1, 'Star Flex',       'area_based',     25.00, 'sqft'),
        ($1, 'China Flex',      'area_based',     20.00, 'sqft'),
        ($2, 'Business Cards',  'quantity_based',  NULL, 'pcs'),
        ($3, 'Vinyl Stickers',  'quantity_based',  NULL, 'pcs')
      RETURNING id, name
    `, [catId['flex-printing'], catId['offset-printing'], catId['digital-printing']]);

    const prodId = Object.fromEntries(prods.map((r) => [r.name, r.id]));
    log(`Products: ${prods.map((p) => p.name).join(', ')}`);

    // ── 4. Pricing rules (area_based products) ────────────────
    console.log('\n[Seed] Inserting pricing rules…');

    await client.query(`
      INSERT INTO pricing_rules (product_id, price_per_sqft, min_sqft) VALUES
        ($1, 25.00, 1),
        ($2, 20.00, 1)
    `, [prodId['Star Flex'], prodId['China Flex']]);

    log('Pricing rules: Star Flex @ ₨25/sqft, China Flex @ ₨20/sqft');

    // ── 5. Quantity tiers ─────────────────────────────────────
    console.log('\n[Seed] Inserting quantity tiers…');

    // Business Cards — tiered total pricing
    await client.query(`
      INSERT INTO quantity_tiers (product_id, min_qty, max_qty, price) VALUES
        ($1,  100,  499,   500.00),
        ($1,  500,  999,  2000.00),
        ($1, 1000, NULL,  3500.00)
    `, [prodId['Business Cards']]);

    // Vinyl Stickers — ₨15/piece reflected as tiered totals
    await client.query(`
      INSERT INTO quantity_tiers (product_id, min_qty, max_qty, price) VALUES
        ($1,   10,   49,   150.00),
        ($1,   50,   99,   750.00),
        ($1,  100,  499,  1500.00),
        ($1,  500, NULL,  7500.00)
    `, [prodId['Vinyl Stickers']]);

    log('Business Cards: 100→₨500 | 500→₨2000 | 1000→₨3500');
    log('Vinyl Stickers: 10→₨150 | 50→₨750 | 100→₨1500 | 500→₨7500');

    // Business Card specifications
    await client.query(`
      INSERT INTO product_specifications (product_id, spec_key, spec_value) VALUES
        ($1, 'size',           '3.5 x 2 inch'),
        ($1, 'paper_type',     '350 GSM Art Card'),
        ($1, 'printing_sides', 'double'),
        ($1, 'lamination',     'matte')
    `, [prodId['Business Cards']]);

    log('Product specifications inserted');

    // ── 6. Customers ──────────────────────────────────────────
    console.log('\n[Seed] Inserting customers…');

    const { rows: custs } = await client.query(`
      INSERT INTO customers (name, phone, address) VALUES
        ('Ali Raza',   '03001234567', 'Main Boulevard, Faisalabad'),
        ('Ahmed Khan', '03111234567', 'Gulberg III, Lahore'),
        ('Usman Ali',  '03221234567', 'F-7 Markaz, Islamabad')
      RETURNING id, name
    `);

    const custId = Object.fromEntries(custs.map((r) => [r.name, r.id]));
    custs.forEach((c) => log(`Customer: ${c.name} (id=${c.id})`));

    // ── 7. Bill 1 — Ali Raza ──────────────────────────────────
    console.log('\n[Seed] Creating Bill 1 — Ali Raza…');

    const { rows: [b1num] } = await client.query(
      `SELECT generate_bill_number() AS num`
    );

    const { rows: [bill1] } = await client.query(`
      INSERT INTO bills
        (bill_number, customer_id, status, discount_type, discount_value, notes, due_date)
      VALUES ($1, $2, 'in_progress', 'fixed', 200, 'Rush order — needed by weekend', CURRENT_DATE + 3)
      RETURNING id
    `, [b1num.num, custId['Ali Raza']]);

    // Item 1a: Star Flex 3×6 ft, qty 2
    //   sqft per piece = 3×6 = 18, total sqft = 18×2 = 36
    //   item_total = 36 × 25 = ₨900
    await client.query(`
      INSERT INTO bill_items
        (bill_id, product_id, pricing_model, width, height, sqft, quantity, unit_price, item_total, sort_order)
      VALUES ($1, $2, 'area_based', 3, 6, 18, 2, 25.00, 900.00, 0)
    `, [bill1.id, prodId['Star Flex']]);

    // Item 1b: Business Cards 500 pcs → tier = ₨2000
    await client.query(`
      INSERT INTO bill_items
        (bill_id, product_id, pricing_model, quantity, unit_price, item_total, sort_order)
      VALUES ($1, $2, 'quantity_based', 500, 4.00, 2000.00, 1)
    `, [bill1.id, prodId['Business Cards']]);

    // Extra charge: design fee
    await client.query(`
      INSERT INTO bill_extra_charges (bill_id, label, amount)
      VALUES ($1, 'Design Fee', 300.00)
    `, [bill1.id]);

    // Sync totals for bill 1
    // subtotal = 900 + 2000 = 2900
    // extra_charges = 300
    // discount_amount = 200 (fixed)
    // total_amount = 2900 + 300 - 200 = 3000
    // advance = 1000, remaining = 2000
    await client.query(`
      UPDATE bills SET
        subtotal          = 2900.00,
        extra_charges     = 300.00,
        discount_amount   = 200.00,
        total_amount      = 3000.00,
        advance_paid      = 1000.00,
        remaining_balance = 2000.00
      WHERE id = $1
    `, [bill1.id]);

    // Advance payment record
    await client.query(`
      INSERT INTO payments (bill_id, customer_id, amount, payment_method, notes)
      VALUES ($1, $2, 1000.00, 'cash', 'Advance payment on order')
    `, [bill1.id, custId['Ali Raza']]);

    log(`Bill 1 (${b1num.num}): Star Flex 3×6×2 + Business Cards 500pcs`);
    log(`  Subtotal ₨2900 + Extra ₨300 − Discount ₨200 = Total ₨3000`);
    log(`  Advance ₨1000 → Remaining ₨2000`);

    // ── 8. Bill 2 — Ahmed Khan ────────────────────────────────
    console.log('\n[Seed] Creating Bill 2 — Ahmed Khan…');

    const { rows: [b2num] } = await client.query(
      `SELECT generate_bill_number() AS num`
    );

    const { rows: [bill2] } = await client.query(`
      INSERT INTO bills
        (bill_number, customer_id, status, discount_type, discount_value, notes, due_date)
      VALUES ($1, $2, 'pending', 'fixed', 0, 'Standard order', CURRENT_DATE + 7)
      RETURNING id
    `, [b2num.num, custId['Ahmed Khan']]);

    // Item 2a: China Flex 5×4 ft, qty 1
    //   sqft = 5×4 = 20, item_total = 20 × 20 = ₨400
    await client.query(`
      INSERT INTO bill_items
        (bill_id, product_id, pricing_model, width, height, sqft, quantity, unit_price, item_total, sort_order)
      VALUES ($1, $2, 'area_based', 5, 4, 20, 1, 20.00, 400.00, 0)
    `, [bill2.id, prodId['China Flex']]);

    // Item 2b: Vinyl Stickers 100 pcs → tier = ₨1500
    await client.query(`
      INSERT INTO bill_items
        (bill_id, product_id, pricing_model, quantity, unit_price, item_total, sort_order)
      VALUES ($1, $2, 'quantity_based', 100, 15.00, 1500.00, 1)
    `, [bill2.id, prodId['Vinyl Stickers']]);

    // Sync totals for bill 2
    // subtotal = 400 + 1500 = 1900, no discount, no extra
    // total = 1900, advance = 500, remaining = 1400
    await client.query(`
      UPDATE bills SET
        subtotal          = 1900.00,
        extra_charges     = 0.00,
        discount_amount   = 0.00,
        total_amount      = 1900.00,
        advance_paid      = 500.00,
        remaining_balance = 1400.00
      WHERE id = $1
    `, [bill2.id]);

    await client.query(`
      INSERT INTO payments (bill_id, customer_id, amount, payment_method, notes)
      VALUES ($1, $2, 500.00, 'bank_transfer', 'Advance via bank transfer')
    `, [bill2.id, custId['Ahmed Khan']]);

    log(`Bill 2 (${b2num.num}): China Flex 5×4×1 + Vinyl Stickers 100pcs`);
    log(`  Subtotal ₨1900 → Total ₨1900`);
    log(`  Advance ₨500 → Remaining ₨1400`);

    // ── 9. Bill 3 — Usman Ali (fully paid, delivered) ─────────
    console.log('\n[Seed] Creating Bill 3 — Usman Ali (delivered, fully paid)…');

    const { rows: [b3num] } = await client.query(
      `SELECT generate_bill_number() AS num`
    );

    const { rows: [bill3] } = await client.query(`
      INSERT INTO bills
        (bill_number, customer_id, status, discount_type, discount_value,
         notes, due_date, delivered_at)
      VALUES ($1, $2, 'delivered', 'percentage', 10,
              'Repeat customer — 10% loyalty discount',
              CURRENT_DATE - 1, NOW() - INTERVAL '2 hours')
      RETURNING id
    `, [b3num.num, custId['Usman Ali']]);

    // Item 3a: Star Flex 10×4, qty 1 → sqft=40, total = 40×25 = ₨1000
    await client.query(`
      INSERT INTO bill_items
        (bill_id, product_id, pricing_model, width, height, sqft, quantity,
         unit_price, item_total, sort_order)
      VALUES ($1, $2, 'area_based', 10, 4, 40, 1, 25.00, 1000.00, 0)
    `, [bill3.id, prodId['Star Flex']]);

    // Item 3b: Business Cards 1000 pcs → ₨3500
    await client.query(`
      INSERT INTO bill_items
        (bill_id, product_id, pricing_model, quantity, unit_price, item_total, sort_order)
      VALUES ($1, $2, 'quantity_based', 1000, 3.50, 3500.00, 1)
    `, [bill3.id, prodId['Business Cards']]);

    // subtotal = 1000 + 3500 = 4500
    // discount 10% = 450
    // total = 4500 - 450 = 4050
    // fully paid
    await client.query(`
      UPDATE bills SET
        subtotal          = 4500.00,
        extra_charges     = 0.00,
        discount_amount   = 450.00,
        total_amount      = 4050.00,
        advance_paid      = 4050.00,
        remaining_balance = 0.00
      WHERE id = $1
    `, [bill3.id]);

    await client.query(`
      INSERT INTO payments (bill_id, customer_id, amount, payment_method, notes)
      VALUES
        ($1, $2, 2000.00, 'cash',          'First instalment'),
        ($1, $2, 2050.00, 'bank_transfer', 'Final payment — bill cleared')
    `, [bill3.id, custId['Usman Ali']]);

    log(`Bill 3 (${b3num.num}): Star Flex 10×4 + Business Cards 1000pcs`);
    log(`  Subtotal ₨4500 − 10% = Total ₨4050  (Fully paid, Delivered)`);

    // ── Commit ────────────────────────────────────────────────
    await client.query('COMMIT');

    console.log('\n[Seed] ✅ Done! Summary:');
    console.log('  • 3 categories   (Flex, Offset, Digital)');
    console.log('  • 4 products     (Star Flex, China Flex, Business Cards, Vinyl Stickers)');
    console.log('  • 3 customers    (Ali Raza, Ahmed Khan, Usman Ali)');
    console.log('  • 3 bills        (in_progress, pending, delivered)');
    console.log('  • 4 payments');
    console.log('\n  Ready to test the system.\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n[Seed] ❌ Failed — transaction rolled back');
    console.error(`  ${err.message}\n`);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
