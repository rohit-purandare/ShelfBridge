/**
 * Utility functions for the sync tool
 */
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { Agent } from 'https';
import { Agent as HttpAgent } from 'http';
import logger from './logger.js';
import { currentVersion } from './version.js';

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
    if (normalized.length === 10 && /^[A-Z]/.test(normalized) && !/^\d+$/.test(normalized)) {
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
            if (typeof bookData.media.author === 'object' && bookData.media.author.name) {
                return bookData.media.author.name;
            }
            return bookData.media.author;
        }
        
        // Check inside media.metadata object
        if (bookData.media.metadata && bookData.media.metadata.author) {
            if (Array.isArray(bookData.media.metadata.author)) {
                return bookData.media.metadata.author[0];
            }
            if (typeof bookData.media.metadata.author === 'object' && bookData.media.metadata.author.name) {
                return bookData.media.metadata.author.name;
            }
            return bookData.media.metadata.author;
        }
        // Check for authors array
        if (bookData.media.authors && bookData.media.authors.length > 0) {
            if (typeof bookData.media.authors[0] === 'object' && bookData.media.authors[0].name) {
                return bookData.media.authors[0].name;
            }
            return bookData.media.authors[0];
        }
        // Check inside media.metadata for authors array
        if (bookData.media.metadata && bookData.media.metadata.authors && bookData.media.metadata.authors.length > 0) {
            if (typeof bookData.media.metadata.authors[0] === 'object' && bookData.media.metadata.authors[0].name) {
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
 */
export function calculateCurrentPage(percentage, totalPages) {
    if (!totalPages || totalPages <= 0) return 0;
    
    // Clamp percentage to valid range
    const clampedPercentage = Math.max(0, Math.min(100, percentage));
    
    const currentPage = Math.round((clampedPercentage / 100) * totalPages);
    return Math.max(1, Math.min(currentPage, totalPages));
}

/**
 * Calculate seconds from percentage and total seconds
 * @param {number} percentage - Progress percentage (0-100)
 * @param {number} totalSeconds - Total seconds in the audiobook
 * @returns {number} - Calculated current seconds
 */
export function calculateCurrentSeconds(percentage, totalSeconds) {
    if (!totalSeconds || totalSeconds <= 0) return 0;
    
    // Clamp percentage to valid range
    const clampedPercentage = Math.max(0, Math.min(100, percentage));
    
    const currentSeconds = Math.round((clampedPercentage / 100) * totalSeconds);
    return Math.max(0, Math.min(currentSeconds, totalSeconds));
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
        
        logger.warn(`${serviceName} token contained "Bearer" prefix - automatically removed`, {
            originalLength: originalToken.length,
            normalizedLength: normalizedToken.length,
            originalPrefix: originalToken.substring(0, 15) + '...',
            normalizedPrefix: normalizedToken.substring(0, 15) + '...'
        });
        
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
        ...options
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
        const absClient = new AudiobookshelfClient(user.abs_url, user.abs_token, 1, null, 100);
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
            execEvenly: true // Spread requests evenly across the duration
        });
        
        // Clean up old request counts every minute
        setInterval(() => {
            this._cleanupOldCounts();
        }, 60000);
        
        logger.debug('RateLimiter initialized', {
            maxRequests: this.maxRequests,
            keyPrefix: this.keyPrefix,
            warningThreshold: this.warningThreshold
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
                resetTime: resRateLimiter ? new Date(Date.now() + resRateLimiter.msBeforeNext) : null,
                timestamp: new Date().toISOString(),
                action: 'check',
            });

            // Log warning if approaching rate limit
            if (resRateLimiter && resRateLimiter.consumedPoints >= this.warningThreshold) {
                logger.warn(`Rate limit warning: ${resRateLimiter.consumedPoints}/${this.maxRequests} requests used in the current minute`, {
                    service: 'shelfbridge',
                    version: currentVersion,
                    identifier,
                    remainingRequests: resRateLimiter.remainingPoints,
                    resetTime: new Date(Date.now() + resRateLimiter.msBeforeNext)
                });
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
                resetTime: resRateLimiter ? new Date(Date.now() + resRateLimiter.msBeforeNext) : null,
                timestamp: new Date().toISOString(),
                action: 'allowed',
            });
        } catch (rejRes) {
            // Rate limit exceeded, wait for reset
            const waitTime = rejRes.msBeforeNext || 60000;
            logger.warn(`Rate limit exceeded. Waiting ${Math.round(waitTime / 1000)}s before next request`, {
                service: 'shelfbridge',
                version: currentVersion,
                identifier,
                remainingRequests: rejRes.remainingPoints || 0,
                resetTime: new Date(Date.now() + waitTime)
            });
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
            console.log(`⏳ Rate limit reached for '${identifier}' (${this.maxRequests}/min). Waiting ${Math.round(waitTime / 1000)}s before continuing...`);
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
                remainingRequests: resRateLimiter ? resRateLimiter.remainingPoints : this.maxRequests,
                resetTime: resRateLimiter ? new Date(Date.now() + resRateLimiter.msBeforeNext) : null,
                isNearLimit: resRateLimiter ? resRateLimiter.consumedPoints >= this.warningThreshold : false
            };
        } catch (error) {
            logger.error('Error getting rate limit status', { error: error.message, identifier });
            return {
                requestsUsed: 0,
                maxRequests: this.maxRequests,
                remainingRequests: this.maxRequests,
                resetTime: null,
                isNearLimit: false
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
export async function dumpFailedSyncBooks(result, userId, dataFolder = './data') {
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
        const failedBooks = result.book_details.filter(book => book.status === 'error');
        
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