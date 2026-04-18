import { createError } from './errorHandler.js';

/**
 * Validate that required fields exist and are non-empty on req.body.
 * Usage: validate(['name', 'phone'])  →  returns an Express middleware
 */
export const validate = (requiredFields) => (req, _res, next) => {
  const missing = requiredFields.filter(
    (field) => req.body[field] === undefined || req.body[field] === null || req.body[field] === ''
  );

  if (missing.length > 0) {
    return next(createError(400, `Missing required fields: ${missing.join(', ')}`));
  }
  next();
};

/**
 * Validate that req.params.id is a positive integer.
 */
export const validateId = (req, _res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return next(createError(400, 'Invalid ID — must be a positive integer'));
  }
  next();
};
