import { Router } from 'express';
import { asyncWrap } from '../middleware/errorHandler.js';
import * as ctrl from '../controllers/settings.js';

const router = Router();

router.get('/',  asyncWrap(ctrl.getSettings));
router.put('/',  asyncWrap(ctrl.updateSettings));

export default router;
