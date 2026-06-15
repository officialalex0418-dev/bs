import mongoose from 'mongoose';

/** Singleton-ish settings document (per scope). scope=PLATFORM for super admin, or company id */
const settingSchema = new mongoose.Schema(
  {
    scope: { type: String, required: true, unique: true }, // 'PLATFORM' or companyId string
    smtp: {
      host: String,
      port: Number,
      secure: Boolean,
      user: String,
      // pass intentionally NOT stored in DB readable form in this template;
      // production: use a secret manager / encrypted field.
    },
    branding: {
      appName: { type: String, default: 'Business Sarthi' },
      logoUrl: String,
      primaryColor: { type: String, default: '#2563eb' },
    },
    security: {
      sessionTimeoutMinutes: { type: Number, default: 60 },
      enforceStrongPasswords: { type: Boolean, default: true },
      maxLoginAttempts: { type: Number, default: 5 },
    },
  },
  { timestamps: true }
);

export default mongoose.model('Setting', settingSchema);
