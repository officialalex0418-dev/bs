import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * Socket.io with JWT auth + room-based multi-tenancy.
 * Rooms:
 *   platform            → super admin / admin employees
 *   company:<companyId> → owner + managers of that company
 *   user:<userId>       → personal notifications
 *
 * Client emits:
 *   staff:location { lat, lng, accuracy, ... }  (relayed after REST save — see location.controller)
 */
let io = null;

export function initSocket(server) {
  io = new Server(server, {
    cors: { origin: env.clientUrl, credentials: true },
    transports: ['websocket', 'polling'],
  });

  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(' ')[1];
      if (!token) return next(new Error('Authentication required'));
      const payload = jwt.verify(token, env.jwt.accessSecret);
      socket.user = { id: payload.sub, role: payload.role, company: payload.company };
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { id, role, company } = socket.user;
    socket.join(`user:${id}`);
    if (role === 'SUPER_ADMIN' || role === 'ADMIN_EMPLOYEE') socket.join('platform');
    if (company && ['COMPANY_OWNER', 'COMPANY_MANAGER'].includes(role)) {
      socket.join(`company:${company}`);
    }

    socket.on('disconnect', () => {});
  });

  console.log('🔌 Socket.io initialized');
  return io;
}

export function getIO() {
  return io;
}

// ---------- Emit helpers (safe even if io not initialized, e.g. tests) ----------
export const realtime = {
  /** Live staff location → company room + platform room */
  staffLocation(companyId, payload) {
    if (!io) return;
    io.to(`company:${companyId}`).to('platform').emit('location:update', payload);
  },
  /** Dashboard counters changed */
  dashboard(companyId, payload) {
    if (!io) return;
    if (companyId) io.to(`company:${companyId}`).emit('dashboard:update', payload);
    io.to('platform').emit('dashboard:update', { companyId, ...payload });
  },
  /** Personal notification */
  notify(userId, notification) {
    if (!io) return;
    io.to(`user:${userId}`).emit('notification:new', notification);
  },
  /** Activity feed */
  activity(companyId, activity) {
    if (!io) return;
    if (companyId) io.to(`company:${companyId}`).emit('activity:new', activity);
    io.to('platform').emit('activity:new', { companyId, ...activity });
  },
};
