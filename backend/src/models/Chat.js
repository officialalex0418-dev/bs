import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isGroup: { type: Boolean, default: false },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    groupName: { type: String, maxlength: 100 },
    lastMessage: { type: String, maxlength: 500 },
    lastMessageAt: { type: Date, default: Date.now },
    lastMessageSender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    expiresAt: { type: Date, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: true }
);

chatSchema.index({ company: 1, lastMessageAt: -1 });
chatSchema.index({ participants: 1, lastMessageAt: -1 });

export default mongoose.model('Chat', chatSchema);
