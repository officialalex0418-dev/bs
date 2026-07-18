import mongoose from 'mongoose';

const salesInvoiceItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory' },
  productName: { type: String, required: true },
  batch: { type: String },
  price: { type: Number, required: true, min: 0 },
  mrp: { type: Number, min: 0 },
  quantity: { type: Number, required: true, min: 1 },
  amount: { type: Number, required: true, min: 0 }
});

const salesInvoiceSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  invoiceNumber: { type: String, required: true },
  distributor: { type: mongoose.Schema.Types.ObjectId, ref: 'Distributor' },
  customerName: { type: String }, // keeping this as fallback or for walk-in
  items: [salesInvoiceItemSchema],
  totalAmount: { type: Number, required: true, min: 0 },
  discountPct: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  taxableAmount: { type: Number, required: true, min: 0 },
  vatPct: { type: Number, default: 0 },
  vatAmount: { type: Number, default: 0 },
  netTotal: { type: Number, required: true, min: 0 },
  paymentMethod: { type: String, enum: ['Cash', 'Online/QR', 'Cheque', 'Credit'], required: true },
  saleDate: { type: Date, default: Date.now },
  dueDate: { type: Date }
}, { timestamps: true });

salesInvoiceSchema.index({ company: 1, invoiceNumber: 1 }, { unique: true });

export default mongoose.model('SalesInvoice', salesInvoiceSchema);
