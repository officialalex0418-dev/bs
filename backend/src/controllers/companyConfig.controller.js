import { Designation, Branch, Shift, Department, LeaveType, Holiday } from '../models/index.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { audit } from '../utils/audit.js';

/**
 * Generic helper for CRUD on company-scoped config models
 */
const crud = (Model, entityName, options = {}) => {
  const { defaultSort = 'name date', populate = '' } = options;

  return {
    list: asyncHandler(async (req, res) => {
      let query = Model.find({ company: req.companyId, isActive: { $ne: false } }).sort(defaultSort);
      if (populate) query = query.populate(populate);
      const items = await query;
      res.json({ success: true, data: items });
    }),
    create: asyncHandler(async (req, res) => {
      const item = await Model.create({ ...req.body, company: req.companyId });
      audit({ req, action: `CREATE_${entityName.toUpperCase()}`, entity: entityName, entityId: item._id });
      res.status(201).json({ success: true, data: item });
    }),
    update: asyncHandler(async (req, res) => {
      const item = await Model.findOneAndUpdate(
        { _id: req.params.id, company: req.companyId },
        { $set: req.body },
        { new: true, runValidators: true }
      );
      if (!item) throw ApiError.notFound(`${entityName} not found`);
      audit({ req, action: `UPDATE_${entityName.toUpperCase()}`, entity: entityName, entityId: item._id });
      res.json({ success: true, data: item });
    }),
    delete: asyncHandler(async (req, res) => {
      // Soft delete if isActive exists, otherwise hard delete
      const hasIsActive = Model.schema.path('isActive');
      let item;
      if (hasIsActive) {
        item = await Model.findOneAndUpdate({ _id: req.params.id, company: req.companyId }, { isActive: false });
      } else {
        item = await Model.findOneAndDelete({ _id: req.params.id, company: req.companyId });
      }
      if (!item) throw ApiError.notFound(`${entityName} not found`);
      audit({ req, action: `DELETE_${entityName.toUpperCase()}`, entity: entityName, entityId: item._id });
      res.json({ success: true, message: `${entityName} removed` });
    }),
  };
};

// ---------- Designations ----------
const designations = crud(Designation, 'Designation', { populate: 'department' });
export const listDesignations = designations.list;
export const createDesignation = designations.create;
export const updateDesignation = designations.update;
export const deleteDesignation = designations.delete;

// ---------- Branches ----------
const branches = crud(Branch, 'Branch');
export const listBranches = branches.list;
export const createBranch = branches.create;
export const updateBranch = branches.update;
export const deleteBranch = branches.delete;

// ---------- Shifts ----------
const shifts = crud(Shift, 'Shift');
export const listShifts = shifts.list;
export const createShift = shifts.create;
export const updateShift = shifts.update;
export const deleteShift = shifts.delete;

// ---------- Departments ----------
const departments = crud(Department, 'Department');
export const listDepartments = departments.list;
export const createDepartment = departments.create;
export const updateDepartment = departments.update;
export const deleteDepartment = departments.delete;

// ---------- Leave Types ----------
const leaveTypes = crud(LeaveType, 'LeaveType');
export const listLeaveTypes = leaveTypes.list;
export const createLeaveType = leaveTypes.create;
export const updateLeaveType = leaveTypes.update;
export const deleteLeaveType = leaveTypes.delete;

// ---------- Holidays ----------
const holidays = crud(Holiday, 'Holiday', { defaultSort: 'startDate' });
export const listHolidays = holidays.list;
export const createHoliday = holidays.create;
export const updateHoliday = holidays.update;
export const deleteHoliday = holidays.delete;
