/**
 * Minimal JWT (HS256) — zero external dependencies, uses Node.js built-in crypto.
 * Compatible with any standard JWT verifier on the frontend or tooling.
 */
import { createHmac } from 'crypto';

const b64u = (str) =>
  Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

const b64uDecode = (str) =>
  Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

const getSecret = () => {
  const s = process.env.JWT_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === 'production')
      throw new Error('JWT_SECRET env var is not set — refusing to start in production');
    console.warn('[JWT] ⚠ JWT_SECRET not set — using insecure dev default. Set it before going live.');
    return 'dev-only-insecure-secret-replace-me';
  }
  return s;
};

/**
 * Sign a JWT. Default expiry: 7 days.
 */
export const signJwt = (payload, expiresInSeconds = 7 * 24 * 3600) => {
  const secret  = getSecret();
  const header  = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body    = b64u(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  }));
  const sig     = b64u(createHmac('sha256', secret).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
};

/**
 * Verify a JWT. Throws on invalid signature or expiry.
 * Returns the decoded payload on success.
 */
export const verifyJwt = (token) => {
  const parts = token?.split('.');
  if (parts?.length !== 3) throw new Error('Malformed token');

  const [header, body, sig] = parts;
  const expected = b64u(createHmac('sha256', getSecret()).update(`${header}.${body}`).digest());

  if (sig !== expected) throw new Error('Invalid signature');

  const payload = JSON.parse(b64uDecode(body));
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');

  return payload;
};
