/**
 * Data parsing and validation utilities
 *
 * This module provides safe parsing functions for converting data types
 * with proper error handling and logging.
 */
import logger from '../logger.js';

/**
 * Safely convert a value to integer, handling null/undefined cases
 * @param {any} value - Value to convert
 * @param {string} fieldName - Field name for error logging
 * @returns {number|null} - Integer value or null
 */
export function safeParseInt(value, fieldName = 'unknown') {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }
  const parsed = parseInt(value);
  if (isNaN(parsed)) {
    logger.warn(`Invalid integer value for ${fieldName}: ${value}`);
    return null;
  }
  return parsed;
}

/**
 * Safely convert a value to float, handling null/undefined cases
 * @param {any} value - Value to convert
 * @param {string} fieldName - Field name for error logging
 * @returns {number|null} - Float value or null
 */
export function safeParseFloat(value, fieldName = 'unknown') {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number' && isFinite(value)) {
    return value;
  }
  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    logger.warn(`Invalid float value for ${fieldName}: ${value}`);
    return null;
  }
  return parsed;
}

/**
 * Safely convert a value to boolean
 * @param {any} value - Value to convert
 * @param {boolean} defaultValue - Default value if conversion fails
 * @returns {boolean} - Boolean value
 */
export function safeParseBoolean(value, defaultValue = false) {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    return lower === 'true' || lower === '1' || lower === 'yes';
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  return defaultValue;
}
