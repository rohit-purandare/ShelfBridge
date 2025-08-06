/**
 * Utility functions for the sync tool
 *
 * This module contains general-purpose utilities that are NOT related to book matching.
 * Book matching utilities have been moved to src/matching/utils/
 */
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { Agent } from 'https';
import { Agent as HttpAgent } from 'http';
import logger from './logger.js';
import ProgressManager from './progress-manager.js';

/**
 * Semaphore class for managing concurrent access to shared resources
 */
export class Semaphore {
  constructor(maxConcurrency = 1) {
    this.maxConcurrency = maxConcurrency;
    this.current = 0;
    this.queue = [];
  }

  async acquire() {
    if (this.current < this.maxConcurrency) {
      this.current++;
      return;
    }
    return new Promise(resolve => {
      this.queue.push(resolve);
    });
  }

  release() {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      next();
    } else {
      this.current--;
    }
  }
}

/**
 * Calculate current page from percentage and total pages
 * @param {number} percentage - Progress percentage (0-100)
 * @param {number} totalPages - Total pages in the book
 * @returns {number} - Calculated current page
 * @deprecated Use ProgressManager.calculateCurrentPosition instead
 */
export function calculateCurrentPage(percentage, totalPages) {
  // Delegate to ProgressManager for consistency
  return ProgressManager.calculateCurrentPosition(percentage, totalPages, {
    type: 'pages',
    context: 'legacy calculateCurrentPage function',
  });
}

/**
 * Calculate seconds from percentage and total seconds
 * @param {number} percentage - Progress percentage (0-100)
 * @param {number} totalSeconds - Total seconds in the audiobook
 * @returns {number} - Calculated current seconds
 * @deprecated Use ProgressManager.calculateCurrentPosition instead
 */
export function calculateCurrentSeconds(percentage, totalSeconds) {
  // Delegate to ProgressManager for consistency
  return ProgressManager.calculateCurrentPosition(percentage, totalSeconds, {
    type: 'seconds',
    context: 'legacy calculateCurrentSeconds function',
  });
}

/**
 * Format duration in seconds to HH:MM:SS
 * @param {number} seconds - Duration in seconds
 * @returns {string} - Formatted duration
 */
export function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format duration in seconds to human-readable format for logging
 * @param {number} seconds - Duration in seconds
 * @returns {string} - Human-readable duration (e.g., "11h 7m 53s", "2m 30s", "45s")
 */
export function formatDurationForLogging(seconds) {
  if (!seconds || seconds < 0) return '0s';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

/**
 * Sleep for a specified number of milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} - Promise that resolves after the delay
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Normalize API token by stripping "Bearer" prefix if present
 * This handles cases where users accidentally include "Bearer" in their token
 * @param {string} token - The API token to normalize
 * @param {string} serviceName - Name of the service for logging (default: "API")
 * @returns {string} - The normalized token
 */
export function normalizeApiToken(token, serviceName = 'API') {
  if (!token) {
    logger.warn(`Empty token provided for ${serviceName}`);
    return token;
  }

  // Check if token starts with "Bearer " (case insensitive)
  const bearerPrefix = /^bearer\s+/i;
  if (bearerPrefix.test(token)) {
    const normalizedToken = token.replace(bearerPrefix, '');
    logger.warn(
      `Detected "Bearer" prefix in ${serviceName} token - removing it. Please update your configuration to exclude "Bearer" from the token.`,
    );
    return normalizedToken;
  }

  return token;
}

/**
 * Create HTTP/HTTPS agent with optimized settings
 * @param {boolean} isHttps - Whether to create HTTPS agent
 * @param {Object} options - Additional agent options
 * @returns {Agent} - HTTP or HTTPS agent
 */
export function createHttpAgent(isHttps = true, options = {}) {
  const defaultOptions = {
    keepAlive: true,
    maxSockets: 10,
    maxFreeSockets: 5,
    timeout: 60000,
    freeSocketTimeout: 30000,
  };

  const agentOptions = { ...defaultOptions, ...options };

  return isHttps ? new Agent(agentOptions) : new HttpAgent(agentOptions);
}

/**
 * Test API connections for a user
 * @param {Object} user - User configuration object
 * @returns {Object} - Results of connection tests
 */
export async function testApiConnections(user) {
  const results = {
    abs: false,
    hardcover: false,
    errors: [],
  };

  try {
    // Test Audiobookshelf connection
    const { AudiobookshelfClient } = await import('./audiobookshelf-client.js');
    const absClient = new AudiobookshelfClient(user.abs_url, user.abs_token);
    results.abs = await absClient.testConnection();

    if (!results.abs) {
      results.errors.push('Audiobookshelf connection failed');
    }
  } catch (error) {
    logger.debug('Audiobookshelf connection test failed', {
      error: error.message,
    });
    results.errors.push('Audiobookshelf connection failed');
    results.errors.push(`Audiobookshelf: ${error.message}`);
  }

  try {
    // Test Hardcover connection
    const { HardcoverClient } = await import('./hardcover-client.js');
    const hardcoverClient = new HardcoverClient(user.hardcover_token);
    results.hardcover = await hardcoverClient.testConnection();

    if (!results.hardcover) {
      results.errors.push('Hardcover connection failed');
    }
  } catch (error) {
    logger.debug('Hardcover connection test failed', { error: error.message });
    results.errors.push('Hardcover connection failed');
    results.errors.push(`Hardcover: ${error.message}`);
  }

  return results;
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} - Promise that resolves with the function result
 */
export async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Rate limiter class for API requests using rate-limiter-flexible
 */
export class RateLimiter {
  constructor(maxRequestsPerMinute = 55, keyPrefix = 'rate-limiter') {
    this.maxRequests = maxRequestsPerMinute;
    // Make key prefix unique by adding a timestamp to prevent conflicts between instances
    this.keyPrefix = `${keyPrefix}-${Date.now()}`;
    this.warningThreshold = Math.ceil(maxRequestsPerMinute * 0.8); // 80% of max requests
    this.requestCounts = new Map(); // Track request counts per minute for logging

    // Create rate limiter with specified requests per minute
    this.rateLimiter = new RateLimiterMemory({
      points: maxRequestsPerMinute, // Number of requests
      duration: 60, // Per 60 seconds (1 minute)
      blockDuration: 60, // Block for 60 seconds if limit exceeded
      execEvenly: true, // Spread requests evenly across the duration
    });

    // Clean up old request counts every minute
    setInterval(() => {
      this._cleanupOldCounts();
    }, 60000);

    logger.debug('RateLimiter initialized', {
      maxRequests: this.maxRequests,
      keyPrefix: this.keyPrefix,
      warningThreshold: this.warningThreshold,
    });
  }

  /**
   * Wait for rate limit if needed, with logging
   * @param {string} identifier - Unique identifier for this request (optional)
   * @returns {Promise<void>}
   */
  async waitIfNeeded(identifier = 'api-request') {
    try {
      const key = `${this.keyPrefix}-${identifier}`;
      await this.rateLimiter.consume(key);

      // Track request count for this minute
      const currentMinute = Math.floor(Date.now() / 60000);
      const currentCount = this.requestCounts.get(currentMinute) || 0;
      this.requestCounts.set(currentMinute, currentCount + 1);

      // Log warning if approaching limit
      if (currentCount + 1 >= this.warningThreshold) {
        logger.warn(
          `Rate limit warning: ${currentCount + 1}/${this.maxRequests} requests used this minute`,
          {
            identifier,
            requestsRemaining: this.maxRequests - (currentCount + 1),
          },
        );
      }
    } catch (rateLimiterError) {
      if (rateLimiterError.remainingPoints !== undefined) {
        const resetTime = new Date(Date.now() + rateLimiterError.msBeforeNext);
        logger.warn(
          `Rate limit hit for ${identifier}. Waiting ${Math.ceil(rateLimiterError.msBeforeNext / 1000)}s until ${resetTime.toLocaleTimeString()}`,
          {
            identifier,
            remainingPoints: rateLimiterError.remainingPoints,
            resetTime: resetTime.toISOString(),
          },
        );

        // Wait for the rate limiter to reset
        await sleep(rateLimiterError.msBeforeNext);
      } else {
        // Re-throw if it's not a rate limit error
        throw rateLimiterError;
      }
    }
  }

  /**
   * Clean up old request counts to prevent memory leaks
   * @private
   */
  _cleanupOldCounts() {
    const currentMinute = Math.floor(Date.now() / 60000);
    const cutoffMinute = currentMinute - 5; // Keep last 5 minutes

    for (const [minute] of this.requestCounts) {
      if (minute < cutoffMinute) {
        this.requestCounts.delete(minute);
      }
    }
  }

  /**
   * Get current usage statistics
   * @returns {Object} - Usage statistics
   */
  getStats() {
    const currentMinute = Math.floor(Date.now() / 60000);
    const currentCount = this.requestCounts.get(currentMinute) || 0;

    return {
      currentRequests: currentCount,
      maxRequests: this.maxRequests,
      utilizationPercent: Math.round((currentCount / this.maxRequests) * 100),
      warningThreshold: this.warningThreshold,
    };
  }
}

/**
 * Dump failed sync books to a file for debugging
 * @param {string} userId - User ID
 * @param {Array} failedBooks - Array of failed book objects
 * @param {string} timestamp - Timestamp for the dump file
 * @returns {Promise<string>} - Path to the dump file
 */
export async function dumpFailedSyncBooks(
  userId,
  failedBooks,
  timestamp = new Date().toISOString().replace(/[:.]/g, '-'),
) {
  if (!failedBooks || failedBooks.length === 0) {
    return null;
  }

  const fs = await import('fs');
  const path = await import('path');

  // Ensure data directory exists
  const dataDir = 'data';
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const filename = `failed-sync-${userId}-${timestamp}.txt`;
  const filepath = path.join(dataDir, filename);

  const output = [];
  output.push(`Failed Sync Books for User: ${userId}`);
  output.push(`Timestamp: ${new Date().toISOString()}`);
  output.push(`Count: ${failedBooks.length}`);
  output.push('='.repeat(80));
  output.push('');

  for (const [index, book] of failedBooks.entries()) {
    output.push(`${index + 1}. ${book.title || 'Unknown Title'}`);
    output.push(`   Author: ${book.author || 'Unknown Author'}`);
    output.push(`   Error: ${book.error || 'Unknown Error'}`);
    output.push(`   Progress: ${book.progress || 0}%`);
    if (book.identifiers) {
      output.push(`   Identifiers: ${JSON.stringify(book.identifiers)}`);
    }
    output.push('');
  }

  fs.writeFileSync(filepath, output.join('\n'), 'utf8');

  logger.info(`Failed sync books dumped to: ${filepath}`, {
    userId,
    failedCount: failedBooks.length,
    filepath,
  });

  return filepath;
}
