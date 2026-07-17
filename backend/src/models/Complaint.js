import mongoose from 'mongoose';

const complaintSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // Null if group
    isGroup: { type: Boolean, default: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    type: {
      type: String,
      enum: ['CHAT', 'COMPLAINT'],
      default: 'CHAT',
    },
    subject: { type: String, required: true, maxlength: 200 },
    message: { type: String, maxlength: 2000 },
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
      default: 'OPEN',
    },
    lastMessage: { type: String, maxlength: 500 },
    lastMessageAt: { type: Date, default: Date.now },
    lastMessageSender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    expiresAt: { type: Date, index: { expireAfterSeconds: 0 } },
    attachments: [String],
  },
  { timestamps: true }
);

complaintSchema.index({ company: 1, createdAt: -1 });
complaintSchema.index({ sender: 1, createdAt: -1 });
complaintSchema.index({ recipient: 1, createdAt: -1 });

export default mongoose.model('Complaint', complaintSchema);
