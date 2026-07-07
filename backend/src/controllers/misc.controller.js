import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';
import Setting from '../models/Setting.js';
import User from '../models/User.js';
import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { getPagination, paginatedResponse } from '../utils/pagination.js';
import { audit } from '../utils/audit.js';

// ---------- Notifications ----------
export const myNotifications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { recipient: req.user._id };
  if (req.query.unread === 'true') filter.isRead = false;

  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort('-createdAt').skip(skip).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipient: req.user._id, isRead: false }),
  ]);
  res.json({ success: true, data: { ...paginatedResponse(items, total, page, limit), unreadCount } });
});

export const markNotificationsRead = asyncHandler(async (req, res) => {
  const filter = { recipient: req.user._id };
  if (req.body.ids?.length) filter._id = { $in: req.body.ids };
  await Notification.updateMany(filter, { isRead: true });
  res.json({ success: true, message: 'Marked as read' });
});

// ---------- Audit Logs (super admin) ----------
export const listAuditLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.action) filter.action = req.query.action;
  if (req.query.userId) filter.user = req.query.userId;
  if (req.query.companyId) filter.company = req.query.companyId;

  const [items, total] = await Promise.all([
    AuditLog.find(filter).populate('user', 'name email role')
      .populate('company', 'name').sort('-createdAt').skip(skip).limit(limit),
    AuditLog.countDocuments(filter),
  ]);
  res.json({ success: true, data: paginatedResponse(items, total, page, limit) });
});

// ---------- Settings ----------
export const getPublicSettings = asyncHandler(async (req, res) => {
  const settings = await Setting.findOne({ scope: 'PLATFORM' }).select('branding');
  res.json({
    success: true,
    data: {
      branding: settings?.branding || {
        appName: 'Business Sarthi',
        logoUrl: '/logo.png',
        tagline: 'Driving Your Business Forward'
      }
    }
  });
});

export const getSettings = asyncHandler(async (req, res) => {
  const scope = ['SUPER_ADMIN', 'ADMIN_EMPLOYEE'].includes(req.user.role)
    ? 'PLATFORM'
    : req.user.company?._id?.toString();
  if (!scope) throw ApiError.badRequest('No settings scope');
  let settings = await Setting.findOne({ scope });
  if (!settings) settings = await Setting.create({ scope });
  res.json({ success: true, data: { settings } });
});

export const updateSettings = asyncHandler(async (req, res) => {
  const scope = ['SUPER_ADMIN', 'ADMIN_EMPLOYEE'].includes(req.user.role)
    ? 'PLATFORM'
    : req.user.company?._id?.toString();
  const allowed = (({ branding, security }) => ({ branding, security }))(req.body);
  Object.keys(allowed).forEach((k) => allowed[k] === undefined && delete allowed[k]);

  const settings = await Setting.findOneAndUpdate(
    { scope },
    { $set: allowed },
    { new: true, upsert: true, runValidators: true }
  );
  audit({ req, action: 'UPDATE_SETTINGS', entity: 'Setting', entityId: settings._id });
  res.json({ success: true, data: { settings } });
});

// ---------- Profile (staff self-service) ----------
export const updateMyProfile = asyncHandler(async (req, res) => {
  const allowed = ['phone', 'profilePhoto'];
  const user = await User.findById(req.user._id).populate({
    path: 'designation',
    populate: { path: 'department', select: 'name' }
  }).populate('company');
  for (const k of allowed) if (req.body[k] !== undefined) user[k] = req.body[k];
  await user.save({ validateBeforeSave: true });
  audit({ req, action: 'UPDATE_PROFILE', entity: 'User', entityId: user._id });
  res.json({ success: true, data: { user: user.toSafeJSON() } });
});
