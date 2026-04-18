import { Router } from 'express';
import * as ctrl from '../controllers/payments.js';
import { asyncWrap } from '../middleware/errorHandler.js';
import { validate, validateId } from '../middleware/validate.js';

const router = Router();

router.get('/',       asyncWrap(ctrl.getAll));
router.post('/',      validate(['billId', 'amount']), asyncWrap(ctrl.create));
router.delete('/:id', validateId, asyncWrap(ctrl.remove));

export default router;
