import mongoose from 'mongoose';

const designationSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null }, // Null for system designations
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', index: true },
    name: { type: String, required: true, trim: true },
    baseRole: { type: String, enum: ['COMPANY_OWNER', 'COMPANY_MANAGER', 'STAFF', 'ADMIN_EMPLOYEE'], default: 'STAFF' },
    permissions: {
      // Platform permissions
      companies: { type: Boolean, default: false },
      packages: { type: Boolean, default: false },
      systemEmployees: { type: Boolean, default: false },
      companyStaff: { type: Boolean, default: false },

      // Company permissions
      staff: { type: Boolean, default: false },
      liveTracking: { type: Boolean, default: false },
      attendance: { type: Boolean, default: false },
      leaves: { type: Boolean, default: false },
      salesTracker: { type: Boolean, default: false },
      inventory: { type: Boolean, default: false },
      distributors: { type: Boolean, default: false },
      payroll: { type: Boolean, default: false },
      complaints: { type: Boolean, default: false },
      reports: { type: Boolean, default: false },

      // Shared
      configuration: { type: Boolean, default: false },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Unique designation name within a company and department
designationSchema.index({ company: 1, department: 1, name: 1 }, { unique: true });

export default mongoose.model('Designation', designationSchema);
