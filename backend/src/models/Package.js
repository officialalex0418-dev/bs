import mongoose from 'mongoose';
import { TRACKING_INTERVALS } from '../constants/roles.js';

const packageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true, maxlength: 100 },
    description: { type: String, maxlength: 500 },
    price: { type: Number, min: 0, default: 0 }, // per month
    maxStaff: { type: Number, required: true, min: 1 },
    trackingIntervalMinutes: {
      type: Number,
      enum: TRACKING_INTERVALS,
      default: 60,
    },
    features: {
      employeeTracking: { type: Boolean, default: true },
      inventoryManagement: { type: Boolean, default: false },
      vendorManagement: { type: Boolean, default: false },
      payrollManagement: { type: Boolean, default: false },
      salesTracking: { type: Boolean, default: false },
    },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
  },
  { timestamps: true }
);

export default mongoose.model('Package', packageSchema);
