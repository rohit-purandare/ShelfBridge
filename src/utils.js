/**
 * Utility functions for the sync tool
 */
import { RateLimiterMemory } from 'rate-limiter-flexible';
import logger from './logger.js';

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
    
    // ASIN should be 10 characters
    if (normalized.length === 10) {
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
        this.keyPrefix = keyPrefix;
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
            
            // Log warning if approaching rate limit
            if (resRateLimiter && resRateLimiter.consumedPoints >= this.warningThreshold) {
                logger.warn(`Rate limit warning: ${resRateLimiter.consumedPoints}/${this.maxRequests} requests used in the current minute`, {
                    identifier,
                    remainingRequests: resRateLimiter.remainingPoints,
                    resetTime: new Date(Date.now() + resRateLimiter.msBeforeNext)
                });
            }
            
            // Consume a point (make a request)
            await this.rateLimiter.consume(key);
            
            // Track request count for logging
            this._trackRequest(identifier);
            
        } catch (rejRes) {
            // Rate limit exceeded, wait for reset
            const waitTime = rejRes.msBeforeNext || 60000;
            logger.warn(`Rate limit exceeded. Waiting ${Math.round(waitTime / 1000)}s before next request`, {
                identifier,
                remainingRequests: rejRes.remainingPoints || 0,
                resetTime: new Date(Date.now() + waitTime)
            });
            
            // Wait for the specified time
            await sleep(waitTime);
            
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