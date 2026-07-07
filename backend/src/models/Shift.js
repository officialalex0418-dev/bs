import mongoose from 'mongoose';

const shiftSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true, trim: true },
    workingDays: [{ type: String, enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] }],
    startTime: { type: String, required: true }, // HH:mm
    endTime: { type: String, required: true },
    bufferTime: { type: Number, default: 0 }, // minutes
  },
  { timestamps: true }
);

shiftSchema.index({ company: 1, name: 1 }, { unique: true });

export default mongoose.model('Shift', shiftSchema);
