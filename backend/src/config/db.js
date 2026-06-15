import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDB() {
  mongoose.set('strictQuery', true);
  try {
    const conn = await mongoose.connect(env.mongoUri, {
      autoIndex: !env.isProd, // build indexes in dev; in prod sync manually/migration
      maxPoolSize: 50,
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () =>
    console.warn('⚠️  MongoDB disconnected')
  );
}
