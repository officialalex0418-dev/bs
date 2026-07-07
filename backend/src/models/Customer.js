import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    contactNumber: { type: String, trim: true },
    panVat: { type: String, trim: true },
    ownerName: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

customerSchema.index({ company: 1, name: 1 });

export default mongoose.model('Customer', customerSchema);
