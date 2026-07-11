import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { ALL_ROLES, ADMIN_EMPLOYEE_SUBROLES } from '../constants/roles.js';
import { env } from '../config/env.js';

const refreshTokenSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true },
    device: String,
    ip: String,
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 120 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email address'],
    },
    phone: { type: String, trim: true, maxlength: 20 },
    address: { type: String, trim: true, maxlength: 300 },
    pan: { type: String, trim: true, uppercase: true, maxlength: 30 },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ALL_ROLES, required: true, index: true },
    subRole: { type: String, enum: [...ADMIN_EMPLOYEE_SUBROLES, null], default: null }, // for ADMIN_EMPLOYEE (Deprecated in favor of designation)
    designation: { type: mongoose.Schema.Types.ObjectId, ref: 'Designation', default: null },
    shift: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift', default: null },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', index: true, default: null },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    position: { type: String, trim: true, maxlength: 100 },
    workMode: { type: String, enum: ['INDOOR', 'OUTDOOR'], default: 'OUTDOOR' },
    basicSalary: { type: Number, min: 0, default: 0 },
    dailyAllowance: { type: Number, min: 0, default: 0 },
    allowances: { type: Number, min: 0, default: 0 },
    profilePhoto: { type: String, default: null },
    isActive: { type: Boolean, default: true, index: true },
    needsPasswordChange: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
    emailVerifyToken: { type: String, select: false },
    emailVerifyExpires: { type: Date, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    refreshTokens: { type: [refreshTokenSchema], select: false },
    lastLoginAt: Date,
    // Device locking
    primaryDeviceId: { type: String, default: null },
    isDeviceResetAuthorized: { type: Boolean, default: false },
    deviceResetRequested: { type: Boolean, default: false },
    // Staff-specific
    monthlyTarget: { type: Number, min: 0, default: 0 },
    leaveBalance: {
      paid: { type: Number, default: 12 },
      sick: { type: Number, default: 6 },
    },
  },
  { timestamps: true }
);

// ---------- Indexes ----------
userSchema.index({ company: 1, role: 1 });
userSchema.index({ company: 1, isActive: 1 });
userSchema.index({ name: 'text', email: 'text' });

// ---------- Hooks ----------
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, env.bcryptRounds);
  next();
});

// ---------- Methods ----------
userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.createPasswordResetToken = function () {
  const raw = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(raw).digest('hex');
  this.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 min
  return raw;
};

userSchema.methods.createPasswordResetOtp = function () {
  const otp = crypto.randomInt(100000, 999999).toString();
  this.passwordResetToken = crypto.createHash('sha256').update(otp).digest('hex');
  this.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
  return otp;
};

userSchema.methods.createEmailVerifyToken = function () {
  const raw = crypto.randomBytes(32).toString('hex');
  this.emailVerifyToken = crypto.createHash('sha256').update(raw).digest('hex');
  this.emailVerifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 h
  return raw;
};

userSchema.methods.toSafeJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshTokens;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.emailVerifyToken;
  delete obj.emailVerifyExpires;
  return obj;
};

export default mongoose.model('User', userSchema);
