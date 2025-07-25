import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';
import { currentVersion } from './version.js';

// Get the version from shared utility
const version = currentVersion;

// Create logs directory if it doesn't exist
const logsDir = 'logs';
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for structured logging
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

// Console format for human-readable output
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let logMessage = `${timestamp} [${level}]: ${message}`;

    // Add structured data if present
    if (Object.keys(meta).length > 0) {
      const metaStr = Object.entries(meta)
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join(' ');
      logMessage += ` ${metaStr}`;
    }

    return logMessage;
  }),
);

// Create the logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'shelfbridge',
    version: version,
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.LOG_LEVEL || 'info',
    }),

    // Daily rotating file transport for all logs
    new DailyRotateFile({
      filename: path.join(logsDir, 'shelfbridge-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      level: 'debug',
    }),

    // Separate error log file
    new DailyRotateFile({
      filename: path.join(logsDir, 'shelfbridge-error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error',
    }),
  ],
  // Handle uncaught exceptions
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'shelfbridge-exception-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
    }),
  ],
  // Handle unhandled promise rejections
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'shelfbridge-rejection-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
    }),
  ],
});

// Add context methods for structured logging
logger.withContext = context => {
  return {
    info: (message, meta = {}) => logger.info(message, { ...meta, context }),
    error: (message, meta = {}) => logger.error(message, { ...meta, context }),
    warn: (message, meta = {}) => logger.warn(message, { ...meta, context }),
    debug: (message, meta = {}) => logger.debug(message, { ...meta, context }),
    verbose: (message, meta = {}) =>
      logger.verbose(message, { ...meta, context }),
    withContext: additionalContext =>
      logger.withContext({ ...context, ...additionalContext }),
  };
};

// Add user-specific logging
logger.forUser = userId => {
  return logger.withContext({ userId });
};

// Add operation-specific logging
logger.forOperation = operation => {
  return logger.withContext({ operation });
};

// Add book-specific logging
logger.forBook = (bookId, title) => {
  return logger.withContext({ bookId, title });
};

// Performance logging helper
logger.measureTime = async (operation, fn) => {
  const startTime = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - startTime;
    logger.info(`${operation} completed`, {
      operation,
      duration,
      durationMs: duration,
      success: true,
    });
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`${operation} failed`, {
      operation,
      duration,
      durationMs: duration,
      success: false,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
};

// Sync progress logging helper
logger.logSyncProgress = (user, stats) => {
  logger.info('Sync completed', {
    userId: user.id,
    booksProcessed: stats.books_processed,
    booksSynced: stats.books_synced,
    booksCompleted: stats.books_completed,
    booksAutoAdded: stats.books_auto_added,
    booksSkipped: stats.books_skipped,
    errors: stats.errors.length,
    hasErrors: stats.errors.length > 0,
  });

  if (stats.errors.length > 0) {
    stats.errors.forEach((error, index) => {
      logger.error(`Sync error ${index + 1}`, {
        userId: user.id,
        error: error.message || error,
      });
    });
  }
};

// API request logging helper
logger.logApiRequest = (method, url, statusCode, duration, userId = null) => {
  const level = statusCode >= 400 ? 'error' : 'debug';
  logger[level]('API request', {
    method,
    url,
    statusCode,
    duration,
    durationMs: duration,
    userId,
  });
};

// Cache operation logging helper
logger.logCacheOperation = (operation, details) => {
  logger.debug('Cache operation', {
    operation,
    ...details,
  });
};

export default logger;
