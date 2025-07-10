/**
 * Utility functions for the sync tool
 */

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
    
    const currentPage = Math.round((percentage / 100) * totalPages);
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
    
    const currentSeconds = Math.round((percentage / 100) * totalSeconds);
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
 * Rate limiter class for API requests
 */
export class RateLimiter {
    constructor(maxRequestsPerMinute = 60) {
        this.maxRequests = maxRequestsPerMinute;
        this.delay = 60000 / maxRequestsPerMinute; // Convert to milliseconds
        this.lastRequestTime = 0;
    }

    async waitIfNeeded() {
        const currentTime = Date.now();
        const timeSinceLast = currentTime - this.lastRequestTime;

        if (timeSinceLast < this.delay) {
            const sleepTime = this.delay - timeSinceLast;
            await sleep(sleepTime);
        }

        this.lastRequestTime = Date.now();
    }
} 