import mongoose from 'mongoose';

/**
 * High-volume collection. Uses GeoJSON + compound indexes for fast
 * "route history for staff X between dates" and geo queries (heatmaps).
 * Recommended: enable MongoDB Atlas Online Archive / TTL for old data.
 */
const locationLogSchema = new mongoose.Schema(
  {
    staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: {
        type: [Number], // [lng, lat]
        required: true,
        validate: {
          validator: (v) =>
            v.length === 2 && v[0] >= -180 && v[0] <= 180 && v[1] >= -90 && v[1] <= 90,
          message: 'Invalid coordinates',
        },
      },
    },
    accuracy: { type: Number, min: 0 }, // metres
    address: { type: String },
    batteryLevel: { type: Number, min: 0, max: 100 },
    deviceInfo: {
      platform: String, // android / ios / web
      model: String,
      osVersion: String,
      appVersion: String,
    },
    recordedAt: { type: Date, required: true, default: Date.now },
    source: { type: String, enum: ['BACKGROUND', 'CHECKIN', 'CHECKOUT', 'MANUAL'], default: 'BACKGROUND' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// ---------- Indexes ----------
locationLogSchema.index({ staff: 1, recordedAt: -1 });
locationLogSchema.index({ company: 1, recordedAt: -1 });
locationLogSchema.index({ location: '2dsphere' });
// Optional auto-purge of raw pings after 180 days (route summaries should be aggregated)
locationLogSchema.index({ recordedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

export default mongoose.model('LocationLog', locationLogSchema);
