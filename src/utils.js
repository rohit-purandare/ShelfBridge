/**
 * Utility functions for the sync tool
 */
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { Agent } from 'https';
import { Agent as HttpAgent } from 'http';
import logger from './logger.js';
import { currentVersion } from './version.js';
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
 * Normalize ISBN by removing hyphens and spaces
 * @param {string} isbn - The ISBN to normalize
 * @returns {string|null} - Normalized ISBN or null if invalid
 */
export function normalizeIsbn(isbn) {
  if (!isbn) return null;

  // Remove hyphens, spaces, and convert to uppercase
  const normalized = isbn.replace(/[-\s]/g, '').toUpperCase();

  // Validate ISBN-10 or ISBN-13 format
  if (normalized.length === 10) {
    return normalized;
  } else if (normalized.length === 13) {
    return normalized;
  }

  return null;
}

/**
 * Normalize ASIN by removing spaces and converting to uppercase
 * @param {string} asin - The ASIN to normalize
 * @returns {string|null} - Normalized ASIN or null if invalid
 */
export function normalizeAsin(asin) {
  if (!asin) return null;

  // Remove spaces and convert to uppercase
  const normalized = asin.replace(/\s/g, '').toUpperCase();

  // ASIN should be 10 characters and start with a letter (typically 'B')
  // Real ASINs are not purely numeric
  if (
    normalized.length === 10 &&
    /^[A-Z]/.test(normalized) &&
    !/^\d+$/.test(normalized)
  ) {
    return normalized;
  }

  return null;
}

/**
 * Extract ISBN from various formats in book data
 * @param {Object} bookData - Book data object
 * @returns {string|null} - Normalized ISBN or null
 */
export function extractIsbn(bookData) {
  if (!bookData) return null;

  // Try different possible ISBN fields
  const isbnFields = ['isbn', 'isbn_10', 'isbn_13', 'isbn10', 'isbn13'];

  // Check direct fields first
  for (const field of isbnFields) {
    if (bookData[field]) {
      const normalized = normalizeIsbn(bookData[field]);
      if (normalized) {
        return normalized;
      }
    }
  }

  // Check inside media object
  if (bookData.media) {
    for (const field of isbnFields) {
      if (bookData.media[field]) {
        const normalized = normalizeIsbn(bookData.media[field]);
        if (normalized) {
          return normalized;
        }
      }
    }

    // Check inside media.metadata object
    if (bookData.media.metadata) {
      for (const field of isbnFields) {
        if (bookData.media.metadata[field]) {
          const normalized = normalizeIsbn(bookData.media.metadata[field]);
          if (normalized) {
            return normalized;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Extract ASIN from book data
 * @param {Object} bookData - Book data object
 * @returns {string|null} - Normalized ASIN or null
 */
export function extractAsin(bookData) {
  if (!bookData) return null;

  const asinFields = ['asin', 'amazon_asin'];

  // Check direct fields first
  for (const field of asinFields) {
    if (bookData[field]) {
      const normalized = normalizeAsin(bookData[field]);
      if (normalized) {
        return normalized;
      }
    }
  }

  // Check inside media object
  if (bookData.media) {
    for (const field of asinFields) {
      if (bookData.media[field]) {
        const normalized = normalizeAsin(bookData.media[field]);
        if (normalized) {
          return normalized;
        }
      }
    }

    // Check inside media.metadata object
    if (bookData.media.metadata) {
      for (const field of asinFields) {
        if (bookData.media.metadata[field]) {
          const normalized = normalizeAsin(bookData.media.metadata[field]);
          if (normalized) {
            return normalized;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Extract title from book data
 * @param {Object} bookData - Book data object
 * @returns {string|null} - Title or null
 */
export function extractTitle(bookData) {
  if (!bookData) return null;

  // Try direct title field first
  if (bookData.title) {
    return bookData.title;
  }

  // Check inside media object
  if (bookData.media) {
    // Check media.title
    if (bookData.media.title) {
      return bookData.media.title;
    }

    // Check inside media.metadata object
    if (bookData.media.metadata && bookData.media.metadata.title) {
      return bookData.media.metadata.title;
    }
  }

  return null;
}

/**
 * Extract author from book data
 * @param {Object} bookData - Book data object
 * @returns {string|null} - Author or null
 */
export function extractAuthor(bookData) {
  if (!bookData) return null;

  // Try direct author field first
  if (bookData.author) {
    if (Array.isArray(bookData.author)) {
      return bookData.author[0];
    }
    if (typeof bookData.author === 'object' && bookData.author.name) {
      return bookData.author.name;
    }
    return bookData.author;
  }

  // Check inside media object
  if (bookData.media) {
    // Check media.author
    if (bookData.media.author) {
      if (Array.isArray(bookData.media.author)) {
        return bookData.media.author[0];
      }
      if (
        typeof bookData.media.author === 'object' &&
        bookData.media.author.name
      ) {
        return bookData.media.author.name;
      }
      return bookData.media.author;
    }

    // Check inside media.metadata object
    if (bookData.media.metadata && bookData.media.metadata.author) {
      if (Array.isArray(bookData.media.metadata.author)) {
        return bookData.media.metadata.author[0];
      }
      if (
        typeof bookData.media.metadata.author === 'object' &&
        bookData.media.metadata.author.name
      ) {
        return bookData.media.metadata.author.name;
      }
      return bookData.media.metadata.author;
    }
    // Check for authors array
    if (bookData.media.authors && bookData.media.authors.length > 0) {
      if (
        typeof bookData.media.authors[0] === 'object' &&
        bookData.media.authors[0].name
      ) {
        return bookData.media.authors[0].name;
      }
      return bookData.media.authors[0];
    }
    // Check inside media.metadata for authors array
    if (
      bookData.media.metadata &&
      bookData.media.metadata.authors &&
      bookData.media.metadata.authors.length > 0
    ) {
      if (
        typeof bookData.media.metadata.authors[0] === 'object' &&
        bookData.media.metadata.authors[0].name
      ) {
        return bookData.media.metadata.authors[0].name;
      }
      return bookData.media.metadata.authors[0];
    }
  }

  return null;
}

/**
 * Calculate page number from percentage and total pages
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
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

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
  if (!token || typeof token !== 'string') {
    return token;
  }

  const trimmedToken = token.trim();

  // Check if token starts with "Bearer " (case-insensitive)
  if (trimmedToken.toLowerCase().startsWith('bearer ')) {
    const originalToken = trimmedToken;
    const normalizedToken = trimmedToken.substring(7).trim(); // Remove "Bearer " and trim remaining whitespace

    logger.warn(
      `${serviceName} token contained "Bearer" prefix - automatically removed`,
      {
        originalLength: originalToken.length,
        normalizedLength: normalizedToken.length,
        originalPrefix: originalToken.substring(0, 15) + '...',
        normalizedPrefix: normalizedToken.substring(0, 15) + '...',
      },
    );

    return normalizedToken;
  }

  return trimmedToken;
}

/**
 * Create an HTTP agent with keep-alive configuration
 * @param {boolean} isHttps - Whether to create an HTTPS agent (default: true)
 * @param {Object} options - Additional agent options
 * @returns {Agent} - HTTP or HTTPS agent instance
 */
export function createHttpAgent(isHttps = true, options = {}) {
  const AgentClass = isHttps ? Agent : HttpAgent;

  const defaultOptions = {
    keepAlive: true,
    maxSockets: options.maxSockets || (isHttps ? 5 : 10),
    maxFreeSockets: options.maxFreeSockets || (isHttps ? 2 : 5),
    timeout: 60000,
    freeSocketTimeout: 30000,
    ...options,
  };

  return new AgentClass(defaultOptions);
}

/**
 * Test API connections for a user
 * @param {Object} user - User configuration object
 * @returns {Promise<Object>} - Connection test results
 */
export async function testApiConnections(user) {
  const results = { abs: false, hardcover: false, errors: [] };

  try {
    // Dynamic import to avoid circular dependencies
    const { AudiobookshelfClient } = await import('./audiobookshelf-client.js');
    const absClient = new AudiobookshelfClient(
      user.abs_url,
      user.abs_token,
      1,
      null,
      100,
    );
    results.abs = await absClient.testConnection();

    if (!results.abs) {
      results.errors.push('Audiobookshelf connection failed');
    }
  } catch (error) {
    results.errors.push(`Audiobookshelf: ${error.message}`);
  }

  try {
    // Dynamic import to avoid circular dependencies
    const { HardcoverClient } = await import('./hardcover-client.js');
    const hcClient = new HardcoverClient(user.hardcover_token, 1);
    results.hardcover = await hcClient.testConnection();

    if (!results.hardcover) {
      results.errors.push('Hardcover connection failed');
    }
  } catch (error) {
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
  async waitIfNeeded(identifier = 'default') {
    const key = `${this.keyPrefix}:${identifier}`;
    try {
      // Check if we can make the request
      const resRateLimiter = await this.rateLimiter.get(key);

      // Verbose log for every rate limit check
      logger.verbose('[RateLimiter] waitIfNeeded check', {
        identifier,
        key,
        requestsUsed: resRateLimiter?.consumedPoints,
        remainingRequests: resRateLimiter?.remainingPoints,
        resetTime: resRateLimiter
          ? new Date(Date.now() + resRateLimiter.msBeforeNext)
          : null,
        timestamp: new Date().toISOString(),
        action: 'check',
      });

      // Log warning if approaching rate limit
      if (
        resRateLimiter &&
        resRateLimiter.consumedPoints >= this.warningThreshold
      ) {
        logger.warn(
          `Rate limit warning: ${resRateLimiter.consumedPoints}/${this.maxRequests} requests used in the current minute`,
          {
            service: 'shelfbridge',
            version: currentVersion,
            identifier,
            remainingRequests: resRateLimiter.remainingPoints,
            resetTime: new Date(Date.now() + resRateLimiter.msBeforeNext),
          },
        );
      }

      // Consume a point (make a request)
      await this.rateLimiter.consume(key);

      // Track request count for logging
      this._trackRequest(identifier);

      // Verbose log for allowed request
      logger.verbose('[RateLimiter] request allowed', {
        identifier,
        key,
        requestsUsed: resRateLimiter?.consumedPoints + 1, // +1 for this request
        remainingRequests: resRateLimiter?.remainingPoints - 1,
        resetTime: resRateLimiter
          ? new Date(Date.now() + resRateLimiter.msBeforeNext)
          : null,
        timestamp: new Date().toISOString(),
        action: 'allowed',
      });
    } catch (rejRes) {
      // Rate limit exceeded, wait for reset
      const waitTime = rejRes.msBeforeNext || 60000;
      logger.warn(
        `Rate limit exceeded. Waiting ${Math.round(waitTime / 1000)}s before next request`,
        {
          service: 'shelfbridge',
          version: currentVersion,
          identifier,
          remainingRequests: rejRes.remainingPoints || 0,
          resetTime: new Date(Date.now() + waitTime),
        },
      );
      // Verbose log for delayed request
      logger.verbose('[RateLimiter] request delayed', {
        identifier,
        key,
        waitTime,
        remainingRequests: rejRes.remainingPoints || 0,
        resetTime: new Date(Date.now() + waitTime),
        timestamp: new Date().toISOString(),
        action: 'delayed',
      });
      // User-facing message
      console.log(
        `⏳ Rate limit reached for '${identifier}' (${this.maxRequests}/min). Waiting ${Math.round(waitTime / 1000)}s before continuing...`,
      );
      // Wait for the specified time
      await sleep(waitTime);
      // User-facing resume message
      console.log('✅ Resuming sync after rate limit pause.');
      // Retry the request after waiting
      return this.waitIfNeeded(identifier);
    }
  }

  /**
   * Get current rate limit status
   * @param {string} identifier - Unique identifier for this request
   * @returns {Promise<Object>} Rate limit status
   */
  async getStatus(identifier = 'default') {
    const key = `${this.keyPrefix}:${identifier}`;

    try {
      const resRateLimiter = await this.rateLimiter.get(key);
      return {
        requestsUsed: resRateLimiter ? resRateLimiter.consumedPoints : 0,
        maxRequests: this.maxRequests,
        remainingRequests: resRateLimiter
          ? resRateLimiter.remainingPoints
          : this.maxRequests,
        resetTime: resRateLimiter
          ? new Date(Date.now() + resRateLimiter.msBeforeNext)
          : null,
        isNearLimit: resRateLimiter
          ? resRateLimiter.consumedPoints >= this.warningThreshold
          : false,
      };
    } catch (error) {
      logger.error('Error getting rate limit status', {
        error: error.message,
        identifier,
      });
      return {
        requestsUsed: 0,
        maxRequests: this.maxRequests,
        remainingRequests: this.maxRequests,
        resetTime: null,
        isNearLimit: false,
      };
    }
  }

  /**
   * Reset rate limit for a specific identifier
   * @param {string} identifier - Unique identifier to reset
   * @returns {Promise<void>}
   */
  async reset(identifier = 'default') {
    const key = `${this.keyPrefix}:${identifier}`;
    await this.rateLimiter.delete(key);
    logger.debug(`Rate limit reset for identifier: ${identifier}`);
  }

  /**
   * Track request count for logging purposes
   * @private
   */
  _trackRequest(identifier) {
    const minute = Math.floor(Date.now() / 60000);
    const key = `${identifier}:${minute}`;

    if (!this.requestCounts.has(key)) {
      this.requestCounts.set(key, 0);
    }

    this.requestCounts.set(key, this.requestCounts.get(key) + 1);
  }

  /**
   * Clean up old request counts (older than 2 minutes)
   * @private
   */
  _cleanupOldCounts() {
    const currentMinute = Math.floor(Date.now() / 60000);
    const cutoff = currentMinute - 2; // Keep last 2 minutes

    for (const [key, _value] of this.requestCounts.entries()) {
      const [, minuteStr] = key.split(':');
      const minute = parseInt(minuteStr, 10);

      if (minute < cutoff) {
        this.requestCounts.delete(key);
      }
    }
  }
}

/**
 * Dumps failed sync books and their details into a text file
 * @param {Object} result - The sync result object containing book_details and errors
 * @param {string} userId - The user ID for the sync
 * @param {string} dataFolder - The data folder path (defaults to './data')
 * @returns {Promise<string>} - The path to the created error dump file
 */
export async function dumpFailedSyncBooks(
  result,
  userId,
  dataFolder = './data',
) {
  const fs = await import('fs/promises');
  const path = await import('path');

  // Create timestamp for filename
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5); // Remove milliseconds
  const filename = `failed-sync-${userId}-${timestamp}.txt`;
  const filepath = path.join(dataFolder, filename);

  let content = '';

  // Header
  content += '='.repeat(80) + '\n';
  content += `FAILED SYNC BOOKS DUMP\n`;
  content += `Generated: ${now.toLocaleString()}\n`;
  content += `User ID: ${userId}\n`;
  content += `Total Books Processed: ${result.books_processed || 0}\n`;
  content += `Total Errors: ${result.errors?.length || 0}\n`;
  content += '='.repeat(80) + '\n\n';

  // Summary statistics
  content += '📊 SYNC SUMMARY\n';
  content += '-'.repeat(40) + '\n';
  content += `Books processed: ${result.books_processed || 0}\n`;
  content += `Books synced: ${result.books_synced || 0}\n`;
  content += `Books completed: ${result.books_completed || 0}\n`;
  content += `Books auto-added: ${result.books_auto_added || 0}\n`;
  content += `Books skipped: ${result.books_skipped || 0}\n`;
  content += `Books with errors: ${result.book_details?.filter(book => book.status === 'error').length || 0}\n`;
  content += `Total errors: ${result.errors?.length || 0}\n\n`;

  // Detailed book information for failed books
  if (result.book_details && result.book_details.length > 0) {
    const failedBooks = result.book_details.filter(
      book => book.status === 'error',
    );

    if (failedBooks.length > 0) {
      content += '❌ FAILED BOOKS DETAILS\n';
      content += '='.repeat(80) + '\n\n';

      failedBooks.forEach((book, index) => {
        content += `${index + 1}. BOOK: ${book.title}\n`;
        content += `   Status: ${book.status.toUpperCase()}\n`;

        if (book.progress && book.progress.before !== null) {
          content += `   Progress: ${book.progress.before.toFixed(1)}%\n`;
        }

        if (book.identifiers && Object.keys(book.identifiers).length > 0) {
          const identifierStr = Object.entries(book.identifiers)
            .filter(([_k, v]) => v)
            .map(([k, v]) => `${k.toUpperCase()}=${v}`)
            .join(', ');
          if (identifierStr) {
            content += `   Identifiers: ${identifierStr}\n`;
          }
        }

        if (book.actions && book.actions.length > 0) {
          content += `   Actions taken:\n`;
          book.actions.forEach(action => {
            content += `     • ${action}\n`;
          });
        }

        if (book.errors && book.errors.length > 0) {
          content += `   Errors encountered:\n`;
          book.errors.forEach(error => {
            content += `     ❌ ${error}\n`;
          });
        }

        if (book.timing) {
          content += `   Processing time: ${book.timing}ms\n`;
        }

        content += '\n';
      });
    }
  }

  // General error summary
  if (result.errors && result.errors.length > 0) {
    content += '🚨 GENERAL ERROR SUMMARY\n';
    content += '='.repeat(80) + '\n\n';

    result.errors.forEach((error, index) => {
      content += `${index + 1}. ${error}\n`;
    });

    content += '\n';
  }

  // Footer
  content += '='.repeat(80) + '\n';
  content += 'End of failed sync dump\n';
  content += '='.repeat(80) + '\n';

  try {
    // Ensure data folder exists
    await fs.mkdir(dataFolder, { recursive: true });

    // Write the file
    await fs.writeFile(filepath, content, 'utf8');

    return filepath;
  } catch (error) {
    throw new Error(`Failed to write error dump file: ${error.message}`);
  }
}

/**
 * Normalize title for matching by removing articles and less important elements
 * @param {string} title - The title to normalize
 * @returns {string} - Normalized title
 */
export function normalizeTitle(title) {
  if (!title || typeof title !== 'string') return '';

  let normalized = title
    .toLowerCase()
    .normalize('NFD') // Normalize unicode characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/^(the|a|an)\s+/i, ''); // Remove leading articles

  // Handle number/word normalization
  normalized = normalized
    .replace(/\bone\b/g, '1')
    .replace(/\btwo\b/g, '2')
    .replace(/\bthree\b/g, '3')
    .replace(/\bfour\b/g, '4')
    .replace(/\bfive\b/g, '5')
    .replace(/\bsix\b/g, '6')
    .replace(/\bseven\b/g, '7')
    .replace(/\beight\b/g, '8')
    .replace(/\bnine\b/g, '9')
    .replace(/\bten\b/g, '10')
    .replace(/\bi\b/g, '1') // Roman numerals
    .replace(/\bii\b/g, '2')
    .replace(/\biii\b/g, '3')
    .replace(/\biv\b/g, '4')
    .replace(/\bv\b/g, '5')
    .replace(/\bvi\b/g, '6')
    .replace(/\bvii\b/g, '7')
    .replace(/\bviii\b/g, '8')
    .replace(/\bix\b/g, '9')
    .replace(/\bx\b/g, '10');

  // Remove only obvious publication/edition info in parentheses/brackets
  normalized = normalized
    .replace(/\s*\(unabridged\)\s*/gi, '') // Remove "(Unabridged)"
    .replace(/\s*\(abridged\)\s*/gi, '') // Remove "(Abridged)"
    .replace(/\s*\(audiobook\)\s*/gi, '') // Remove "(Audiobook)"
    .replace(/\s*\(ebook\)\s*/gi, '') // Remove "(Ebook)"
    .replace(/\s*\(paperback\)\s*/gi, '') // Remove "(Paperback)"
    .replace(/\s*\(hardcover\)\s*/gi, '') // Remove "(Hardcover)"
    .replace(/\s*\(special edition\)\s*/gi, '') // Remove "(Special Edition)"
    .replace(/\s*\(annotated\)\s*/gi, '') // Remove "(Annotated)"
    .replace(/\s*\(revised\)\s*/gi, '') // Remove "(Revised)"
    .replace(/\s*\[[^\]]*edition[^\]]*\]\s*/gi, '') // Remove "[...Edition...]"
    .replace(/\s*\[[^\]]*audio[^\]]*\]\s*/gi, ''); // Remove "[...Audio...]"

  // Clean up punctuation and whitespace
  normalized = normalized
    .replace(/[^\w\s]/g, '') // Remove remaining punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  // Handle edge case: if normalization results in empty string but original had content
  // This can happen with non-Latin scripts (Chinese, Japanese, etc.)
  if (normalized.length === 0 && title.length > 0) {
    // Fall back to simple lowercase of original title
    normalized = title.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  return normalized;
}

/**
 * Normalize author name for matching
 * @param {string} author - The author name to normalize
 * @returns {string} - Normalized author name
 */
export function normalizeAuthor(author) {
  if (!author || typeof author !== 'string') return '';

  return author
    .toLowerCase()
    .normalize('NFD') // Normalize unicode characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/gi, '') // Remove suffixes
    .replace(/\b[a-z]\.?\s+/gi, '') // Remove single initials with space
    .replace(/[^\w\s-]/g, '') // Remove punctuation (keep hyphens)
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Normalize narrator name for matching
 * @param {string} narrator - The narrator name to normalize
 * @returns {string} - Normalized narrator name
 */
export function normalizeNarrator(narrator) {
  if (!narrator || typeof narrator !== 'string') return '';

  return narrator
    .toLowerCase()
    .replace(/\s*\(narrator\)\s*/gi, '') // Remove "(narrator)" indicator
    .replace(/\s*\(reader\)\s*/gi, '') // Remove "(reader)" indicator
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/gi, '') // Remove suffixes
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Calculate text similarity using multiple algorithms
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Similarity score (0-1)
 */
export function calculateTextSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;

  // Exact match after normalization
  if (str1.toLowerCase().trim() === str2.toLowerCase().trim()) return 1;

  // Levenshtein distance similarity
  const levenshtein = levenshteinSimilarity(str1, str2);

  // Token set similarity (words in common)
  const tokenSet = tokenSetSimilarity(str1, str2);

  // Weighted combination (token set is more forgiving for books)
  return Math.max(levenshtein * 0.4 + tokenSet * 0.6, 0);
}

/**
 * Calculate Levenshtein distance similarity
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Similarity score (0-1)
 */
function levenshteinSimilarity(str1, str2) {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  if (s1.length === 0) return s2.length === 0 ? 1 : 0;
  if (s2.length === 0) return 0;

  const matrix = Array(s2.length + 1)
    .fill()
    .map(() => Array(s1.length + 1).fill(0));

  for (let i = 0; i <= s1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= s2.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= s2.length; j++) {
    for (let i = 1; i <= s1.length; i++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j - 1][i] + 1, // deletion
        matrix[j][i - 1] + 1, // insertion
        matrix[j - 1][i - 1] + cost, // substitution
      );
    }
  }

  const maxLength = Math.max(s1.length, s2.length);
  const distance = matrix[s2.length][s1.length];
  return 1 - distance / maxLength;
}

/**
 * Calculate token set similarity (Jaccard index)
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Similarity score (0-1)
 */
function tokenSetSimilarity(str1, str2) {
  const tokens1 = new Set(
    str1
      .toLowerCase()
      .split(/\s+/)
      .filter(t => t.length > 0),
  );
  const tokens2 = new Set(
    str2
      .toLowerCase()
      .split(/\s+/)
      .filter(t => t.length > 0),
  );

  if (tokens1.size === 0 && tokens2.size === 0) return 1;
  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  const intersection = new Set(
    [...tokens1].filter(token => tokens2.has(token)),
  );
  const union = new Set([...tokens1, ...tokens2]);

  return intersection.size / union.size;
}

/**
 * Extract series information from book data
 * @param {Object} bookData - Book data object
 * @returns {Object} - Object with series name and sequence
 */
export function extractSeries(bookData) {
  if (!bookData) return { name: null, sequence: null };

  // Handle Audiobookshelf series array format first
  if (
    bookData.media?.metadata?.series &&
    Array.isArray(bookData.media.metadata.series)
  ) {
    const firstSeries = bookData.media.metadata.series[0];
    if (firstSeries) {
      return {
        name: firstSeries.name || firstSeries.series || null,
        sequence: firstSeries.sequence || firstSeries.book_number || null,
      };
    }
  }

  // Handle direct series array
  if (bookData.series && Array.isArray(bookData.series)) {
    const firstSeries = bookData.series[0];
    if (firstSeries) {
      return {
        name: firstSeries.name || firstSeries.series || null,
        sequence: firstSeries.sequence || firstSeries.book_number || null,
      };
    }
  }

  // Handle nested media series array
  if (bookData.media?.series && Array.isArray(bookData.media.series)) {
    const firstSeries = bookData.media.series[0];
    if (firstSeries) {
      return {
        name: firstSeries.name || firstSeries.series || null,
        sequence: firstSeries.sequence || firstSeries.book_number || null,
      };
    }
  }

  // Fallback to old string-based extraction for compatibility
  const seriesName =
    bookData.series ||
    bookData.series_name ||
    bookData.media?.metadata?.series ||
    bookData.media?.metadata?.series_name;

  const seriesSequence =
    bookData.series_sequence ||
    bookData.book_number ||
    bookData.sequence ||
    bookData.media?.metadata?.series_sequence ||
    bookData.media?.metadata?.book_number;

  // Parse title for series info if no direct series data found (e.g., "The Primal Hunter 11")
  if (!seriesName && bookData.media?.metadata?.title) {
    const title = bookData.media.metadata.title;
    const match = title.match(/^(.+?)\s+(\d+)$/);
    if (match) {
      return {
        name: match[1].trim(),
        sequence: parseFloat(match[2]),
      };
    }
  }

  return {
    name: seriesName ? String(seriesName).trim() : null,
    sequence: seriesSequence ? parseFloat(seriesSequence) : null,
  };
}

/**
 * Extract publication year from book data
 * @param {Object} bookData - Book data object
 * @returns {number|null} - Publication year or null
 */
export function extractPublicationYear(bookData) {
  if (!bookData) return null;

  // NEW: Direct edition search results (edition data directly on result)
  if (bookData._searchMetadata?.searchType === 'direct_edition_search') {
    // Try edition-specific release data first
    if (bookData.release_year) {
      return typeof bookData.release_year === 'number'
        ? bookData.release_year
        : parseInt(bookData.release_year);
    }

    // Extract year from release_date
    if (bookData.release_date) {
      const dateMatch = bookData.release_date.match(/(\d{4})/);
      if (dateMatch) {
        return parseInt(dateMatch[1]);
      }
    }

    // Check book-level data as fallback
    if (bookData.book) {
      const bookYear =
        bookData.book.release_year || bookData.book.publication_year;
      if (bookYear) {
        return typeof bookYear === 'number' ? bookYear : parseInt(bookYear);
      }
    }
  }

  // Enhanced search results (edition data nested in .edition property)
  if (bookData.edition) {
    const edition = bookData.edition;
    const editionYear =
      edition.release_year ||
      edition.publication_year ||
      edition.published_year;
    if (editionYear) {
      return typeof editionYear === 'number'
        ? editionYear
        : parseInt(editionYear);
    }
  }

  // Try Hardcover search result fields
  const hardcoverYear =
    bookData.release_year ||
    bookData.publication_year ||
    bookData.published_year;
  if (hardcoverYear) {
    return typeof hardcoverYear === 'number'
      ? hardcoverYear
      : parseInt(hardcoverYear);
  }

  // Handle release_date field (extract year from date string)
  if (bookData.release_date) {
    const dateMatch = bookData.release_date.match(/(\d{4})/);
    if (dateMatch) {
      return parseInt(dateMatch[1]);
    }
  }

  // Try original Audiobookshelf fields
  const year =
    bookData.publishedYear ||
    bookData.publication_date ||
    bookData.releaseDate ||
    bookData.year ||
    bookData.media?.metadata?.publishedYear ||
    bookData.media?.metadata?.publication_date ||
    bookData.media?.metadata?.releaseDate ||
    bookData.media?.metadata?.year;

  if (!year) return null;

  // Handle different formats
  if (typeof year === 'number') return year;
  if (typeof year === 'string') {
    const match = year.match(/(\d{4})/);
    return match ? parseInt(match[1]) : null;
  }

  return null;
}

/**
 * Extract narrator from book data
 * @param {Object} bookData - Book data object
 * @returns {string|null} - Narrator name or null
 */
export function extractNarrator(bookData) {
  if (!bookData) return null;

  // Try different possible narrator fields
  const narratorFields = ['narrator', 'narrators', 'voice_actor', 'reader'];

  // Check direct fields first
  for (const field of narratorFields) {
    if (bookData[field]) {
      if (Array.isArray(bookData[field])) {
        return bookData[field][0]; // Return first narrator
      }
      if (typeof bookData[field] === 'object' && bookData[field].name) {
        return bookData[field].name;
      }
      return bookData[field];
    }
  }

  // Check inside media object
  if (bookData.media) {
    for (const field of narratorFields) {
      if (bookData.media[field]) {
        if (Array.isArray(bookData.media[field])) {
          return bookData.media[field][0];
        }
        if (
          typeof bookData.media[field] === 'object' &&
          bookData.media[field].name
        ) {
          return bookData.media[field].name;
        }
        return bookData.media[field];
      }
    }

    // Check inside media.metadata object
    if (bookData.media.metadata) {
      for (const field of narratorFields) {
        if (bookData.media.metadata[field]) {
          if (Array.isArray(bookData.media.metadata[field])) {
            return bookData.media.metadata[field][0];
          }
          if (
            typeof bookData.media.metadata[field] === 'object' &&
            bookData.media.metadata[field].name
          ) {
            return bookData.media.metadata[field].name;
          }
          return bookData.media.metadata[field];
        }
      }
    }
  }

  return null;
}

/**
 * Calculate confidence score for title/author/narrator matching
 * @param {Object} searchResult - Hardcover search result
 * @param {string} targetTitle - Target title from Audiobookshelf
 * @param {string} targetAuthor - Target author from Audiobookshelf
 * @param {string} targetNarrator - Target narrator from Audiobookshelf (optional)
 * @returns {Object} - Confidence score and breakdown
 */
export function calculateMatchingScore(
  searchResult,
  targetTitle,
  targetAuthor,
  targetNarrator = null,
  targetMetadata = {},
) {
  // Handle null/undefined search results
  if (!searchResult || typeof searchResult !== 'object') {
    return {
      totalScore: 0,
      breakdown: {},
      confidence: 'low',
    };
  }

  let score = 0;
  const breakdown = {};

  // Extract data from search result
  const resultTitle = searchResult.title || '';
  const resultAuthor = extractAuthorFromSearchResult(
    searchResult,
    targetAuthor,
  );
  const resultNarrator = extractNarratorFromSearchResult(searchResult);
  const resultFormat = extractFormatFromSearchResult(searchResult);

  // Extract enhanced metadata
  const targetSeries = extractSeries(targetMetadata);
  const targetYear = extractPublicationYear(targetMetadata);
  const resultSeries = extractSeries(searchResult);
  const resultYear = extractPublicationYear(searchResult);

  // Extract activity data
  const resultActivity = extractActivityFromSearchResult(searchResult);

  // Extract duration data for weight calculation
  const targetDuration = extractAudioDurationFromAudiobookshelf(targetMetadata);
  const resultDuration = extractAudioDurationFromSearchResult(searchResult);
  const isDurationRelevant = targetDuration || resultDuration;

  // 1. Title Similarity (25% weight) - PRIMARY matching factor
  const titleScore =
    calculateTextSimilarity(
      normalizeTitle(targetTitle),
      normalizeTitle(resultTitle),
    ) * 100;
  score += titleScore * 0.25;
  breakdown.title = {
    score: titleScore,
    weight: 0.25,
    comparison: `"${targetTitle}" vs "${resultTitle}"`,
  };

  // 2. Author Similarity (18% weight) - SECONDARY matching factor
  const authorScore =
    calculateTextSimilarity(
      normalizeAuthor(targetAuthor || ''),
      normalizeAuthor(resultAuthor || ''),
    ) * 100;
  score += authorScore * 0.18;
  breakdown.author = {
    score: authorScore,
    weight: 0.18,
    comparison: `"${targetAuthor || 'N/A'}" vs "${resultAuthor || 'N/A'}"`,
  };

  // 3. Series Match (12% weight) - Enhanced edition disambiguation
  const seriesResult = calculateSeriesScore(targetSeries, resultSeries);
  score += seriesResult.score * 0.12;
  breakdown.series = {
    score: seriesResult.score,
    weight: 0.12,
    reason: seriesResult.reason,
    comparison: `"${targetSeries.name || 'N/A'}" vs "${resultSeries.name || 'N/A'}"`,
  };

  // 4. Format Score (10% weight) - Relevant for audiobook matching
  const formatScore = calculateFormatScore(resultFormat);
  score += formatScore * 0.1;
  breakdown.format = {
    score: formatScore,
    weight: 0.1,
    value: resultFormat || 'unknown',
  };

  // 5. Activity/Popularity (18% weight) - Important for distinguishing between similar titles
  const activityScore = calculateActivityScore(resultActivity);
  score += activityScore * 0.18;
  breakdown.activity = {
    score: activityScore,
    weight: 0.18,
    value: resultActivity || 0,
  };

  // 6. Publication Year (7% weight) - Enhanced edition disambiguation
  const yearResult = calculateYearScore(targetYear, resultYear);
  score += yearResult.score * 0.07;
  breakdown.year = {
    score: yearResult.score,
    weight: 0.07,
    reason: yearResult.reason,
    comparison: `${targetYear || 'N/A'} vs ${resultYear || 'N/A'}`,
  };

  // 7. Duration Match (5% weight) - Small but helpful for audiobook edition matching
  const durationScore = calculateDurationSimilarity(
    targetDuration,
    resultDuration,
  );
  score += durationScore * 0.05;
  breakdown.duration = {
    score: durationScore,
    weight: 0.05,
    comparison: `${targetDuration ? Math.round(targetDuration / 60) + 'm' : 'N/A'} vs ${resultDuration ? Math.round(resultDuration / 60) + 'm' : 'N/A'}`,
    reason: isDurationRelevant
      ? 'Duration matching for audiobook edition'
      : 'No duration data available',
  };

  // 8. Narrator Match (3% weight) - Small tiebreaker for audiobooks
  let narratorScore = 60; // Neutral default
  if (targetNarrator && resultNarrator) {
    narratorScore =
      calculateTextSimilarity(
        normalizeNarrator(targetNarrator),
        normalizeNarrator(resultNarrator),
      ) * 100;
  } else if (targetNarrator && !resultNarrator) {
    narratorScore = 60; // Neutral - don't penalize missing narrator data
  } else if (!targetNarrator && resultNarrator) {
    narratorScore = 60; // Neutral
  }
  score += narratorScore * 0.03;
  breakdown.narrator = {
    score: narratorScore,
    weight: 0.03,
    comparison: `"${targetNarrator || 'N/A'}" vs "${resultNarrator || 'N/A'}"`,
  };

  // Apply penalty for very short titles (higher chance of false matches)
  const normalizedTitle = normalizeTitle(targetTitle);
  if (normalizedTitle.length <= 10) {
    // Very short titles
    const penalty = Math.max(0, 10 - normalizedTitle.length) * 2; // Up to 20% penalty
    score -= penalty;
    breakdown.shortTitlePenalty = {
      score: -penalty,
      reason: `Short title penalty (${normalizedTitle.length} chars)`,
    };
  }

  // Apply penalty for very different authors on same/similar titles
  if (authorScore < 30 && titleScore > 80) {
    const penalty = (80 - authorScore) * 0.2; // Penalty for same title, different author
    score -= penalty;
    breakdown.authorMismatchPenalty = {
      score: -penalty,
      reason: 'Same title, very different author',
    };
  }

  // NEW: Format Preference Bonus - strongly prefer matching format types
  const userFormat = detectUserBookFormat(targetMetadata);
  const resultFormatLower =
    extractFormatFromSearchResult(searchResult).toLowerCase();

  if (
    userFormat === 'audiobook' &&
    (resultFormatLower.includes('audiobook') ||
      resultFormatLower.includes('listened'))
  ) {
    const formatPreferenceBonus = 10; // Reduced from 20 - moderate bonus for audiobook match
    score += formatPreferenceBonus;
    breakdown.formatPreferenceBonus = {
      score: formatPreferenceBonus,
      reason:
        'User has audiobook, result is audiobook - format preference match',
    };
    logger.debug(
      `Applied audiobook preference bonus: +${formatPreferenceBonus} points`,
    );
  } else if (
    userFormat === 'ebook' &&
    (resultFormatLower.includes('ebook') ||
      resultFormatLower.includes('digital'))
  ) {
    const formatPreferenceBonus = 8; // Reduced from 15 - moderate bonus for ebook match
    score += formatPreferenceBonus;
    breakdown.formatPreferenceBonus = {
      score: formatPreferenceBonus,
      reason: 'User has ebook, result is ebook - format preference match',
    };
  } else if (
    userFormat === 'physical' &&
    (resultFormatLower.includes('physical') ||
      resultFormatLower.includes('paperback') ||
      resultFormatLower.includes('hardcover'))
  ) {
    const formatPreferenceBonus = 5; // Reduced from 10 - small bonus for physical match
    score += formatPreferenceBonus;
    breakdown.formatPreferenceBonus = {
      score: formatPreferenceBonus,
      reason:
        'User has physical book, result is physical - format preference match',
    };
  }

  // NEW: Perfect Match Bonus for high-confidence title+author combinations
  if (titleScore >= 90 && authorScore >= 90) {
    const perfectMatchBonus = Math.min(titleScore, authorScore) * 0.08; // Reduced from 0.15 to 0.08 - up to 8 bonus points
    score += perfectMatchBonus;
    breakdown.perfectMatchBonus = {
      score: perfectMatchBonus,
      reason: `Perfect title+author match bonus (title: ${titleScore.toFixed(1)}%, author: ${authorScore.toFixed(1)}%)`,
    };
    logger.debug(
      `Applied perfect match bonus: +${perfectMatchBonus.toFixed(1)} points`,
    );
  }

  // NEW: High-confidence bonus for very good title+author matches
  else if (titleScore >= 80 && authorScore >= 80) {
    const highConfidenceBonus = Math.min(titleScore, authorScore) * 0.04; // Reduced from 0.08 to 0.04 - up to 4 bonus points
    score += highConfidenceBonus;
    breakdown.highConfidenceBonus = {
      score: highConfidenceBonus,
      reason: `High-confidence title+author match bonus (title: ${titleScore.toFixed(1)}%, author: ${authorScore.toFixed(1)}%)`,
    };
    logger.debug(
      `Applied high-confidence bonus: +${highConfidenceBonus.toFixed(1)} points`,
    );
  }

  // Ensure score is within 0-100 range
  const totalScore = Math.min(100, Math.max(0, score));

  // Determine confidence level
  let confidence = 'low';
  if (totalScore >= 85) confidence = 'high';
  else if (totalScore >= 70) confidence = 'medium';

  return {
    totalScore,
    breakdown,
    confidence,
  };
}

/**
 * Calculate series matching score
 * @param {Object} targetSeries - Target series info {name, sequence}
 * @param {Object} resultSeries - Result series info {name, sequence}
 * @returns {Object} - Score and reason
 */
function calculateSeriesScore(targetSeries, resultSeries) {
  if (!targetSeries.name || !resultSeries.name) {
    return { score: 65, reason: 'No series info available' }; // Neutral score
  }

  const nameSimilarity = calculateTextSimilarity(
    normalizeTitle(targetSeries.name),
    normalizeTitle(resultSeries.name),
  );

  // Series name must match well
  if (nameSimilarity < 0.8) {
    return { score: 20, reason: 'Different series' };
  }

  // If we have sequence numbers, they should match exactly
  if (targetSeries.sequence !== null && resultSeries.sequence !== null) {
    if (Math.abs(targetSeries.sequence - resultSeries.sequence) < 0.1) {
      return { score: 100, reason: 'Perfect series + sequence match' };
    } else {
      return { score: 30, reason: 'Same series, different book number' };
    }
  }

  // Series name matches but no sequence info
  return { score: 85, reason: 'Series name matches' };
}

/**
 * Calculate publication year matching score
 * @param {number|null} targetYear - Target publication year
 * @param {number|null} resultYear - Result publication year
 * @returns {Object} - Score and reason
 */
function calculateYearScore(targetYear, resultYear) {
  if (!targetYear || !resultYear) {
    return { score: 70, reason: 'No publication year available' }; // Higher neutral
  }

  const yearDiff = Math.abs(targetYear - resultYear);

  if (yearDiff === 0) {
    return { score: 100, reason: 'Exact year match' };
  } else if (yearDiff <= 1) {
    return { score: 90, reason: 'Very close year' };
  } else if (yearDiff <= 5) {
    return { score: 75, reason: 'Close year (different edition)' };
  } else if (yearDiff <= 10) {
    return { score: 50, reason: 'Different decade' };
  } else {
    return { score: 20, reason: 'Very different years' };
  }
}

/**
 * Calculate format preference score
 * @param {string} format - Book format
 * @returns {number} - Format score (0-100)
 */
function calculateFormatScore(format) {
  if (!format) return 25;

  const formatLower = format.toLowerCase();
  if (
    formatLower.includes('audiobook') ||
    formatLower.includes('audio') ||
    formatLower.includes('listened')
  )
    // Add "listened" format recognition
    return 100;
  if (
    formatLower.includes('ebook') ||
    formatLower.includes('digital') ||
    formatLower.includes('read')
  )
    // Add "read" format recognition
    return 75;
  if (
    formatLower.includes('paperback') ||
    formatLower.includes('hardcover') ||
    formatLower.includes('physical')
  )
    return 50;
  return 25;
}

/**
 * Calculate activity score based on user engagement
 * @param {number} activity - Activity count
 * @returns {number} - Activity score (0-100)
 */
function calculateActivityScore(activity) {
  if (!activity || activity < 50) return 25;
  if (activity >= 1000) return 100;
  if (activity >= 100) return 75;
  return 50;
}

/**
 * Extract author from Hardcover search result, optionally finding best match for target author
 * @param {Object} searchResult - Hardcover search result
 * @param {string} targetAuthor - Optional target author to find best match for
 * @returns {string} - Author name
 */
export function extractAuthorFromSearchResult(
  searchResult,
  targetAuthor = null,
) {
  let availableAuthors = [];

  // Priority 1: Edition-level contributions (most specific for different editions)
  if (searchResult.contributions && searchResult.contributions.length > 0) {
    const authorContribs = searchResult.contributions.filter(
      c =>
        c.author &&
        c.author.name &&
        (!c.contribution || !c.contribution.toLowerCase().includes('narrator')),
    );
    availableAuthors = authorContribs.map(c => c.author.name);
  }

  // Priority 2: Book-level contributions (fallback when no edition-level data)
  if (
    availableAuthors.length === 0 &&
    searchResult.book &&
    searchResult.book.contributions &&
    searchResult.book.contributions.length > 0
  ) {
    const authorContribs = searchResult.book.contributions.filter(
      c =>
        c.author &&
        c.author.name &&
        (!c.contribution || !c.contribution.toLowerCase().includes('narrator')),
    );
    availableAuthors = authorContribs.map(c => c.author.name);
  }

  // Fallback to author_names array for backward compatibility
  if (
    availableAuthors.length === 0 &&
    searchResult.author_names &&
    searchResult.author_names.length > 0
  ) {
    availableAuthors = [...searchResult.author_names];
  }

  // Additional fallback to cached_contributors, but filter out narrators
  if (
    availableAuthors.length === 0 &&
    searchResult.cached_contributors &&
    searchResult.cached_contributors.length > 0
  ) {
    const authorContribs = searchResult.cached_contributors.filter(
      c => !c.role || !c.role.toLowerCase().includes('narrator'),
    );
    availableAuthors = authorContribs.map(c => c.name).filter(name => name);

    // If all contributors are narrators, include them as fallback
    if (availableAuthors.length === 0) {
      availableAuthors = searchResult.cached_contributors
        .map(c => c.name)
        .filter(name => name);
    }
  }

  // If no authors found, return empty string
  if (availableAuthors.length === 0) {
    return '';
  }

  // If we have a target author, find the best match
  if (targetAuthor && availableAuthors.length > 1) {
    let bestMatch = availableAuthors[0];
    let bestScore = calculateTextSimilarity(
      normalizeAuthor(targetAuthor),
      normalizeAuthor(availableAuthors[0]),
    );

    for (let i = 1; i < availableAuthors.length; i++) {
      const score = calculateTextSimilarity(
        normalizeAuthor(targetAuthor),
        normalizeAuthor(availableAuthors[i]),
      );
      if (score > bestScore) {
        bestScore = score;
        bestMatch = availableAuthors[i];
      }
    }
    return bestMatch;
  }

  // If no target author or only one author available, return the first one
  return availableAuthors[0];
}

/**
 * Extract narrator from Hardcover search result
 * Prioritizes edition-level contributions, then explicit role labels, then heuristic detection
 * @param {Object} searchResult - Hardcover search result
 * @returns {string|null} - Narrator name or null
 */
export function extractNarratorFromSearchResult(searchResult) {
  // Priority 1: Edition-level contributors with explicit narrator role labels (most accurate)
  if (searchResult.contributions && searchResult.contributions.length > 0) {
    const narratorContrib = searchResult.contributions.find(
      c =>
        c.contribution &&
        c.author &&
        c.author.name &&
        (c.contribution.toLowerCase().includes('narrator') ||
          c.contribution.toLowerCase().includes('reader')),
    );

    if (narratorContrib) {
      return narratorContrib.author.name;
    }
  }

  // Priority 2: Book-level contributors with explicit narrator role labels
  if (
    searchResult.book &&
    searchResult.book.contributions &&
    searchResult.book.contributions.length > 0
  ) {
    const narratorContrib = searchResult.book.contributions.find(
      c =>
        c.contribution &&
        c.author &&
        c.author.name &&
        (c.contribution.toLowerCase().includes('narrator') ||
          c.contribution.toLowerCase().includes('reader')),
    );

    if (narratorContrib) {
      return narratorContrib.author.name;
    }
  }

  // Priority 3: Heuristic detection for audiobooks (fallback for unlabeled edition-level data)
  const format = extractFormatFromSearchResult(searchResult).toLowerCase();
  const isAudiobook =
    format.includes('listened') || format.includes('audiobook');

  // For audiobooks with multiple edition-level contributions, the last contributor might be the narrator
  if (
    isAudiobook &&
    searchResult.contributions &&
    searchResult.contributions.length >= 2
  ) {
    const potentialNarrator =
      searchResult.contributions[searchResult.contributions.length - 1]; // Last contributor
    if (
      potentialNarrator &&
      potentialNarrator.author &&
      potentialNarrator.author.name
    ) {
      // Only return if different from the author (avoid false positives)
      const authorName = searchResult.contributions[0]?.author?.name || '';
      if (potentialNarrator.author.name !== authorName) {
        return potentialNarrator.author.name;
      }
    }
  }

  // Priority 4: Check multiple edition-level contributions regardless of format
  // This covers cases where format detection might be wrong but we have clear narrator data
  if (searchResult.contributions && searchResult.contributions.length >= 2) {
    const potentialNarrator =
      searchResult.contributions[searchResult.contributions.length - 1];
    if (
      potentialNarrator &&
      potentialNarrator.author &&
      potentialNarrator.author.name
    ) {
      const narratorName = potentialNarrator.author.name;
      const authorName = searchResult.contributions[0]?.author?.name || '';

      // Only return if different from author and looks like a narrator name
      if (narratorName !== authorName) {
        return narratorName;
      }
    }
  }

  // Legacy fallback for other data structures (keeping for compatibility)
  if (
    searchResult.cached_contributors &&
    searchResult.cached_contributors.length > 0
  ) {
    const narratorContrib = searchResult.cached_contributors.find(
      c =>
        (c.role && c.role.toLowerCase().includes('narrator')) ||
        (c.contribution && c.contribution.toLowerCase().includes('narrator')),
    );
    if (narratorContrib && narratorContrib.name) {
      return narratorContrib.name;
    }
  }

  return null;
}

/**
 * Extract format from Hardcover search result
 * @param {Object} searchResult - Hardcover search result
 * @returns {string} - Format string
 */
export function extractFormatFromSearchResult(searchResult) {
  // NEW: Direct edition search results (edition data is on the result object itself)
  if (searchResult._searchMetadata?.searchType === 'direct_edition_search') {
    // Check reading format first (most specific)
    if (searchResult.reading_format && searchResult.reading_format.format) {
      return searchResult.reading_format.format;
    }

    // Check edition_format
    if (searchResult.edition_format) {
      return searchResult.edition_format;
    }

    // Check physical format
    if (searchResult.physical_format) {
      return searchResult.physical_format;
    }

    // Determine format from edition capabilities
    if (searchResult.audio_seconds && searchResult.audio_seconds > 0) {
      return 'audiobook';
    }
    if (searchResult.pages && searchResult.pages > 0) {
      return 'physical';
    }
  }

  // Enhanced search results (edition data is nested in .edition property)
  if (searchResult.edition) {
    const edition = searchResult.edition;

    // Check reading format first (most specific)
    if (edition.reading_format && edition.reading_format.format) {
      return edition.reading_format.format;
    }

    // Check physical format
    if (edition.physical_format) {
      return edition.physical_format;
    }

    // Determine format from edition capabilities
    if (edition.audio_seconds && edition.audio_seconds > 0) {
      return 'audiobook';
    }
    if (edition.pages && edition.pages > 0) {
      return edition.physical_format || 'physical';
    }
  }

  // Fallback to original format detection logic
  // Check for explicit format field first
  if (searchResult.format) return searchResult.format;
  if (searchResult.physical_format) return searchResult.physical_format;
  if (searchResult.reading_format && searchResult.reading_format.format) {
    return searchResult.reading_format.format;
  }

  // Use boolean flags from search API (book-level)
  if (searchResult.has_audiobook) {
    return 'audiobook';
  }
  if (searchResult.has_ebook) {
    return 'ebook';
  }

  return 'unknown';
}

/**
 * Extract activity count from Hardcover search result
 * @param {Object} searchResult - Hardcover search result
 * @returns {number} - Activity count
 */
export function extractActivityFromSearchResult(searchResult) {
  // NEW: Direct edition search results (comprehensive activity data)
  if (searchResult._searchMetadata?.searchType === 'direct_edition_search') {
    // Collect edition-level activity metrics
    const editionMetrics = [
      searchResult.users_count || 0,
      searchResult.users_read_count || 0,
      searchResult.lists_count || 0,
      searchResult.rating ? Math.floor(searchResult.rating * 10) : 0, // Convert rating to 0-50 scale
    ];

    // Collect book-level activity metrics (if available)
    const bookMetrics = [];
    if (searchResult.book) {
      bookMetrics.push(
        searchResult.book.activities_count || 0,
        searchResult.book.users_count || 0,
        searchResult.book.users_read_count || 0,
        searchResult.book.ratings_count || 0,
        searchResult.book.reviews_count || 0,
        searchResult.book.lists_count || 0,
      );
    }

    // Combine all metrics and use the highest value for best discrimination
    const allMetrics = [...editionMetrics, ...bookMetrics];
    const maxActivity = Math.max(...allMetrics);

    // Create a weighted composite score favoring edition-specific metrics
    const editionScore = editionMetrics.reduce((sum, count) => sum + count, 0);
    const bookScore = bookMetrics.reduce((sum, count) => sum + count, 0);
    const compositeScore = Math.floor(editionScore * 0.7 + bookScore * 0.3);

    // Return the higher of max single metric or weighted composite
    return Math.max(maxActivity, compositeScore);
  }

  // Enhanced search results (book-level data)
  // Try multiple activity metrics and use the highest value for better disambiguation
  const activitySources = [
    searchResult.activities_count || 0,
    searchResult.users_read_count || 0,
    searchResult.ratings_count || 0,
    searchResult.users_count || 0,
    searchResult.lists_count || 0,
    searchResult.reviews_count || 0,
  ];

  // Use the highest activity count for best discrimination
  const maxActivity = Math.max(...activitySources);

  // If we have multiple metrics, create a composite score
  const totalActivity = activitySources.reduce((sum, count) => sum + count, 0);

  // Return the higher of max single metric or weighted composite
  return Math.max(maxActivity, Math.floor(totalActivity * 0.4));
}

/**
 * Detect the format of the user's book based on available metadata
 * @param {Object} targetMetadata - User's book metadata
 * @returns {string} - Detected format: 'audiobook', 'ebook', 'physical', or 'unknown'
 */
export function detectUserBookFormat(targetMetadata) {
  if (!targetMetadata) return 'unknown';

  // NEW: Check Audiobookshelf native format indicators first (most reliable)
  const hasAudioFiles =
    targetMetadata.audioFiles &&
    Array.isArray(targetMetadata.audioFiles) &&
    targetMetadata.audioFiles.length > 0;

  const hasEbookFile =
    targetMetadata.ebookFile && targetMetadata.ebookFile !== null;

  if (hasAudioFiles) {
    return 'audiobook';
  }

  if (hasEbookFile) {
    return 'ebook';
  }

  // Check media nested structure (Audiobookshelf API response format)
  if (targetMetadata.media) {
    const mediaAudioFiles = targetMetadata.media.audioFiles;
    const mediaEbookFile = targetMetadata.media.ebookFile;

    if (
      mediaAudioFiles &&
      Array.isArray(mediaAudioFiles) &&
      mediaAudioFiles.length > 0
    ) {
      return 'audiobook';
    }

    if (mediaEbookFile && mediaEbookFile !== null) {
      return 'ebook';
    }
  }

  // Fallback: Check for audiobook indicators (ASIN, duration, narrator)
  const hasAsin = extractAsin(targetMetadata);
  const hasAudioDuration =
    targetMetadata.duration ||
    targetMetadata.media?.metadata?.duration ||
    targetMetadata.media?.duration;
  const hasNarrator = extractNarrator(targetMetadata);

  if (hasAsin || hasAudioDuration || hasNarrator) {
    return 'audiobook';
  }

  // Check for ebook indicators (file extensions)
  const filePath = targetMetadata.path || targetMetadata.media?.path || '';
  const fileExtension = filePath.toLowerCase();

  if (
    fileExtension.includes('.epub') ||
    fileExtension.includes('.pdf') ||
    fileExtension.includes('.mobi') ||
    fileExtension.includes('.azw') ||
    fileExtension.includes('.txt')
  ) {
    return 'ebook';
  }

  // Check for explicit format information
  const format =
    targetMetadata.format ||
    targetMetadata.media?.metadata?.format ||
    targetMetadata.libraryItemType;

  if (format) {
    const formatLower = format.toLowerCase();
    if (formatLower.includes('audio') || formatLower.includes('book')) {
      return 'audiobook';
    }
    if (formatLower.includes('ebook') || formatLower.includes('digital')) {
      return 'ebook';
    }
    if (
      formatLower.includes('physical') ||
      formatLower.includes('paper') ||
      formatLower.includes('hard')
    ) {
      return 'physical';
    }
  }

  // Default assumption: if we have ISBN but no audio/ebook indicators, likely physical
  const hasIsbn = extractIsbn(targetMetadata);
  if (hasIsbn && !hasAsin && !hasAudioDuration) {
    return 'physical';
  }

  return 'unknown';
}

/**
 * Extract audiobook duration in seconds from Hardcover search result
 * @param {Object} searchResult - Hardcover search result
 * @returns {number|null} Duration in seconds, or null if not available
 */
export function extractAudioDurationFromSearchResult(searchResult) {
  if (!searchResult) return null;

  // Direct edition search results
  if (searchResult.audio_seconds && searchResult.audio_seconds > 0) {
    return searchResult.audio_seconds;
  }

  // Edition nested in search result
  if (
    searchResult.edition &&
    searchResult.edition.audio_seconds &&
    searchResult.edition.audio_seconds > 0
  ) {
    return searchResult.edition.audio_seconds;
  }

  // Book nested structure
  if (
    searchResult.book &&
    searchResult.book.audio_seconds &&
    searchResult.book.audio_seconds > 0
  ) {
    return searchResult.book.audio_seconds;
  }

  return null;
}

/**
 * Extract audiobook duration in seconds from Audiobookshelf metadata
 * @param {Object} bookData - Audiobookshelf book data
 * @returns {number|null} Duration in seconds, or null if not available
 */
export function extractAudioDurationFromAudiobookshelf(bookData) {
  if (!bookData) return null;

  // Check direct duration field (from screenshot: duration is Float)
  if (bookData.duration && bookData.duration > 0) {
    return Math.round(bookData.duration); // Convert to integer seconds
  }

  // Check media.duration
  if (
    bookData.media &&
    bookData.media.duration &&
    bookData.media.duration > 0
  ) {
    return Math.round(bookData.media.duration);
  }

  // Check metadata.duration
  if (
    bookData.media &&
    bookData.media.metadata &&
    bookData.media.metadata.duration &&
    bookData.media.metadata.duration > 0
  ) {
    return Math.round(bookData.media.metadata.duration);
  }

  // Check if we can derive from audioFiles
  if (
    bookData.media &&
    bookData.media.audioFiles &&
    Array.isArray(bookData.media.audioFiles)
  ) {
    let totalDuration = 0;
    for (const audioFile of bookData.media.audioFiles) {
      if (audioFile.duration && audioFile.duration > 0) {
        totalDuration += audioFile.duration;
      }
    }
    if (totalDuration > 0) {
      return Math.round(totalDuration);
    }
  }

  return null;
}

/**
 * Calculate similarity score for audiobook durations
 * @param {number|null} duration1 - First duration in seconds
 * @param {number|null} duration2 - Second duration in seconds
 * @returns {number} Similarity score from 0-100
 */
export function calculateDurationSimilarity(duration1, duration2) {
  if (!duration1 || !duration2 || duration1 <= 0 || duration2 <= 0) {
    return 0; // No duration data available
  }

  const difference = Math.abs(duration1 - duration2);
  const average = (duration1 + duration2) / 2;
  const percentageDifference = (difference / average) * 100;

  // Convert percentage difference to similarity score
  // 0% difference = 100% similarity
  // 5% difference = 75% similarity
  // 10% difference = 50% similarity
  // 20%+ difference = 0% similarity

  if (percentageDifference <= 1) return 100; // Within 1% - perfect match
  if (percentageDifference <= 3) return 95; // Within 3% - excellent match
  if (percentageDifference <= 5) return 85; // Within 5% - very good match
  if (percentageDifference <= 10) return 70; // Within 10% - good match
  if (percentageDifference <= 15) return 50; // Within 15% - fair match
  if (percentageDifference <= 20) return 25; // Within 20% - poor match

  return 0; // Greater than 20% difference - no match
}
