import { verifyJwt } from '../utils/jwt.js';

/**
 * Express middleware — verifies the Bearer token on every protected request.
 * Attaches `req.user = { username, role }` on success.
 * Returns 401 JSON on missing, malformed, or expired token.
 */
export const requireAuth = (req, res, next) => {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    req.user = verifyJwt(header.slice(7));
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session — please log in again' });
  }
};
