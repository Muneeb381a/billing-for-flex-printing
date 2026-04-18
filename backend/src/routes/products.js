import { Router } from 'express';
import * as ctrl from '../controllers/products.js';
import { asyncWrap } from '../middleware/errorHandler.js';
import { validate, validateId } from '../middleware/validate.js';

const router = Router();

// Products
router.get('/',       asyncWrap(ctrl.getAll));
router.get('/:id',    validateId, asyncWrap(ctrl.getById));
router.post('/',      validate(['categoryId', 'name', 'pricingModel']), asyncWrap(ctrl.create));
router.put('/:id',    validateId, asyncWrap(ctrl.update));
router.delete('/:id', validateId, asyncWrap(ctrl.remove));

// Quantity tiers
router.get('/:id/tiers',             validateId, asyncWrap(ctrl.getTiers));
router.post('/:id/tiers',            validateId, validate(['minQty', 'price']), asyncWrap(ctrl.addTier));
router.patch('/:id/tiers/bulk',      validateId, asyncWrap(ctrl.replaceTiersBulk));   // ← bulk replace
router.delete('/:id/tiers/:tierId',  validateId, asyncWrap(ctrl.removeTier));

// Pricing rules
router.get('/:id/pricing-rules',   validateId, asyncWrap(ctrl.getPricingRules));
router.post('/:id/pricing-rules',  validateId, asyncWrap(ctrl.addPricingRule));

// Specifications
router.get('/:id/specs',               validateId, asyncWrap(ctrl.getSpecs));
router.put('/:id/specs',               validateId, validate(['specKey', 'specValue']), asyncWrap(ctrl.upsertSpec));
router.delete('/:id/specs/:specKey',   validateId, asyncWrap(ctrl.removeSpec));

export default router;
