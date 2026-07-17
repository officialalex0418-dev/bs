import mongoose from 'mongoose';

const attendanceRequestSchema = new mongoose.Schema(
  {
    staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    checkInTime: { type: Date, required: true },
    checkOutTime: { type: Date, required: true },
    reason: { type: String, required: true, maxlength: 500 },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    reviewNote: { type: String, maxlength: 300 },
  },
  { timestamps: true }
);

attendanceRequestSchema.index({ company: 1, date: -1 });
attendanceRequestSchema.index({ staff: 1, status: 1 });

export default mongoose.model('AttendanceRequest', attendanceRequestSchema);
