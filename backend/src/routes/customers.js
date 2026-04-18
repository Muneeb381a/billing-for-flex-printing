import { Router } from 'express';
import * as ctrl from '../controllers/customers.js';
import { asyncWrap } from '../middleware/errorHandler.js';
import { validate, validateId } from '../middleware/validate.js';

const router = Router();

router.get('/',          asyncWrap(ctrl.getAll));
router.get('/:id',       validateId, asyncWrap(ctrl.getById));
router.get('/:id/ledger',validateId, asyncWrap(ctrl.getLedger));
router.post('/',         validate(['name', 'phone']), asyncWrap(ctrl.create));
router.put('/:id',       validateId, asyncWrap(ctrl.update));
router.delete('/:id',    validateId, asyncWrap(ctrl.remove));

export default router;
