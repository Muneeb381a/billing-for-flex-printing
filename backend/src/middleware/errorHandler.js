/**
 * Central error handler — last middleware in the chain.
 * Distinguishes operational errors (4xx) from unexpected crashes (5xx).
 */
export const errorHandler = (err, _req, res, _next) => {
  const status  = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  if (process.env.NODE_ENV !== 'production') {
    console.error(`[Error] ${status} — ${message}`, err.stack ?? '');
  }

  res.status(status).json({
    error:   message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

/**
 * Async wrapper — eliminates try/catch boilerplate in every controller.
 * Usage: router.get('/path', asyncWrap(controller.getAll))
 */
export const asyncWrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Create a structured operational error with an HTTP status.
 */
export const createError = (status, message) => {
  const err    = new Error(message);
  err.status   = status;
  return err;
};
