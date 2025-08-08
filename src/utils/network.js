/**
 * Network and HTTP utility functions
 *
 * This module provides utilities for HTTP/HTTPS agents, API token handling,
 * and network-related operations.
 */
import { Agent } from 'https';
import { Agent as HttpAgent } from 'http';
import logger from '../logger.js';
import { sleep } from './time.js';

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
