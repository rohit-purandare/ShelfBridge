/**
 * Utilities index - Re-exports all utility functions for easier imports
 *
 * This allows importing multiple utilities from different modules with:
 * import { formatDuration, Semaphore, normalizeApiToken } from './utils/index.js';
 *
 * Instead of multiple imports from different files.
 */

// Time utilities
export {
  formatDuration,
  formatDurationForLogging,
  parseDurationString,
  sleep,
} from './time.js';

// Debug utilities
export { dumpFailedSyncBooks } from './debug.js';

// Network utilities
export {
  normalizeApiToken,
  createHttpAgent,
  retryWithBackoff,
} from './network.js';

// Retry management utilities
export {
  RetryManager,
  RetryStrategy,
  createRetryManager,
  HardcoverRetryManager,
  AudiobookshelfRetryManager,
} from './retry-manager.js';

// Concurrency utilities
export { Semaphore, RateLimiter } from './concurrency.js';

// API testing utilities
export { testApiConnections } from './api-testing.js';

// Data parsing utilities
export { safeParseInt, safeParseFloat, safeParseBoolean } from './data.js';

// Identifier resolution utilities
export { resolveBookIdentifier } from './identifier-resolver.js';

// Date formatting utilities
export {
  formatTimestampForDisplay,
  formatDateForHardcover,
} from './date-formatter.js';

// Format compatibility utilities
export {
  mapHardcoverFormatToInternal,
  areFormatsCompatible,
  checkFormatCompatibility,
} from './format-compatibility.js';
