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
import * as salesInvoice from '../controllers/salesInvoice.controller.js';
import * as purchase from '../controllers/purchase.controller.js';
import * as inventory from '../controllers/inventory.controller.js';
import * as distributor from '../controllers/distributor.controller.js';
import * as customer from '../controllers/customer.controller.js';
import * as vendor from '../controllers/vendor.controller.js';
import * as payroll from '../controllers/payroll.controller.js';
import * as cheque from '../controllers/cheque.controller.js';
import * as dashboard from '../controllers/dashboard.controller.js';
import * as complaint from '../controllers/complaint.controller.js';
import * as chat from '../controllers/chat.controller.js';
import * as designation from '../controllers/designation.controller.js';
import * as companyConfig from '../controllers/companyConfig.controller.js';
import * as report from '../controllers/report.controller.js';
import * as misc from '../controllers/misc.controller.js';

const r = Router();

const PLATFORM = ['SUPER_ADMIN', 'ADMIN_EMPLOYEE'];
const ALL_STAFF = ['COMPANY_OWNER', 'COMPANY_MANAGER', 'STAFF'];
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
r.post('/auth/request-device-reset', auth.requestDeviceReset);

// ============ DASHBOARDS ============
r.get('/dashboard/super', protect, authorize(...PLATFORM), dashboard.superDashboard);
r.get('/dashboard/company', protect, authorize(...MANAGERS), scopeCompany, dashboard.companyDashboard);
r.get('/dashboard/staff', protect, authorize(...ALL_STAFF), dashboard.staffDashboard);

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
r.patch('/staff/:id/authorize-device-reset', protect, authorize(...MANAGERS), staff.authorizeDeviceReset);
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

// Attendance Requests
r.post('/attendance/requests', protect, authorize('STAFF', 'COMPANY_MANAGER'), attendance.createAttendanceRequest);
r.get('/attendance/requests/me', protect, attendance.myAttendanceRequests);
r.get('/attendance/requests', protect, authorize(...MANAGERS), scopeCompany, attendance.listAttendanceRequests);
r.patch('/attendance/requests/:id/review', protect, authorize(...MANAGERS), attendance.reviewAttendanceRequest);

// ============ LEAVES ============
r.post('/leaves', protect, authorize('STAFF', 'COMPANY_MANAGER'), validate({ body: schemas.applyLeave }), leave.applyLeave);
r.get('/leaves/me', protect, leave.myLeaves);
r.get('/leaves', protect, authorize(...MANAGERS), scopeCompany, leave.listLeaves);
r.patch('/leaves/:id/decision', protect, authorize(...MANAGERS), validate({ body: schemas.decideLeave }), leave.decideLeave);

// ============ SALES (feature-gated) ============
r.post('/sales', protect, authorize(...ALL_STAFF), scopeCompany, requireFeature('salesTracking'), validate({ body: schemas.createSale }), sale.createSale);
r.get('/sales', protect, authorize(...ALL_STAFF), scopeCompany, requireFeature('salesTracking'), sale.listSales);
r.get('/sales/analytics', protect, authorize(...MANAGERS), scopeCompany, requireFeature('salesTracking'), sale.salesAnalytics);
r.get('/sales/me/summary', protect, authorize(...ALL_STAFF), scopeCompany, requireFeature('salesTracking'), sale.mySalesSummary);
r.get('/sales/metadata', protect, authorize(...ALL_STAFF), scopeCompany, requireFeature('salesTracking'), sale.getSalesMetadata);
r.delete('/sales/:id', protect, authorize(...ALL_STAFF), scopeCompany, requireFeature('salesTracking'), sale.deleteSale);
r.patch('/sales/:id', protect, authorize(...ALL_STAFF), scopeCompany, requireFeature('salesTracking'), validate({ body: schemas.updateSale }), sale.updateSale);

// ============ SALES INVOICES ============
r.post('/sales-invoices', protect, authorize(...ALL_STAFF), scopeCompany, validate({ body: schemas.createSalesInvoice }), salesInvoice.createSalesInvoice);
r.get('/sales-invoices', protect, authorize(...MANAGERS), scopeCompany, salesInvoice.listSalesInvoices);
r.get('/sales-invoices/:id', protect, authorize(...MANAGERS), scopeCompany, salesInvoice.getSalesInvoice);
r.patch('/sales-invoices/:id', protect, authorize(...MANAGERS), scopeCompany, salesInvoice.updateSalesInvoice);
r.delete('/sales-invoices/:id', protect, authorize(...OWNERS), scopeCompany, salesInvoice.deleteSalesInvoice);

// ============ PURCHASES ============
r.post('/purchases', protect, authorize(...MANAGERS), scopeCompany, purchase.createPurchase);
r.get('/purchases', protect, authorize(...MANAGERS), scopeCompany, purchase.listPurchases);
r.patch('/purchases/:id', protect, authorize(...MANAGERS), scopeCompany, purchase.updatePurchase);

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
r.get('/distributors/:id', protect, authorize(...MANAGERS), scopeCompany, distributor.getDistributorDetails);
r.get('/distributors/:id/ledger', protect, authorize(...MANAGERS), scopeCompany, distributor.getLedger);

// ============ CHEQUES ============
r.get('/cheques', protect, authorize(...MANAGERS), scopeCompany, cheque.listCheques);
r.post('/cheques', protect, authorize(...MANAGERS), scopeCompany, validate({ body: schemas.chequeBody }), cheque.createCheque);
r.patch('/cheques/:id', protect, authorize(...MANAGERS), scopeCompany, validate({ body: schemas.chequeUpdate }), cheque.updateCheque);
r.delete('/cheques/:id', protect, authorize(...OWNERS), scopeCompany, cheque.deleteCheque);

// ============ BILLING & PAYMENTS ============
r.post('/invoices', protect, authorize(...MANAGERS), scopeCompany, distributor.createInvoice);
r.post('/payments', protect, authorize(...MANAGERS), scopeCompany, distributor.recordPayment);
r.delete('/payments/:id', protect, authorize(...OWNERS), scopeCompany, distributor.deletePayment);

// ============ CUSTOMERS ============
r.get('/customers', protect, scopeCompany, customer.listCustomers);
r.post('/customers', protect, authorize(...ALL_STAFF), scopeCompany, validate({ body: schemas.customerBody }), customer.createCustomer);
r.patch('/customers/:id', protect, authorize(...MANAGERS), scopeCompany, validate({ body: schemas.customerBody }), customer.updateCustomer);
r.delete('/customers/:id', protect, authorize(...OWNERS), scopeCompany, customer.deleteCustomer);

// ============ VENDORS (feature-gated) ============
r.get('/vendors', protect, authorize(...MANAGERS), scopeCompany, requireFeature('vendorManagement'), vendor.listVendors);
r.post('/vendors', protect, authorize(...MANAGERS), scopeCompany, requireFeature('vendorManagement'), vendor.createVendor);
r.get('/vendors/analytics', protect, authorize(...MANAGERS), scopeCompany, requireFeature('vendorManagement'), vendor.vendorAnalytics);
r.get('/vendors/:id', protect, authorize(...MANAGERS), scopeCompany, requireFeature('vendorManagement'), vendor.getVendorDetails);
r.patch('/vendors/:id', protect, authorize(...MANAGERS), scopeCompany, requireFeature('vendorManagement'), vendor.updateVendor);
r.delete('/vendors/:id', protect, authorize(...OWNERS), scopeCompany, requireFeature('vendorManagement'), vendor.deleteVendor);

// ============ VENDOR PAYMENTS ============
r.post('/vendor-payments', protect, authorize(...MANAGERS), scopeCompany, requireFeature('vendorManagement'), vendor.recordVendorPayment);
r.patch('/vendor-payments/:id', protect, authorize(...MANAGERS), scopeCompany, requireFeature('vendorManagement'), vendor.updateVendorPayment);
r.delete('/vendor-payments/:id', protect, authorize(...OWNERS), scopeCompany, requireFeature('vendorManagement'), vendor.deleteVendorPayment);

// ============ PAYROLL ============
r.post('/payroll/generate', protect, authorize(...MANAGERS), scopeCompany, requireFeature('payrollManagement'), validate({ body: schemas.generatePayroll }), payroll.generatePayroll);
r.get('/payroll', protect, scopeCompany, requireFeature('payrollManagement'), payroll.listPayroll);
r.get('/payroll/:id', protect, scopeCompany, requireFeature('payrollManagement'), payroll.getPayroll);
r.patch('/payroll/:id', protect, authorize(...MANAGERS), scopeCompany, requireFeature('payrollManagement'), validate({ body: schemas.updatePayroll }), payroll.updatePayroll);
r.patch('/payroll/:id/pay', protect, authorize(...OWNERS), scopeCompany, requireFeature('payrollManagement'), payroll.markPaid);

// ============ COMPLAINTS ============
r.get('/complaints', protect, complaint.getComplaints);
r.post('/complaints', protect, validate({ body: schemas.complaintBody }), complaint.createComplaint);
r.get('/complaints/recipients', protect, complaint.getRecipients);
r.get('/complaints/:id/messages', protect, complaint.getComplaintMessages);
r.post('/complaints/:id/messages', protect, complaint.addReply);

// ============ CHATS ============
r.get('/chats', protect, chat.getChats);
r.post('/chats', protect, chat.createChat);
r.get('/chats/:id/messages', protect, chat.getChatMessages);
r.post('/chats/:id/messages', protect, chat.addChatMessage);

// ============ DESIGNATIONS ============
r.get('/designations', protect, authorize(...PLATFORM), designation.listDesignations);
r.post('/designations', protect, authorize('SUPER_ADMIN'), designation.createDesignation);
r.patch('/designations/:id', protect, authorize('SUPER_ADMIN'), designation.updateDesignation);
r.delete('/designations/:id', protect, authorize('SUPER_ADMIN'), designation.deleteDesignation);

// ============ COMPANY CONFIGURATION ============
// Company Designations
r.get('/company-config/designations', protect, authorize(...MANAGERS), scopeCompany, companyConfig.listDesignations);
r.post('/company-config/designations', protect, authorize(...MANAGERS), scopeCompany, companyConfig.createDesignation);
r.patch('/company-config/designations/:id', protect, authorize(...MANAGERS), scopeCompany, companyConfig.updateDesignation);
r.delete('/company-config/designations/:id', protect, authorize(...MANAGERS), scopeCompany, companyConfig.deleteDesignation);

// Branches
r.get('/company-config/branches', protect, authorize(...MANAGERS), scopeCompany, companyConfig.listBranches);
r.post('/company-config/branches', protect, authorize(...MANAGERS), scopeCompany, companyConfig.createBranch);
r.patch('/company-config/branches/:id', protect, authorize(...MANAGERS), scopeCompany, companyConfig.updateBranch);
r.delete('/company-config/branches/:id', protect, authorize(...MANAGERS), scopeCompany, companyConfig.deleteBranch);

// Shifts
r.get('/company-config/shifts', protect, authorize(...MANAGERS), scopeCompany, companyConfig.listShifts);
r.post('/company-config/shifts', protect, authorize(...MANAGERS), scopeCompany, companyConfig.createShift);
r.patch('/company-config/shifts/:id', protect, authorize(...MANAGERS), scopeCompany, companyConfig.updateShift);
r.delete('/company-config/shifts/:id', protect, authorize(...MANAGERS), scopeCompany, companyConfig.deleteShift);

// Departments
r.get('/company-config/departments', protect, authorize(...MANAGERS), scopeCompany, companyConfig.listDepartments);
r.post('/company-config/departments', protect, authorize(...MANAGERS), scopeCompany, companyConfig.createDepartment);
r.patch('/company-config/departments/:id', protect, authorize(...MANAGERS), scopeCompany, companyConfig.updateDepartment);
r.delete('/company-config/departments/:id', protect, authorize(...MANAGERS), scopeCompany, companyConfig.deleteDepartment);

// Leave Types
r.get('/company-config/leave-types', protect, authorize(...MANAGERS), scopeCompany, companyConfig.listLeaveTypes);
r.post('/company-config/leave-types', protect, authorize(...MANAGERS), scopeCompany, companyConfig.createLeaveType);
r.patch('/company-config/leave-types/:id', protect, authorize(...MANAGERS), scopeCompany, companyConfig.updateLeaveType);
r.delete('/company-config/leave-types/:id', protect, authorize(...MANAGERS), scopeCompany, companyConfig.deleteLeaveType);

// Holidays
r.get('/company-config/holidays', protect, authorize(...MANAGERS), scopeCompany, companyConfig.listHolidays);
r.post('/company-config/holidays', protect, authorize(...MANAGERS), scopeCompany, companyConfig.createHoliday);
r.patch('/company-config/holidays/:id', protect, authorize(...MANAGERS), scopeCompany, companyConfig.updateHoliday);
r.delete('/company-config/holidays/:id', protect, authorize(...MANAGERS), scopeCompany, companyConfig.deleteHoliday);

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
