import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
    action: { type: String, required: true }, // e.g. LOGIN, LOGIN_FAILED, CREATE_STAFF, UPDATE_PACKAGE
    entity: String, // collection / module
    entityId: String,
    ip: String,
    userAgent: String,
    meta: mongoose.Schema.Types.Mixed,
    success: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ company: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 }); // 1 year

export default mongoose.model('AuditLog', auditLogSchema);
