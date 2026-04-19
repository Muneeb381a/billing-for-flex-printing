import { Router } from 'express';
import * as ctrl from '../controllers/expenses.js';
import { asyncWrap } from '../middleware/errorHandler.js';
import { validateId } from '../middleware/validate.js';

const router = Router();

router.get('/summary',      asyncWrap(ctrl.getSummary));
router.get('/by-category',  asyncWrap(ctrl.getByCategory));
router.get('/',             asyncWrap(ctrl.getAll));
router.get('/:id',          validateId, asyncWrap(ctrl.getOne));
router.post('/',            asyncWrap(ctrl.create));
router.put('/:id',          validateId, asyncWrap(ctrl.update));
router.delete('/:id',       validateId, asyncWrap(ctrl.remove));

export default router;
