import mongoose from 'mongoose';
import { LEAVE_TYPES, LEAVE_STATUS } from '../constants/roles.js';

const leaveSchema = new mongoose.Schema(
  {
    staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    type: { type: String, enum: LEAVE_TYPES, required: true },
    fromDate: { type: Date, required: true },
    toDate: {
      type: Date,
      required: true,
      validate: {
        validator() { return this.toDate >= this.fromDate; },
        message: 'toDate must be after fromDate',
      },
    },
    days: { type: Number, min: 0.5, required: true },
    reason: { type: String, maxlength: 500 },
    status: { type: String, enum: LEAVE_STATUS, default: 'PENDING', index: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    reviewNote: { type: String, maxlength: 300 },
  },
  { timestamps: true }
);

leaveSchema.index({ company: 1, status: 1, createdAt: -1 });
leaveSchema.index({ staff: 1, createdAt: -1 });

export default mongoose.model('Leave', leaveSchema);
