import { Distributor, Invoice, Payment } from '../models/index.js';
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
    Invoice.find({ distributor: id, company: req.companyId }).sort('createdAt'),
    Payment.find({ distributor: id, company: req.companyId }).sort('createdAt'),
  ]);

  // Combine and sort by date for ledger
  const ledger = [
    ...invoices.map(i => ({ type: 'INVOICE', date: i.createdAt, amount: i.grandTotal, ref: i.invoiceNumber, id: i._id })),
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
  const { distributorId, items, dueDate, remarks } = req.body;

  const distributor = await Distributor.findOne({ _id: distributorId, company: req.companyId });
  if (!distributor) throw ApiError.notFound('Distributor not found');

  const subTotal = items.reduce((acc, item) => acc + (item.rate * item.quantity), 0);
  const discountTotal = items.reduce((acc, item) => acc + (item.discountAmount || 0), 0);
  // Simple tax calculation for demo
  const taxTotal = subTotal * 0.13;
  const grandTotal = subTotal + taxTotal - discountTotal;

  const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

  const invoice = await Invoice.create({
    company: req.companyId,
    distributor: distributorId,
    invoiceNumber,
    items,
    subTotal,
    taxTotal,
    discountTotal,
    grandTotal,
    balanceDue: grandTotal,
    dueDate,
    remarks,
    createdBy: req.user._id
  });

  // Update distributor outstanding
  distributor.outstandingBalance += grandTotal;
  await distributor.save();

  audit({ req, action: 'CREATE_INVOICE', entity: 'Invoice', entityId: invoice._id, company: req.companyId });
  res.status(201).json({ success: true, data: { invoice } });
});

/** POST /payments - Includes FIFO adjustment */
export const recordPayment = asyncHandler(async (req, res) => {
  const { distributorId, amount, method, chequeDetails, bankTransferReference, remarks } = req.body;

  const distributor = await Distributor.findOne({ _id: distributorId, company: req.companyId });
  if (!distributor) throw ApiError.notFound('Distributor not found');

  // FIFO Adjustment Logic
  let remainingPayment = amount;
  const unpaidInvoices = await Invoice.find({
    distributor: distributorId,
    company: req.companyId,
    status: { $in: ['UNPAID', 'PARTIAL'] }
  }).sort('createdAt');

  const adjustedInvoices = [];

  for (const inv of unpaidInvoices) {
    if (remainingPayment <= 0) break;

    const amountToApply = Math.min(remainingPayment, inv.balanceDue);
    inv.amountPaid += amountToApply;
    inv.balanceDue -= amountToApply;
    inv.status = inv.balanceDue === 0 ? 'PAID' : 'PARTIAL';
    await inv.save();

    adjustedInvoices.push({ invoice: inv._id, amount: amountToApply });
    remainingPayment -= amountToApply;
  }

  const payment = await Payment.create({
    company: req.companyId,
    distributor: distributorId,
    amount,
    method,
    chequeDetails,
    bankTransferReference,
    remarks,
    adjustedInvoices,
    createdBy: req.user._id
  });

  // Update distributor outstanding
  distributor.outstandingBalance -= amount;
  await distributor.save();

  audit({ req, action: 'RECORD_PAYMENT', entity: 'Payment', entityId: payment._id, company: req.companyId });
  res.status(201).json({ success: true, data: { payment } });
});

/** GET /distributors/analytics */
export const distributorAnalytics = asyncHandler(async (req, res) => {
  const companyId = req.companyId;

  const [totalOutstanding, overdueCount, upcomingCheques] = await Promise.all([
    Distributor.aggregate([
      { $match: { company: companyId } },
      { $group: { _id: null, total: { $sum: '$outstandingBalance' } } }
    ]),
    Invoice.countDocuments({ company: companyId, status: { $in: ['UNPAID', 'PARTIAL'] }, dueDate: { $lt: new Date() } }),
    Payment.find({
      company: companyId,
      method: 'CHEQUE',
      'chequeDetails.status': 'PENDING',
      'chequeDetails.maturityDate': { $gte: new Date() }
    }).populate('distributor', 'name')
  ]);

  res.json({
    success: true,
    data: {
      totalOutstanding: totalOutstanding[0]?.total || 0,
      overdueInvoices: overdueCount,
      upcomingCheques
    }
  });
});
