import mongoose from 'mongoose';
import LocationLog from '../models/LocationLog.js';
import User from '../models/User.js';
import Attendance from '../models/Attendance.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { realtime } from '../sockets/index.js';
import { rangeFromPeriod, todayStr } from '../utils/dates.js';

const toObjectId = (id) => new mongoose.Types.ObjectId(id);

/**
 * POST /locations — staff device pushes a location ping
 * Body: { latitude, longitude, accuracy, batteryLevel, deviceInfo, recordedAt, source }
 * Supports batch: { pings: [...] } for offline-queued points.
 */
export const pushLocation = asyncHandler(async (req, res) => {
  const companyId = req.user.company?._id;
  if (!companyId) throw ApiError.forbidden('No company associated');

  const pings = req.body.pings || [req.body];
  const docs = pings.map((p) => ({
    staff: req.user._id,
    company: companyId,
    location: { type: 'Point', coordinates: [p.longitude, p.latitude] },
    accuracy: p.accuracy,
    batteryLevel: p.batteryLevel,
    deviceInfo: p.deviceInfo,
    recordedAt: p.recordedAt ? new Date(p.recordedAt) : new Date(),
    source: p.source || 'BACKGROUND',
  }));

  const saved = await LocationLog.insertMany(docs, { ordered: false });

  // Realtime: broadcast latest point to company + platform dashboards
  const latest = saved[saved.length - 1];
  realtime.staffLocation(companyId.toString(), {
    staffId: req.user._id,
    staffName: req.user.name,
    lat: latest.location.coordinates[1],
    lng: latest.location.coordinates[0],
    accuracy: latest.accuracy,
    recordedAt: latest.recordedAt,
  });

  res.status(201).json({ success: true, data: { saved: saved.length } });
});

/** GET /locations/interval — staff app asks how often to ping (from company package) */
export const getTrackingConfig = asyncHandler(async (req, res) => {
  const pkg = req.companyPackage; // set by requireFeature middleware
  res.json({
    success: true,
    data: {
      enabled: !!pkg?.features?.employeeTracking,
      intervalMinutes: pkg?.trackingIntervalMinutes || 60,
    },
  });
});

/** GET /locations/live — latest location per active staff (owner/manager/admin) */
export const liveLocations = asyncHandler(async (req, res) => {
  const companyMatch = req.companyId ? { company: toObjectId(req.companyId) } : {};
  const today = todayStr();

  // 1. Find staff who are checked in today and haven't checked out
  const activeAttendance = await Attendance.find({
    ...companyMatch,
    date: today,
    'checkIn.time': { $exists: true },
    'checkOut.time': { $exists: false },
  }).select('staff checkIn.time');

  const activeStaffIds = activeAttendance.map((a) => a.staff);
  if (!activeStaffIds.length) {
    return res.json({ success: true, data: { items: [] } });
  }

  // 2. Get latest location for these staff members
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const latest = await LocationLog.aggregate([
    { $match: {
        ...companyMatch,
        staff: { $in: activeStaffIds },
        recordedAt: { $gte: since }
    } },
    { $sort: { recordedAt: -1 } },
    { $group: { _id: '$staff', doc: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$doc' } },
    {
      $lookup: {
        from: 'users', localField: 'staff', foreignField: '_id', as: 'staffInfo',
        pipeline: [{ $project: { name: 1, position: 1, profilePhoto: 1 } }],
      },
    },
    { $unwind: '$staffInfo' },
    { $limit: 500 },
  ]);

  // Map for fast lookup
  const attMap = Object.fromEntries(activeAttendance.map((a) => [a.staff.toString(), a.checkIn.time]));

  res.json({
    success: true,
    data: {
      items: latest.map((l) => ({
        staffId: l.staff,
        name: l.staffInfo.name,
        position: l.staffInfo.position,
        profilePhoto: l.staffInfo.profilePhoto,
        lat: l.location.coordinates[1],
        lng: l.location.coordinates[0],
        accuracy: l.accuracy,
        batteryLevel: l.batteryLevel,
        recordedAt: l.recordedAt,
        checkInTime: attMap[l.staff.toString()],
      })),
    },
  });
});

/** GET /locations/history/:staffId?from=&to= — route history / playback */
export const routeHistory = asyncHandler(async (req, res) => {
  const staff = await User.findById(req.params.staffId);
  if (!staff) throw ApiError.notFound('Staff not found');
  assertScope(req, staff);

  const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 24 * 3600 * 1000);
  const to = req.query.to ? new Date(req.query.to) : new Date();

  const logs = await LocationLog.find({
    staff: staff._id,
    recordedAt: { $gte: from, $lte: to },
  }).sort('recordedAt').limit(5000).lean();

  res.json({
    success: true,
    data: {
      staff: { id: staff._id, name: staff.name },
      points: logs.map((l) => ({
        lat: l.location.coordinates[1],
        lng: l.location.coordinates[0],
        accuracy: l.accuracy,
        recordedAt: l.recordedAt,
        source: l.source,
      })),
    },
  });
});

/** GET /locations/heatmap?period=daily|weekly|monthly — movement heatmap data */
export const heatmap = asyncHandler(async (req, res) => {
  const { start, end } = rangeFromPeriod(req.query.period || 'weekly');
  const match = { recordedAt: { $gte: start, $lte: end } };
  if (req.companyId) match.company = toObjectId(req.companyId);

  const points = await LocationLog.aggregate([
    { $match: match },
    { $sample: { size: 3000 } }, // cap for client rendering
    {
      $project: {
        _id: 0,
        lat: { $arrayElemAt: ['$location.coordinates', 1] },
        lng: { $arrayElemAt: ['$location.coordinates', 0] },
      },
    },
  ]);
  res.json({ success: true, data: { points } });
});

/** GET /locations/analysis/:staffId?period= — movement stats (distance, pings, active hours) */
export const movementAnalysis = asyncHandler(async (req, res) => {
  const staff = await User.findById(req.params.staffId);
  if (!staff) throw ApiError.notFound('Staff not found');
  assertScope(req, staff);

  const { start, end } = rangeFromPeriod(req.query.period || 'daily');
  const logs = await LocationLog.find({ staff: staff._id, recordedAt: { $gte: start, $lte: end } })
    .sort('recordedAt').lean();

  let distanceKm = 0;
  for (let i = 1; i < logs.length; i++) {
    distanceKm += haversine(
      logs[i - 1].location.coordinates[1], logs[i - 1].location.coordinates[0],
      logs[i].location.coordinates[1], logs[i].location.coordinates[0]
    );
  }

  res.json({
    success: true,
    data: {
      staff: { id: staff._id, name: staff.name },
      period: req.query.period || 'daily',
      totalPings: logs.length,
      distanceKm: Math.round(distanceKm * 100) / 100,
      firstPing: logs[0]?.recordedAt || null,
      lastPing: logs[logs.length - 1]?.recordedAt || null,
    },
  });
});

// ---------- helpers ----------
function assertScope(req, staff) {
  if (['SUPER_ADMIN', 'ADMIN_EMPLOYEE'].includes(req.user.role)) return;
  if (staff.company?.toString() !== req.user.company?._id?.toString()) {
    throw ApiError.forbidden('Staff outside your company');
  }
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
