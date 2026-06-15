import Leave from '../models/Leave.js';
import User from '../models/User.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { getPagination, paginatedResponse } from '../utils/pagination.js';
import { audit } from '../utils/audit.js';
import { emails } from '../services/email.service.js';
import { notify } from '../services/notification.service.js';
import { realtime } from '../sockets/index.js';

/** POST /leaves — staff applies */
export const applyLeave = asyncHandler(async (req, res) => {
  const { type, fromDate, toDate, reason } = req.body;
  const from = new Date(fromDate);
  const to = new Date(toDate);
  const days = Math.max(Math.round((to - from) / 86400000) + 1, 1);

  // balance check for PAID / SICK
  if (type === 'PAID' && req.user.leaveBalance.paid < days) {
    throw ApiError.badRequest(`Insufficient paid leave balance (${req.user.leaveBalance.paid} days left)`);
  }
  if (type === 'SICK' && req.user.leaveBalance.sick < days) {
    throw ApiError.badRequest(`Insufficient sick leave balance (${req.user.leaveBalance.sick} days left)`);
  }

  const leave = await Leave.create({
    staff: req.user._id,
    company: req.user.company._id,
    type, fromDate: from, toDate: to, days, reason,
  });

  // notify owner + managers
  const approvers = await User.find({
    company: req.user.company._id,
    role: { $in: ['COMPANY_OWNER', 'COMPANY_MANAGER'] },
    isActive: true,
  });
  for (const a of approvers) {
    notify({
      recipient: a._id, company: req.user.company._id, type: 'LEAVE_APPLIED',
      title: 'New leave request',
      message: `${req.user.name} applied for ${days} day(s) ${type} leave.`,
      link: '/company/leaves',
    });
  }
  realtime.activity(req.user.company._id.toString(), { text: `${req.user.name} applied for leave`, at: new Date() });
  audit({ req, action: 'APPLY_LEAVE', entity: 'Leave', entityId: leave._id });

  res.status(201).json({ success: true, data: { leave } });
});

/** GET /leaves/me */
export const myLeaves = asyncHandler(async (req, res) => {
  const items = await Leave.find({ staff: req.user._id }).sort('-createdAt').limit(100);
  res.json({ success: true, data: { items, balance: req.user.leaveBalance } });
});

/** GET /leaves (owner/manager) */
export const listLeaves = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.companyId) filter.company = req.companyId;
  if (req.query.status) filter.status = req.query.status;

  const [items, total] = await Promise.all([
    Leave.find(filter).populate('staff', 'name position profilePhoto')
      .populate('reviewedBy', 'name').sort('-createdAt').skip(skip).limit(limit),
    Leave.countDocuments(filter),
  ]);
  res.json({ success: true, data: paginatedResponse(items, total, page, limit) });
});

/** PATCH /leaves/:id/decision { status: APPROVED|REJECTED, note } */
export const decideLeave = asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  const leave = await Leave.findById(req.params.id).populate('staff', 'name email leaveBalance');
  if (!leave) throw ApiError.notFound('Leave not found');
  if (leave.status !== 'PENDING') throw ApiError.conflict('Leave already reviewed');

  // scope check
  if (!['SUPER_ADMIN', 'ADMIN_EMPLOYEE'].includes(req.user.role) &&
      leave.company.toString() !== req.user.company._id.toString()) {
    throw ApiError.forbidden('Leave outside your company');
  }

  leave.status = status;
  leave.reviewedBy = req.user._id;
  leave.reviewedAt = new Date();
  leave.reviewNote = note;
  await leave.save();

  // deduct balance on approval
  if (status === 'APPROVED' && ['PAID', 'SICK'].includes(leave.type)) {
    const field = leave.type === 'PAID' ? 'leaveBalance.paid' : 'leaveBalance.sick';
    await User.findByIdAndUpdate(leave.staff._id, { $inc: { [field]: -leave.days } });
  }

  emails.leaveDecision(leave.staff.email, {
    name: leave.staff.name, status, type: leave.type,
    fromDate: leave.fromDate.toDateString(), toDate: leave.toDate.toDateString(), note,
  });
  notify({
    recipient: leave.staff._id, company: leave.company,
    type: status === 'APPROVED' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
    title: `Leave ${status.toLowerCase()}`,
    message: `Your ${leave.type} leave (${leave.days} days) was ${status.toLowerCase()}.`,
  });
  audit({ req, action: `LEAVE_${status}`, entity: 'Leave', entityId: leave._id });

  res.json({ success: true, data: { leave } });
});
