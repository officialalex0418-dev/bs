import { ApiError } from '../utils/ApiError.js';
import Package from '../models/Package.js';

/** Role gate: authorize('SUPER_ADMIN', 'COMPANY_OWNER') */
export const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) {
    return next(ApiError.forbidden(`Requires role: ${roles.join(' / ')}`));
  }
  next();
};

/**
 * Multi-tenant guard: company users may only access their own company data.
 * Super admin / admin employees can pass ?companyId= or access everything.
 * Sets req.companyId for downstream controllers.
 */
export const scopeCompany = (req, _res, next) => {
  const { role, company } = req.user;
  if (role === 'SUPER_ADMIN' || role === 'ADMIN_EMPLOYEE') {
    req.companyId = req.params.companyId || req.query.companyId || null;
  } else {
    if (!company) return next(ApiError.forbidden('No company associated with this account'));
    req.companyId = company._id ? company._id.toString() : company.toString();
  }
  next();
};

/**
 * Feature gate based on company package, e.g. requireFeature('salesTracking').
 * Super admin bypasses.
 */
export const requireFeature = (feature) => async (req, _res, next) => {
  try {
    if (['SUPER_ADMIN', 'ADMIN_EMPLOYEE'].includes(req.user.role)) return next();
    const companyDoc = req.user.company;
    if (!companyDoc?.package) return next(ApiError.forbidden('No package assigned to your company'));
    const pkg = await Package.findById(companyDoc.package).lean();
    if (!pkg || pkg.status !== 'ACTIVE') return next(ApiError.forbidden('Package inactive'));
    if (!pkg.features?.[feature]) {
      return next(ApiError.forbidden(`Your package does not include this feature (${feature})`));
    }
    req.companyPackage = pkg;
    next();
  } catch (e) {
    next(e);
  }
};
