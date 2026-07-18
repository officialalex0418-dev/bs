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
  } else if (req.query.expired === 'true') {
    filter.expiryDate = { $lt: new Date() };
  }

  if (req.query.search) {
    filter.$or = [
      { productName: { $regex: req.query.search, $options: 'i' } },
      { sku: { $regex: req.query.search, $options: 'i' } },
    ];
  }

  const [items, total, lowStockCount, nearExpiryCount, expiredCount] = await Promise.all([
    Inventory.find(filter).populate('vendor', 'name').sort('productName').skip(skip).limit(limit),
    Inventory.countDocuments(filter),
    Inventory.countDocuments({ company: req.companyId, isActive: true, $expr: { $lte: ['$quantity', '$reorderLevel'] } }),
    Inventory.countDocuments({
      company: req.companyId,
      isActive: true,
      expiryDate: { $lte: thirtyDaysFromNow, $gte: new Date() }
    }),
    Inventory.countDocuments({
      company: req.companyId,
      isActive: true,
      expiryDate: { $lt: new Date() }
    }),
  ]);
  res.json({ success: true, data: { ...paginatedResponse(items, total, page, limit), lowStockCount, nearExpiryCount, expiredCount } });
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

  const results = { created: 0, updated: 0, errors: [], duplicates: 0 };

  for (const raw of products) {
    // 1. Robust Header Mapping (Case-insensitive, trim spaces)
    const p = {};
    Object.keys(raw).forEach(key => {
        const cleanKey = key.trim().toLowerCase();
        p[cleanKey] = raw[key];
    });

    const normalized = {
        productName: p['product name'] || p['productname'] || p.name,
        batchNumber: String(p['batch'] || p['batchnumber'] || '').trim(),
        quantity: Number(p['qty'] || p['quantity'] || 0),
        costPrice: Number(p['cost price'] || p['costprice'] || 0),
        mrp: Number(p['mpr'] || p['mrp'] || 0),
        expiryDate: p['expiry'] || p['expirey'] || p['expiry date'] || p['expirydate']
    };

    if (!normalized.productName) {
      results.errors.push({ row: raw, error: 'Product Name is missing' });
      continue;
    }

    // 2. Date Parsing (MMM-YY support)
    if (typeof normalized.expiryDate === 'string' && normalized.expiryDate.includes('-')) {
        const parts = normalized.expiryDate.split('-');
        if (parts.length === 2) {
            const monthMap = { 'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5, 'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11 };
            const mStr = parts[0].toLowerCase().substr(0, 3);
            const yStr = parts[1];
            if (monthMap[mStr] !== undefined) {
                const year = 2000 + parseInt(yStr);
                normalized.expiryDate = new Date(year, monthMap[mStr], 28);
            }
        }
    }

    // 3. Upsert Logic: Match by Name + Batch
    const existing = await Inventory.findOne({
        company: req.companyId,
        productName: normalized.productName.trim(),
        batchNumber: normalized.batchNumber,
        isActive: true
    }).select('+movements');

    if (existing) {
      // Update existing
      existing.quantity = normalized.quantity;
      existing.costPrice = normalized.costPrice || existing.costPrice;
      existing.mrp = normalized.mrp || existing.mrp;
      existing.sellingPrice = normalized.mrp || existing.sellingPrice;
      if (normalized.expiryDate) existing.expiryDate = normalized.expiryDate;

      existing.movements.push({
        type: 'ADJUST',
        quantity: normalized.quantity,
        note: 'Bulk Upload Sync (Overwrite)',
        by: req.user._id
      });

      await existing.save();
      results.updated++;
    } else {
      // Create new
      await Inventory.create({
        ...normalized,
        company: req.companyId,
        sku: `AUTO-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        sellingPrice: normalized.mrp || normalized.costPrice * 1.2,
        isActive: true
      });
      results.created++;
    }
  }

  audit({ req, action: 'BULK_UPLOAD_INVENTORY', entity: 'Inventory', meta: { created: results.created, updated: results.updated } });
  res.json({ success: true, data: results });
});
