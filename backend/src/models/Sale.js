import mongoose from 'mongoose';

const saleSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', default: null },
    productName: { type: String, required: true, trim: true, maxlength: 200 },
    quantity: { type: Number, required: true, min: 1 },
    amount: { type: Number, required: true, min: 0 },
    customerName: { type: String, trim: true, maxlength: 150 },
    remarks: { type: String, maxlength: 500 },
    saleDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

saleSchema.index({ company: 1, saleDate: -1 });
saleSchema.index({ company: 1, staff: 1, saleDate: -1 });
saleSchema.index({ company: 1, productName: 1 });

export default mongoose.model('Sale', saleSchema);
