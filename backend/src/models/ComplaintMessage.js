import mongoose from 'mongoose';

const complaintMessageSchema = new mongoose.Schema(
  {
    complaint: { type: mongoose.Schema.Types.ObjectId, ref: 'Complaint', required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, maxlength: 2000 },
    expiresAt: { type: Date, index: { expireAfterSeconds: 0 } },
    attachments: [String],
  },
  { timestamps: true }
);

export default mongoose.model('ComplaintMessage', complaintMessageSchema);
