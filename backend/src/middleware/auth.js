import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import User from '../models/User.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';

/** Verifies access token (Authorization: Bearer <token>) and attaches req.user */
export const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw ApiError.unauthorized('Not authenticated');

  const token = header.split(' ')[1];
  let payload;
  try {
    payload = jwt.verify(token, env.jwt.accessSecret);
  } catch (e) {
    throw ApiError.unauthorized(e.name === 'TokenExpiredError' ? 'Access token expired' : 'Invalid token');
  }

  const user = await User.findById(payload.sub).populate({
    path: 'company',
    select: 'name status package settings address phone panVat registrationNumber logo website description additionalInfo',
    populate: { path: 'package', select: 'name status features chatRetentionDays trackingIntervalMinutes' }
  }).populate({
    path: 'designation',
    populate: { path: 'department', select: 'name' }
  });

  if (!user || !user.isActive) throw ApiError.unauthorized('Account disabled or not found');
  if (user.company && user.company.status === 'SUSPENDED') {
    throw ApiError.forbidden('Company account is suspended');
  }

  // Force password change if required
  if (user.needsPasswordChange && req.path !== '/auth/change-password' && req.method !== 'PATCH') {
    // We allow fetching basic info/settings but block other actions
    const allowedPaths = ['/auth/me', '/auth/settings', '/auth/logout', '/auth/refresh'];
    if (!allowedPaths.some(p => req.path.includes(p))) {
      throw ApiError.forbidden('Please change your temporary password to continue');
    }
  }

  req.user = user;
  next();
});
