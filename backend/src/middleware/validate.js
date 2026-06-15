import { ApiError } from '../utils/ApiError.js';

/**
 * Joi validation middleware.
 * usage: validate({ body: schema, query: schema, params: schema })
 */
export const validate = (schemas) => (req, _res, next) => {
  for (const key of ['params', 'query', 'body']) {
    if (!schemas[key]) continue;
    const { error, value } = schemas[key].validate(req[key], {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      return next(
        ApiError.badRequest(
          'Validation failed',
          error.details.map((d) => ({ field: d.path.join('.'), message: d.message }))
        )
      );
    }
    req[key] = value;
  }
  next();
};
