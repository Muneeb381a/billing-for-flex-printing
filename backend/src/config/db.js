import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const connectionConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: true,
    }
  : {
      host:     process.env.DB_HOST     || 'localhost',
      port:     Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME     || 'printing_press',
      user:     process.env.DB_USER     || 'postgres',
      password: process.env.DB_PASSWORD || '',
    };

const isNeon = !!process.env.DATABASE_URL;

// Suppress pg-connection-string SSL mode warning on Neon URLs.
// 'uselibpqcompat=true' tells pg to use standard libpq semantics for sslmode.
if (isNeon && connectionConfig.connectionString && !connectionConfig.connectionString.includes('uselibpqcompat')) {
  const u = new URL(connectionConfig.connectionString);
  u.searchParams.set('uselibpqcompat', 'true');
  connectionConfig.connectionString = u.toString();
}

const pool = new Pool({
  ...connectionConfig,
  // Neon free tier: compute suspends after 5 min, takes up to 5s to wake.
  // 30s gives it plenty of room on cold start.
  connectionTimeoutMillis: isNeon ? 30_000 : 5_000,
  // Neon pooler allows 25 concurrent connections on free tier.
  // Keep max low so we don't exhaust them across hot-reload dev cycles.
  max:              isNeon ? 5 : 10,
  // Release idle connections quickly so Neon compute can suspend when idle.
  idleTimeoutMillis: isNeon ? 10_000 : 30_000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

// ── Keep-alive ping (Neon free only) ─────────────────────────
// Neon suspends compute after ~5 min of inactivity. During an active
// server session this ping every 4 min keeps the compute warm so
// user requests don't hit a cold-start delay.
let keepAliveTimer = null;

const startKeepAlive = () => {
  if (!isNeon || keepAliveTimer) return;
  keepAliveTimer = setInterval(async () => {
    try {
      await pool.query('SELECT 1');
    } catch {
      // Ignore — compute may have suspended anyway; next real query wakes it.
    }
  }, 4 * 60 * 1000); // every 4 minutes
  keepAliveTimer.unref(); // don't prevent process exit
};

export const connectDB = async () => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      'SELECT NOW() AS time, current_database() AS db'
    );
    const source = isNeon ? 'Neon (DATABASE_URL)' : 'DB_* vars';
    console.log(`[DB] Connected via ${source} → ${rows[0].db} at ${rows[0].time}`);
    startKeepAlive();
  } finally {
    client.release();
  }
};

export default pool;
