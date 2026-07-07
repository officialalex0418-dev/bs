import mongoose from 'mongoose';

const chequeSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    distributor: { type: mongoose.Schema.Types.ObjectId, ref: 'Distributor', required: true },
    chequeNumber: { type: String, required: true },
    bankName: { type: String, required: true },
    issueDate: { type: Date },
    cashDate: { type: Date, required: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['ISSUED', 'COLLECTED', 'DEPOSITED', 'CASHED', 'BOUNCED'],
      default: 'ISSUED'
    },
    remarks: { type: String }
  },
  { timestamps: true }
);

chequeSchema.index({ company: 1, distributor: 1 });
chequeSchema.index({ cashDate: 1 });

export default mongoose.model('Cheque', chequeSchema);
