import { ApiError } from '../utils/ApiError.js';
import Package from '../models/Package.js';

/** Role gate: authorize('SUPER_ADMIN', 'COMPANY_OWNER') */
export const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());

  const { role, designation } = req.user;

  // Super Admin bypasses everything
  if (role === 'SUPER_ADMIN') return next();

  // If user has a designation, enforce granular permissions
  if (designation?.permissions) {
    const { permissions } = designation;
    const path = req.path; // Note: req.path is relative to the router mount point

    // Platform-level permissions (for ADMIN_EMPLOYEE)
    if (role === 'ADMIN_EMPLOYEE') {
      if (path.includes('/companies') && !permissions.companies) return next(ApiError.forbidden('Access denied: Companies'));
      if (path.includes('/packages') && !permissions.packages) return next(ApiError.forbidden('Access denied: Packages'));
      if (path.includes('/designations') && !permissions.configuration) return next(ApiError.forbidden('Access denied: Platform Config'));
      if (path.includes('/staff') && req.query.scope === 'system' && !permissions.systemEmployees) return next(ApiError.forbidden('Access denied: System Employees'));
      if (path.includes('/staff') && !req.query.scope && !permissions.companyStaff) return next(ApiError.forbidden('Access denied: Company Staff'));
    }

    // Company-level permissions (for STAFF and COMPANY_MANAGER)
    // Owners bypass designation checks within their company
    if (role !== 'COMPANY_OWNER' && role !== 'SUPER_ADMIN') {
      if (path.startsWith('/staff') && !permissions.staff) return next(ApiError.forbidden('Access denied: Staff Management'));
      if (path.startsWith('/locations/live') && !permissions.liveTracking) return next(ApiError.forbidden('Access denied: Live Tracking'));
      if (path.startsWith('/locations/history') && !permissions.liveTracking) return next(ApiError.forbidden('Access denied: Tracking History'));

      if (path.startsWith('/attendance')) {
        const isSelf = path.includes('/me') || path.includes('/check-in') || path.includes('/check-out');
        if (!isSelf && !permissions.attendance) return next(ApiError.forbidden('Access denied: Attendance Management'));
      }

      if (path.startsWith('/leaves')) {
        const isSelf = path.includes('/me') || (req.method === 'POST' && path === '/leaves');
        if (!isSelf && !permissions.leaves) return next(ApiError.forbidden('Access denied: Leave Management'));
      }

      if (path.startsWith('/sales')) {
        const isEntry = path.includes('/me') || path.includes('/metadata') || (req.method === 'POST' && path === '/sales');
        const isOwnList = req.method === 'GET' && path === '/sales' && role === 'STAFF';

        const dept = (designation?.department?.name || '').toLowerCase();
        const isSalesDept = dept.includes('sales') || dept.includes('marketing');

        // Allow entry actions if user has permission OR is in sales/marketing department
        if (!permissions.salesTracker) {
          if (!(isSalesDept && (isEntry || isOwnList))) {
            return next(ApiError.forbidden('Access denied: Sales Management'));
          }
        }
      }

      if (path.startsWith('/inventory') && !permissions.inventory) return next(ApiError.forbidden('Access denied: Inventory'));
      if (path.startsWith('/distributors') && !permissions.distributors) return next(ApiError.forbidden('Access denied: Distributors'));
      if (path.startsWith('/vendors') && !permissions.distributors) return next(ApiError.forbidden('Access denied: Vendors'));
      if (path.startsWith('/payroll') && !permissions.payroll) return next(ApiError.forbidden('Access denied: Payroll'));
      if (path.startsWith('/reports') && !permissions.reports) return next(ApiError.forbidden('Access denied: Reports'));

      if (path.startsWith('/company-config') && !permissions.configuration) return next(ApiError.forbidden('Access denied: Company Config'));
    }
  }

  if (!roles.includes(role)) {
    return next(ApiError.forbidden(`Role mismatch: ${role} not in [${roles.join(', ')}]`));
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
    if (!companyDoc) return next(ApiError.forbidden('No company associated with this account'));

    // Use populated package if available, else fetch it
    let pkg = companyDoc.package;
    if (!pkg) return next(ApiError.forbidden('No package assigned to your company'));

    if (!pkg.features) {
      pkg = await Package.findById(pkg).lean();
    }

    if (!pkg || pkg.status !== 'ACTIVE') return next(ApiError.forbidden('Package inactive or not found'));

    if (!pkg.features?.[feature]) {
      return next(ApiError.forbidden(`Your package does not include this feature (${feature})`));
    }

    req.companyPackage = pkg;
    next();
  } catch (e) {
    next(e);
  }
};
