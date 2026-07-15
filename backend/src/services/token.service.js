import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';

export function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      company: user.company?._id?.toString() || user.company?.toString() || null,
      needsPasswordChange: !!user.needsPasswordChange,
    },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpires }
  );
}

export function signRefreshToken(user, isMobile = false) {
  const expiresIn = isMobile ? '365d' : '30m';
  return jwt.sign({ sub: user._id.toString(), type: 'refresh', isMobile }, env.jwt.refreshSecret, {
    expiresIn,
  });
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret);
}

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/** Store a hashed refresh token on the user document (rotation-friendly). */
export async function persistRefreshToken(user, refreshToken, req) {
  const decoded = jwt.decode(refreshToken);
  user.refreshTokens = (user.refreshTokens || [])
    .filter((t) => t.expiresAt > new Date())
    .slice(-19); // keep max 20 sessions
  user.refreshTokens.push({
    tokenHash: hashToken(refreshToken),
    device: decoded.isMobile ? 'mobile' : 'web',
    ip: req?.ip,
    expiresAt: new Date(decoded.exp * 1000),
    createdAt: new Date(),
  });
  await user.save({ validateBeforeSave: false });
}
