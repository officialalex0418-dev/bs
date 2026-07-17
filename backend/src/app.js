import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import { env } from './config/env.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { notFoundHandler, errorHandler } from './middleware/error.js';
import routes from './routes/index.js';

const app = express();

app.set('trust proxy', 1); // behind Render / proxies

// ---------- Security ----------
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Origin: ${req.headers.origin}`);
  next();
});

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowedOrigins = [
        env.clientUrl,
        'http://localhost:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5173',
        'https://bs-ebon-omega.vercel.app',
        'https://business-sarthi.vercel.app'
      ];
      if (allowedOrigins.includes(origin) || !env.isProd) {
        return callback(null, true);
      }
      console.warn(`[CORS REJECTED] Origin: ${origin}`);
      return callback(new Error('CORS blocked'));
    },
    credentials: true,
  })
);
app.use(mongoSanitize());

// ---------- Parsing / perf ----------
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(compression());
if (!env.isProd) app.use(morgan('dev'));

// ---------- Rate limiting ----------
app.use('/api', apiLimiter);

// ---------- Routes ----------
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', service: 'business-sarthi-api', time: new Date().toISOString() })
);
app.use('/api/v1', routes);

// ---------- Errors ----------
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
