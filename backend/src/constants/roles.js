export const ROLES = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN_EMPLOYEE: 'ADMIN_EMPLOYEE', // system employees: Admin / HR / Support / Finance
  COMPANY_OWNER: 'COMPANY_OWNER',
  COMPANY_MANAGER: 'COMPANY_MANAGER',
  STAFF: 'STAFF',
});

export const ADMIN_EMPLOYEE_SUBROLES = Object.freeze(['ADMIN', 'HR', 'SUPPORT', 'FINANCE']);

export const PLATFORM_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN_EMPLOYEE];
export const COMPANY_ROLES = [ROLES.COMPANY_OWNER, ROLES.COMPANY_MANAGER];
export const ALL_ROLES = Object.values(ROLES);

export const PACKAGE_FEATURES = Object.freeze({
  EMPLOYEE_TRACKING: 'employeeTracking',
  INVENTORY: 'inventoryManagement',
  VENDOR: 'vendorManagement',
  PAYROLL: 'payrollManagement',
  SALES: 'salesTracking',
});

export const TRACKING_INTERVALS = Object.freeze([30, 60, 120]); // minutes

export const LEAVE_TYPES = Object.freeze(['PAID', 'UNPAID', 'SICK']);
export const LEAVE_STATUS = Object.freeze(['PENDING', 'APPROVED', 'REJECTED']);
