import mongoose from 'mongoose';

const vendorSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    phone: { type: String, trim: true, maxlength: 20 },
    email: { type: String, lowercase: true, trim: true, match: [/^\S+@\S+\.\S+$/, 'Invalid email'] },
    address: { type: String, trim: true, maxlength: 300 },
    panVat: { type: String, trim: true, uppercase: true, maxlength: 30 },
    registrationNumber: { type: String, trim: true, maxlength: 50 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

vendorSchema.index({ company: 1, name: 1 });

export default mongoose.model('Vendor', vendorSchema);
