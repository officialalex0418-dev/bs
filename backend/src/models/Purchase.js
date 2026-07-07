import mongoose from 'mongoose';

const purchaseItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory' },
  productName: { type: String, required: true },
  batch: { type: String },
  price: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 1 },
  amount: { type: Number, required: true, min: 0 },
  expiryDate: { type: Date }
});

const purchaseSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  items: [purchaseItemSchema],
  totalAmount: { type: Number, required: true, min: 0 },
  discountPct: { type: Number, default: 0 },
  discountAmount: { type: Number, default: 0 },
  taxableAmount: { type: Number, required: true, min: 0 },
  vatPct: { type: Number, default: 0 },
  vatAmount: { type: Number, default: 0 },
  netTotal: { type: Number, required: true, min: 0 },
  purchaseDate: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('Purchase', purchaseSchema);
