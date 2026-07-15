import http from 'http';
import app from './app.js';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { initSocket } from './sockets/index.js';
import { startCronJobs } from './services/cron.service.js';

async function main() {
  // Trigger reload
  await connectDB();

  const server = http.createServer(app);
  initSocket(server);

  // Start background tasks
  startCronJobs();

  server.listen(env.port, '0.0.0.0', () => {
    console.log(`🚀 Business Sarthi API running on port ${env.port} (${env.nodeEnv})`);
  });

  // Graceful shutdown
  const shutdown = (signal) => {
    console.log(`\n${signal} received — shutting down gracefully...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION 💥', err);
  });
}

main();
