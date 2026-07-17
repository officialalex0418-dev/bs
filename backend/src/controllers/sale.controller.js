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
  const { productId, productName, quantity, amount, customerName, remarks } = req.body;

  // Robust check for inventorySync setting
  let inventorySync = false;
  if (req.user.company && typeof req.user.company === 'object') {
    inventorySync = req.user.company.settings?.inventorySync || false;
  } else if (req.user.company) {
    // If somehow not populated, fetch it
    const comp = await mongoose.model('Company').findById(req.user.company).select('settings');
    inventorySync = comp?.settings?.inventorySync || false;
  }

  let product = null;
  if (productId) {
    product = await Inventory.findOne({ _id: productId, company: companyId }).select('+movements');
    if (!product) throw ApiError.notFound('Product not found in inventory');

    if (inventorySync) {
      const qty = Number(quantity);
      if (product.quantity < qty) {
        throw ApiError.badRequest(`Insufficient stock (${product.quantity} left)`);
      }
      product.quantity -= qty;
      product.movements.push({ type: 'OUT', quantity: qty, note: 'Sale', by: req.user._id });
      await product.save();
    }
  }

  // Handle Customer: Store if new
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

  const sale = await Sale.create({
    company: companyId,
    staff: req.user._id,
    product: product?._id || null,
    productName: product?.productName || productName,
    quantity, amount,
    customer: customerId,
    customerName,
    remarks,
  });

  // notify owner(s)
  const owners = await User.find({ company: companyId, role: 'COMPANY_OWNER', isActive: true });
  for (const o of owners) {
    emails.saleSubmitted(o.email, {
      staffName: req.user.name, productName: sale.productName, amount, quantity,
    });
    notify({
      recipient: o._id, company: companyId, type: 'SALE_SUBMITTED',
      title: 'New sale', message: `${req.user.name} sold ${quantity} × ${sale.productName} (${amount})`,
    });
  }

  // low stock alert (only if sync is on)
  if (inventorySync && product && product.quantity <= product.reorderLevel) {
    for (const o of owners) {
      notify({
        recipient: o._id, company: companyId, type: 'LOW_STOCK',
        title: 'Low stock alert', message: `${product.productName} is low (${product.quantity} left).`,
      });
    }
  }

  realtime.dashboard(companyId.toString(), { event: 'sale', amount });
  realtime.activity(companyId.toString(), { text: `${req.user.name} submitted a sale of ${amount}`, at: new Date() });
  audit({ req, action: 'CREATE_SALE', entity: 'Sale', entityId: sale._id, meta: { amount } });

  res.status(201).json({ success: true, data: { sale } });
});

/** GET /sales?period=&staffId=&startDate=&endDate= */
export const listSales = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.companyId) filter.company = req.companyId;
  if (req.user.role === 'STAFF') filter.staff = req.user._id;
  else if (req.query.staffId && req.query.staffId !== 'all') filter.staff = req.query.staffId;

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
