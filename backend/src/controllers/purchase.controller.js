import Purchase from '../models/Purchase.js';
import Inventory from '../models/Inventory.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { audit } from '../utils/audit.js';

export const createPurchase = asyncHandler(async (req, res) => {
  const { items, discountPct, vatPct, vendorId } = req.body;
  const companyId = req.companyId;

  if (!items || !items.length) {
    throw ApiError.badRequest('Purchase items are required');
  }

  let totalAmount = 0;
  const processedItems = [];

  for (const item of items) {
    const itemAmount = (Number(item.price) || 0) * (Number(item.quantity) || 0);
    totalAmount += itemAmount;

    let product = null;
    if (item.productId) {
      product = await Inventory.findOne({ _id: item.productId, company: companyId }).select('+movements');
    } else {
      // Try to find by name if no ID provided (e.g. from a quick entry)
      product = await Inventory.findOne({ productName: item.productName, company: companyId }).select('+movements');
    }

    if (product) {
      product.quantity += Number(item.quantity);
      product.costPrice = Number(item.price); // Usually purchase price updates cost price
      if (item.batch) product.batchNumber = item.batch;
      if (item.expiryDate) product.expiryDate = item.expiryDate;
      if (vendorId) product.vendor = vendorId;

      product.movements.push({
        type: 'IN',
        quantity: item.quantity,
        note: `Purchase Entry - Batch: ${item.batch || 'N/A'}`,
        by: req.user._id
      });
      await product.save();
    }

    processedItems.push({
      product: product?._id,
      productName: item.productName,
      batch: item.batch,
      price: Number(item.price),
      quantity: Number(item.quantity),
      amount: itemAmount,
      expiryDate: item.expiryDate
    });
  }

  const discountAmount = (totalAmount * (Number(discountPct) || 0)) / 100;
  const taxableAmount = totalAmount - discountAmount;
  const vatAmount = (taxableAmount * (Number(vatPct) || 0)) / 100;
  const netTotal = taxableAmount + vatAmount;

  const purchase = await Purchase.create({
    company: companyId,
    staff: req.user._id,
    vendor: vendorId || null,
    items: processedItems,
    totalAmount,
    discountPct: Number(discountPct) || 0,
    discountAmount,
    taxableAmount,
    vatPct: Number(vatPct) || 0,
    vatAmount,
    netTotal
  });

  audit({ req, action: 'CREATE_PURCHASE', entity: 'Purchase', entityId: purchase._id, meta: { netTotal } });

  res.status(201).json({ success: true, data: purchase });
});

export const listPurchases = asyncHandler(async (req, res) => {
  const filter = { company: req.companyId };
  const items = await Purchase.find(filter).sort('-createdAt')
    .populate('staff', 'name')
    .populate('vendor', 'name panVat registrationNumber');
  res.json({ success: true, data: { items } });
});
