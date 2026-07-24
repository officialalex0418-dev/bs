import dotenv from 'dotenv';
dotenv.config();

const required = [
  'MONGO_URI',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'R2_ENDPOINT'
];
for (const key of required) {
  if (!process.env[key]) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`CRITICAL: Missing required environment variable: ${key}`);
    } else {
      console.warn(`[SECURITY WARN] Missing environment variable: ${key}. Using insecure development default.`);
    }
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT || '5000', 10),
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:5000',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/business_sarthi',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev_secret_UNSAFE_REPLACE_ME_IN_PROD_123456789',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_UNSAFE_REPLACE_ME_IN_PROD_123456789',
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '30d',
  },
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true', // false for 587 (STARTTLS)
    user: process.env.EMAIL_USER || process.env.SMTP_USER || process.env.MAIL_USER,
    pass: process.env.EMAIL_PASS || process.env.SMTP_PASS || process.env.MAIL_PASS,
    from: process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.EMAIL_USER || process.env.SMTP_USER || process.env.MAIL_USER,
  },
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
  r2: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET,
    endpoint: process.env.R2_ENDPOINT,
    publicUrl: process.env.R2_PUBLIC_URL || '', // If using a custom domain for R2
  },
  rateLimit: {
    windowMinutes: parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES || '15', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '300', 10),
    authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '20', 10),
  },
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
};
