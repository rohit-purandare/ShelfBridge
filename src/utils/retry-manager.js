/**
 * Unified retry manager with exponential backoff for HTTP requests
 *
 * This class provides consistent retry logic across all API clients,
 * with configurable backoff strategies for different error types.
 */
import logger from '../logger.js';

/**
 * Retry strategies for different error types
 */
export const RetryStrategy = {
  // No retries
  NONE: 'none',
  // Standard exponential backoff: 1s, 2s, 4s
  STANDARD: 'standard',
  // Aggressive backoff for rate limits: 2s, 4s, 8s
  AGGRESSIVE: 'aggressive',
  // Conservative backoff: 500ms, 1s, 2s
  CONSERVATIVE: 'conservative',
};

/**
 * Configuration for retry behavior per error type
 */
const DEFAULT_RETRY_CONFIG = {
  // Network errors (timeouts, connection issues)
  network: {
    strategy: RetryStrategy.STANDARD,
    maxRetries: 2,
    shouldRetry: error => {
      return (
        !error.response &&
        (error.code === 'ECONNABORTED' ||
          error.code === 'ENOTFOUND' ||
          error.code === 'ECONNRESET' ||
          error.code === 'ETIMEDOUT' ||
          (error.message && error.message.toLowerCase().includes('timeout')))
      );
    },
  },

  // Server errors (5xx)
  serverError: {
    strategy: RetryStrategy.STANDARD,
    maxRetries: 2,
    shouldRetry: error => {
      return (
        error.response &&
        error.response.status >= 500 &&
        error.response.status < 600
      );
    },
  },

  // Rate limiting (429)
  rateLimit: {
    strategy: RetryStrategy.AGGRESSIVE,
    maxRetries: 2,
    shouldRetry: error => {
      return error.response && error.response.status === 429;
    },
  },

  // Client errors (4xx excluding 429)
  clientError: {
    strategy: RetryStrategy.STANDARD,
    maxRetries: 2,
    shouldRetry: error => {
      return (
        error.response &&
        error.response.status >= 400 &&
        error.response.status < 500 &&
        error.response.status !== 429
      ); // 429 handled separately
    },
  },
};

/**
 * Calculates backoff delay based on strategy and attempt number
 */
function calculateBackoffDelay(strategy, attempt) {
  switch (strategy) {
    case RetryStrategy.CONSERVATIVE:
      return 500 * Math.pow(2, attempt); // 500ms, 1s, 2s
    case RetryStrategy.STANDARD:
      return 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
    case RetryStrategy.AGGRESSIVE:
      return 2000 * Math.pow(2, attempt); // 2s, 4s, 8s
    case RetryStrategy.NONE:
    default:
      return 0;
  }
}

/**
 * Determines error category and retry configuration
 */
function getRetryConfig(error, customConfig = {}) {
  const config = { ...DEFAULT_RETRY_CONFIG, ...customConfig };

  // Check each category in order of specificity
  for (const [category, categoryConfig] of Object.entries(config)) {
    if (categoryConfig.shouldRetry(error)) {
      return { category, ...categoryConfig };
    }
  }

  // No retry configuration found
  return { category: 'unknown', strategy: RetryStrategy.NONE, maxRetries: 0 };
}

/**
 * Gets human-readable error type for logging
 */
function getErrorType(error, category) {
  if (category === 'rateLimit') {
    return 'Rate limit (429)';
  } else if (category === 'serverError') {
    return `Server error (${error.response?.status})`;
  } else if (category === 'clientError') {
    return `Client error (${error.response?.status})`;
  } else if (category === 'network') {
    return 'Network timeout';
  } else {
    return `Unknown error (${error.response?.status || error.code})`;
  }
}

/**
 * Unified retry manager class
 */
export class RetryManager {
  constructor(serviceName, customRetryConfig = {}) {
    this.serviceName = serviceName;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...customRetryConfig };
  }

  /**
   * Execute a function with retry logic
   * @param {Function} fn - Async function to execute
   * @param {Object} options - Override options
   * @returns {Promise} - Result of the function
   */
  async executeWithRetry(fn, options = {}) {
    const { maxRetries: globalMaxRetries, onRetry } = options;
    let attempt = 0;

    while (true) {
      try {
        const result = await fn();

        // Log successful retry if this wasn't the first attempt
        if (attempt > 0) {
          logger.info(
            `${this.serviceName} request succeeded after ${attempt} retries`,
          );
        }

        return result;
      } catch (error) {
        const retryConfig = getRetryConfig(error, this.retryConfig);
        const maxRetries =
          globalMaxRetries !== undefined
            ? globalMaxRetries
            : retryConfig.maxRetries;

        // Check if we should retry this error type
        if (
          retryConfig.strategy === RetryStrategy.NONE ||
          attempt >= maxRetries
        ) {
          // Log final failure
          if (attempt > 0) {
            logger.error(
              `${this.serviceName} request failed after ${attempt} retries`,
            );
          }
          throw error;
        }

        // Calculate backoff delay
        const backoffMs = calculateBackoffDelay(retryConfig.strategy, attempt);
        const errorType = getErrorType(error, retryConfig.category);

        // Log retry attempt
        logger.warn(
          `${errorType} contacting ${this.serviceName} (attempt ${attempt + 1}/${maxRetries + 1}). Retrying in ${backoffMs} ms…`,
          {
            service: this.serviceName,
            errorType: retryConfig.category,
            attempt: attempt + 1,
            maxAttempts: maxRetries + 1,
            backoffMs,
            statusCode: error.response?.status,
            errorCode: error.code,
          },
        );

        // Call retry callback if provided
        if (onRetry) {
          await onRetry(error, attempt, backoffMs);
        }

        // Wait before retry
        if (backoffMs > 0) {
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }

        attempt++;
      }
    }
  }

  /**
   * Update retry configuration for specific error categories
   * @param {Object} newConfig - New configuration to merge
   */
  updateConfig(newConfig) {
    this.retryConfig = { ...this.retryConfig, ...newConfig };
  }

  /**
   * Get current retry statistics (for monitoring/debugging)
   * @returns {Object} Current configuration and statistics
   */
  getConfig() {
    return {
      serviceName: this.serviceName,
      retryConfig: this.retryConfig,
      strategies: RetryStrategy,
    };
  }
}

/**
 * Factory function to create service-specific retry managers
 */
export function createRetryManager(serviceName, customConfig = {}) {
  return new RetryManager(serviceName, customConfig);
}

/**
 * Pre-configured retry managers for common services
 * Both services now use the same aggressive retry strategy for consistency
 */
export const HardcoverRetryManager = createRetryManager('Hardcover');

export const AudiobookshelfRetryManager = createRetryManager('Audiobookshelf');
