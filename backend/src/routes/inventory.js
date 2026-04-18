import { Router } from 'express';
import { asyncWrap } from '../middleware/errorHandler.js';
import * as ctrl from '../controllers/inventory.js';

const router = Router();

// ── Inventory items ───────────────────────────────────────────
router.get('/',              asyncWrap(ctrl.getAll));
router.get('/alerts',        asyncWrap(ctrl.getAlerts));
router.get('/:id',           asyncWrap(ctrl.getById));
router.post('/',             asyncWrap(ctrl.create));
router.put('/:id',           asyncWrap(ctrl.update));

// ── Stock operations ──────────────────────────────────────────
router.post('/:id/restock',  asyncWrap(ctrl.restock));
router.post('/:id/adjust',   asyncWrap(ctrl.adjust));
router.get('/:id/movements', asyncWrap(ctrl.getMovements));

// ── Product → Inventory mappings (nested under /products) ────
router.get('/product/:productId/mappings',                        asyncWrap(ctrl.getMappings));
router.put('/product/:productId/mappings',                        asyncWrap(ctrl.upsertMapping));
router.delete('/product/:productId/mappings/:inventoryItemId',    asyncWrap(ctrl.deleteMapping));

export default router;
