import mongoose from 'mongoose';

const leaveTypeSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true, trim: true },
    days: { type: Number, default: 0 }, // max days allowed per year
    isPaid: { type: Boolean, default: true },
    description: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

leaveTypeSchema.index({ company: 1, name: 1 }, { unique: true });

export default mongoose.model('LeaveType', leaveTypeSchema);
