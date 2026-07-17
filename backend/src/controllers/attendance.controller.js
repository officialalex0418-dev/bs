import Attendance from '../models/Attendance.js';
import AttendanceRequest from '../models/AttendanceRequest.js';
import LocationLog from '../models/LocationLog.js';
import Company from '../models/Company.js';
import Branch from '../models/Branch.js';
import Shift from '../models/Shift.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { getPagination, paginatedResponse } from '../utils/pagination.js';
import { audit } from '../utils/audit.js';
import { realtime } from '../sockets/index.js';
import { todayStr } from '../utils/dates.js';
import { getDistanceMeters } from '../utils/geo.js';

import { reverseGeocode } from '../utils/geocoder.js';
import { checkAttendanceRestriction } from '../utils/attendance-checks.js';

/** POST /attendance/check-in */
export const checkIn = asyncHandler(async (req, res) => {
  const companyId = req.user.company?._id;
  if (!companyId) throw ApiError.forbidden('No company associated');

  const date = todayStr();

  // 0. Check for off-days, holidays, or leaves
  const restriction = await checkAttendanceRestriction(req.user, date);
  if (restriction.restricted) {
    throw ApiError.forbidden(restriction.reason + ' Regular check-in is disabled. Please submit an attendance request if you are working overtime.');
  }

  const existing = await Attendance.findOne({ staff: req.user._id, date });
  if (existing?.checkIn?.time) throw ApiError.conflict('Already checked in today');

  const { latitude, longitude, deviceInfo } = req.body;

  // Outdoor staff cannot check-in from web
  const isAppRequest = !!deviceInfo?.platform && (deviceInfo.platform.toLowerCase() === 'android' || deviceInfo.platform.toLowerCase() === 'ios');
  if (req.user.workMode === 'OUTDOOR' && !isAppRequest) {
    throw ApiError.forbidden('Outdoor staff can only check in via the mobile application.');
  }

  // 1. Check radius for indoor users
  if (req.user.workMode === 'INDOOR') {
    if (latitude == null || longitude == null) {
      throw ApiError.badRequest('GPS location is required for indoor staff check-in.');
    }

    let targetLoc = null;
    let radius = 200;

    if (req.user.branch) {
      const branch = await Branch.findById(req.user.branch);
      if (branch) {
        targetLoc = branch.location?.coordinates;
        radius = branch.radius || 200;
      }
    }

    if (!targetLoc) {
      const company = await Company.findById(companyId);
      if (company?.location?.coordinates?.length === 2) {
        targetLoc = company.location.coordinates;
        radius = company.checkInRadiusMeters || 200;
      }
    }

    if (targetLoc && targetLoc.length === 2) {
      const dist = getDistanceMeters(latitude, longitude, targetLoc[1], targetLoc[0]);
      if (dist > radius) {
        throw ApiError.forbidden(`Indoor Staff: You must be within ${radius}m of your assigned branch/office to check in. Current distance: ${Math.round(dist)}m.`);
      }
    } else {
      // Fallback: If no location is set for branch/company, we can't enforce radius
      console.warn(`Radius enforcement failed for user ${req.user._id}: No target location defined for branch or company.`);
    }
  }

  const now = new Date();
  const address = await reverseGeocode(latitude, longitude);

  // 2. Shift Window Restriction (1 hour prior)
  if (req.user.shift) {
    const shift = await Shift.findById(req.user.shift);
    if (shift) {
      const now = new Date();
      const [sh, sm] = shift.startTime.split(':').map(Number);
      const shiftStart = new Date(now);
      shiftStart.setHours(sh, sm, 0, 0);

      const oneHourPrior = new Date(shiftStart.getTime() - 60 * 60 * 1000);

      if (now < oneHourPrior) {
        throw ApiError.badRequest(`Check-in not allowed yet. Your shift starts at ${shift.startTime}. You can check in from ${oneHourPrior.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} onwards.`);
      }
    }
  }

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
        'checkIn.address': address,
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
      address,
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

  // Outdoor staff cannot check-out from web
  const isAppRequest = !!deviceInfo?.platform && (deviceInfo.platform.toLowerCase() === 'android' || deviceInfo.platform.toLowerCase() === 'ios');
  if (req.user.workMode === 'OUTDOOR' && !isAppRequest) {
    throw ApiError.forbidden('Outdoor staff can only check out via the mobile application.');
  }

  const now = new Date();
  const address = await reverseGeocode(latitude, longitude);

  attendance.checkOut = {
    time: now,
    location: latitude != null ? { type: 'Point', coordinates: [longitude, latitude] } : undefined,
    address,
    deviceInfo,
  };

  attendance.workedMinutes = Math.round((now - attendance.checkIn.time) / 60000);

  // Requirement: If working hour is less than half of shift hour mark as half day
  let thresholdMinutes = 240; // Default 4 hours fallback

  if (req.user.shift) {
    const shift = await Shift.findById(req.user.shift);
    if (shift) {
      const [sh, sm] = shift.startTime.split(':').map(Number);
      const [eh, em] = shift.endTime.split(':').map(Number);

      let startMins = sh * 60 + sm;
      let endMins = eh * 60 + em;

      if (endMins < startMins) endMins += 1440; // Crosses midnight

      const totalShiftMinutes = endMins - startMins;
      thresholdMinutes = Math.floor(totalShiftMinutes / 2);
    }
  }

  if (attendance.workedMinutes < thresholdMinutes) {
    attendance.status = 'HALF_DAY';
  } else {
    attendance.status = 'PRESENT';
  }

  await attendance.save();

  if (latitude != null) {
    LocationLog.create({
      staff: req.user._id, company: req.user.company._id,
      location: { type: 'Point', coordinates: [longitude, latitude] },
      address,
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
  const date = todayStr();

  const [items, restriction] = await Promise.all([
    Attendance.find({
      staff: req.user._id,
      date: { $regex: `^${month}` },
    }).sort('-date'),
    checkAttendanceRestriction(req.user, date)
  ]);

  const lateDays = items.filter((a) => a.checkIn?.isLate).length;
  const presentDays = items.filter((a) => ['PRESENT', 'HALF_DAY'].includes(a.status)).length;
  const today = items.find((a) => a.date === date);

  res.json({
    success: true,
    data: { items, summary: { month, presentDays, lateDays }, today: today || null, restriction },
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

/** POST /attendance/requests */
export const createAttendanceRequest = asyncHandler(async (req, res) => {
  const { date, checkInTime, checkOutTime, reason } = req.body;
  if (!date || !checkInTime || !checkOutTime || !reason) {
    throw ApiError.badRequest('Missing required fields');
  }

  // Ensure checkOut is after checkIn
  if (new Date(checkOutTime) <= new Date(checkInTime)) {
    throw ApiError.badRequest('Check-out time must be after check-in time');
  }

  // Check if attendance already exists for this date
  const existing = await Attendance.findOne({ staff: req.user._id, date });
  if (existing?.checkIn?.time) {
    throw ApiError.conflict('Attendance already exists for this date');
  }

  const request = await AttendanceRequest.create({
    staff: req.user._id,
    company: req.user.company._id,
    date,
    checkInTime,
    checkOutTime,
    reason,
  });

  audit({ req, action: 'CREATE_ATTENDANCE_REQUEST', entity: 'AttendanceRequest', entityId: request._id });

  // Notify admin/owner
  realtime.notify(req.user.company._id.toString(), {
    title: 'New Attendance Request',
    message: `${req.user.name} has requested attendance for ${date} (Overtime/Off-day)`,
    type: 'ATTENDANCE_REQUEST',
    link: '/company/attendance' // Assuming this is where they manage it
  });

  res.status(201).json({ success: true, data: { request } });
});

/** GET /attendance/requests/me */
export const myAttendanceRequests = asyncHandler(async (req, res) => {
  const requests = await AttendanceRequest.find({ staff: req.user._id }).sort('-createdAt');
  res.json({ success: true, data: { requests } });
});

/** GET /attendance/requests (admin/owner) */
export const listAttendanceRequests = asyncHandler(async (req, res) => {
  const filter = { company: req.companyId };
  if (req.query.status) filter.status = req.query.status;

  const requests = await AttendanceRequest.find(filter)
    .populate('staff', 'name position profilePhoto')
    .sort('-createdAt');

  res.json({ success: true, data: { requests } });
});

/** PATCH /attendance/requests/:id/review */
export const reviewAttendanceRequest = asyncHandler(async (req, res) => {
  const { status, reviewNote } = req.body;
  if (!['APPROVED', 'REJECTED'].includes(status)) {
    throw ApiError.badRequest('Invalid status');
  }

  const request = await AttendanceRequest.findById(req.params.id).populate('staff');
  if (!request) throw ApiError.notFound('Request not found');
  if (request.status !== 'PENDING') throw ApiError.badRequest('Request already reviewed');

  request.status = status;
  request.reviewNote = reviewNote;
  request.reviewedBy = req.user._id;
  request.reviewedAt = new Date();

  if (status === 'APPROVED') {
    // Create actual attendance record
    const workedMinutes = Math.round((new Date(request.checkOutTime) - new Date(request.checkInTime)) / 60000);

    await Attendance.findOneAndUpdate(
      { staff: request.staff._id, date: request.date },
      {
        company: request.company,
        staff: request.staff._id,
        date: request.date,
        'checkIn.time': request.checkInTime,
        'checkIn.address': 'Approved Request',
        'checkOut.time': request.checkOutTime,
        'checkOut.address': 'Approved Request',
        workedMinutes,
        status: 'PRESENT', // Approved overtime counts as Present
      },
      { upsert: true, new: true }
    );
  }

  await request.save();

  audit({ req, action: 'REVIEW_ATTENDANCE_REQUEST', entity: 'AttendanceRequest', entityId: request._id, meta: { status } });

  // Notify staff
  realtime.notify(request.staff._id.toString(), {
    title: `Attendance Request ${status}`,
    message: `Your attendance request for ${request.date} has been ${status.toLowerCase()}.`,
    type: 'ATTENDANCE_REVIEW',
    link: '/staff/attendance'
  });

  res.json({ success: true, data: { request } });
});
