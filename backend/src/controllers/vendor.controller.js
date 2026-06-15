import Vendor from '../models/Vendor.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { getPagination, paginatedResponse } from '../utils/pagination.js';
import { audit } from '../utils/audit.js';

/** GET /vendors */
export const listVendors = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { company: req.companyId, isActive: true };
  if (req.query.search) filter.name = { $regex: req.query.search, $options: 'i' };

  const [items, total] = await Promise.all([
    Vendor.find(filter).sort('name').skip(skip).limit(limit),
    Vendor.countDocuments(filter),
  ]);
  res.json({ success: true, data: paginatedResponse(items, total, page, limit) });
});

/** POST /vendors */
export const createVendor = asyncHandler(async (req, res) => {
  const vendor = await Vendor.create({ ...req.body, company: req.companyId });
  audit({ req, action: 'CREATE_VENDOR', entity: 'Vendor', entityId: vendor._id });
  res.status(201).json({ success: true, data: { vendor } });
});

/** PATCH /vendors/:id */
export const updateVendor = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findOneAndUpdate(
    { _id: req.params.id, company: req.companyId },
    req.body,
    { new: true, runValidators: true }
  );
  if (!vendor) throw ApiError.notFound('Vendor not found');
  audit({ req, action: 'UPDATE_VENDOR', entity: 'Vendor', entityId: vendor._id });
  res.json({ success: true, data: { vendor } });
});

/** DELETE /vendors/:id — soft delete */
export const deleteVendor = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findOneAndUpdate(
    { _id: req.params.id, company: req.companyId },
    { isActive: false },
    { new: true }
  );
  if (!vendor) throw ApiError.notFound('Vendor not found');
  audit({ req, action: 'DELETE_VENDOR', entity: 'Vendor', entityId: vendor._id });
  res.json({ success: true, message: 'Vendor removed' });
});
