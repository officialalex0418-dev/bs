import crypto from 'crypto';
import { User, Company, Package, LocationLog, Attendance, Leave, Sale, Payroll, Notification, Designation } from '../models/index.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { getPagination, paginatedResponse } from '../utils/pagination.js';
import { audit } from '../utils/audit.js';
import { emails } from '../services/email.service.js';
import { realtime } from '../sockets/index.js';
import { ROLES, ADMIN_EMPLOYEE_SUBROLES } from '../constants/roles.js';

/**
 * Staff & system-employee management.
 * - Company owner/manager manage STAFF + COMPANY_MANAGER within their company.
 * - Super admin manages everything incl. ADMIN_EMPLOYEE (system employees).
 */

/** GET /staff?companyId=&role=&search= */
export const listStaff = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};

  if (req.companyId) filter.company = req.companyId;
  else if (req.query.scope === 'system') filter.role = ROLES.ADMIN_EMPLOYEE;

  if (req.query.role) filter.role = req.query.role;
  if (req.query.active) filter.isActive = req.query.active === 'true';
  if (req.query.search) {
    filter.$or = [
      { name: { $regex: req.query.search, $options: 'i' } },
      { email: { $regex: req.query.search, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .populate('company', 'name')
      .populate('designation')
      .populate('branch', 'name')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({ success: true, data: paginatedResponse(items.map((u) => u.toSafeJSON()), total, page, limit) });
});

/** POST /staff */
export const createStaff = asyncHandler(async (req, res) => {
  const {
    name, email, phone, address, pan, position,
    basicSalary, dailyAllowance, allowances, role, designation, shift, companyId, monthlyTarget, workMode, branch,
    allowedMobileCount, allowedWebCount,
  } = req.body;

  if (await User.findOne({ email })) throw ApiError.conflict('Email already in use');

  let targetCompany = null;
  let targetRole = role || ROLES.STAFF;

  if (designation) {
    const des = await Designation.findById(designation);
    if (des) targetRole = des.baseRole;
  }

  let finalSalary = basicSalary;
  let finalAllowance = dailyAllowance;
  let finalAllowances = allowances;

  if ([ROLES.SUPER_ADMIN, ROLES.ADMIN_EMPLOYEE].includes(req.user.role)) {
    if (targetRole === ROLES.ADMIN_EMPLOYEE) {
      // System employees don't have salary/allowance fields in the form now
      finalSalary = 0;
      finalAllowance = 0;
      finalAllowances = 0;
    } else {
      targetCompany = companyId;
      if (!targetCompany) throw ApiError.badRequest('companyId required for company staff');
    }
  } else {
    // company owner / manager
    targetCompany = req.user.company._id;
    if (![ROLES.STAFF, ROLES.COMPANY_MANAGER].includes(targetRole)) {
      throw ApiError.forbidden('You can only create STAFF or COMPANY_MANAGER accounts');
    }
  }

  // Enforce package maxStaff limit
  if (targetCompany) {
    const company = await Company.findById(targetCompany).populate('package');
    if (!company) throw ApiError.notFound('Company not found');
    if (company.package) {
      const count = await User.countDocuments({ company: targetCompany, role: { $in: [ROLES.STAFF, ROLES.COMPANY_MANAGER] }, isActive: true });
      if (count >= company.package.maxStaff) {
        throw ApiError.forbidden(`Staff limit reached (${company.package.maxStaff}). Upgrade your package.`);
      }
    }
  }

  const tempPassword = crypto.randomBytes(6).toString('base64url');
  const user = await User.create({
    name, email, phone, address, pan, position,
    basicSalary: finalSalary, dailyAllowance: finalAllowance, allowances: finalAllowances, monthlyTarget,
    role: targetRole,
    designation: designation || null,
    shift: shift || null,
    company: targetCompany,
    workMode: workMode || 'OUTDOOR',
    branch: branch || null,
    allowedMobileCount: allowedMobileCount || 1,
    allowedWebCount: allowedWebCount || 1,
    password: tempPassword,
    needsPasswordChange: true,
  });

  if (targetCompany) {
    const company = await Company.findById(targetCompany);
    emails.staffCreated(email, { name, companyName: company.name, tempPassword });
    realtime.dashboard(targetCompany.toString(), { event: 'staff_created' });
    realtime.activity(targetCompany.toString(), { text: `${name} added as ${position || targetRole}`, at: new Date() });
  }

  audit({ req, action: 'CREATE_STAFF', entity: 'User', entityId: user._id, meta: { role: targetRole } });
  res.status(201).json({ success: true, data: { user: user.toSafeJSON() } });
});

/** GET /staff/:id */
export const getStaff = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).populate('company', 'name').populate('designation');
  if (!user) throw ApiError.notFound('User not found');
  assertSameCompanyOrPlatform(req, user);
  res.json({ success: true, data: { user: user.toSafeJSON() } });
});

/** PATCH /staff/:id */
export const updateStaff = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  assertSameCompanyOrPlatform(req, user);

  const allowed = ['name', 'phone', 'address', 'pan', 'position', 'basicSalary',
    'dailyAllowance', 'allowances', 'monthlyTarget', 'isActive', 'subRole', 'designation', 'shift', 'profilePhoto', 'leaveBalance', 'role', 'workMode', 'branch',
    'allowedMobileCount', 'allowedWebCount'];

  let targetRole = req.body.role;
  if (req.body.designation) {
    const des = await Designation.findById(req.body.designation);
    if (des) targetRole = des.baseRole;
  }

  if (targetRole !== undefined) {
    if ([ROLES.SUPER_ADMIN, ROLES.ADMIN_EMPLOYEE].includes(req.user.role)) {
      if (user.role === ROLES.ADMIN_EMPLOYEE && targetRole !== ROLES.ADMIN_EMPLOYEE) {
        throw ApiError.forbidden('System employees must remain system employees');
      }
      if (user.role !== ROLES.ADMIN_EMPLOYEE && ![ROLES.STAFF, ROLES.COMPANY_MANAGER].includes(targetRole)) {
        throw ApiError.badRequest('Invalid company role');
      }
    } else if (![ROLES.STAFF, ROLES.COMPANY_MANAGER].includes(targetRole)) {
      throw ApiError.forbidden('You can only edit STAFF or COMPANY_MANAGER roles');
    }
    user.role = targetRole;
  }

  const oldPosition = user.position;
  const oldRole = user.role;

  for (const k of allowed) {
    if (k === 'role') continue; // Handled above
    if (req.body[k] !== undefined) user[k] = req.body[k];
  }
  await user.save();

  if (oldPosition !== user.position || oldRole !== user.role) {
    emails.staffRoleChanged(user.email, {
      name: user.name,
      oldPosition: oldPosition || oldRole,
      newPosition: user.position || user.role,
      effectiveDate: new Date().toLocaleDateString(),
    });
  }

  audit({ req, action: 'UPDATE_STAFF', entity: 'User', entityId: user._id });
  res.json({ success: true, data: { user: user.toSafeJSON() } });
});

/** DELETE /staff/:id — soft delete */
export const deleteStaff = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  assertSameCompanyOrPlatform(req, user);
  user.isActive = false;
  user.refreshTokens = [];
  await user.save({ validateBeforeSave: false });
  audit({ req, action: 'DEACTIVATE_STAFF', entity: 'User', entityId: user._id });
  res.json({ success: true, message: 'User deactivated' });
});

/** DELETE /staff/:id/hard — permanent delete */
export const hardDeleteStaff = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  assertSameCompanyOrPlatform(req, user);

  // Cascading cleanup of staff data
  const staffId = user._id;
  await Promise.all([
    LocationLog.deleteMany({ staff: staffId }),
    Attendance.deleteMany({ staff: staffId }),
    Leave.deleteMany({ staff: staffId }),
    Sale.deleteMany({ staff: staffId }),
    Payroll.deleteMany({ staff: staffId }),
    Notification.deleteMany({ recipient: staffId }),
    User.findByIdAndDelete(staffId),
  ]);

  audit({ req, action: 'HARD_DELETE_STAFF', entity: 'User', entityId: user._id, meta: { name: user.name, email: user.email } });
  res.json({ success: true, message: 'User and all associated data permanently deleted' });
});

/** PATCH /staff/:id/authorize-device-reset */
export const authorizeDeviceReset = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('Staff not found');
  assertSameCompanyOrPlatform(req, user);

  user.isDeviceResetAuthorized = true;
  user.deviceResetRequested = false;
  user.primaryDeviceId = null;
  user.refreshTokens = [];

  await user.save({ validateBeforeSave: false });

  audit({ req, action: 'AUTHORIZE_DEVICE_RESET', entity: 'User', entityId: user._id });
  res.json({ success: true, message: `Device reset authorized for ${user.name}. They can now login from a new device.` });
});

function assertSameCompanyOrPlatform(req, target) {
  if ([ROLES.SUPER_ADMIN, ROLES.ADMIN_EMPLOYEE].includes(req.user.role)) return;
  const myCompany = req.user.company?._id?.toString();
  if (!myCompany || target.company?.toString() !== myCompany) {
    throw ApiError.forbidden('Cannot access users outside your company');
  }
}
