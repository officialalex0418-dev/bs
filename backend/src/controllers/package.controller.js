import Package from '../models/Package.js';
import Company from '../models/Company.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { audit } from '../utils/audit.js';

export const listPackages = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const items = await Package.find(filter).sort('price');
  res.json({ success: true, data: { items } });
});

export const createPackage = asyncHandler(async (req, res) => {
  const pkg = await Package.create(req.body);
  audit({ req, action: 'CREATE_PACKAGE', entity: 'Package', entityId: pkg._id });
  res.status(201).json({ success: true, data: { package: pkg } });
});

export const getPackage = asyncHandler(async (req, res) => {
  const pkg = await Package.findById(req.params.id);
  if (!pkg) throw ApiError.notFound('Package not found');
  const companiesUsing = await Company.countDocuments({ package: pkg._id });
  res.json({ success: true, data: { package: pkg, companiesUsing } });
});

export const updatePackage = asyncHandler(async (req, res) => {
  const pkg = await Package.findByIdAndUpdate(req.params.id, req.body, {
    new: true, runValidators: true,
  });
  if (!pkg) throw ApiError.notFound('Package not found');
  audit({ req, action: 'UPDATE_PACKAGE', entity: 'Package', entityId: pkg._id });
  res.json({ success: true, data: { package: pkg } });
});

export const deletePackage = asyncHandler(async (req, res) => {
  const inUse = await Company.countDocuments({ package: req.params.id });
  if (inUse > 0) throw ApiError.conflict(`Package in use by ${inUse} companies. Set INACTIVE instead.`);
  const pkg = await Package.findByIdAndDelete(req.params.id);
  if (!pkg) throw ApiError.notFound('Package not found');
  audit({ req, action: 'DELETE_PACKAGE', entity: 'Package', entityId: req.params.id });
  res.json({ success: true, message: 'Package deleted' });
});
