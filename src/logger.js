import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';
import { currentVersion } from './version.js';
import { formatErrorWithIssueLink } from './utils/github-helper.js';

// Get the version from shared utility
const version = currentVersion;

// Determine logs directory and whether file logging is available
const logsDir = path.resolve('logs');
let fileLoggingEnabled = true;

try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  // Ensure directory itself is writable
  fs.accessSync(logsDir, fs.constants.W_OK);
  const testFile = path.join(logsDir, `.write-test-${Date.now()}`);
  fs.writeFileSync(testFile, 'ok');
  fs.unlinkSync(testFile);

  // Also verify that any existing log files for today are writable
  const pad = n => String(n).padStart(2, '0');
  const now = new Date();
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const candidates = [
    path.join(logsDir, `shelfbridge-${today}.log`),
    path.join(logsDir, `shelfbridge-error-${today}.log`),
    path.join(logsDir, `shelfbridge-exception-${today}.log`),
    path.join(logsDir, `shelfbridge-rejection-${today}.log`),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      fs.accessSync(file, fs.constants.W_OK);
    }
  }
} catch (e) {
  fileLoggingEnabled = false;
  console.warn(
    `[logging] Falling back to console-only logging. Directory not writable: ${logsDir}`,
  );
  console.warn(`[logging] Error details: ${e.message}`);

  // Add diagnostic information
  try {
    const stats = fs.statSync(logsDir);
    console.warn(`[logging] Directory exists: ${fs.existsSync(logsDir)}`);
    console.warn(`[logging] Directory stats: mode=${stats.mode.toString(8)}, uid=${stats.uid}, gid=${stats.gid}`);
    console.warn(`[logging] Process uid=${process.getuid()}, gid=${process.getgid()}`);
  } catch (statError) {
    console.warn(`[logging] Could not get directory stats: ${statError.message}`);
  }
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
    new winston.transports.Console({
      format: consoleFormat,
      level: process.env.LOG_LEVEL || 'info',
    }),
    ...(fileLoggingEnabled
      ? [
          new DailyRotateFile({
            filename: path.join(logsDir, 'shelfbridge-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d',
            level: 'debug',
          }),
          new DailyRotateFile({
            filename: path.join(logsDir, 'shelfbridge-error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '30d',
            level: 'error',
          }),
        ]
      : []),
  ],
  exceptionHandlers: fileLoggingEnabled
    ? [
        new DailyRotateFile({
          filename: path.join(logsDir, 'shelfbridge-exception-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '30d',
        }),
      ]
    : [
        new winston.transports.Console({
          format: consoleFormat,
          level: 'error',
        }),
      ],
  rejectionHandlers: fileLoggingEnabled
    ? [
        new DailyRotateFile({
          filename: path.join(logsDir, 'shelfbridge-rejection-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '30d',
        }),
      ]
    : [
        new winston.transports.Console({
          format: consoleFormat,
          level: 'error',
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
  return logger.withContext({ user_id: userId });
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
    user_id: user.id,
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
        user_id: user.id,
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
    user_id: userId,
  });
};

// Cache operation logging helper
logger.logCacheOperation = (operation, details) => {
  logger.debug('Cache operation', {
    operation,
    ...details,
  });
};

// Error logging with GitHub issue link helper
logger.logErrorWithIssueLink = async (message, error, context = {}) => {
  // Capture comprehensive error context
  const timestamp = new Date().toISOString();
  const errorContext = {
    timestamp,
    error_type: error.constructor.name,
    error_code: error.code,
    error_errno: error.errno,
    error_syscall: error.syscall,
    error_path: error.path,
    ...context,
  };

  // Log the error normally for file logging with full context
  logger.error(message, {
    error: error.message,
    stack: error.stack,
    ...errorContext,
  });

  try {
    // Format and display user-friendly error with GitHub link to console only
    const enhancedContext = {
      version: version,
      platform: process.platform,
      node_version: process.version,
      component: 'logger',
      timestamp,
      // Add any additional runtime context
      memory_usage: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      process_uptime: `${Math.round(process.uptime())}s`,
      ...errorContext,
    };

    const userFriendlyMessage = await formatErrorWithIssueLink(
      message,
      error,
      enhancedContext,
    );

    // Use console directly to avoid winston formatting for this user-facing message
    console.error('\n' + '='.repeat(60));
    console.error('❌ ERROR');
    console.error('='.repeat(60));
    console.error(userFriendlyMessage);
    console.error('='.repeat(60));
  } catch (formatError) {
    // If there's an error formatting the GitHub link, show a simpler message
    console.error('\n' + '='.repeat(60));
    console.error('❌ ERROR');
    console.error('='.repeat(60));
    console.error(
      `${message}\n\n🐛 Report this issue: https://github.com/rohit-purandare/shelfbridge/issues/new`,
    );
    console.error('='.repeat(60));
    logger.debug('Error formatting GitHub issue link', {
      error: formatError.message,
    });
  }
};

export default logger;
