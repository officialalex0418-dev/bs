import Attendance from '../models/Attendance.js';
import LocationLog from '../models/LocationLog.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { getPagination, paginatedResponse } from '../utils/pagination.js';
import { audit } from '../utils/audit.js';
import { realtime } from '../sockets/index.js';
import { todayStr } from '../utils/dates.js';

/** POST /attendance/check-in */
export const checkIn = asyncHandler(async (req, res) => {
  const companyId = req.user.company?._id;
  if (!companyId) throw ApiError.forbidden('No company associated');

  const date = todayStr();
  const existing = await Attendance.findOne({ staff: req.user._id, date });
  if (existing?.checkIn?.time) throw ApiError.conflict('Already checked in today');

  const { latitude, longitude, deviceInfo } = req.body;
  const now = new Date();

  // Late detection from company settings
  const settings = req.user.company.settings || {};
  const [h, m] = (settings.workStartTime || '09:00').split(':').map(Number);
  const startToday = new Date(now);
  startToday.setHours(h, m + (settings.lateGraceMinutes || 15), 0, 0);
  const isLate = now > startToday;

  const attendance = await Attendance.findOneAndUpdate(
    { staff: req.user._id, date },
    {
      $set: {
        company: companyId,
        'checkIn.time': now,
        'checkIn.location': latitude != null ? { type: 'Point', coordinates: [longitude, latitude] } : undefined,
        'checkIn.deviceInfo': deviceInfo,
        'checkIn.isLate': isLate,
        status: 'PRESENT',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (latitude != null) {
    LocationLog.create({
      staff: req.user._id, company: companyId,
      location: { type: 'Point', coordinates: [longitude, latitude] },
      deviceInfo, source: 'CHECKIN', recordedAt: now,
    }).catch(() => {});
  }

  audit({ req, action: 'CHECK_IN', entity: 'Attendance', entityId: attendance._id, meta: { isLate } });
  realtime.dashboard(companyId.toString(), { event: 'check_in', staffId: req.user._id });
  realtime.activity(companyId.toString(), { text: `${req.user.name} checked in${isLate ? ' (late)' : ''}`, at: now });

  res.status(201).json({ success: true, data: { attendance } });
});

/** POST /attendance/check-out */
export const checkOut = asyncHandler(async (req, res) => {
  const date = todayStr();
  const attendance = await Attendance.findOne({ staff: req.user._id, date });
  if (!attendance?.checkIn?.time) throw ApiError.badRequest('You have not checked in today');
  if (attendance.checkOut?.time) throw ApiError.conflict('Already checked out today');

  const { latitude, longitude, deviceInfo } = req.body;
  const now = new Date();

  attendance.checkOut = {
    time: now,
    location: latitude != null ? { type: 'Point', coordinates: [longitude, latitude] } : undefined,
    deviceInfo,
  };
  attendance.workedMinutes = Math.round((now - attendance.checkIn.time) / 60000);
  if (attendance.workedMinutes < 240) attendance.status = 'HALF_DAY';
  await attendance.save();

  if (latitude != null) {
    LocationLog.create({
      staff: req.user._id, company: req.user.company._id,
      location: { type: 'Point', coordinates: [longitude, latitude] },
      deviceInfo, source: 'CHECKOUT', recordedAt: now,
    }).catch(() => {});
  }

  audit({ req, action: 'CHECK_OUT', entity: 'Attendance', entityId: attendance._id });
  realtime.dashboard(req.user.company._id.toString(), { event: 'check_out', staffId: req.user._id });

  res.json({ success: true, data: { attendance } });
});

/** GET /attendance/me?month=YYYY-MM */
export const myAttendance = asyncHandler(async (req, res) => {
  const month = req.query.month || todayStr().slice(0, 7);
  const items = await Attendance.find({
    staff: req.user._id,
    date: { $regex: `^${month}` },
  }).sort('-date');

  const lateDays = items.filter((a) => a.checkIn?.isLate).length;
  const presentDays = items.filter((a) => ['PRESENT', 'HALF_DAY'].includes(a.status)).length;
  const today = items.find((a) => a.date === todayStr());

  res.json({
    success: true,
    data: { items, summary: { month, presentDays, lateDays }, today: today || null },
  });
});

/** GET /attendance?date=&staffId=&month= (owner/manager/admin) */
export const listAttendance = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.companyId) filter.company = req.companyId;
  if (req.query.staffId) filter.staff = req.query.staffId;
  if (req.query.date) filter.date = req.query.date;
  else if (req.query.month) filter.date = { $regex: `^${req.query.month}` };

  const [items, total] = await Promise.all([
    Attendance.find(filter).populate('staff', 'name position profilePhoto')
      .sort('-date').skip(skip).limit(limit),
    Attendance.countDocuments(filter),
  ]);
  res.json({ success: true, data: paginatedResponse(items, total, page, limit) });
});
