import http from 'http';
import app from './app.js';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { initSocket } from './sockets/index.js';
import { startCronJobs } from './services/cron.service.js';
import { logger } from './utils/logger.js';

async function main() {
  try {
    await connectDB();
    logger.info('Connected to MongoDB');

    const server = http.createServer(app);
    initSocket(server);

    // Start background tasks
    startCronJobs();

    server.listen(env.port, '0.0.0.0', () => {
      logger.info(`🚀 Business Sarthi API running on port ${env.port} (${env.nodeEnv})`);
    });

    // Graceful shutdown
    const shutdown = (signal) => {
      logger.info(`${signal} received — shutting down gracefully...`);
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', (err) => {
      logger.error('UNHANDLED REJECTION 💥', err);
    });
    process.on('uncaughtException', (err) => {
      logger.error('UNCAUGHT EXCEPTION 💥', err);
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

main();
