/**
 * Concurrency and rate limiting utilities
 *
 * This module provides utilities for managing concurrent access,
 * rate limiting, and throttling operations.
 */
import { RateLimiterMemory } from 'rate-limiter-flexible';
import logger from '../logger.js';
import { sleep } from './time.js';

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
    this.cleanupInterval = setInterval(() => {
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

  /**
   * Cleanup resources (for testing or shutdown)
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}
