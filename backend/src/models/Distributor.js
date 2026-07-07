import mongoose from 'mongoose';

const distributorSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    contactPerson: { type: String, trim: true },
    phone: { type: String, trim: true, maxlength: 20 },
    email: { type: String, lowercase: true, trim: true, match: [/^\S+@\S+\.\S+$/, 'Invalid email'] },
    address: { type: String, trim: true, maxlength: 300 },
    panVat: { type: String, trim: true, uppercase: true, maxlength: 30 },
    registrationNumber: { type: String, trim: true, maxlength: 50 },
    creditLimit: { type: Number, default: 0 },
    outstandingBalance: { type: Number, default: 0 },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'BLOCKED'], default: 'ACTIVE' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

distributorSchema.index({ company: 1, name: 1 });
distributorSchema.index({ company: 1, status: 1 });

export default mongoose.model('Distributor', distributorSchema);
