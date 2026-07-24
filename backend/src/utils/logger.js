import winston from 'winston';
import { env } from '../config/env.js';

const { combine, timestamp, json, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  return `${timestamp} [${level}]: ${stack || message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
});

export const logger = winston.createLogger({
  level: env.isProd ? 'info' : 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    env.isProd ? json() : combine(colorize(), logFormat)
  ),
  transports: [
    new winston.transports.Console(),
    // For cloud environments like Northflank, console logs are automatically collected.
    // If we wanted local file logs (not recommended for containers):
    // new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    // new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Stream for morgan
logger.stream = {
  write: (message) => logger.info(message.trim()),
};
