import { Cheque, Payment, Distributor } from '../models/index.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { audit } from '../utils/audit.js';

export const listCheques = asyncHandler(async (req, res) => {
  const filter = { company: req.companyId };
  if (req.query.distributorId) filter.distributor = req.query.distributorId;
  if (req.query.status) filter.status = req.query.status;

  const items = await Cheque.find(filter)
    .populate('distributor', 'name')
    .sort('-cashDate');

  res.json({ success: true, data: items });
});

export const createCheque = asyncHandler(async (req, res) => {
  const cheque = await Cheque.create({
    ...req.body,
    company: req.companyId,
    status: req.body.status || 'ISSUED'
  });

  audit({ req, action: 'CREATE_CHEQUE', entity: 'Cheque', entityId: cheque._id });
  res.status(201).json({ success: true, data: cheque });
});

export const updateCheque = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const companyId = req.companyId;

  const cheque = await Cheque.findOne({ _id: id, company: companyId });
  if (!cheque) throw ApiError.notFound('Cheque not found');

  if (cheque.status === 'CASHED') {
    throw ApiError.badRequest('Cashed cheques cannot be edited');
  }

  const oldStatus = cheque.status;
  const newStatus = req.body.status;

  // Only update fields provided in request
  const updates = { ...req.body };
  if (updates.distributor && typeof updates.distributor === 'object') {
    updates.distributor = updates.distributor._id;
  }

  Object.assign(cheque, updates);
  await cheque.save();

  // Auto-record payment when status changes to CASHED
  if (oldStatus !== 'CASHED' && newStatus === 'CASHED') {
    const payment = await Payment.create({
      company: companyId,
      distributor: cheque.distributor,
      amount: cheque.amount,
      method: 'CHEQUE',
      paymentDate: new Date(),
      chequeDetails: {
        number: cheque.chequeNumber,
        bankName: cheque.bankName,
        depositDate: cheque.cashDate,
        status: 'CLEARED'
      },
      remarks: `Cheque #${cheque.chequeNumber} Cashed. ${cheque.remarks || ''}`,
      createdBy: req.user._id
    });

    // Update distributor outstanding balance
    await Distributor.findByIdAndUpdate(cheque.distributor, {
      $inc: { outstandingBalance: -cheque.amount }
    });

    audit({ req, action: 'AUTO_RECORD_PAYMENT', entity: 'Payment', entityId: payment._id });
  }

  audit({ req, action: 'UPDATE_CHEQUE', entity: 'Cheque', entityId: id });
  res.json({ success: true, data: cheque });
});

export const deleteCheque = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const cheque = await Cheque.findOne({ _id: id, company: req.companyId });
  if (!cheque) throw ApiError.notFound('Cheque not found');

  if (cheque.status === 'CASHED') {
    throw ApiError.badRequest('Cashed cheques cannot be deleted');
  }

  await Cheque.findByIdAndDelete(id);
  audit({ req, action: 'DELETE_CHEQUE', entity: 'Cheque', entityId: id });
  res.json({ success: true, message: 'Cheque removed' });
});
