import mongoose from 'mongoose';
import Sale from '../models/Sale.js';
import User from '../models/User.js';
import Inventory from '../models/Inventory.js';
import Customer from '../models/Customer.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { getPagination, paginatedResponse } from '../utils/pagination.js';
import { audit } from '../utils/audit.js';
import { emails } from '../services/email.service.js';
import { notify } from '../services/notification.service.js';
import { realtime } from '../sockets/index.js';
import { rangeFromPeriod } from '../utils/dates.js';

const oid = (id) => new mongoose.Types.ObjectId(id);

/** POST /sales — staff submits a sale */
export const createSale = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { productId, productName, quantity, amount, customerName, remarks, items } = req.body;

  // Robust check for inventorySync setting
  let inventorySync = false;
  if (req.user.company && typeof req.user.company === 'object') {
    inventorySync = req.user.company.settings?.inventorySync || false;
  } else if (req.user.company) {
    const comp = await mongoose.model('Company').findById(req.user.company).select('settings');
    inventorySync = comp?.settings?.inventorySync || false;
  }

  // Normalize inputs: support single entry (legacy/mobile) or multiple items
  const salesItems = items && Array.isArray(items) ? items : [{ productId, productName, quantity, amount }];

  // Handle Customer: Store if new (shared for all items in this entry)
  let customerId = null;
  if (customerName && customerName.trim()) {
    let existingCust = await Customer.findOne({ company: companyId, name: { $regex: `^${customerName.trim()}$`, $options: 'i' } });
    if (!existingCust) {
      existingCust = await Customer.create({
        company: companyId,
        name: customerName.trim(),
        createdBy: req.user._id
      });
    }
    customerId = existingCust._id;
  }

  const createdSales = [];
  let totalEntryAmount = 0;

  for (const item of salesItems) {
    let product = null;
    if (item.productId) {
      product = await Inventory.findOne({ _id: item.productId, company: companyId }).select('+movements');
      if (product && inventorySync) {
        const qty = Number(item.quantity);
        if (product.quantity < qty) {
          throw ApiError.badRequest(`Insufficient stock for ${product.productName} (${product.quantity} left)`);
        }
        product.quantity -= qty;
        product.movements.push({ type: 'OUT', quantity: qty, note: 'Sale', by: req.user._id });
        await product.save();
      }
    }

    const sale = await Sale.create({
      company: companyId,
      staff: req.user._id,
      product: product?._id || item.productId || null,
      productName: product?.productName || item.productName,
      quantity: item.quantity,
      amount: item.amount,
      customer: customerId,
      customerName,
      remarks,
    });

    createdSales.push(sale);
    totalEntryAmount += Number(item.amount);

    // low stock alert (only if sync is on)
    if (inventorySync && product && product.quantity <= product.reorderLevel) {
       const owners = await User.find({ company: companyId, role: 'COMPANY_OWNER', isActive: true });
       for (const o of owners) {
         notify({
           recipient: o._id, company: companyId, type: 'LOW_STOCK',
           title: 'Low stock alert', message: `${product.productName} is low (${product.quantity} left).`,
         });
       }
    }
  }

  // notify owner(s) once for the total entry
  const owners = await User.find({ company: companyId, role: 'COMPANY_OWNER', isActive: true });
  for (const o of owners) {
    emails.saleSubmitted(o.email, {
      staffName: req.user.name,
      productName: salesItems.length > 1 ? `${salesItems.length} products` : createdSales[0].productName,
      amount: totalEntryAmount,
      quantity: salesItems.reduce((acc, curr) => acc + Number(curr.quantity), 0),
    });
    notify({
      recipient: o._id, company: companyId, type: 'SALE_SUBMITTED',
      title: 'New sales entry',
      message: `${req.user.name} submitted sales totaling ${totalEntryAmount}`,
    });
  }

  realtime.dashboard(companyId.toString(), { event: 'sale', amount: totalEntryAmount });
  realtime.activity(companyId.toString(), { text: `${req.user.name} submitted a sales entry of ${totalEntryAmount}`, at: new Date() });

  // Audit the first sale or a summary
  audit({ req, action: 'CREATE_SALE', entity: 'Sale', entityId: createdSales[0]._id, meta: { totalAmount: totalEntryAmount, itemCount: salesItems.length } });

  res.status(201).json({ success: true, data: { sales: createdSales } });
});

/** GET /sales?period=&staffId=&startDate=&endDate= */
export const listSales = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const { staffId } = req.query;
  const filter = {};
  if (req.companyId) filter.company = req.companyId;

  // Logic:
  // 1. If staffId is 'all', only Managers/Owners can see everything.
  // 2. If staffId is a specific ID, only Managers/Owners can see it (or the staff themselves).
  // 3. If staffId is missing, default to ONLY the current user's sales.

  const isManagerial = ['COMPANY_OWNER', 'COMPANY_MANAGER', 'SUPER_ADMIN', 'ADMIN_EMPLOYEE'].includes(req.user.role);

  if (staffId === 'all') {
    if (!isManagerial) throw ApiError.forbidden('Only managers can view all sales');
    // filter.staff remains unset to show all
  } else if (staffId) {
    if (!isManagerial && staffId !== req.user._id.toString()) {
        throw ApiError.forbidden('Access denied: You can only view your own sales');
    }
    filter.staff = staffId;
  } else {
    // Default: Show only own sales
    filter.staff = req.user._id;
  }

  const { period, startDate, endDate } = req.query;
  if (startDate && endDate) {
    filter.saleDate = { $gte: new Date(startDate), $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)) };
  } else if (period) {
    const { start, end } = rangeFromPeriod(period);
    filter.saleDate = { $gte: start, $lte: end };
  }

  const [items, total] = await Promise.all([
    Sale.find(filter).populate('staff', 'name').sort('-saleDate').skip(skip).limit(limit),
    Sale.countDocuments(filter),
  ]);
  res.json({ success: true, data: paginatedResponse(items, total, page, limit) });
});

/** GET /sales/analytics?period=&staffId=&startDate=&endDate= — staff-wise, product-wise, monthly growth */
export const salesAnalytics = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  if (!companyId) throw ApiError.badRequest('companyId required');

  const { period, startDate, endDate, staffId } = req.query;
  let start, end;
  if (startDate && endDate) {
    start = new Date(startDate);
    end = new Date(new Date(endDate).setHours(23, 59, 59, 999));
  } else {
    const range = rangeFromPeriod(period || '6months');
    start = range.start;
    end = range.end;
  }

  const match = { company: oid(companyId), saleDate: { $gte: start, $lte: end } };
  if (staffId && staffId !== 'all') match.staff = oid(staffId);

  const [byStaff, byProduct, monthly, totals] = await Promise.all([
    Sale.aggregate([
      { $match: match },
      { $group: { _id: '$staff', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } }, { $limit: 20 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'staff', pipeline: [{ $project: { name: 1 } }] } },
      { $unwind: '$staff' },
      { $project: { name: '$staff.name', total: 1, count: 1 } },
    ]),
    Sale.aggregate([
      { $match: match },
      { $group: { _id: '$productName', total: { $sum: '$amount' }, quantity: { $sum: '$quantity' } } },
      { $sort: { total: -1 } }, { $limit: 20 },
      { $project: { name: '$_id', total: 1, quantity: 1, _id: 0 } },
    ]),
    Sale.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$saleDate' } }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
      { $project: { month: '$_id', total: 1, count: 1, _id: 0 } },
    ]),
    Sale.aggregate([
      { $match: match },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      byStaff, byProduct, monthly,
      total: totals[0]?.total || 0,
      count: totals[0]?.count || 0,
    },
  });
});

/** GET /sales/me/summary — staff target progress */
export const mySalesSummary = asyncHandler(async (req, res) => {
  const { start, end } = rangeFromPeriod('monthly');
  const result = await Sale.aggregate([
    { $match: { staff: req.user._id, company: oid(req.companyId), saleDate: { $gte: start, $lte: end } } },
    { $group: { _id: null, achieved: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  const achieved = result[0]?.achieved || 0;
  const target = req.user.monthlyTarget || 0;
  res.json({
    success: true,
    data: {
      monthlyTarget: target,
      achieved,
      remaining: Math.max(target - achieved, 0),
      progressPct: target ? Math.min(Math.round((achieved / target) * 100), 100) : 0,
      salesCount: result[0]?.count || 0,
    },
  });
});

/** GET /sales/metadata - fetch products and customers for staff sales entry */
export const getSalesMetadata = asyncHandler(async (req, res) => {
  const companyId = req.companyId;

  const [products, customers] = await Promise.all([
    Inventory.find({ company: companyId, isActive: true }).select('productName sellingPrice quantity sku batchNumber'),
    Customer.find({ company: companyId }).select('name address contactNumber panVat ownerName').sort('name'),
  ]);

  res.json({
    success: true,
    data: {
      products,
      customers,
    },
  });
});

/** PATCH /sales/:id - Update a sale */
export const updateSale = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const companyId = req.companyId;
  const { productId, quantity, amount, customerName, remarks, saleDate } = req.body;

  const sale = await Sale.findOne({ _id: id, company: companyId });
  if (!sale) throw ApiError.notFound('Sale not found');

  // Authorization: Only the staff who created it or a manager can edit
  const isManager = ['COMPANY_OWNER', 'COMPANY_MANAGER', 'SUPER_ADMIN'].includes(req.user.role);
  if (sale.staff.toString() !== req.user._id.toString() && !isManager) {
    throw ApiError.forbidden('You can only edit your own sales');
  }

  // Inventory handling if quantity or product changed
  const comp = await mongoose.model('Company').findById(companyId).select('settings');
  const inventorySync = comp?.settings?.inventorySync || false;

  if (inventorySync) {
    // 1. Revert old stock if it was linked to a product
    if (sale.product) {
        await Inventory.findByIdAndUpdate(sale.product, {
            $inc: { quantity: sale.quantity },
            $push: { movements: { type: 'IN', quantity: sale.quantity, note: 'Sale Edit (Revert)', by: req.user._id } }
        });
    }

    // 2. Deduct new stock if a new product is linked
    const targetProductId = productId || sale.product;
    if (targetProductId) {
        const newProduct = await Inventory.findOne({ _id: targetProductId, company: companyId });
        if (newProduct) {
            const qty = Number(quantity || sale.quantity);
            if (newProduct.quantity < qty) throw ApiError.badRequest(`Insufficient stock for ${newProduct.productName}`);

            newProduct.quantity -= qty;
            newProduct.movements.push({ type: 'OUT', quantity: qty, note: 'Sale Edit (New)', by: req.user._id });
            await newProduct.save();

            sale.product = newProduct._id;
            sale.productName = newProduct.productName;
        }
    }
  } else if (productId) {
      const p = await Inventory.findOne({ _id: productId, company: companyId });
      if (p) {
          sale.product = p._id;
          sale.productName = p.productName;
      }
  }

  if (quantity) sale.quantity = Number(quantity);
  if (amount) sale.amount = Number(amount);
  if (remarks !== undefined) sale.remarks = remarks;
  if (saleDate) sale.saleDate = saleDate;

  // Handle customer name change
  if (customerName && customerName !== sale.customerName) {
      let existingCust = await Customer.findOne({ company: companyId, name: { $regex: `^${customerName.trim()}$`, $options: 'i' } });
      if (!existingCust) {
        existingCust = await Customer.create({ company: companyId, name: customerName.trim(), createdBy: req.user._id });
      }
      sale.customer = existingCust._id;
      sale.customerName = existingCust.name;
  }

  await sale.save();
  audit({ req, action: 'UPDATE_SALE', entity: 'Sale', entityId: sale._id });
  res.json({ success: true, data: sale });
});

/** DELETE /sales/:id - Remove a sale */
export const deleteSale = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const companyId = req.companyId;

    const sale = await Sale.findOne({ _id: id, company: companyId });
    if (!sale) throw ApiError.notFound('Sale not found');

    const isManager = ['COMPANY_OWNER', 'COMPANY_MANAGER', 'SUPER_ADMIN'].includes(req.user.role);
    if (sale.staff.toString() !== req.user._id.toString() && !isManager) {
        throw ApiError.forbidden('You can only delete your own sales');
    }

    // Revert inventory if sync is on
    const comp = await mongoose.model('Company').findById(companyId).select('settings');
    if (comp?.settings?.inventorySync && sale.product) {
        await Inventory.findByIdAndUpdate(sale.product, {
            $inc: { quantity: sale.quantity },
            $push: { movements: { type: 'IN', quantity: sale.quantity, note: 'Sale Deleted (Revert)', by: req.user._id } }
        });
    }

    await sale.deleteOne();
    audit({ req, action: 'DELETE_SALE', entity: 'Sale', entityId: id });
    res.json({ success: true, message: 'Sale deleted successfully' });
});
