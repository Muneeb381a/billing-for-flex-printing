import { signJwt } from '../utils/jwt.js';

// ── In-memory rate limiter (brute-force protection) ───────────
// Tracks failed login attempts per IP. Resets after 15 min.
// Note: serverless = per-instance memory; still blocks rapid sequential attacks.
const attempts = new Map();
const MAX_ATTEMPTS = 10;
const WINDOW_MS    = 15 * 60 * 1000;

const checkRateLimit = (ip) => {
  const now = Date.now();
  const rec = attempts.get(ip);

  if (!rec || rec.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false; // not limited
  }
  rec.count++;
  return rec.count > MAX_ATTEMPTS;
};

const clearAttempts = (ip) => attempts.delete(ip);

// ── POST /api/auth/login ──────────────────────────────────────
export const login = (req, res) => {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';

  if (checkRateLimit(ip)) {
    return res.status(429).json({
      error: 'Too many failed attempts. Try again in 15 minutes.',
    });
  }

  const { username = '', password = '' } = req.body;

  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD;

  if (!adminPass) {
    console.error('[Auth] ADMIN_PASSWORD env var is not set!');
    return res.status(500).json({
      error: 'Server is not configured correctly. Contact the administrator.',
    });
  }

  if (username.trim() !== adminUser || password !== adminPass) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  clearAttempts(ip);

  const token = signJwt({ username: adminUser, role: 'admin' });
  return res.json({
    token,
    user: { username: adminUser, role: 'admin' },
  });
};

// ── GET /api/auth/me — verify token + return user ────────────
export const me = (req, res) => {
  // req.user is populated by requireAuth middleware
  res.json({ user: req.user });
};
