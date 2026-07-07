import mongoose from 'mongoose';

const holidaySchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    name: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    description: { type: String, trim: true },
  },
  { timestamps: true }
);

holidaySchema.index({ company: 1, startDate: 1, endDate: 1 }, { unique: true });

export default mongoose.model('Holiday', holidaySchema);
