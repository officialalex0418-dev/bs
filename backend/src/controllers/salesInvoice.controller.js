import mongoose from 'mongoose';
import SalesInvoice from '../models/SalesInvoice.js';
import Inventory from '../models/Inventory.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { audit } from '../utils/audit.js';

export const createSalesInvoice = asyncHandler(async (req, res) => {
  const { items, discountPct, vatPct, paymentMethod, customerName, distributorId, saleDate, dueDate } = req.body;
  const companyId = req.companyId;

  if (!items || !items.length) {
    throw ApiError.badRequest('Invoice items are required');
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
      product = await Inventory.findOne({ productName: item.productName, company: companyId }).select('+movements');
    }

    if (product) {
      if (product.quantity < Number(item.quantity)) {
        throw ApiError.badRequest(`Insufficient stock for ${product.productName}. Available: ${product.quantity}`);
      }
      product.quantity -= Number(item.quantity);
      product.movements.push({
        type: 'OUT',
        quantity: item.quantity,
        note: `Invoice Entry - ${paymentMethod}`,
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
      amount: itemAmount
    });
  }

  const discountAmount = (totalAmount * (Number(discountPct) || 0)) / 100;
  const taxableAmount = totalAmount - discountAmount;
  const vatAmount = (taxableAmount * (Number(vatPct) || 0)) / 100;
  const netTotal = taxableAmount + vatAmount;

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
    distributor: distributorId || null,
    customerName,
    items: processedItems,
    totalAmount,
    discountPct: Number(discountPct) || 0,
    discountAmount,
    taxableAmount,
    vatPct: Number(vatPct) || 0,
    vatAmount,
    netTotal,
    paymentMethod,
    saleDate: saleDate || Date.now(),
    dueDate: dueDate || (saleDate ? new Date(new Date(saleDate).getTime() + 30*24*60*60*1000) : new Date(Date.now() + 30*24*60*60*1000))
  });

  if (distributorId) {
    // Every invoice affects outstanding balance until paid
    await mongoose.model('Distributor').findByIdAndUpdate(distributorId, {
      $inc: { outstandingBalance: netTotal }
    });
  }

  audit({ req, action: 'CREATE_SALES_INVOICE', entity: 'SalesInvoice', entityId: invoice._id, meta: { netTotal } });

  res.status(201).json({ success: true, data: invoice });
});

export const listSalesInvoices = asyncHandler(async (req, res) => {
  const filter = { company: req.companyId };
  const items = await SalesInvoice.find(filter).sort('-createdAt')
    .populate('staff', 'name')
    .populate('distributor', 'name panVat registrationNumber phone address');
  res.json({ success: true, data: { items } });
});

export const getSalesInvoice = asyncHandler(async (req, res) => {
  const item = await SalesInvoice.findOne({ _id: req.params.id, company: req.companyId })
    .populate('staff', 'name')
    .populate('distributor', 'name panVat registrationNumber phone address');
  if (!item) throw ApiError.notFound('Invoice not found');
  res.json({ success: true, data: item });
});

export const updateSalesInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { items, discountPct, vatPct, customerName, remarks, dueDate } = req.body;
  const companyId = req.companyId;

  const invoice = await SalesInvoice.findOne({ _id: id, company: companyId });
  if (!invoice) throw ApiError.notFound('Invoice not found');

  const oldNetTotal = invoice.netTotal;

  if (items !== undefined) invoice.items = items;
  if (discountPct !== undefined) invoice.discountPct = Number(discountPct);
  if (vatPct !== undefined) invoice.vatPct = Number(vatPct);
  if (customerName !== undefined) invoice.customerName = customerName;
  if (remarks !== undefined) invoice.remarks = remarks;
  if (dueDate !== undefined) invoice.dueDate = dueDate;

  // Recalculate everything
  let totalAmount = 0;
  invoice.items = invoice.items.map(item => {
    const price = Number(item.price) || 0;
    const quantity = Number(item.quantity) || 0;
    const amount = price * quantity;
    totalAmount += amount;
    return {
      product: item.product,
      productName: item.productName,
      batch: item.batch,
      price,
      quantity,
      amount
    };
  });

  invoice.totalAmount = totalAmount;
  invoice.discountAmount = (totalAmount * invoice.discountPct) / 100;
  invoice.taxableAmount = totalAmount - invoice.discountAmount;
  invoice.vatAmount = (invoice.taxableAmount * invoice.vatPct) / 100;
  invoice.netTotal = invoice.taxableAmount + invoice.vatAmount;

  await invoice.save();

  // If the total changed, update distributor outstanding balance
  if (invoice.distributor && Math.abs(invoice.netTotal - oldNetTotal) > 0.01) {
    const diff = invoice.netTotal - oldNetTotal;
    await mongoose.model('Distributor').findByIdAndUpdate(invoice.distributor, {
      $inc: { outstandingBalance: diff }
    });
  }

  audit({ req, action: 'UPDATE_SALES_INVOICE', entity: 'SalesInvoice', entityId: invoice._id });
  res.json({ success: true, data: invoice });
});

export const deleteSalesInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const companyId = req.companyId;

  const invoice = await SalesInvoice.findOne({ _id: id, company: companyId });
  if (!invoice) throw ApiError.notFound('Invoice not found');

  // Adjust distributor balance if needed
  if (invoice.distributor) {
    await mongoose.model('Distributor').findByIdAndUpdate(invoice.distributor, {
      $inc: { outstandingBalance: -invoice.netTotal }
    });
  }

  await SalesInvoice.findByIdAndDelete(id);

  audit({ req, action: 'DELETE_SALES_INVOICE', entity: 'SalesInvoice', entityId: id, meta: { invoiceNumber: invoice.invoiceNumber } });
  res.json({ success: true, message: 'Invoice deleted successfully' });
});
