import { Router } from 'express';
import * as ctrl from '../controllers/dashboard.js';
import { asyncWrap } from '../middleware/errorHandler.js';

const router = Router();

router.get('/summary',        asyncWrap(ctrl.getSummary));
router.get('/daily-sales',    asyncWrap(ctrl.getDailySales));
router.get('/monthly-sales',  asyncWrap(ctrl.getMonthlySales));
router.get('/pending-orders', asyncWrap(ctrl.getPendingOrders));
router.get('/top-products',   asyncWrap(ctrl.getTopProducts));
router.get('/stock-alerts',   asyncWrap(ctrl.getStockAlerts));

export default router;
