import { Router } from 'express';
import { asyncWrap } from '../middleware/errorHandler.js';
import * as ctrl from '../controllers/reports.js';

const router = Router();

router.get('/summary',        asyncWrap(ctrl.getSummary));
router.get('/daily',          asyncWrap(ctrl.getDaily));
router.get('/monthly',        asyncWrap(ctrl.getMonthly));
router.get('/top-products',   asyncWrap(ctrl.getTopProducts));
router.get('/top-customers',  asyncWrap(ctrl.getTopCustomers));
router.get('/profit-loss',    asyncWrap(ctrl.getProfitLoss));

export default router;
