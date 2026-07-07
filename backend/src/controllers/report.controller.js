import mongoose from 'mongoose';
import Attendance from '../models/Attendance.js';
import Sale from '../models/Sale.js';
import Payroll from '../models/Payroll.js';
import LocationLog from '../models/LocationLog.js';
import User from '../models/User.js';
import Company from '../models/Company.js';
import Setting from '../models/Setting.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { sendExcel, sendPdf } from '../services/report.service.js';
import { rangeFromPeriod } from '../utils/dates.js';
import { audit } from '../utils/audit.js';

const oid = (id) => new mongoose.Types.ObjectId(id);

async function getBranding() {
  const s = await Setting.findOne({ scope: 'PLATFORM' }).lean();
  return {
    appName: s?.branding?.appName || 'Business Sarthi',
    appLogo: s?.branding?.logoUrl,
  };
}

/** GET /reports/tracking/excel?period=daily|weekly|monthly */
export const trackingExcel = asyncHandler(async (req, res) => {
  const { start, end } = rangeFromPeriod(req.query.period || 'daily');
  const match = { recordedAt: { $gte: start, $lte: end } };
  if (req.companyId) match.company = oid(req.companyId);

  const [logs, company] = await Promise.all([
    LocationLog.find(match).populate('staff', 'name position').sort('recordedAt').limit(20000).lean(),
    Company.findById(req.companyId).populate('package').lean()
  ]);

  const interval = company?.package?.trackingIntervalMinutes || 60;
  const filtered = [];
  const lastStaffTime = {};

  for (const log of logs) {
    const staffId = log.staff?._id?.toString();
    if (!staffId) continue;

    const isSpecial = ['CHECKIN', 'CHECKOUT', 'MANUAL'].includes(log.source);
    const lastTime = lastStaffTime[staffId];
    const currentTime = new Date(log.recordedAt).getTime();

    if (isSpecial || !lastTime || (currentTime - lastTime) >= (interval * 60000) - 10000) { // 10s grace
      filtered.push(log);
      lastStaffTime[staffId] = currentTime;
    }
  }

  // Sort descending for report
  filtered.sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));

  audit({ req, action: 'EXPORT_TRACKING_EXCEL', entity: 'Report' });
  await sendExcel(res, {
    filename: `tracking-${req.query.period || 'daily'}-${Date.now()}`,
    sheetName: 'Tracking',
    columns: [
      { header: 'Staff', key: 'staff', width: 25 },
      { header: 'Position', key: 'position', width: 18 },
      { header: 'Location Name', key: 'address', width: 45 },
      { header: 'Accuracy (m)', key: 'accuracy', width: 12 },
      { header: 'Source', key: 'source', width: 12 },
      { header: 'Recorded At', key: 'recordedAt', width: 24 },
    ],
    rows: filtered.map((l) => ({
      staff: l.staff?.name, position: l.staff?.position,
      address: l.address || `${l.location.coordinates[1].toFixed(5)}, ${l.location.coordinates[0].toFixed(5)}`,
      accuracy: l.accuracy, source: l.source,
      recordedAt: new Date(l.recordedAt).toLocaleString(),
    })),
  });
});

/** GET /reports/attendance/excel?month=YYYY-MM */
export const attendanceExcel = asyncHandler(async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  const filter = { date: { $regex: `^${month}` } };
  if (req.companyId) filter.company = req.companyId;

  const records = await Attendance.find(filter).populate('staff', 'name position').sort('date').lean();

  audit({ req, action: 'EXPORT_ATTENDANCE_EXCEL', entity: 'Report' });
  await sendExcel(res, {
    filename: `attendance-${month}`,
    sheetName: 'Attendance',
    columns: [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Staff', key: 'staff', width: 25 },
      { header: 'Check-In', key: 'checkIn', width: 22 },
      { header: 'Check-Out', key: 'checkOut', width: 22 },
      { header: 'Late', key: 'late', width: 8 },
      { header: 'Worked (hrs)', key: 'worked', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
    ],
    rows: records.map((r) => ({
      date: r.date, staff: r.staff?.name,
      checkIn: r.checkIn?.time ? new Date(r.checkIn.time).toLocaleTimeString() : '-',
      checkOut: r.checkOut?.time ? new Date(r.checkOut.time).toLocaleTimeString() : '-',
      late: r.checkIn?.isLate ? 'YES' : 'NO',
      worked: r.workedMinutes ? (r.workedMinutes / 60).toFixed(1) : '-',
      status: r.status,
    })),
  });
});

/** GET /reports/sales/excel?period= */
export const salesExcel = asyncHandler(async (req, res) => {
  const { start, end } = rangeFromPeriod(req.query.period || 'monthly');
  const filter = { saleDate: { $gte: start, $lte: end } };
  if (req.companyId) filter.company = req.companyId;

  const sales = await Sale.find(filter).populate('staff', 'name').sort('-saleDate').limit(10000).lean();

  audit({ req, action: 'EXPORT_SALES_EXCEL', entity: 'Report' });
  await sendExcel(res, {
    filename: `sales-${req.query.period || 'monthly'}-${Date.now()}`,
    sheetName: 'Sales',
    columns: [
      { header: 'Date', key: 'date', width: 20 },
      { header: 'Staff', key: 'staff', width: 22 },
      { header: 'Product', key: 'product', width: 28 },
      { header: 'Qty', key: 'qty', width: 8 },
      { header: 'Amount', key: 'amount', width: 14 },
      { header: 'Customer', key: 'customer', width: 22 },
      { header: 'Remarks', key: 'remarks', width: 30 },
    ],
    rows: sales.map((s) => ({
      date: new Date(s.saleDate).toLocaleDateString(),
      staff: s.staff?.name, product: s.productName,
      qty: s.quantity, amount: s.amount,
      customer: s.customerName, remarks: s.remarks,
    })),
  });
});

/** GET /reports/payroll/excel?month= */
export const payrollExcel = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.companyId) filter.company = req.companyId;
  if (req.query.month) filter.month = req.query.month;

  const records = await Payroll.find(filter).populate('staff', 'name position').sort('-month').lean();

  audit({ req, action: 'EXPORT_PAYROLL_EXCEL', entity: 'Report' });
  await sendExcel(res, {
    filename: `payroll-${req.query.month || 'all'}`,
    sheetName: 'Payroll',
    columns: [
      { header: 'Month', key: 'month', width: 12 },
      { header: 'Staff', key: 'staff', width: 24 },
      { header: 'Basic', key: 'basic', width: 12 },
      { header: 'Allowance', key: 'allowance', width: 12 },
      { header: 'Deductions', key: 'deductions', width: 12 },
      { header: 'Present/Working', key: 'days', width: 16 },
      { header: 'Net Salary', key: 'net', width: 14 },
      { header: 'Status', key: 'status', width: 12 },
    ],
    rows: records.map((p) => ({
      month: p.month, staff: p.staff?.name, basic: p.basicSalary,
      allowance: p.allowance,
      deductions: (p.deductions?.absent || 0) + (p.deductions?.tax || 0) + (p.deductions?.other || 0),
      days: `${p.presentDays}/${p.workingDays}`, net: p.netSalary, status: p.status,
    })),
  });
});

/** GET /reports/payroll/:payrollId/pdf */
export const payrollDetailPdf = asyncHandler(async (req, res) => {
  const payroll = await Payroll.findById(req.params.payrollId)
    .populate('staff', 'name position email phone address pan profilePhoto')
    .populate('generatedBy', 'name email')
    .lean();
  if (!payroll) throw ApiError.notFound('Payroll not found');
  if (req.companyId && payroll.company?.toString() !== req.companyId.toString()) {
    throw ApiError.forbidden('Payroll outside your company');
  }

  const company = payroll.company ? await Company.findById(payroll.company).populate('package').lean() : null;
  const branding = await getBranding();
  const reportCompany = { ...company, ...branding };

  const deductions = payroll.deductions || {};
  const totalDeductions = (deductions.absent || 0) + (deductions.tax || 0) + (deductions.other || 0);
  const gross = (payroll.basicSalary || 0) + (payroll.allowance || 0) + (payroll.bonus || 0);

  audit({ req, action: 'EXPORT_PAYROLL_PDF', entity: 'Report', entityId: payroll._id });
  sendPdf(res, {
    filename: `payroll-${payroll.staff?.name?.replace(/\s+/g, '-') || 'detail'}-${payroll.month}`,
    title: `Payroll Detail — ${payroll.staff?.name || 'Employee'}`,
    subtitle: `${payroll.month} · ${payroll.staff?.position || 'Staff'}`,
    company: reportCompany,
    sections: [
      {
        heading: 'Summary',
        lines: [
          `Staff: ${payroll.staff?.name || '-'}`,
          `Email: ${payroll.staff?.email || '-'}`,
          `Month: ${payroll.month}`,
          `Status: ${payroll.status}`,
          `Gross Salary: ${gross.toLocaleString()}`,
          `Net Salary: ${payroll.netSalary?.toLocaleString() || 0}`,
          `Paid At: ${payroll.paidAt ? new Date(payroll.paidAt).toLocaleString() : '-'}`,
        ],
      },
      {
        heading: 'Pay Breakdown',
        lines: [
          `Basic Salary: ${payroll.basicSalary?.toLocaleString() || 0}`,
          `Allowance: ${payroll.allowance?.toLocaleString() || 0}`,
          `Bonus: ${payroll.bonus?.toLocaleString() || 0}`,
          `Absent Deduction: ${deductions.absent?.toLocaleString() || 0}`,
          `Tax Deduction: ${deductions.tax?.toLocaleString() || 0}`,
          `Other Deduction: ${deductions.other?.toLocaleString() || 0}`,
          `Total Deductions: ${totalDeductions.toLocaleString()}`,
          `Present / Working Days: ${payroll.presentDays || 0} / ${payroll.workingDays || 0}`,
        ],
      },
      {
        heading: 'Remarks and Edits',
        lines: [
          `Current Remarks: ${payroll.remarks || '-'}`,
          ...(payroll.editHistory?.length ? payroll.editHistory.map((entry) => (
            `${new Date(entry.changedAt).toLocaleString()} — ${entry.reason || 'No reason provided'}`
          )) : ['No edit history recorded.']),
        ],
      },
    ],
  });
});

/** GET /reports/employee/:staffId/pdf — employee summary PDF */
export const employeeSummaryPdf = asyncHandler(async (req, res) => {
  const staff = await User.findById(req.params.staffId).populate('company', 'name email phone address logo package');
  if (!staff) throw ApiError.notFound('Staff not found');
  if (!['SUPER_ADMIN', 'ADMIN_EMPLOYEE'].includes(req.user.role) &&
      staff.company?._id?.toString() !== req.user.company?._id?.toString()) {
    throw ApiError.forbidden();
  }

  const month = new Date().toISOString().slice(0, 7);
  const [attendance, sales, payroll] = await Promise.all([
    Attendance.find({ staff: staff._id, date: { $regex: `^${month}` } }).lean(),
    Sale.aggregate([
      { $match: { staff: staff._id } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Payroll.findOne({ staff: staff._id }).sort('-month').lean(),
  ]);

  audit({ req, action: 'EXPORT_EMPLOYEE_PDF', entity: 'Report', entityId: staff._id });
  const branding = await getBranding();
  sendPdf(res, {
    filename: `employee-${staff.name.replace(/\s+/g, '-')}`,
    title: `Employee Summary — ${staff.name}`,
    subtitle: `${staff.position || 'Staff'} · ${staff.company?.name || 'Business Sarthi'}`,
    company: { ...staff.company, ...branding },
    sections: [
      {
        heading: 'Profile',
        lines: [
          `Email: ${staff.email}`, `Phone: ${staff.phone || '-'}`,
          `Address: ${staff.address || '-'}`, `PAN: ${staff.pan || '-'}`,
          `Basic Salary: ${staff.basicSalary}`, `Daily Allowance: ${staff.dailyAllowance}`,
        ],
      },
      {
        heading: `Attendance (${month})`,
        lines: [
          `Present days: ${attendance.filter((a) => ['PRESENT', 'HALF_DAY'].includes(a.status)).length}`,
          `Late days: ${attendance.filter((a) => a.checkIn?.isLate).length}`,
        ],
      },
      {
        heading: 'Sales (lifetime)',
        lines: [
          `Total sales: ${sales[0]?.count || 0}`,
          `Total amount: ${sales[0]?.total?.toLocaleString() || 0}`,
        ],
      },
      ...(payroll ? [{
        heading: `Last Payroll (${payroll.month})`,
        lines: [`Net Salary: ${payroll.netSalary.toLocaleString()}`, `Status: ${payroll.status}`],
      }] : []),
    ],
  });
});

/** GET /reports/company/:companyId/pdf — company summary PDF (super admin) */
export const companySummaryPdf = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.companyId).populate('package').lean();
  if (!company) throw ApiError.notFound('Company not found');

  const [staffCount, salesAgg, attendanceToday] = await Promise.all([
    User.countDocuments({ company: company._id, isActive: true }),
    Sale.aggregate([
      { $match: { company: company._id } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Attendance.countDocuments({
      company: company._id,
      date: new Date().toISOString().slice(0, 10),
      'checkIn.time': { $exists: true },
    }),
  ]);

  audit({ req, action: 'EXPORT_COMPANY_PDF', entity: 'Report', entityId: company._id });
  const branding = await getBranding();
  sendPdf(res, {
    filename: `company-${company.name.replace(/\s+/g, '-')}`,
    title: `Company Summary — ${company.name}`,
    subtitle: company.address || '',
    company: { ...company, ...branding },
    sections: [
      {
        heading: 'Details',
        lines: [
          `Email: ${company.email}`, `Phone: ${company.phone || '-'}`,
          `PAN/VAT: ${company.panVat || '-'}`, `Status: ${company.status}`,
          `Package: ${company.package?.name || 'None'} (max ${company.package?.maxStaff || '-'} staff, ${company.package?.trackingIntervalMinutes || '-'} min tracking)`,
        ],
      },
      {
        heading: 'Statistics',
        lines: [
          `Active users: ${staffCount}`,
          `Checked-in today: ${attendanceToday}`,
          `Total sales: ${salesAgg[0]?.count || 0} (${salesAgg[0]?.total?.toLocaleString() || 0})`,
        ],
      },
    ],
  });
});
