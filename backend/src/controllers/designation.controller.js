import { Designation } from '../models/index.js';
import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { audit } from '../utils/audit.js';

export const listDesignations = asyncHandler(async (req, res) => {
  const items = await Designation.find({ company: null }).sort('name');
  res.json({ success: true, data: items });
});

export const createDesignation = asyncHandler(async (req, res) => {
  const { name, permissions } = req.body;
  if (await Designation.findOne({ name, company: null })) {
    throw ApiError.badRequest('System designation name already exists');
  }

  const item = await Designation.create({ name, permissions, company: null, baseRole: 'ADMIN_EMPLOYEE' });
  audit({ req, action: 'CREATE_DESIGNATION', entity: 'Designation', entityId: item._id, meta: { name } });
  res.status(201).json({ success: true, data: item });
});

export const updateDesignation = asyncHandler(async (req, res) => {
  const item = await Designation.findOneAndUpdate(
    { _id: req.params.id, company: null },
    req.body,
    { new: true, runValidators: true }
  );
  if (!item) throw ApiError.notFound('Designation not found');
  audit({ req, action: 'UPDATE_DESIGNATION', entity: 'Designation', entityId: item._id });
  res.json({ success: true, data: item });
});

export const deleteDesignation = asyncHandler(async (req, res) => {
  const item = await Designation.findOneAndDelete({ _id: req.params.id, company: null });
  if (!item) throw ApiError.notFound('Designation not found');
  audit({ req, action: 'DELETE_DESIGNATION', entity: 'Designation', entityId: item._id });
  res.json({ success: true, message: 'Designation removed' });
});
