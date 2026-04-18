/**
 * Migration script — Printing Press ERP
 *
 * Resets and applies database/schema.sql in one atomic operation.
 *
 * Strategy:
 *   1. Drop the public schema (wipes all tables, types, functions, views)
 *   2. Re-create public schema with correct grants
 *   3. Run schema.sql fresh
 *
 * This is safe for a development / cloud database (Neon, Supabase, Railway).
 * It is intentionally destructive — it always starts clean.
 *
 * Usage:
 *   npm run migrate        ← reset schema and apply
 *   npm run seed           ← insert sample data after migrate
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join }  from 'path';
import { readFileSync }   from 'fs';
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

const schemaPath = join(__dirname, '../../database/schema.sql');
const schemaSql  = readFileSync(schemaPath, 'utf8');

async function migrate() {
  console.log('\n[Migrate] Connecting to database…');
  const client = await pool.connect();

  try {
    // ── Step 1: Wipe everything in the public schema ──────────
    console.log('[Migrate] Dropping existing schema (clean slate)…');
    await client.query(`DROP SCHEMA public CASCADE`);
    await client.query(`CREATE SCHEMA public`);

    // Restore default grants that Postgres sets on a fresh schema
    await client.query(`GRANT ALL ON SCHEMA public TO public`);
    await client.query(`GRANT ALL ON SCHEMA public TO current_user`);
    console.log('  ✓ Schema reset');

    // ── Step 2: Apply schema.sql ──────────────────────────────
    console.log('[Migrate] Applying schema.sql…');
    await client.query(schemaSql);
    console.log('  ✓ All tables, types, functions, and views created');

    console.log('\n[Migrate] ✅ Migration complete.');
    console.log('  Next step:  cd backend && npm run seed\n');

  } catch (err) {
    console.error(`\n[Migrate] ❌ Failed: ${err.message}`);
    if (err.detail) console.error(`  Detail: ${err.detail}`);
    console.error(`  Code: ${err.code ?? 'unknown'}\n`);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
