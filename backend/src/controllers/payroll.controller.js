import Payroll from '../models/Payroll.js';
import User from '../models/User.js';
import Attendance from '../models/Attendance.js';
import Company from '../models/Company.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { getPagination, paginatedResponse } from '../utils/pagination.js';
import { audit } from '../utils/audit.js';
import { emails } from '../services/email.service.js';
import { notify } from '../services/notification.service.js';
import { monthStr } from '../utils/dates.js';

function getPayrollTotals(payroll) {
  const deductions = payroll.deductions || {};
  const totalDeductions = (deductions.absent || 0) + (deductions.tax || 0) + (deductions.other || 0);
  const gross = (payroll.basicSalary || 0) + (payroll.allowance || 0) + (payroll.bonus || 0);
  return { deductions, totalDeductions, gross };
}

function buildPayrollDetail(payroll) {
  const { deductions, totalDeductions, gross } = getPayrollTotals(payroll);
  return {
    ...payroll,
    breakdown: {
      gross,
      totalDeductions,
      netSalary: payroll.netSalary,
      deductions,
    },
  };
}

/**
 * POST /payroll/generate { month: 'YYYY-MM', companyId?, scope? }
 * Generates payroll for all active staff of a company (or system employees when
 * called by super admin with scope=system). Salary = basic + allowance*presentDays
 * - per-day deduction for absent days.
 */
export const generatePayroll = asyncHandler(async (req, res) => {
  const month = req.body.month || monthStr();
  const isSystemScope = req.body.scope === 'system' &&
    ['SUPER_ADMIN', 'ADMIN_EMPLOYEE'].includes(req.user.role);

  let staffFilter;
  let company = null;
  if (isSystemScope) {
    staffFilter = { role: 'ADMIN_EMPLOYEE', isActive: true };
  } else {
    const companyId = req.companyId;
    if (!companyId) throw ApiError.badRequest('companyId required');
    company = await Company.findById(companyId);
    if (!company) throw ApiError.notFound('Company not found');
    staffFilter = { company: companyId, role: { $in: ['STAFF', 'COMPANY_MANAGER'] }, isActive: true };
  }

  const staffList = await User.find(staffFilter);
  if (!staffList.length) throw ApiError.badRequest('No active staff to generate payroll for');

  const workingDays = getWorkingDays(month);
  const results = [];

  for (const staff of staffList) {
    const exists = await Payroll.findOne({ staff: staff._id, month });
    if (exists) { results.push({ staff: staff.name, skipped: true }); continue; }

    const presentDays = company
      ? await Attendance.countDocuments({
          staff: staff._id,
          date: { $regex: `^${month}` },
          status: { $in: ['PRESENT', 'HALF_DAY'] },
        })
      : workingDays; // system employees assumed full attendance

    const perDay = staff.basicSalary / workingDays || 0;
    const absentDays = Math.max(workingDays - presentDays, 0);
    const absentDeduction = Math.round(perDay * absentDays);
    const allowance = Math.round((staff.dailyAllowance || 0) * presentDays);
    const tax = Math.round(staff.basicSalary * 0.01); // 1% SST placeholder
    const netSalary = Math.max(Math.round(staff.basicSalary + allowance - absentDeduction - tax), 0);

    const payroll = await Payroll.create({
      staff: staff._id,
      company: company?._id || null,
      month,
      basicSalary: staff.basicSalary,
      allowance,
      deductions: { absent: absentDeduction, tax, other: 0 },
      presentDays, workingDays, netSalary,
      generatedBy: req.user._id,
    });

    emails.payrollGenerated(staff.email, {
      name: staff.name, month, netSalary,
      currency: company?.settings?.currency || 'NPR',
    });
    notify({
      recipient: staff._id, company: company?._id, type: 'PAYROLL_GENERATED',
      title: 'Salary slip ready', message: `Payroll for ${month} generated. Net: ${netSalary}`,
    });
    results.push({ staff: staff.name, netSalary, payrollId: payroll._id });
  }

  audit({ req, action: 'GENERATE_PAYROLL', entity: 'Payroll', meta: { month, count: results.length } });
  res.status(201).json({ success: true, data: { month, results } });
});

/** GET /payroll?month=&companyId= */
export const listPayroll = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.companyId) filter.company = req.companyId;
  else if (req.query.scope === 'system') filter.company = null;
  if (req.query.month) filter.month = req.query.month;
  if (req.user.role === 'STAFF') filter.staff = req.user._id;

  const [items, total] = await Promise.all([
    Payroll.find(filter).populate('staff', 'name position email')
      .sort('-month').skip(skip).limit(limit),
    Payroll.countDocuments(filter),
  ]);
  res.json({ success: true, data: paginatedResponse(items, total, page, limit) });
});

/** GET /payroll/:id */
export const getPayroll = asyncHandler(async (req, res) => {
  const payroll = await Payroll.findById(req.params.id)
    .populate('staff', 'name position email phone profilePhoto')
    .populate('generatedBy', 'name email');
  if (!payroll) throw ApiError.notFound('Payroll not found');
  if (req.companyId && payroll.company?.toString() !== req.companyId.toString()) {
    throw ApiError.forbidden('Payroll outside your company');
  }
  if (req.user.role === 'STAFF' && payroll.staff?._id?.toString() !== req.user._id.toString()) {
    throw ApiError.forbidden('Payroll outside your access');
  }
  res.json({ success: true, data: { payroll: buildPayrollDetail(payroll.toObject()) } });
});

/** PATCH /payroll/:id */
export const updatePayroll = asyncHandler(async (req, res) => {
  const payroll = await Payroll.findById(req.params.id);
  if (!payroll) throw ApiError.notFound('Payroll not found');
  if (req.companyId && payroll.company?.toString() !== req.companyId.toString()) {
    throw ApiError.forbidden('Payroll outside your company');
  }

  const editable = ['basicSalary', 'allowance', 'bonus', 'presentDays', 'workingDays', 'status', 'paidAt'];
  const changes = {};

  for (const key of editable) {
    if (req.body[key] !== undefined && req.body[key] !== payroll[key]) {
      changes[key] = { from: payroll[key], to: req.body[key] };
      payroll[key] = req.body[key];
    }
  }

  if (req.body.deductions) {
    payroll.deductions = {
      absent: req.body.deductions.absent ?? payroll.deductions?.absent ?? 0,
      tax: req.body.deductions.tax ?? payroll.deductions?.tax ?? 0,
      other: req.body.deductions.other ?? payroll.deductions?.other ?? 0,
    };
    changes.deductions = { from: req.body.deductions, to: payroll.deductions };
  }

  const hasBusinessChange = Object.keys(changes).length > 0;
  const reason = (req.body.remarks || '').trim() || 'Updated from payroll panel';

  if (hasBusinessChange) {
    payroll.remarks = reason;
    payroll.editHistory = payroll.editHistory || [];
    payroll.editHistory.push({
      changedBy: req.user._id,
      changedAt: new Date(),
      reason,
      changes,
    });
  }

  const deductions = payroll.deductions || {};
  const totalDeductions = (deductions.absent || 0) + (deductions.tax || 0) + (deductions.other || 0);
  const gross = (payroll.basicSalary || 0) + (payroll.allowance || 0) + (payroll.bonus || 0);
  payroll.netSalary = Math.max(Math.round(gross - totalDeductions), 0);

  await payroll.save();
  audit({ req, action: 'UPDATE_PAYROLL', entity: 'Payroll', entityId: payroll._id, meta: { reason } });
  res.json({ success: true, data: { payroll: buildPayrollDetail(payroll.toObject()) } });
});

/** PATCH /payroll/:id/pay */
export const markPaid = asyncHandler(async (req, res) => {
  const payroll = await Payroll.findById(req.params.id);
  if (!payroll) throw ApiError.notFound('Payroll not found');
  if (req.companyId && payroll.company?.toString() !== req.companyId.toString()) {
    throw ApiError.forbidden('Payroll outside your company');
  }
  payroll.status = 'PAID';
  payroll.paidAt = new Date();
  await payroll.save();
  audit({ req, action: 'PAYROLL_PAID', entity: 'Payroll', entityId: payroll._id });
  res.json({ success: true, data: { payroll } });
});

function getWorkingDays(month) {
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  let working = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(y, m - 1, d).getDay();
    if (day !== 6) working++; // Saturday off (Nepal)
  }
  return working;
}
