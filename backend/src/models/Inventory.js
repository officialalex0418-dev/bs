import mongoose from 'mongoose';

const stockMovementSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['IN', 'OUT', 'ADJUST'], required: true },
    quantity: { type: Number, required: true },
    note: String,
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const inventorySchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    productName: { type: String, required: true, trim: true, maxlength: 200 },
    sku: { type: String, required: true, trim: true, uppercase: true, maxlength: 60 },
    category: { type: String, trim: true, maxlength: 100 },
    quantity: { type: Number, default: 0, min: 0 },
    costPrice: { type: Number, required: true, min: 0 },
    mrp: { type: Number, required: true, min: 0, default: 0 },
    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null },
    reorderLevel: { type: Number, default: 10, min: 0 },
    vatPct: { type: Number, default: 0 },
    batchNumber: { type: String, trim: true },
    expiryDate: Date,
    description: String,
    customFields: { type: Map, of: String },
    movements: { type: [stockMovementSchema], select: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

inventorySchema.index({ company: 1, sku: 1 }, { unique: true });
inventorySchema.index({ company: 1, productName: 1 });
inventorySchema.index({ company: 1, category: 1 });

inventorySchema.virtual('isLowStock').get(function () {
  return this.quantity <= this.reorderLevel;
});

inventorySchema.virtual('isNearExpiry').get(function () {
  if (!this.expiryDate) return false;
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  return this.expiryDate <= thirtyDaysFromNow && this.expiryDate >= new Date();
});

inventorySchema.virtual('isExpired').get(function () {
  if (!this.expiryDate) return false;
  return this.expiryDate < new Date();
});
inventorySchema.set('toJSON', { virtuals: true });

export default mongoose.model('Inventory', inventorySchema);
