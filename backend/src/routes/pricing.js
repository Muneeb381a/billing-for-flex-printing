import { Router } from 'express';
import * as ctrl from '../controllers/pricing.js';
import { asyncWrap } from '../middleware/errorHandler.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// GET /api/pricing/product/:productId
// Returns: pricingModel, inputs schema, activeRule, tiers, specs
router.get('/product/:productId', asyncWrap(ctrl.getProductPricingConfig));

// POST /api/pricing/calculate
// Live single-item price preview (no DB write)
router.post('/calculate', validate(['productId']), asyncWrap(ctrl.calculate));

// POST /api/pricing/estimate
// Full multi-item bill preview with totals (no DB write)
router.post('/estimate', asyncWrap(ctrl.estimate));

// GET /api/pricing/tiers/:productId?qty=500
// Returns tiers + next-tier upgrade guidance
router.get('/tiers/:productId', asyncWrap(ctrl.getTiersWithGuidance));

export default router;
