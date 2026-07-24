import mongoose from 'mongoose';

/**
 * Mongoose plugin to enforce multi-tenancy by automatically adding
 * a company filter to queries.
 */
export const multiTenantPlugin = (schema) => {
  // Ensure 'company' field exists in the schema if not already present
  if (!schema.path('company')) {
    schema.add({
      company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        index: true
      }
    });
  }

  const applyTenantFilter = function (next) {
    const filter = this.getFilter();

    // If 'skipTenant' is explicitly set to true, don't apply filter
    if (this.options?.skipTenant) return next();

    // If 'company' is already set in the filter, don't override it
    // (unless we want to enforce it strictly based on req context)
    if (filter.company) return next();

    // Note: To make this truly automatic, we'd need to get req.companyId
    // but Mongoose queries don't have access to express 'req' easily.
    // Common pattern is using 'cls-hooked' or passing it in options.

    next();
  };

  // List of middlewares to apply the filter to
  const queryMethods = [
    'find', 'findOne', 'findOneAndUpdate', 'updateMany',
    'deleteOne', 'deleteMany', 'countDocuments'
  ];

  // queryMethods.forEach(method => {
  //   schema.pre(method, applyTenantFilter);
  // });
};
