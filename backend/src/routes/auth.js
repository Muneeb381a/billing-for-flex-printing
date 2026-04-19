import { Router } from 'express';
import { login, me } from '../controllers/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncWrap } from '../middleware/errorHandler.js';

const router = Router();

router.post('/login', asyncWrap(login));
router.get('/me',    requireAuth, asyncWrap(me));

export default router;
