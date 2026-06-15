import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    distributor: { type: mongoose.Schema.Types.ObjectId, ref: 'Distributor', required: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: ['CASH', 'CHEQUE', 'BANK_TRANSFER'], required: true },
    paymentDate: { type: Date, default: Date.now },
    chequeDetails: {
      number: String,
      bankName: String,
      depositDate: Date,
      maturityDate: Date,
      status: { type: String, enum: ['PENDING', 'CLEARED', 'BOUNCED'], default: 'PENDING' },
    },
    bankTransferReference: String,
    remarks: String,
    adjustedInvoices: [{
      invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
      amount: Number,
    }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

paymentSchema.index({ company: 1, distributor: 1 });
paymentSchema.index({ 'chequeDetails.status': 1 });

export default mongoose.model('Payment', paymentSchema);
