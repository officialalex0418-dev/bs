import mongoose from 'mongoose';
import { Distributor, Invoice, Payment, SalesInvoice, Cheque } from '../models/index.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { getPagination, paginatedResponse } from '../utils/pagination.js';
import { audit } from '../utils/audit.js';

/** GET /distributors */
export const listDistributors = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { company: req.companyId, isActive: true };

  if (req.query.search) {
    filter.name = { $regex: req.query.search, $options: 'i' };
  }

  const [items, total] = await Promise.all([
    Distributor.find(filter).sort('name').skip(skip).limit(limit),
    Distributor.countDocuments(filter),
  ]);
  res.json({ success: true, data: paginatedResponse(items, total, page, limit) });
});

/** GET /distributors/:id - includes aging and transaction history */
export const getDistributorDetails = asyncHandler(async (req, res) => {
  const distributor = await Distributor.findOne({ _id: req.params.id, company: req.companyId });
  if (!distributor) throw ApiError.notFound('Distributor not found');

  const [invoices, payments] = await Promise.all([
    SalesInvoice.find({ distributor: distributor._id, company: req.companyId }).sort('saleDate'),
    Payment.find({ distributor: distributor._id, company: req.companyId }).sort('paymentDate'),
  ]);

  // Aging calculation using FIFO matching on-the-fly
  // Total received vs chronological invoices
  let totalPaymentsReceived = payments.reduce((sum, p) => sum + p.amount, 0);
  const now = new Date();

  const aging = [];
  const processedInvoices = invoices.map(inv => {
    const dueForThis = Math.max(0, inv.netTotal - totalPaymentsReceived);
    const paidForThis = inv.netTotal - dueForThis;

    // Reduce the pool of available payments
    totalPaymentsReceived = Math.max(0, totalPaymentsReceived - inv.netTotal);

    const days = Math.floor((now - new Date(inv.saleDate)) / (1000 * 60 * 60 * 24));

    if (dueForThis > 0) {
      aging.push({
        invoiceNumber: inv.invoiceNumber,
        amount: dueForThis,
        date: inv.saleDate,
        ageDays: days
      });
    }

    return {
      ...inv.toObject(),
      amountPaid: paidForThis,
      balanceDue: dueForThis
    };
  });

  res.json({
    success: true,
    data: {
      distributor,
      invoices: processedInvoices.reverse(), // Sort for list display (newest first)
      payments: payments.reverse(),
      aging,
      history: [
        ...invoices.map(i => ({ id: i._id, type: 'INVOICE', date: i.saleDate, amount: i.netTotal, ref: i.invoiceNumber, method: i.paymentMethod })),
        ...payments.map(p => ({ id: p._id, type: 'PAYMENT', date: p.paymentDate, amount: p.amount, ref: 'Payment', method: p.method }))
      ].sort((a, b) => new Date(b.date) - new Date(a.date))
    }
  });
});

/** POST /distributors */
export const createDistributor = asyncHandler(async (req, res) => {
  const distributor = await Distributor.create({ ...req.body, company: req.companyId });
  audit({ req, action: 'CREATE_DISTRIBUTOR', entity: 'Distributor', entityId: distributor._id });
  res.status(201).json({ success: true, data: { distributor } });
});

/** PATCH /distributors/:id */
export const updateDistributor = asyncHandler(async (req, res) => {
  const distributor = await Distributor.findOneAndUpdate(
    { _id: req.params.id, company: req.companyId },
    { $set: req.body },
    { new: true, runValidators: true }
  );
  if (!distributor) throw ApiError.notFound('Distributor not found');
  audit({ req, action: 'UPDATE_DISTRIBUTOR', entity: 'Distributor', entityId: distributor._id });
  res.json({ success: true, data: { distributor } });
});

/** DELETE /distributors/:id */
export const deleteDistributor = asyncHandler(async (req, res) => {
  const distributor = await Distributor.findOneAndUpdate(
    { _id: req.params.id, company: req.companyId },
    { isActive: false },
    { new: true }
  );
  if (!distributor) throw ApiError.notFound('Distributor not found');
  audit({ req, action: 'DEACTIVATE_DISTRIBUTOR', entity: 'Distributor', entityId: distributor._id });
  res.json({ success: true, message: 'Distributor deactivated' });
});

/** DELETE /distributors/:id/hard */
export const hardDeleteDistributor = asyncHandler(async (req, res) => {
  const distributor = await Distributor.findOne({ _id: req.params.id, company: req.companyId });
  if (!distributor) throw ApiError.notFound('Distributor not found');

  const distributorId = distributor._id;
  await Promise.all([
    Invoice.deleteMany({ distributor: distributorId }),
    Payment.deleteMany({ distributor: distributorId }),
    Distributor.findByIdAndDelete(distributorId),
  ]);

  audit({ req, action: 'HARD_DELETE_DISTRIBUTOR', entity: 'Distributor', entityId: distributor._id });
  res.json({ success: true, message: 'Distributor and all associated invoices/payments permanently deleted' });
});

/** GET /distributors/:id/ledger */
export const getLedger = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [invoices, payments] = await Promise.all([
    SalesInvoice.find({ distributor: id, company: req.companyId }).sort('saleDate'),
    Payment.find({ distributor: id, company: req.companyId }).sort('paymentDate'),
  ]);

  // Combine and sort by date for ledger
  const ledger = [
    ...invoices.map(i => ({ type: 'INVOICE', date: i.saleDate, amount: i.netTotal, ref: i.invoiceNumber, id: i._id })),
    ...payments.map(p => ({ type: 'PAYMENT', date: p.paymentDate, amount: p.amount, ref: p.method, id: p._id }))
  ].sort((a, b) => new Date(a.date) - new Date(b.date));

  let balance = 0;
  const entries = ledger.map(item => {
    if (item.type === 'INVOICE') balance += item.amount;
    else balance -= item.amount;
    return { ...item, runningBalance: balance };
  });

  res.json({ success: true, data: { entries, finalBalance: balance } });
});

/** POST /invoices */
export const createInvoice = asyncHandler(async (req, res) => {
  const { distributorId, items, dueDate, remarks, saleDate } = req.body;
  const companyId = req.companyId;

  const distributor = await Distributor.findOne({ _id: distributorId, company: companyId });
  if (!distributor) throw ApiError.notFound('Distributor not found');

  let totalAmount = 0;
  const processedItems = [];

  for (const item of items) {
    const amt = (Number(item.rate) || Number(item.price) || 0) * (Number(item.quantity) || 0);
    totalAmount += amt;

    // Deduct stock for each item
    const product = await Inventory.findOne({ productName: item.productName, company: companyId }).select('+movements');
    if (product) {
      if (product.quantity < Number(item.quantity)) {
        throw ApiError.badRequest(`Insufficient stock for ${product.productName}. Available: ${product.quantity}`);
      }
      product.quantity -= Number(item.quantity);
      product.movements.push({
        type: 'OUT',
        quantity: item.quantity,
        note: `Invoice Entry (Distributor)`,
        by: req.user._id
      });
      await product.save();
    }

    processedItems.push({
      product: product?._id,
      productName: item.productName,
      price: Number(item.rate) || Number(item.price) || 0,
      quantity: Number(item.quantity),
      amount: amt
    });
  }

  // Simple tax calculation for demo (13% VAT)
  const vatAmount = totalAmount * 0.13;
  const netTotal = totalAmount + vatAmount;

  // SBXXXXX format logic
  const lastInvoice = await SalesInvoice.findOne({ company: companyId, invoiceNumber: /^SB/ }).sort('-createdAt');
  let nextNum = 1;
  if (lastInvoice) {
    const match = lastInvoice.invoiceNumber.match(/SB(\d+)/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }
  const invoiceNumber = `SB${String(nextNum).padStart(5, '0')}`;

  const invoice = await SalesInvoice.create({
    company: companyId,
    staff: req.user._id,
    invoiceNumber,
    distributor: distributorId,
    items: processedItems,
    totalAmount,
    taxableAmount: totalAmount,
    vatPct: 13,
    vatAmount,
    netTotal,
    paymentMethod: 'Credit',
    saleDate: saleDate || new Date(),
    dueDate,
    remarks
  });

  // Update distributor outstanding
  distributor.outstandingBalance += netTotal;
  await distributor.save();

  audit({ req, action: 'CREATE_SALES_INVOICE', entity: 'SalesInvoice', entityId: invoice._id, company: companyId });
  res.status(201).json({ success: true, data: { invoice } });
});

/** POST /payments - Does not affect invoice objects directly */
export const recordPayment = asyncHandler(async (req, res) => {
  const { distributorId, amount, method, remarks } = req.body;

  const distributor = await Distributor.findOne({ _id: distributorId, company: req.companyId });
  if (!distributor) throw ApiError.notFound('Distributor not found');

  const payment = await Payment.create({
    company: req.companyId,
    distributor: distributorId,
    amount: Number(amount),
    method,
    remarks,
    paymentDate: new Date(),
    createdBy: req.user._id
  });

  // Update distributor outstanding balance
  distributor.outstandingBalance -= Number(amount);
  await distributor.save();

  audit({ req, action: 'RECORD_PAYMENT', entity: 'Payment', entityId: payment._id, company: req.companyId });
  res.status(201).json({ success: true, data: { payment } });
});

/** DELETE /payments/:id */
export const deletePayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const payment = await Payment.findOne({ _id: id, company: req.companyId });
  if (!payment) throw ApiError.notFound('Payment record not found');

  // Reverse distributor outstanding balance
  await Distributor.findByIdAndUpdate(payment.distributor, {
    $inc: { outstandingBalance: payment.amount }
  });

  await Payment.findByIdAndDelete(id);

  audit({ req, action: 'DELETE_PAYMENT', entity: 'Payment', entityId: id, meta: { amount: payment.amount } });
  res.json({ success: true, message: 'Payment record removed' });
});

/** GET /distributors/analytics */
export const distributorAnalytics = asyncHandler(async (req, res) => {
  const companyId = new mongoose.Types.ObjectId(req.companyId);
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const [
    totalOutstanding,
    monthlySales,
    monthlyPayments,
    activeCount,
    paymentCheques,
    directCheques,
    allDistributorsWithBalance
  ] = await Promise.all([
    Distributor.aggregate([
      { $match: { company: companyId, isActive: true } },
      { $group: { _id: null, total: { $sum: '$outstandingBalance' } } }
    ]),
    SalesInvoice.aggregate([
      { $match: { company: companyId, saleDate: { $gte: startOfMonth }, distributor: { $ne: null } } },
      { $group: { _id: null, total: { $sum: '$netTotal' } } }
    ]),
    Payment.aggregate([
      { $match: { company: companyId, paymentDate: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    Distributor.countDocuments({ company: companyId, isActive: true }),
    Payment.countDocuments({
      company: companyId,
      method: 'CHEQUE',
      'chequeDetails.depositDate': { $lte: threeDaysFromNow, $gte: now },
      'chequeDetails.status': 'PENDING'
    }),
    Cheque.countDocuments({
      company: companyId,
      status: { $ne: 'CASHED' }
    }),
    Distributor.find({ company: companyId, outstandingBalance: { $gt: 0 } }).select('_id')
  ]);

  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Calculate Overdue Outstanding (Aged > 90 days)
  let overdueOutstanding = 0;
  for (const dist of allDistributorsWithBalance) {
    const [invoices, payments] = await Promise.all([
      SalesInvoice.find({ distributor: dist._id, company: companyId }).sort('saleDate'),
      Payment.find({ distributor: dist._id, company: companyId })
    ]);

    let totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    for (const inv of invoices) {
      const unpaidAmount = Math.max(0, inv.netTotal - totalPaid);
      totalPaid = Math.max(0, totalPaid - inv.netTotal);

      if (unpaidAmount > 0 && new Date(inv.saleDate) < ninetyDaysAgo) {
        overdueOutstanding += unpaidAmount;
      }
    }
  }

  res.json({
    success: true,
    data: {
      totalOutstanding: totalOutstanding[0]?.total || 0,
      monthlySales: monthlySales[0]?.total || 0,
      monthlyPayments: monthlyPayments[0]?.total || 0,
      activeDistributors: activeCount,
      upcomingCheques: (paymentCheques || 0) + (directCheques || 0),
      overdueOutstanding
    }
  });
});
