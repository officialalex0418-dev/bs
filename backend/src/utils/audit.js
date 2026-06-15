import AuditLog from '../models/AuditLog.js';

/** Fire-and-forget audit logger — never blocks the request path. */
export function audit({ req, user, company, action, entity, entityId, meta, success = true }) {
  const doc = {
    user: user?._id || user || req?.user?._id,
    company: company || req?.user?.company || null,
    action,
    entity,
    entityId: entityId ? String(entityId) : undefined,
    ip: req?.ip,
    userAgent: req?.headers?.['user-agent'],
    meta,
    success,
  };
  AuditLog.create(doc).catch((e) => console.error('audit log failed:', e.message));
}
