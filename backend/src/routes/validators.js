import Joi from 'joi';

const objectId = Joi.string().hex().length(24);
const password = Joi.string().min(8).max(128)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z0-9])/)
  .message('Password must be 8+ chars with mixed case or numbers');

export const schemas = {
  // ---- Auth ----
  login: Joi.object({ email: Joi.string().email().required(), password: Joi.string().required() }),
  forgotPassword: Joi.object({ email: Joi.string().email().required() }),
  requestPasswordResetOtp: Joi.object({ email: Joi.string().email().required() }),
  resetPasswordWithOtp: Joi.object({
    email: Joi.string().email().required(),
    otp: Joi.string().pattern(/^\d{6}$/).required(),
    password: password.required(),
  }),
  resetPassword: Joi.object({ password: password.required() }),
  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: password.required(),
  }),

  // ---- Company ----
  createCompany: Joi.object({
    name: Joi.string().max(200).required(),
    address: Joi.string().max(300).allow(''),
    panVat: Joi.string().max(30).allow(''),
    phone: Joi.string().max(20).allow(''),
    email: Joi.string().email().required(),
    logo: Joi.string().allow('', null),
    packageId: objectId.allow(null, ''),
    ownerName: Joi.string().max(120).required(),
    ownerEmail: Joi.string().email().required(),
  }),
  updateCompany: Joi.object({
    name: Joi.string().max(200),
    address: Joi.string().max(300).allow(''),
    panVat: Joi.string().max(30).allow(''),
    phone: Joi.string().max(20).allow(''),
    email: Joi.string().email(),
    logo: Joi.string().allow('', null),
  }),
  assignPackage: Joi.object({ packageId: objectId.required() }),

  // ---- Package ----
  packageBody: Joi.object({
    name: Joi.string().max(100).required(),
    description: Joi.string().max(500).allow(''),
    price: Joi.number().min(0).default(0),
    maxStaff: Joi.number().integer().min(1).required(),
    trackingIntervalMinutes: Joi.number().valid(30, 60, 120).default(60),
    features: Joi.object({
      employeeTracking: Joi.boolean(),
      inventoryManagement: Joi.boolean(),
      vendorManagement: Joi.boolean(),
      payrollManagement: Joi.boolean(),
      salesTracking: Joi.boolean(),
    }),
    status: Joi.string().valid('ACTIVE', 'INACTIVE'),
  }),
  packageUpdate: Joi.object({
    name: Joi.string().max(100),
    description: Joi.string().max(500).allow(''),
    price: Joi.number().min(0),
    maxStaff: Joi.number().integer().min(1),
    trackingIntervalMinutes: Joi.number().valid(30, 60, 120),
    features: Joi.object({
      employeeTracking: Joi.boolean(),
      inventoryManagement: Joi.boolean(),
      vendorManagement: Joi.boolean(),
      payrollManagement: Joi.boolean(),
      salesTracking: Joi.boolean(),
    }),
    status: Joi.string().valid('ACTIVE', 'INACTIVE'),
  }),

  // ---- Staff ----
  createStaff: Joi.object({
    name: Joi.string().max(120).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().max(20).allow(''),
    address: Joi.string().max(300).allow(''),
    pan: Joi.string().max(30).allow(''),
    position: Joi.string().max(100).allow(''),
    basicSalary: Joi.number().min(0).default(0),
    dailyAllowance: Joi.number().min(0).default(0),
    monthlyTarget: Joi.number().min(0).default(0),
    role: Joi.string().valid('STAFF', 'COMPANY_MANAGER', 'ADMIN_EMPLOYEE'),
    subRole: Joi.string().valid('ADMIN', 'HR', 'SUPPORT', 'FINANCE').allow(null),
    companyId: objectId.allow(null, ''),
  }),

  // ---- Location ----
  pushLocation: Joi.object({
    latitude: Joi.number().min(-90).max(90),
    longitude: Joi.number().min(-180).max(180),
    accuracy: Joi.number().min(0),
    batteryLevel: Joi.number().min(0).max(100),
    deviceInfo: Joi.object({
      platform: Joi.string(), model: Joi.string(),
      osVersion: Joi.string(), appVersion: Joi.string(),
    }),
    recordedAt: Joi.date(),
    source: Joi.string().valid('BACKGROUND', 'CHECKIN', 'CHECKOUT', 'MANUAL'),
    pings: Joi.array().items(Joi.object({
      latitude: Joi.number().min(-90).max(90).required(),
      longitude: Joi.number().min(-180).max(180).required(),
      accuracy: Joi.number().min(0),
      batteryLevel: Joi.number().min(0).max(100),
      deviceInfo: Joi.object(),
      recordedAt: Joi.date(),
      source: Joi.string(),
    })).max(200),
  }).or('latitude', 'pings'),

  // ---- Attendance ----
  checkInOut: Joi.object({
    latitude: Joi.number().min(-90).max(90),
    longitude: Joi.number().min(-180).max(180),
    deviceInfo: Joi.object({ platform: Joi.string(), model: Joi.string() }),
  }),

  // ---- Leave ----
  applyLeave: Joi.object({
    type: Joi.string().valid('PAID', 'UNPAID', 'SICK').required(),
    fromDate: Joi.date().required(),
    toDate: Joi.date().min(Joi.ref('fromDate')).required(),
    reason: Joi.string().max(500).allow(''),
  }),
  decideLeave: Joi.object({
    status: Joi.string().valid('APPROVED', 'REJECTED').required(),
    note: Joi.string().max(300).allow(''),
  }),

  // ---- Sale ----
  createSale: Joi.object({
    productId: objectId.allow(null, ''),
    productName: Joi.string().max(200).when('productId', { is: Joi.exist().not(null, ''), then: Joi.optional(), otherwise: Joi.required() }),
    quantity: Joi.number().integer().min(1).required(),
    amount: Joi.number().min(0).required(),
    customerName: Joi.string().max(150).allow(''),
    remarks: Joi.string().max(500).allow(''),
  }),

  // ---- Inventory ----
  productBody: Joi.object({
    productName: Joi.string().max(200).required(),
    sku: Joi.string().max(60).required(),
    category: Joi.string().max(100).allow(''),
    quantity: Joi.number().min(0).default(0),
    costPrice: Joi.number().min(0).required(),
    sellingPrice: Joi.number().min(0).required(),
    vendor: objectId.allow(null, ''),
    reorderLevel: Joi.number().min(0).default(10),
  }),
  adjustStock: Joi.object({
    type: Joi.string().valid('IN', 'OUT', 'ADJUST').required(),
    quantity: Joi.number().integer().min(0).required(),
    note: Joi.string().max(200).allow(''),
  }),

  // ---- Vendor ----
  vendorBody: Joi.object({
    name: Joi.string().max(200).required(),
    phone: Joi.string().max(20).allow(''),
    email: Joi.string().email().allow(''),
    address: Joi.string().max(300).allow(''),
    panVat: Joi.string().max(30).allow(''),
  }),

  // ---- Payroll ----
  generatePayroll: Joi.object({
    month: Joi.string().pattern(/^\d{4}-\d{2}$/),
    companyId: objectId.allow(null, ''),
    scope: Joi.string().valid('system'),
  }),
  updatePayroll: Joi.object({
    basicSalary: Joi.number().min(0),
    allowance: Joi.number().min(0),
    bonus: Joi.number().min(0),
    deductions: Joi.object({
      absent: Joi.number().min(0),
      tax: Joi.number().min(0),
      other: Joi.number().min(0),
    }),
    presentDays: Joi.number().min(0),
    workingDays: Joi.number().min(0),
    status: Joi.string().valid('DRAFT', 'GENERATED', 'PAID'),
    paidAt: Joi.date().allow(null),
    remarks: Joi.string().max(300).allow(''),
  }),
};
