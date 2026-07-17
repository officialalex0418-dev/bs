import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema(
  {
    chat: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, maxlength: 2000 },
    attachments: [String], // Base64 or URL
    expiresAt: { type: Date, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: true }
);

chatMessageSchema.index({ chat: 1, createdAt: 1 });

export default mongoose.model('ChatMessage', chatMessageSchema);
