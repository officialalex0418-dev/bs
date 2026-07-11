import mongoose from 'mongoose';

const vendorPaymentSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: ['CASH', 'CHEQUE', 'BANK_TRANSFER'], required: true },
    paymentDate: { type: Date, default: Date.now },
    chequeDetails: {
      number: String,
      bankName: String,
      maturityDate: Date,
      status: { type: String, enum: ['PENDING', 'CLEARED', 'BOUNCED'], default: 'PENDING' },
    },
    bankTransferReference: String,
    remarks: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

vendorPaymentSchema.index({ company: 1, vendor: 1 });
vendorPaymentSchema.index({ paymentDate: -1 });

export default mongoose.model('VendorPayment', vendorPaymentSchema);
