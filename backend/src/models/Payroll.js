import mongoose from 'mongoose';

const payrollSchema = new mongoose.Schema(
  {
    staff: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null }, // null => system employee payroll
    month: { type: String, required: true }, // YYYY-MM
    basicSalary: { type: Number, required: true, min: 0 },
    dailyAllowance: { type: Number, default: 0, min: 0 },
    allowance: { type: Number, default: 0, min: 0 },
    bonus: { type: Number, default: 0, min: 0 },
    deductions: {
      absent: { type: Number, default: 0, min: 0 },
      tax: { type: Number, default: 0, min: 0 },
      other: { type: Number, default: 0, min: 0 },
    },
    presentDays: { type: Number, default: 0 },
    paidLeaveDays: { type: Number, default: 0 },
    workingDays: { type: Number, default: 0 },
    netSalary: { type: Number, required: true },
    status: { type: String, enum: ['DRAFT', 'GENERATED', 'PAID'], default: 'GENERATED', index: true },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    paidAt: Date,
    remarks: { type: String, maxlength: 300 },
    editHistory: [{
      changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      changedAt: { type: Date, default: Date.now },
      reason: { type: String, maxlength: 300 },
      changes: { type: mongoose.Schema.Types.Mixed },
    }],
  },
  { timestamps: true }
);

payrollSchema.index({ staff: 1, month: 1 }, { unique: true });
payrollSchema.index({ company: 1, month: -1 });

export default mongoose.model('Payroll', payrollSchema);
