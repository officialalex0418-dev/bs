import crypto from 'crypto';
import {
  Company, User, Package, LocationLog, Attendance, Leave, Sale,
  Payroll, Notification, Inventory, Distributor, Invoice, Payment, Setting
} from '../models/index.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { getPagination, paginatedResponse } from '../utils/pagination.js';
import { audit } from '../utils/audit.js';
import { emails } from '../services/email.service.js';
import { notify } from '../services/notification.service.js';
import { realtime } from '../sockets/index.js';
import { uploadFile } from '../services/storage.service.js';
import { ROLES } from '../constants/roles.js';

/** GET /companies (Super Admin) */
export const listCompanies = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) filter.name = { $regex: req.query.search, $options: 'i' };

  const [items, total] = await Promise.all([
    Company.find(filter).populate('package', 'name maxStaff trackingIntervalMinutes features')
      .populate('owner', 'name email').sort('-createdAt').skip(skip).limit(limit),
    Company.countDocuments(filter),
  ]);
  res.json({ success: true, data: paginatedResponse(items, total, page, limit) });
});

/** POST /companies (Super Admin) — creates company + owner account */
export const createCompany = asyncHandler(async (req, res) => {
  const {
    name, address, panVat, phone, email, logo, packageId, ownerName, ownerEmail,
    location, checkInRadiusMeters, settings, registrationNumber, website, description, additionalInfo
  } = req.body;

  if (await Company.findOne({ email })) throw ApiError.conflict('Company email already exists');
  if (await User.findOne({ email: ownerEmail })) throw ApiError.conflict('Owner email already in use');

  const pkg = packageId ? await Package.findById(packageId) : null;
  if (packageId && !pkg) throw ApiError.notFound('Package not found');

  let logoUrl = logo;
  if (logo && logo.startsWith('data:')) {
    logoUrl = await uploadFile(logo, 'logos');
  }

  const company = await Company.create({
    name, address, panVat, phone, email, logo: logoUrl,
    registrationNumber, website, description, additionalInfo,
    package: pkg?._id || null,
    packageAssignedAt: pkg ? new Date() : null,
    location,
    checkInRadiusMeters,
    settings: settings || {}
  });

  const tempPassword = crypto.randomBytes(6).toString('base64url');
  const owner = await User.create({
    name: ownerName,
    email: ownerEmail,
    password: tempPassword,
    role: ROLES.COMPANY_OWNER,
    company: company._id,
    isEmailVerified: false,
    needsPasswordChange: true,
  });
  company.owner = owner._id;
  await company.save();

  emails.companyCreated(ownerEmail, { companyName: name, ownerEmail, tempPassword });
  audit({ req, action: 'CREATE_COMPANY', entity: 'Company', entityId: company._id, meta: { name } });
  realtime.dashboard(null, { event: 'company_created' });
  realtime.activity(null, { text: `Company "${name}" created`, at: new Date() });

  res.status(201).json({ success: true, data: { company, owner: owner.toSafeJSON() } });
});

/** GET /companies/:id */
export const getCompany = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id)
    .populate('package').populate('owner', 'name email phone');
  if (!company) throw ApiError.notFound('Company not found');
  res.json({ success: true, data: { company } });
});

/** GET /companies/me — current user's company (owner/manager) */
export const myCompany = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.user.company).populate('package').populate('owner', 'name email phone');
  if (!company) throw ApiError.notFound('Company not found');
  res.json({ success: true, data: { company } });
});

/** PATCH /companies/me — company owner can edit own company details */
export const updateMyCompany = asyncHandler(async (req, res) => {
  if (!req.user.company) throw ApiError.forbidden('No company associated with this account');

  const updates = (({ name, address, panVat, phone, email, logo, settings, registrationNumber, website, description, additionalInfo, location, checkInRadiusMeters }) =>
    ({ name, address, panVat, phone, email, logo, settings, registrationNumber, website, description, additionalInfo, location, checkInRadiusMeters }))(req.body);

  Object.keys(updates).forEach((k) => updates[k] === undefined && delete updates[k]);

  if (updates.logo && updates.logo.startsWith('data:')) {
    updates.logo = await uploadFile(updates.logo, 'logos');
  }

  const companyId = req.user.company._id || req.user.company;
  const company = await Company.findByIdAndUpdate(companyId, updates, { new: true, runValidators: true })
    .populate('package').populate('owner', 'name email phone');
  if (!company) throw ApiError.notFound('Company not found');

  audit({ req, action: 'UPDATE_MY_COMPANY', entity: 'Company', entityId: company._id });
  res.json({ success: true, data: { company } });
});

/** PATCH /companies/:id */
export const updateCompany = asyncHandler(async (req, res) => {
  const updates = (({ name, address, panVat, phone, email, logo, status, settings, registrationNumber, website, description, additionalInfo }) =>
    ({ name, address, panVat, phone, email, logo, status, settings, registrationNumber, website, description, additionalInfo }))(req.body);
  Object.keys(updates).forEach((k) => updates[k] === undefined && delete updates[k]);

  if (updates.logo && updates.logo.startsWith('data:')) {
    updates.logo = await uploadFile(updates.logo, 'logos');
  }

  const company = await Company.findByIdAndUpdate(req.params.id, updates, {
    new: true, runValidators: true,
  });
  if (!company) throw ApiError.notFound('Company not found');

  audit({ req, action: 'UPDATE_COMPANY', entity: 'Company', entityId: company._id });
  res.json({ success: true, data: { company } });
});

/** PATCH /companies/:id/package — assign / change package */
export const assignPackage = asyncHandler(async (req, res) => {
  const pkg = await Package.findById(req.body.packageId);
  if (!pkg) throw ApiError.notFound('Package not found');

  const company = await Company.findByIdAndUpdate(
    req.params.id,
    { package: pkg._id, packageAssignedAt: new Date() },
    { new: true }
  ).populate('owner', 'email name');
  if (!company) throw ApiError.notFound('Company not found');

  if (company.owner) {
    emails.packageAssigned(company.owner.email, { companyName: company.name, packageName: pkg.name });
    notify({
      recipient: company.owner._id, company: company._id, type: 'PACKAGE_ASSIGNED',
      title: 'Package updated', message: `Your company is now on "${pkg.name}".`,
    });
  }
  audit({ req, action: 'ASSIGN_PACKAGE', entity: 'Company', entityId: company._id, meta: { package: pkg.name } });
  res.json({ success: true, data: { company } });
});

/** DELETE /companies/:id — soft suspend */
export const deleteCompany = asyncHandler(async (req, res) => {
  const company = await Company.findByIdAndUpdate(req.params.id, { status: 'SUSPENDED' }, { new: true });
  if (!company) throw ApiError.notFound('Company not found');
  await User.updateMany({ company: company._id }, { isActive: false });
  audit({ req, action: 'SUSPEND_COMPANY', entity: 'Company', entityId: company._id });
  res.json({ success: true, message: 'Company suspended and users deactivated' });
});

/** DELETE /companies/:id/hard — permanent delete */
export const hardDeleteCompany = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id);
  if (!company) throw ApiError.notFound('Company not found');

  const companyId = company._id;

  // Cascading cleanup of ALL company data
  await Promise.all([
    User.deleteMany({ company: companyId }),
    LocationLog.deleteMany({ company: companyId }),
    Attendance.deleteMany({ company: companyId }),
    Leave.deleteMany({ company: companyId }),
    Sale.deleteMany({ company: companyId }),
    Inventory.deleteMany({ company: companyId }),
    Distributor.deleteMany({ company: companyId }),
    Invoice.deleteMany({ company: companyId }),
    Payment.deleteMany({ company: companyId }),
    Payroll.deleteMany({ company: companyId }),
    Notification.deleteMany({ company: companyId }),
    Setting.deleteMany({ scope: companyId.toString() }),
    Company.findByIdAndDelete(companyId),
  ]);

  audit({ req, action: 'HARD_DELETE_COMPANY', entity: 'Company', entityId: companyId, meta: { name: company.name } });
  res.json({ success: true, message: 'Company and all associated data permanently removed from database' });
});

