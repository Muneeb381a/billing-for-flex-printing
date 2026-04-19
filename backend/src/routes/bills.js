import { Router } from 'express';
import * as ctrl from '../controllers/bills.js';
import { asyncWrap } from '../middleware/errorHandler.js';
import { validate, validateId } from '../middleware/validate.js';

const router = Router();

// ── Complete bill (atomic: items + charges + advance in one shot) ──
// MUST be before /:id routes to avoid route shadowing
router.post('/complete',            validate(['customerId']), asyncWrap(ctrl.completeBill));

// Bulk status update (must be before /:id to avoid shadowing)
router.post('/bulk-status',         validate(['status']),    asyncWrap(ctrl.bulkStatus));

// Bill number availability check  (?value=AK-2024-55)
router.get('/check-bill-number',    asyncWrap(ctrl.checkBillNumber));

// Bills CRUD
router.get('/',       asyncWrap(ctrl.getAll));
router.get('/:id',    validateId, asyncWrap(ctrl.getById));
router.get('/:id/invoice', validateId, asyncWrap(ctrl.getInvoice));
router.post('/',      validate(['customerId']), asyncWrap(ctrl.create));
router.put('/:id',    validateId, asyncWrap(ctrl.update));
router.delete('/:id', validateId, asyncWrap(ctrl.remove));

// Duplicate bill
router.post('/:id/duplicate', validateId,                              asyncWrap(ctrl.duplicateBill));

// Status & discount
router.patch('/:id/status',   validateId, validate(['status']),        asyncWrap(ctrl.updateStatus));
router.patch('/:id/deliver',  validateId,                              asyncWrap(ctrl.markDelivered));
router.patch('/:id/discount', validateId,                              asyncWrap(ctrl.applyDiscount));

// Bill items
router.post('/:id/items',                 validateId, validate(['productId', 'pricingModel']), asyncWrap(ctrl.addItem));
router.put('/:id/items/:itemId',          validateId, asyncWrap(ctrl.updateItem));
router.delete('/:id/items/:itemId',       validateId, asyncWrap(ctrl.removeItem));

// Extra charges
router.post('/:id/extra-charges',         validateId, validate(['label', 'amount']), asyncWrap(ctrl.addExtraCharge));
router.delete('/:id/extra-charges/:chargeId', validateId, asyncWrap(ctrl.removeExtraCharge));

export default router;
