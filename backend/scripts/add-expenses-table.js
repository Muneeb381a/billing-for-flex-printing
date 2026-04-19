/**
 * One-time migration: adds the expenses table to an existing database.
 * Run once: node backend/scripts/add-expenses-table.js
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
    await client.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id             SERIAL PRIMARY KEY,
        title          VARCHAR(255)    NOT NULL,
        amount         NUMERIC(12, 2)  NOT NULL CHECK (amount >= 0),
        category       VARCHAR(100),
        payment_method payment_method  NOT NULL DEFAULT 'cash',
        expense_date   DATE            NOT NULL DEFAULT CURRENT_DATE,
        notes          TEXT,
        created_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_expenses_date     ON expenses (expense_date DESC);
      CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses (category);
    `);
    console.log('✅ expenses table ready');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((e) => { console.error('❌', e.message); process.exit(1); });
