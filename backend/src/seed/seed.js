/**
 * Clean Seed script: creates only the primary super admin and default packages.
 * Run: npm run seed
 */
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { User, Package } from '../models/index.js';

async function seed() {
  try {
    await mongoose.connect(env.mongoUri);
    console.log('Connected to MongoDB. Starting clean seed...');

    const upsertUser = async (email, payload) => {
      let user = await User.findOne({ email });
      if (!user) {
        user = new User({ email, ...payload });
      } else {
        Object.assign(user, payload);
        // Ensure password is re-hashed if it's being updated via seed
        if (payload.password) {
            user.markModified('password');
        }
      }
      await user.save();
      return user;
    };

    // ---- Super Admin ----
    const superAdminEmail = 'royalconsultancyservices24@gmail.com';
    await upsertUser(superAdminEmail, {
      name: 'Royal Consultancy Services',
      password: 'R0yAl>bUsin@2o26',
      role: 'SUPER_ADMIN',
      isEmailVerified: true,
      position: 'Platform Owner',
    });
    console.log('✅ Super admin ready:', superAdminEmail);

    // ---- Essential Packages ----
    const packagesData = [
      {
        name: 'Starter', price: 2999, maxStaff: 10, trackingIntervalMinutes: 120,
        description: 'Basic tracking for small teams',
        features: { employeeTracking: true, inventoryManagement: false, vendorManagement: false, distributorManagement: false, payrollManagement: false, salesTracking: true },
      },
      {
        name: 'Growth', price: 7999, maxStaff: 50, trackingIntervalMinutes: 60,
        description: 'Tracking + inventory + payroll',
        features: { employeeTracking: true, inventoryManagement: true, vendorManagement: true, distributorManagement: true, payrollManagement: true, salesTracking: true },
      },
      {
        name: 'Enterprise', price: 19999, maxStaff: 500, trackingIntervalMinutes: 30,
        description: 'Everything, highest tracking frequency',
        features: { employeeTracking: true, inventoryManagement: true, vendorManagement: true, distributorManagement: true, payrollManagement: true, salesTracking: true },
      },
    ];

    for (const p of packagesData) {
      await Package.findOneAndUpdate({ name: p.name }, p, { upsert: true, new: true });
    }
    console.log('✅ Standard packages seeded');

    await mongoose.disconnect();
    console.log('🌱 Clean seeding complete. No dummy data created.');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();
