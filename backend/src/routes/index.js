import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { authorize, scopeCompany, requireFeature } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { schemas } from './validators.js';

import * as auth from '../controllers/auth.controller.js';
import * as company from '../controllers/company.controller.js';
import * as pkg from '../controllers/package.controller.js';
import * as staff from '../controllers/staff.controller.js';
import * as location from '../controllers/location.controller.js';
import * as attendance from '../controllers/attendance.controller.js';
import * as leave from '../controllers/leave.controller.js';
import * as sale from '../controllers/sale.controller.js';
import * as inventory from '../controllers/inventory.controller.js';
import * as distributor from '../controllers/distributor.controller.js';
import * as vendor from '../controllers/vendor.controller.js';
import * as payroll from '../controllers/payroll.controller.js';
import * as dashboard from '../controllers/dashboard.controller.js';
import * as report from '../controllers/report.controller.js';
import * as misc from '../controllers/misc.controller.js';

const r = Router();

const PLATFORM = ['SUPER_ADMIN', 'ADMIN_EMPLOYEE'];
const MANAGERS = ['SUPER_ADMIN', 'ADMIN_EMPLOYEE', 'COMPANY_OWNER', 'COMPANY_MANAGER'];
const OWNERS = ['SUPER_ADMIN', 'ADMIN_EMPLOYEE', 'COMPANY_OWNER'];

// ============ AUTH ============
r.post('/auth/login', authLimiter, validate({ body: schemas.login }), auth.login);
r.post('/auth/refresh', auth.refresh);
r.post('/auth/logout', auth.logout);
r.post('/auth/forgot-password', authLimiter, validate({ body: schemas.forgotPassword }), auth.forgotPassword);
r.post('/auth/request-password-reset-otp', authLimiter, validate({ body: schemas.requestPasswordResetOtp }), auth.requestPasswordResetOtp);
r.post('/auth/reset-password-with-otp', authLimiter, validate({ body: schemas.resetPasswordWithOtp }), auth.resetPasswordWithOtp);
r.post('/auth/reset-password/:token', authLimiter, validate({ body: schemas.resetPassword }), auth.resetPassword);
r.get('/auth/verify-email/:token', auth.verifyEmail);
r.get('/auth/me', protect, auth.me);
r.get('/auth/settings', misc.getPublicSettings);
r.patch('/auth/change-password', protect, validate({ body: schemas.changePassword }), auth.changePassword);

// ============ DASHBOARDS ============
r.get('/dashboard/super', protect, authorize(...PLATFORM), dashboard.superDashboard);
r.get('/dashboard/company', protect, authorize(...MANAGERS), scopeCompany, dashboard.companyDashboard);
r.get('/dashboard/staff', protect, authorize('STAFF'), dashboard.staffDashboard);

// ============ COMPANIES (Super Admin) ============
r.get('/companies', protect, authorize(...PLATFORM), company.listCompanies);
r.post('/companies', protect, authorize(...PLATFORM), validate({ body: schemas.createCompany }), company.createCompany);
r.get('/companies/me', protect, authorize('COMPANY_OWNER', 'COMPANY_MANAGER'), company.myCompany);
r.patch('/companies/me', protect, authorize('COMPANY_OWNER', 'COMPANY_MANAGER'), validate({ body: schemas.updateCompany }), company.updateMyCompany);
r.get('/companies/:id', protect, authorize(...PLATFORM), company.getCompany);
r.patch('/companies/:id', protect, authorize(...PLATFORM), company.updateCompany);
r.patch('/companies/:id/package', protect, authorize(...PLATFORM), validate({ body: schemas.assignPackage }), company.assignPackage);
r.delete('/companies/:id', protect, authorize('SUPER_ADMIN'), company.deleteCompany);
r.delete('/companies/:id/hard', protect, authorize('SUPER_ADMIN'), company.hardDeleteCompany);

// ============ PACKAGES ============
r.get('/packages', protect, pkg.listPackages);
r.post('/packages', protect, authorize('SUPER_ADMIN'), validate({ body: schemas.packageBody }), pkg.createPackage);
r.get('/packages/:id', protect, authorize(...PLATFORM), pkg.getPackage);
r.patch('/packages/:id', protect, authorize('SUPER_ADMIN'), validate({ body: schemas.packageUpdate }), pkg.updatePackage);
r.delete('/packages/:id', protect, authorize('SUPER_ADMIN'), pkg.deletePackage);

// ============ STAFF / EMPLOYEES ============
r.get('/staff', protect, authorize(...MANAGERS), scopeCompany, staff.listStaff);
r.post('/staff', protect, authorize(...MANAGERS), validate({ body: schemas.createStaff }), staff.createStaff);
r.get('/staff/:id', protect, authorize(...MANAGERS), staff.getStaff);
r.patch('/staff/:id', protect, authorize(...MANAGERS), staff.updateStaff);
r.delete('/staff/:id', protect, authorize(...OWNERS), staff.deleteStaff);
r.delete('/staff/:id/hard', protect, authorize('SUPER_ADMIN', 'COMPANY_OWNER'), staff.hardDeleteStaff);

// ============ LOCATION TRACKING ============
r.post('/locations', protect, authorize('STAFF', 'COMPANY_MANAGER'), validate({ body: schemas.pushLocation }), location.pushLocation);
r.get('/locations/config', protect, authorize('STAFF', 'COMPANY_MANAGER'), requireFeature('employeeTracking'), location.getTrackingConfig);
r.get('/locations/live', protect, authorize(...MANAGERS), scopeCompany, location.liveLocations);
r.get('/locations/heatmap', protect, authorize(...MANAGERS), scopeCompany, location.heatmap);
r.get('/locations/history/:staffId', protect, authorize(...MANAGERS), location.routeHistory);
r.get('/locations/analysis/:staffId', protect, authorize(...MANAGERS), location.movementAnalysis);

// ============ ATTENDANCE ============
r.post('/attendance/check-in', protect, authorize('STAFF', 'COMPANY_MANAGER'), validate({ body: schemas.checkInOut }), attendance.checkIn);
r.post('/attendance/check-out', protect, authorize('STAFF', 'COMPANY_MANAGER'), validate({ body: schemas.checkInOut }), attendance.checkOut);
r.get('/attendance/me', protect, attendance.myAttendance);
r.get('/attendance', protect, authorize(...MANAGERS), scopeCompany, attendance.listAttendance);

// ============ LEAVES ============
r.post('/leaves', protect, authorize('STAFF', 'COMPANY_MANAGER'), validate({ body: schemas.applyLeave }), leave.applyLeave);
r.get('/leaves/me', protect, leave.myLeaves);
r.get('/leaves', protect, authorize(...MANAGERS), scopeCompany, leave.listLeaves);
r.patch('/leaves/:id/decision', protect, authorize(...MANAGERS), validate({ body: schemas.decideLeave }), leave.decideLeave);

// ============ SALES (feature-gated) ============
r.post('/sales', protect, authorize('STAFF', 'COMPANY_MANAGER'), requireFeature('salesTracking'), validate({ body: schemas.createSale }), sale.createSale);
r.get('/sales', protect, scopeCompany, sale.listSales);
r.get('/sales/analytics', protect, authorize(...MANAGERS), scopeCompany, requireFeature('salesTracking'), sale.salesAnalytics);
r.get('/sales/me/summary', protect, authorize('STAFF'), sale.mySalesSummary);

// ============ INVENTORY (feature-gated) ============
r.get('/inventory', protect, authorize(...MANAGERS), scopeCompany, requireFeature('inventoryManagement'), inventory.listInventory);
r.post('/inventory', protect, authorize(...MANAGERS), scopeCompany, requireFeature('inventoryManagement'), validate({ body: schemas.productBody }), inventory.createProduct);
r.post('/inventory/bulk-upload', protect, authorize(...MANAGERS), scopeCompany, requireFeature('inventoryManagement'), inventory.bulkUpload);
r.patch('/inventory/:id', protect, authorize(...MANAGERS), scopeCompany, requireFeature('inventoryManagement'), inventory.updateProduct);
r.post('/inventory/:id/stock', protect, authorize(...MANAGERS), scopeCompany, requireFeature('inventoryManagement'), validate({ body: schemas.adjustStock }), inventory.adjustStock);
r.delete('/inventory/:id', protect, authorize(...OWNERS), scopeCompany, requireFeature('inventoryManagement'), inventory.deleteProduct);
r.delete('/inventory/:id/hard', protect, authorize(...OWNERS), scopeCompany, requireFeature('inventoryManagement'), inventory.hardDeleteProduct);

// ============ DISTRIBUTORS (feature-gated) ============
r.get('/distributors', protect, authorize(...MANAGERS), scopeCompany, requireFeature('vendorManagement'), distributor.listDistributors);
r.post('/distributors', protect, authorize(...MANAGERS), scopeCompany, requireFeature('vendorManagement'), distributor.createDistributor);
r.patch('/distributors/:id', protect, authorize(...MANAGERS), scopeCompany, requireFeature('vendorManagement'), distributor.updateDistributor);
r.delete('/distributors/:id', protect, authorize(...OWNERS), scopeCompany, requireFeature('vendorManagement'), distributor.deleteDistributor);
r.delete('/distributors/:id/hard', protect, authorize(...OWNERS), scopeCompany, requireFeature('vendorManagement'), distributor.hardDeleteDistributor);
r.get('/distributors/analytics', protect, authorize(...MANAGERS), scopeCompany, distributor.distributorAnalytics);
r.get('/distributors/:id/ledger', protect, authorize(...MANAGERS), scopeCompany, distributor.getLedger);

// ============ BILLING & PAYMENTS ============
r.post('/invoices', protect, authorize(...MANAGERS), scopeCompany, distributor.createInvoice);
r.post('/payments', protect, authorize(...MANAGERS), scopeCompany, distributor.recordPayment);

// ============ VENDORS (feature-gated) ============
r.get('/vendors', protect, authorize(...MANAGERS), scopeCompany, requireFeature('vendorManagement'), vendor.listVendors);
r.post('/vendors', protect, authorize(...MANAGERS), scopeCompany, requireFeature('vendorManagement'), vendor.createVendor);
r.patch('/vendors/:id', protect, authorize(...MANAGERS), scopeCompany, requireFeature('vendorManagement'), vendor.updateVendor);
r.delete('/vendors/:id', protect, authorize(...OWNERS), scopeCompany, requireFeature('vendorManagement'), vendor.deleteVendor);

// ============ PAYROLL ============
r.post('/payroll/generate', protect, authorize(...MANAGERS), scopeCompany, requireFeature('payrollManagement'), validate({ body: schemas.generatePayroll }), payroll.generatePayroll);
r.get('/payroll', protect, scopeCompany, requireFeature('payrollManagement'), payroll.listPayroll);
r.get('/payroll/:id', protect, scopeCompany, requireFeature('payrollManagement'), payroll.getPayroll);
r.patch('/payroll/:id', protect, authorize(...MANAGERS), scopeCompany, requireFeature('payrollManagement'), validate({ body: schemas.updatePayroll }), payroll.updatePayroll);
r.patch('/payroll/:id/pay', protect, authorize(...OWNERS), scopeCompany, requireFeature('payrollManagement'), payroll.markPaid);

// ============ REPORTS ============
r.get('/reports/tracking/excel', protect, authorize(...MANAGERS), scopeCompany, report.trackingExcel);
r.get('/reports/attendance/excel', protect, authorize(...MANAGERS), scopeCompany, report.attendanceExcel);
r.get('/reports/sales/excel', protect, authorize(...MANAGERS), scopeCompany, report.salesExcel);
r.get('/reports/payroll/excel', protect, authorize(...MANAGERS), scopeCompany, requireFeature('payrollManagement'), report.payrollExcel);
r.get('/reports/payroll/:payrollId/pdf', protect, authorize(...MANAGERS), scopeCompany, requireFeature('payrollManagement'), report.payrollDetailPdf);
r.get('/reports/employee/:staffId/pdf', protect, authorize(...MANAGERS), report.employeeSummaryPdf);
r.get('/reports/company/:companyId/pdf', protect, authorize(...PLATFORM), report.companySummaryPdf);

// ============ NOTIFICATIONS / SETTINGS / AUDIT ============
r.get('/notifications', protect, misc.myNotifications);
r.patch('/notifications/read', protect, misc.markNotificationsRead);
r.get('/audit-logs', protect, authorize(...PLATFORM), misc.listAuditLogs);
r.get('/settings', protect, authorize(...MANAGERS), misc.getSettings);
r.patch('/settings', protect, authorize('SUPER_ADMIN', 'COMPANY_OWNER'), misc.updateSettings);
r.patch('/profile/me', protect, misc.updateMyProfile);

export default r;
