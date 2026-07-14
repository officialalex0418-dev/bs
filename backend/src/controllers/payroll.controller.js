import Payroll from '../models/Payroll.js';
import User from '../models/User.js';
import Attendance from '../models/Attendance.js';
import Company from '../models/Company.js';
import Leave from '../models/Leave.js';
import LeaveType from '../models/LeaveType.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { getPagination, paginatedResponse } from '../utils/pagination.js';
import { audit } from '../utils/audit.js';
import { emails } from '../services/email.service.js';
import { notify } from '../services/notification.service.js';
import { monthStr } from '../utils/dates.js';
import { getBsMonthRange, bsMapping } from '../utils/nepaliDate.js';

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
  let dateFilter = { $regex: `^${month}` };
  let totalWorkingDays = 0;

  if (isSystemScope) {
    staffFilter = { role: 'ADMIN_EMPLOYEE', isActive: true };
    totalWorkingDays = getWorkingDays(month);
    if (month > monthStr()) throw ApiError.badRequest('Cannot generate payroll for future months');
  } else {
    const companyId = req.companyId;
    if (!companyId) throw ApiError.badRequest('companyId required');
    company = await Company.findById(companyId);
    if (!company) throw ApiError.notFound('Company not found');
    staffFilter = { company: companyId, role: { $in: ['STAFF', 'COMPANY_MANAGER'] }, isActive: true };

    if (company.settings?.dateFormat === 'BS') {
      const { start, end } = getBsMonthRange(month);
      dateFilter = { $gte: start.toISOString().slice(0, 10), $lte: end.toISOString().slice(0, 10) };

      if (start > new Date()) throw ApiError.badRequest('Cannot generate payroll for future months');

      // Calculate working days for BS month (Nepal: Sat off)
      const [by, bm] = month.split('-').map(Number);
      const daysInBsMonth = bsMapping[by][bm - 1];
      totalWorkingDays = 0;
      for (let d = 1; d <= daysInBsMonth; d++) {
        const adDate = bsToAdInside(`${by}-${bm}-${d}`);
        if (adDate.getUTCDay() !== 6) totalWorkingDays++;
      }
    } else {
      if (month > monthStr()) throw ApiError.badRequest('Cannot generate payroll for future months');
      totalWorkingDays = getWorkingDays(month);
    }
  }

  const staffList = await User.find(staffFilter);
  if (!staffList.length) throw ApiError.badRequest('No active staff to generate payroll for');

  const leaveTypes = company ? await LeaveType.find({ company: company._id }) : [];
  const paidLeaveTypeNames = leaveTypes.filter(lt => lt.isPaid).map(lt => lt.name);
  if (!paidLeaveTypeNames.includes('PAID')) paidLeaveTypeNames.push('PAID');
  if (!paidLeaveTypeNames.includes('SICK')) paidLeaveTypeNames.push('SICK');

  let startMonth, endMonth;
  if (company?.settings?.dateFormat === 'BS') {
    const range = getBsMonthRange(month);
    startMonth = range.start; endMonth = range.end;
  } else {
    const [y, m] = month.split('-').map(Number);
    startMonth = new Date(Date.UTC(y, m - 1, 1));
    endMonth = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  }

  const results = [];

  for (const staff of staffList) {
    const exists = await Payroll.findOne({ staff: staff._id, month });
    if (exists) { results.push({ staff: staff.name, skipped: true }); continue; }

    const attendanceRecords = company
      ? await Attendance.find({
          staff: staff._id,
          date: dateFilter,
          status: { $in: ['PRESENT', 'HALF_DAY'] },
        })
      : [];

    const presentDays = company
      ? attendanceRecords.reduce((acc, curr) => acc + (curr.status === 'HALF_DAY' ? 0.5 : 1), 0)
      : totalWorkingDays;

    const approvedLeaves = company
      ? await Leave.find({
          staff: staff._id, status: 'APPROVED',
          $or: [
            { fromDate: { $gte: startMonth, $lte: endMonth } },
            { toDate: { $gte: startMonth, $lte: endMonth } },
          ],
        })
      : [];

    let paidLeaveDays = 0;
    for (const l of approvedLeaves) {
      if (paidLeaveTypeNames.includes(l.type)) {
        paidLeaveDays += l.days;
      }
    }

    const effectivePresentDays = Math.min(presentDays + paidLeaveDays, totalWorkingDays);
    const perDay = staff.basicSalary / totalWorkingDays || 0;
    const absentDays = Math.max(totalWorkingDays - effectivePresentDays, 0);
    const absentDeduction = Math.round(perDay * absentDays);

    // Using monthly fixed allowances + daily allowances (per present day)
    const monthlyAllowance = Number(staff.allowances || 0);
    const dailyAllowance = (staff.dailyAllowance || 0) * presentDays;
    const allowance = monthlyAllowance + dailyAllowance;

    const tax = Math.round(staff.basicSalary * 0.01); // 1% Social Security Tax
    const netSalary = Math.max(Math.round(staff.basicSalary + allowance - absentDeduction - tax), 0);

    const payroll = await Payroll.create({
      staff: staff._id,
      company: company?._id || null,
      month,
      basicSalary: staff.basicSalary,
      allowance,
      paidLeaveDays,
      deductions: { absent: absentDeduction, tax, other: 0 },
      presentDays, workingDays: totalWorkingDays, netSalary,
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

  // Staff can only see their own payroll unless they have managerial payroll permission
  if (req.user.role === 'STAFF' && !req.user.designation?.permissions?.payroll) {
    filter.staff = req.user._id;
  }

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

  // Staff can only see their own payroll slip unless they have managerial payroll permission
  if (req.user.role === 'STAFF' &&
      payroll.staff?._id?.toString() !== req.user._id.toString() &&
      !req.user.designation?.permissions?.payroll) {
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

function bsToAdInside(bsDateStr) {
  const [year, month, day] = bsDateStr.split('-').map(Number);
  let totalDays = 0;
  for (let y = 2070; y < year; y++) {
    totalDays += bsMapping[y].reduce((a, b) => a + b, 0);
  }
  for (let m = 0; m < month - 1; m++) {
    totalDays += bsMapping[year][m];
  }
  totalDays += day - 1;
  const adReference = new Date(Date.UTC(2013, 3, 14));
  adReference.setUTCDate(adReference.getUTCDate() + totalDays);
  return adReference;
}
