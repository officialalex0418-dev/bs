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
      let permissionChecked = false;
      let permissionGranted = false;

      if (path.startsWith('/staff')) {
        permissionChecked = true;
        permissionGranted = permissions.staff;
      } else if (path.startsWith('/locations/live') || path.startsWith('/locations/history')) {
        permissionChecked = true;
        permissionGranted = permissions.liveTracking;
      } else if (path.startsWith('/attendance')) {
        const isSelf = path.includes('/me') || path.includes('/check-in') || path.includes('/check-out');
        if (!isSelf) {
          permissionChecked = true;
          permissionGranted = permissions.attendance;
        }
      } else if (path.startsWith('/leaves')) {
        const isSelf = path.includes('/me') || (req.method === 'POST' && path === '/leaves');
        if (!isSelf) {
          permissionChecked = true;
          permissionGranted = permissions.leaves;
        }
      } else if (path.startsWith('/sales')) {
        const isEntry = path.includes('/me') || path.includes('/metadata') || (req.method === 'POST' && path === '/sales');
        const isOwnList = req.method === 'GET' && path === '/sales' && role === 'STAFF';
        const dept = (designation?.department?.name || '').toLowerCase();
        const isSalesDept = dept.includes('sales') || dept.includes('marketing');

        if (!(isSalesDept && (isEntry || isOwnList))) {
          permissionChecked = true;
          permissionGranted = permissions.salesTracker;
        }
      } else if (path.startsWith('/inventory')) {
        permissionChecked = true;
        permissionGranted = permissions.inventory;
      } else if (path.startsWith('/distributors') || path.startsWith('/vendors') ||
                 path.startsWith('/cheques') || path.startsWith('/invoices') || path.startsWith('/payments')) {
        permissionChecked = true;
        permissionGranted = permissions.distributors;
      } else if (path.startsWith('/payroll')) {
        permissionChecked = true;
        permissionGranted = permissions.payroll;
      } else if (path.startsWith('/reports')) {
        permissionChecked = true;
        permissionGranted = permissions.reports;

        // Allow specific report exports if they have the base module permission
        if (!permissionGranted) {
          if (path.includes('/tracking') && permissions.liveTracking) permissionGranted = true;
          if (path.includes('/attendance') && permissions.attendance) permissionGranted = true;
          if (path.includes('/sales') && permissions.salesTracker) permissionGranted = true;
          if (path.includes('/payroll') && permissions.payroll) permissionGranted = true;
        }
      } else if (path.startsWith('/company-config')) {
        permissionChecked = true;
        permissionGranted = permissions.configuration;
      }

      if (permissionChecked) {
        if (permissionGranted) return next();
        return next(ApiError.forbidden('Access denied: Granular permission missing'));
      }
    }
  }

  if (!roles.includes(role)) {
    return next(ApiError.forbidden(`Role mismatch: ${role} not in [${roles.join(', ')}]`));
  }

  // Final catch for STAFF: If they are hitting a route meant ONLY for Managers/Owners,
  // they MUST have passed the granular permission check above (which calls return next() early).
  const isManagementRoute = (roles.includes('COMPANY_MANAGER') || roles.includes('COMPANY_OWNER')) && !roles.includes('STAFF');

  if (role === 'STAFF' && isManagementRoute) {
     return next(ApiError.forbidden('Access denied: Staff role requires specific managerial permissions for this route'));
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
