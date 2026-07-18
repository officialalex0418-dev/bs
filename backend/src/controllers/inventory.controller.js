import Inventory from '../models/Inventory.js';
import User from '../models/User.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { getPagination, paginatedResponse } from '../utils/pagination.js';
import { audit } from '../utils/audit.js';
import { notify } from '../services/notification.service.js';

/** GET /inventory */
export const listInventory = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { company: req.companyId, isActive: true };
  if (req.query.category) filter.category = req.query.category;
  if (req.query.lowStock === 'true') filter.$expr = { $lte: ['$quantity', '$reorderLevel'] };

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  if (req.query.expirySoon === 'true') {
    filter.expiryDate = { $lte: thirtyDaysFromNow, $gte: new Date() };
  }

  if (req.query.search) {
    filter.$or = [
      { productName: { $regex: req.query.search, $options: 'i' } },
      { sku: { $regex: req.query.search, $options: 'i' } },
    ];
  }

  const [items, total, lowStockCount, nearExpiryCount] = await Promise.all([
    Inventory.find(filter).populate('vendor', 'name').sort('productName').skip(skip).limit(limit),
    Inventory.countDocuments(filter),
    Inventory.countDocuments({ company: req.companyId, isActive: true, $expr: { $lte: ['$quantity', '$reorderLevel'] } }),
    Inventory.countDocuments({
      company: req.companyId,
      isActive: true,
      expiryDate: { $lte: thirtyDaysFromNow, $gte: new Date() }
    }),
  ]);
  res.json({ success: true, data: { ...paginatedResponse(items, total, page, limit), lowStockCount, nearExpiryCount } });
});

/** POST /inventory */
export const createProduct = asyncHandler(async (req, res) => {
  const product = await Inventory.create({ ...req.body, company: req.companyId });
  audit({ req, action: 'CREATE_PRODUCT', entity: 'Inventory', entityId: product._id });
  res.status(201).json({ success: true, data: { product } });
});

/** PATCH /inventory/:id */
export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Inventory.findOneAndUpdate(
    { _id: req.params.id, company: req.companyId },
    req.body,
    { new: true, runValidators: true }
  );
  if (!product) throw ApiError.notFound('Product not found');
  audit({ req, action: 'UPDATE_PRODUCT', entity: 'Inventory', entityId: product._id });
  res.json({ success: true, data: { product } });
});

/** POST /inventory/:id/stock { type: IN|OUT|ADJUST, quantity, note } */
export const adjustStock = asyncHandler(async (req, res) => {
  const { type, quantity, note } = req.body;
  const product = await Inventory.findOne({ _id: req.params.id, company: req.companyId }).select('+movements');
  if (!product) throw ApiError.notFound('Product not found');

  if (type === 'IN') product.quantity += quantity;
  else if (type === 'OUT') {
    if (product.quantity < quantity) throw ApiError.badRequest(`Insufficient stock (${product.quantity} available)`);
    product.quantity -= quantity;
  } else product.quantity = quantity; // ADJUST = set absolute

  product.movements.push({ type, quantity, note, by: req.user._id });
  await product.save();

  // Low stock alert
  if (product.quantity <= product.reorderLevel) {
    const owners = await User.find({ company: req.companyId, role: 'COMPANY_OWNER', isActive: true });
    for (const o of owners) {
      notify({
        recipient: o._id, company: req.companyId, type: 'LOW_STOCK',
        title: 'Low stock alert',
        message: `${product.productName} stock is low (${product.quantity} ≤ reorder level ${product.reorderLevel}).`,
      });
    }
  }

  audit({ req, action: 'STOCK_' + type, entity: 'Inventory', entityId: product._id, meta: { quantity } });
  res.json({ success: true, data: { product } });
});

/** DELETE /inventory/:id — soft delete */
export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Inventory.findOneAndUpdate(
    { _id: req.params.id, company: req.companyId },
    { isActive: false },
    { new: true }
  );
  if (!product) throw ApiError.notFound('Product not found');
  audit({ req, action: 'DELETE_PRODUCT', entity: 'Inventory', entityId: product._id });
  res.json({ success: true, message: 'Product removed' });
});

/** DELETE /inventory/:id/hard */
export const hardDeleteProduct = asyncHandler(async (req, res) => {
  const product = await Inventory.findOneAndDelete({ _id: req.params.id, company: req.companyId });
  if (!product) throw ApiError.notFound('Product not found');
  audit({ req, action: 'HARD_DELETE_PRODUCT', entity: 'Inventory', entityId: product._id });
  res.json({ success: true, message: 'Product permanently deleted' });
});

/** POST /inventory/bulk-upload */
export const bulkUpload = asyncHandler(async (req, res) => {
  const { products } = req.body;
  if (!Array.isArray(products)) throw ApiError.badRequest('Invalid products array');

  const results = { created: 0, errors: [], duplicates: 0 };
  const toInsert = [];

  for (const p of products) {
    // Normalization logic for different field names (supporting image format)
    const normalized = {
        productName: p.productName || p['Product Name'],
        batchNumber: p.batchNumber || p.batch || p['Batch'],
        quantity: p.quantity || p.qty || p['QTY'] || 0,
        costPrice: p.costPrice || p['Cost Price'],
        mrp: p.mrp || p['MPR'],
        sellingPrice: p.sellingPrice || p.mrp || p['MPR'], // Use MRP as selling price by default
        sku: p.sku || `AUTO-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        expiryDate: p.expiryDate || p.expirey || p['Expirey']
    };

    if (!normalized.productName || normalized.costPrice === undefined || normalized.mrp === undefined) {
      results.errors.push({ productName: normalized.productName, error: 'Missing required fields (Name, Cost, MRP)' });
      continue;
    }

    // Try to parse expiry date if it's a string like "Jun-26"
    if (typeof normalized.expiryDate === 'string' && normalized.expiryDate.includes('-')) {
        const parts = normalized.expiryDate.split('-');
        if (parts.length === 2) {
            // Assume format MMM-YY (e.g., Jun-26)
            const monthMap = { 'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5, 'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11 };
            const mStr = parts[0].toLowerCase().substr(0, 3);
            const yStr = parts[1];
            if (monthMap[mStr] !== undefined) {
                const year = 2000 + parseInt(yStr);
                normalized.expiryDate = new Date(year, monthMap[mStr], 28); // Set to end of month roughly
            }
        }
    }

    // Check duplication by Name + Batch instead of SKU for bulk uploads from sheets
    const exists = await Inventory.findOne({
        company: req.companyId,
        productName: normalized.productName.trim(),
        batchNumber: (normalized.batchNumber || '').trim(),
        isActive: true
    });

    if (exists) {
      results.duplicates++;
      continue;
    }

    toInsert.push({
      ...normalized,
      company: req.companyId,
      sku: normalized.sku.toUpperCase(),
    });
  }

  if (toInsert.length > 0) {
    await Inventory.insertMany(toInsert);
    results.created = toInsert.length;
  }

  audit({ req, action: 'BULK_UPLOAD_INVENTORY', entity: 'Inventory', meta: { count: results.created } });
  res.json({ success: true, data: results });
});
