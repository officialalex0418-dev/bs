import mongoose from 'mongoose';

const branchSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true, trim: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    radius: { type: Number, default: 100 }, // in meters
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  },
  { timestamps: true }
);

branchSchema.index({ company: 1, name: 1 }, { unique: true });
branchSchema.index({ location: '2dsphere' });

export default mongoose.model('Branch', branchSchema);
