import { setServers } from "node:dns/promises"; setServers(["1.1.1.1", "8.8.8.8"]);/**
 * Seed script: creates super admin, demo packages, a demo company with owner,
 * manager and staff. Run: npm run seed
 */
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { User, Company, Package } from '../models/index.js';

async function seed() {
  await mongoose.connect(env.mongoUri);
  console.log('Connected. Seeding...');

  const upsertUser = async (email, payload) => {
    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ email, ...payload });
    } else {
      Object.assign(user, payload);
    }
    await user.save();
    return user;
  };

  // ---- Super Admin ----
  const superAdminEmail = 'admin@businesssarthi.com';
  await upsertUser(superAdminEmail, {
    name: 'Super Admin',
    password: 'SuperAdmin@123',
    role: 'SUPER_ADMIN',
    isEmailVerified: true,
    position: 'Platform Administrator',
  });
  console.log('✅ Super admin ready:', superAdminEmail, '/ SuperAdmin@123');

  // ---- Packages ----
  const packagesData = [
    {
      name: 'Starter', price: 2999, maxStaff: 10, trackingIntervalMinutes: 120,
      description: 'Basic tracking for small teams',
      features: { employeeTracking: true, inventoryManagement: false, vendorManagement: false, payrollManagement: false, salesTracking: true },
    },
    {
      name: 'Growth', price: 7999, maxStaff: 50, trackingIntervalMinutes: 60,
      description: 'Tracking + inventory + payroll',
      features: { employeeTracking: true, inventoryManagement: true, vendorManagement: true, payrollManagement: true, salesTracking: true },
    },
    {
      name: 'Enterprise', price: 19999, maxStaff: 500, trackingIntervalMinutes: 30,
      description: 'Everything, highest tracking frequency',
      features: { employeeTracking: true, inventoryManagement: true, vendorManagement: true, payrollManagement: true, salesTracking: true },
    },
  ];
  const packages = {};
  for (const p of packagesData) {
    packages[p.name] = await Package.findOneAndUpdate({ name: p.name }, p, { upsert: true, new: true });
  }
  console.log('✅ Packages seeded');

  // ---- Demo Company ----
  const demoEmail = 'demo@himalayatraders.com';
  let company = await Company.findOne({ email: demoEmail });
  if (!company) {
    company = await Company.create({
      name: 'Himalaya Traders Pvt. Ltd.',
      email: demoEmail,
      address: 'New Baneshwor, Kathmandu',
      panVat: '601234567',
      phone: '+977-1-4567890',
      package: packages['Growth']._id,
      packageAssignedAt: new Date(),
    });
  }

  const owner = await upsertUser('owner@himalayatraders.com', {
    name: 'Ramesh Shrestha',
    password: 'Owner@1234',
    role: 'COMPANY_OWNER',
    company: company._id,
    isEmailVerified: true,
    position: 'Managing Director',
  });
  company.owner = owner._id;
  await company.save();

  await upsertUser('manager@himalayatraders.com', {
    name: 'Sita Karki',
    password: 'Manager@1234',
    role: 'COMPANY_MANAGER',
    company: company._id,
    isEmailVerified: true,
    position: 'Operations Manager',
    basicSalary: 60000,
    dailyAllowance: 500,
  });

  const staffUsers = [
    ['Hari Thapa', 'hari@himalayatraders.com', 'Sales Executive', 35000, 300, 500000],
    ['Gita Lama', 'gita@himalayatraders.com', 'Field Officer', 32000, 300, 400000],
    ['Bikash Rai', 'bikash@himalayatraders.com', 'Sales Executive', 35000, 300, 450000],
  ];
  for (const [name, email, position, basicSalary, dailyAllowance, monthlyTarget] of staffUsers) {
    await upsertUser(email, {
      name,
      password: 'Staff@1234',
      role: 'STAFF',
      company: company._id,
      isEmailVerified: true,
      position,
      basicSalary,
      dailyAllowance,
      monthlyTarget,
    });
  }
  console.log('✅ Demo company + users ready');
  console.log('   owner@himalayatraders.com / Owner@1234');
  console.log('   manager@himalayatraders.com / Manager@1234');
  console.log('   hari@himalayatraders.com / Staff@1234');

  await mongoose.disconnect();
  console.log('🌱 Seeding complete');
}

seed().catch((e) => { console.error(e); process.exit(1); });
