import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
    type: {
      type: String,
      enum: [
        'COMPANY_CREATED', 'STAFF_CREATED', 'PASSWORD_RESET',
        'LEAVE_APPLIED', 'LEAVE_APPROVED', 'LEAVE_REJECTED',
        'PAYROLL_GENERATED', 'SALE_SUBMITTED', 'PACKAGE_ASSIGNED',
        'LOW_STOCK', 'GENERAL',
      ],
      required: true,
    },
    title: { type: String, required: true, maxlength: 200 },
    message: { type: String, maxlength: 1000 },
    link: String,
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 }); // 90 days

export default mongoose.model('Notification', notificationSchema);
