import { Customer } from '../models/index.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { getPagination, paginatedResponse } from '../utils/pagination.js';
import { audit } from '../utils/audit.js';

export const listCustomers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { company: req.companyId };

  if (req.query.search) {
    filter.$or = [
      { name: { $regex: req.query.search, $options: 'i' } },
      { contactNumber: { $regex: req.query.search, $options: 'i' } },
      { ownerName: { $regex: req.query.search, $options: 'i' } }
    ];
  }

  const [items, total] = await Promise.all([
    Customer.find(filter).sort('name').skip(skip).limit(limit),
    Customer.countDocuments(filter),
  ]);
  res.json({ success: true, data: paginatedResponse(items, total, page, limit) });
});

export const createCustomer = asyncHandler(async (req, res) => {
  const { name } = req.body;

  // Optional: check if customer with same name exists in same company
  const existing = await Customer.findOne({ company: req.companyId, name: { $regex: `^${name}$`, $options: 'i' } });
  if (existing) {
    throw ApiError.badRequest('Customer with this name already exists');
  }

  const customer = await Customer.create({
    ...req.body,
    company: req.companyId,
    createdBy: req.user._id
  });

  audit({ req, action: 'CREATE_CUSTOMER', entity: 'Customer', entityId: customer._id });
  res.status(201).json({ success: true, data: customer });
});

export const updateCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findOneAndUpdate(
    { _id: req.params.id, company: req.companyId },
    { $set: req.body },
    { new: true, runValidators: true }
  );
  if (!customer) throw ApiError.notFound('Customer not found');

  audit({ req, action: 'UPDATE_CUSTOMER', entity: 'Customer', entityId: customer._id });
  res.json({ success: true, data: customer });
});

export const deleteCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findOneAndDelete({ _id: req.params.id, company: req.companyId });
  if (!customer) throw ApiError.notFound('Customer not found');

  audit({ req, action: 'DELETE_CUSTOMER', entity: 'Customer', entityId: customer._id });
  res.json({ success: true, message: 'Customer removed' });
});
