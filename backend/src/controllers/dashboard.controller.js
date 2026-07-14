import mongoose from 'mongoose';
import Company from '../models/Company.js';
import User from '../models/User.js';
import Package from '../models/Package.js';
import Attendance from '../models/Attendance.js';
import Sale from '../models/Sale.js';
import LocationLog from '../models/LocationLog.js';
import AuditLog from '../models/AuditLog.js';
import Leave from '../models/Leave.js';
import Holiday from '../models/Holiday.js';
import { asyncHandler } from '../utils/ApiError.js';
import { todayStr } from '../utils/dates.js';

const oid = (id) => new mongoose.Types.ObjectId(id);

/** GET /dashboard/super — Super Admin dashboard */
export const superDashboard = asyncHandler(async (_req, res) => {
  const today = todayStr();
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);

  const [
    totalCompanies, companiesToday, totalStaff, activeStaff,
    checkedInToday, activePackages, packages, recentActivities,
    trackingPingsToday,
  ] = await Promise.all([
    Company.countDocuments({}),
    Company.countDocuments({ createdAt: { $gte: startOfToday } }),
    User.countDocuments({ role: { $in: ['STAFF', 'COMPANY_MANAGER'] } }),
    User.countDocuments({ role: { $in: ['STAFF', 'COMPANY_MANAGER'] }, isActive: true }),
    Attendance.countDocuments({ date: today, 'checkIn.time': { $exists: true } }),
    Package.countDocuments({ status: 'ACTIVE' }),
    Package.find({ status: 'ACTIVE' }).lean(),
    AuditLog.find({}).populate('user', 'name role').sort('-createdAt').limit(15).lean(),
    LocationLog.countDocuments({ recordedAt: { $gte: startOfToday } }),
  ]);

  // Revenue estimate = sum of package price × companies on it
  const revenueAgg = await Company.aggregate([
    { $match: { status: 'ACTIVE', package: { $ne: null } } },
    { $lookup: { from: 'packages', localField: 'package', foreignField: '_id', as: 'pkg' } },
    { $unwind: '$pkg' },
    { $group: { _id: null, monthlyRevenue: { $sum: '$pkg.price' } } },
  ]);

  res.json({
    success: true,
    data: {
      totalCompanies,
      companiesToday,
      totalStaff,
      activeStaff,
      checkedInToday,
      monthlyRevenue: revenueAgg[0]?.monthlyRevenue || 0,
      activePackages,
      packages,
      trackingPingsToday,
      recentActivities,
    },
  });
});

/** GET /dashboard/company — Company owner / manager dashboard */
export const companyDashboard = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const today = todayStr();
  const month = today.slice(0, 7);
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
  const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [
    company, totalStaff, activeStaff, checkedInToday, monthlyAttendance,
    dailySalesAgg, monthlySalesAgg, salesGraph, recentActivities, pendingLeaves,
  ] = await Promise.all([
    Company.findById(companyId).populate('package', 'name'),
    User.countDocuments({ company: companyId, role: { $in: ['STAFF', 'COMPANY_MANAGER'] } }),
    User.countDocuments({ company: companyId, role: { $in: ['STAFF', 'COMPANY_MANAGER'] }, isActive: true }),
    Attendance.countDocuments({ company: companyId, date: today, 'checkIn.time': { $exists: true } }),
    Attendance.countDocuments({ company: companyId, date: { $regex: `^${month}` }, status: { $in: ['PRESENT', 'HALF_DAY'] } }),
    Sale.aggregate([
      { $match: { company: oid(companyId), saleDate: { $gte: startOfToday } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Sale.aggregate([
      { $match: { company: oid(companyId), saleDate: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Sale.aggregate([
      { $match: { company: oid(companyId), saleDate: { $gte: sixMonthsAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$saleDate' } }, total: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
      { $project: { month: '$_id', total: 1, _id: 0 } },
    ]),
    AuditLog.find({ company: companyId }).populate('user', 'name').sort('-createdAt').limit(15).lean(),
    Leave.countDocuments({ company: companyId, status: 'PENDING' }),
  ]);

  res.json({
    success: true,
    data: {
      company,
      totalStaff, activeStaff, checkedInToday, monthlyAttendance,
      dailySales: dailySalesAgg[0]?.total || 0,
      monthlySales: monthlySalesAgg[0]?.total || 0,
      salesGraph,
      pendingLeaves,
      recentActivities,
    },
  });
});

/** GET /dashboard/staff — Staff app dashboard */
export const staffDashboard = asyncHandler(async (req, res) => {
  const userId = oid(req.user._id);
  const today = todayStr();
  const month = today.slice(0, 7);
  const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);

  const [todayAttendance, monthAttendance, salesAgg, upcomingHolidays, recentLeaves] = await Promise.all([
    Attendance.findOne({ staff: userId, date: today }),
    Attendance.find({ staff: userId, date: { $regex: `^${month}` } }).lean(),
    Sale.aggregate([
      { $match: { staff: userId, saleDate: { $gte: startOfMonth } } },
      { $group: { _id: null, achieved: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Holiday.find({ company: req.user.company?._id, startDate: { $gte: new Date() } })
      .sort('startDate').limit(5).lean(),
    Leave.find({ staff: userId }).sort('-createdAt').limit(5).lean(),
  ]);

  const lateDays = monthAttendance.filter((a) => a.checkIn?.isLate).length;
  const presentDays = monthAttendance.filter((a) => ['PRESENT', 'HALF_DAY'].includes(a.status)).length;
  const achieved = salesAgg[0]?.achieved || 0;
  const target = req.user.monthlyTarget || 0;

  res.json({
    success: true,
    data: {
      profile: {
        name: req.user.name,
        position: req.user.position,
        profilePhoto: req.user.profilePhoto,
        company: req.user.company?.name,
        email: req.user.email,
        phone: req.user.phone,
        department: req.user.designation?.department?.name || '—',
      },
      checkInStatus: !!todayAttendance?.checkIn?.time,
      checkOutStatus: !!todayAttendance?.checkOut?.time,
      checkInTime: todayAttendance?.checkIn?.time || null,
      checkOutTime: todayAttendance?.checkOut?.time || null,
      leaveBalance: req.user.leaveBalance,
      lateDays,
      presentDays,
      monthlyTarget: target,
      achievedTarget: achieved,
      remainingTarget: Math.max(target - achieved, 0),
      salesProgressPct: target ? Math.min(Math.round((achieved / target) * 100), 100) : 0,
      attendanceProgressPct: Math.min(Math.round((presentDays / 26) * 100), 100),
      upcomingHolidays,
      recentLeaves,
    },
  });
});
