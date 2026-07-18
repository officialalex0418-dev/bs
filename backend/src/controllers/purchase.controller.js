import mongoose from 'mongoose';
import Purchase from '../models/Purchase.js';
import Inventory from '../models/Inventory.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { audit } from '../utils/audit.js';

export const createPurchase = asyncHandler(async (req, res) => {
  const { items, discountPct, vatPct, vendorId, billNumber, billDate } = req.body;
  const companyId = req.companyId;

  if (!items || !items.length) {
    throw ApiError.badRequest('Purchase items are required');
  }

  let totalAmount = 0;
  const processedItems = [];

  for (const item of items) {
    const itemAmount = (Number(item.price) || 0) * (Number(item.quantity) || 0);
    totalAmount += itemAmount;

    // Requirement 2: Match by Name AND Batch for inventory update
    let product = await Inventory.findOne({
      productName: item.productName.trim(),
      batchNumber: (item.batch || '').trim(),
      company: companyId
    }).select('+movements');

    if (product) {
      product.quantity += Number(item.quantity);
      product.costPrice = Number(item.price); // Update cost price to latest purchase price
      product.mrp = Number(item.mrp || product.mrp || 0);
      product.sellingPrice = product.mrp; // Update selling price to MRP
      if (item.expiryDate) product.expiryDate = item.expiryDate;
      if (vendorId) product.vendor = vendorId;

      product.movements.push({
        type: 'IN',
        quantity: item.quantity,
        note: `Purchase Entry - Restock Batch: ${item.batch || 'N/A'}`,
        by: req.user._id
      });
      await product.save();
    } else {
      // If Name + Batch doesn't match, create a separate listing
      product = await Inventory.create({
        company: companyId,
        productName: item.productName.trim(),
        sku: `AUTO-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        batchNumber: (item.batch || '').trim(),
        quantity: Number(item.quantity),
        costPrice: Number(item.price),
        mrp: Number(item.mrp || 0),
        sellingPrice: Number(item.mrp || 0), // Default selling price to MRP
        vendor: vendorId || null,
        expiryDate: item.expiryDate || null,
        movements: [{
          type: 'IN',
          quantity: item.quantity,
          note: `New Purchase Entry - New Batch/Listing`,
          by: req.user._id
        }]
      });
    }

    processedItems.push({
      product: product._id,
      productName: item.productName,
      batch: item.batch,
      price: Number(item.price),
      mrp: Number(item.mrp || 0),
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
    billNumber,
    billDate,
    items: processedItems,
    totalAmount,
    discountPct: Number(discountPct) || 0,
    discountAmount,
    taxableAmount,
    vatPct: Number(vatPct) || 0,
    vatAmount,
    netTotal
  });

  if (vendorId) {
    await mongoose.model('Vendor').findByIdAndUpdate(vendorId, {
      $inc: { outstandingBalance: netTotal }
    });
  }

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

export const updatePurchase = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { purchaseDate, items, discountPct, vatPct, vendorId, billNumber, billDate } = req.body;

  const purchase = await Purchase.findOne({ _id: id, company: req.companyId });
  if (!purchase) throw ApiError.notFound('Purchase record not found');

  if (billNumber !== undefined) purchase.billNumber = billNumber;
  if (billDate !== undefined) purchase.billDate = billDate;

  const oldNetTotal = purchase.netTotal;

  // 1. Reverse Inventory Changes from the Old Purchase Items
  for (const item of purchase.items) {
    if (item.product) {
      await Inventory.findByIdAndUpdate(item.product, {
        $inc: { quantity: -Number(item.quantity) },
        $push: {
          movements: {
            type: 'OUT',
            quantity: item.quantity,
            note: `Purchase Correction (Reversing Old Items) - ID: ${purchase._id}`,
            by: req.user._id
          }
        }
      });
    }
  }

  // 2. Process New Items and Apply to Inventory
  if (items && items.length) {
    let totalAmount = 0;
    const processedItems = [];

    for (const item of items) {
      const itemAmount = (Number(item.price) || 0) * (Number(item.quantity) || 0);
      totalAmount += itemAmount;

      // Match by Name AND Batch to update or find product
      let product = await Inventory.findOne({
        productName: item.productName.trim(),
        batchNumber: (item.batch || '').trim(),
        company: req.companyId
      }).select('+movements');

      if (product) {
        product.quantity += Number(item.quantity);
        product.costPrice = Number(item.price);
        product.mrp = Number(item.mrp || product.mrp || 0);
        product.sellingPrice = product.mrp;
        if (item.expiryDate) product.expiryDate = item.expiryDate;

        product.movements.push({
          type: 'IN',
          quantity: item.quantity,
          note: `Purchase Correction (Applying New Items) - ID: ${purchase._id}`,
          by: req.user._id
        });
        await product.save();
      } else {
        // Create new if doesn't exist
        product = await Inventory.create({
          company: req.companyId,
          productName: item.productName.trim(),
          sku: `AUTO-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          batchNumber: (item.batch || '').trim(),
          quantity: Number(item.quantity),
          costPrice: Number(item.price),
          mrp: Number(item.mrp || 0),
          sellingPrice: Number(item.mrp || 0),
          vendor: vendorId || purchase.vendor,
          expiryDate: item.expiryDate || null,
          movements: [{
            type: 'IN',
            quantity: item.quantity,
            note: `Purchase Correction - New Batch Created during edit`,
            by: req.user._id
          }]
        });
      }

      processedItems.push({
        product: product._id,
        productName: item.productName,
        batch: item.batch,
        price: Number(item.price),
        mrp: Number(item.mrp || 0),
        quantity: Number(item.quantity),
        amount: itemAmount,
        expiryDate: item.expiryDate
      });
    }

    purchase.items = processedItems;
    purchase.totalAmount = totalAmount;
    purchase.discountPct = Number(discountPct) ?? purchase.discountPct;
    purchase.discountAmount = (totalAmount * purchase.discountPct) / 100;
    purchase.taxableAmount = totalAmount - purchase.discountAmount;
    purchase.vatPct = Number(vatPct) ?? purchase.vatPct;
    purchase.vatAmount = (purchase.taxableAmount * purchase.vatPct) / 100;
    purchase.netTotal = purchase.taxableAmount + purchase.vatAmount;
  }

  // Handle Date
  if (purchaseDate) {
    const pDate = new Date(purchaseDate);
    const now = new Date();
    if (pDate.toDateString() === now.toDateString()) {
      purchase.purchaseDate = now;
    } else {
      purchase.purchaseDate = new Date(purchaseDate + (purchaseDate.includes('T') ? '' : 'T12:00:00'));
    }
  }

  if (vendorId) purchase.vendor = vendorId;

  await purchase.save();

  // 3. Sync Vendor Balance
  if (purchase.vendor && oldNetTotal !== purchase.netTotal) {
    await mongoose.model('Vendor').findByIdAndUpdate(purchase.vendor, {
      $inc: { outstandingBalance: purchase.netTotal - oldNetTotal }
    });
  }

  audit({ req, action: 'UPDATE_PURCHASE', entity: 'Purchase', entityId: id, meta: { oldNetTotal, newNetTotal: purchase.netTotal } });
  res.json({ success: true, data: purchase });
});
