import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export function notFoundHandler(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(err, req, res, _next) {
  let status = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details || null;

  // Mongoose errors → friendly responses
  if (err.name === 'ValidationError') {
    status = 400;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid value for ${err.path}`;
  } else if (err.code === 11000) {
    status = 409;
    const fields = Object.keys(err.keyValue || {});
    message = `Duplicate value for: ${fields.join(', ')}`;
  }

  if (status >= 500) console.error('💥', err);

  res.status(status).json({
    success: false,
    message,
    details,
    ...(env.isProd ? {} : { stack: err.stack }),
  });
}
