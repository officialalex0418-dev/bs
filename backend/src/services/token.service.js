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

export function signRefreshToken(user) {
  return jwt.sign({ sub: user._id.toString(), type: 'refresh' }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpires,
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
    .slice(-9); // keep max 10 sessions
  user.refreshTokens.push({
    tokenHash: hashToken(refreshToken),
    device: req?.headers?.['user-agent']?.slice(0, 200),
    ip: req?.ip,
    expiresAt: new Date(decoded.exp * 1000),
  });
  await user.save({ validateBeforeSave: false });
}
