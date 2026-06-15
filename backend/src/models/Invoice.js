import mongoose from 'mongoose';

const invoiceItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory' },
  productName: String,
  quantity: { type: Number, required: true },
  rate: { type: Number, required: true },
  taxPct: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  total: { type: Number, required: true },
});

const invoiceSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    distributor: { type: mongoose.Schema.Types.ObjectId, ref: 'Distributor', required: true },
    invoiceNumber: { type: String, required: true },
    items: [invoiceItemSchema],
    subTotal: { type: Number, required: true },
    taxTotal: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
    amountPaid: { type: Number, default: 0 },
    balanceDue: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: ['UNPAID', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED'], default: 'UNPAID' },
    remarks: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

invoiceSchema.index({ company: 1, invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ company: 1, distributor: 1 });
invoiceSchema.index({ status: 1 });

export default mongoose.model('Invoice', invoiceSchema);
