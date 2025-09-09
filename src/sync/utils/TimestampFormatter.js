import { DateTime } from 'luxon';
import logger from '../../logger.js';

/**
 * TimestampFormatter - Centralized timestamp and date formatting utility
 * 
 * Extracted from SyncManager to follow DRY principles and Single Responsibility Principle.
 * Handles all timestamp/date formatting operations for sync operations.
 * 
 * Key functions:
 * - Display formatting (with timezone conversion)
 * - Hardcover API formatting (YYYY-MM-DD)
 * - Robust error handling for invalid inputs
 */
export class TimestampFormatter {
  constructor(timezone = 'UTC') {
    this.timezone = timezone;
  }

  /**
   * Format timestamp for display using configured timezone
   * Extracted from SyncManager._formatTimestampForDisplay()
   * 
   * @param {string|number} timestamp - Timestamp value (ISO string or milliseconds)
   * @returns {string} - Formatted date string for display
   */
  formatForDisplay(timestamp) {
    if (!timestamp) return 'N/A';

    try {
      let dateTime;

      if (typeof timestamp === 'string') {
        // Handle ISO string or timestamp as string
        if (timestamp.includes('T') || timestamp.includes('-')) {
          // ISO string format - these are typically in UTC or have timezone info
          dateTime = DateTime.fromISO(timestamp);
          if (!dateTime.isValid) {
            // Try parsing as SQL format or other common formats
            dateTime = DateTime.fromSQL(timestamp);
            if (!dateTime.isValid) {
              dateTime = DateTime.fromFormat(timestamp, 'yyyy-LL-dd HH:mm:ss');
            }
          }
        } else {
          // Timestamp as string - assume UTC milliseconds
          const tsNumber = parseInt(timestamp);
          if (!isNaN(tsNumber)) {
            dateTime = DateTime.fromMillis(tsNumber, { zone: 'utc' });
          } else {
            return 'Invalid timestamp';
          }
        }
      } else if (typeof timestamp === 'number') {
        // Timestamp in milliseconds - assume UTC
        dateTime = DateTime.fromMillis(timestamp, { zone: 'utc' });
      } else {
        return 'Invalid timestamp';
      }

      if (!dateTime.isValid) {
        return 'Invalid timestamp';
      }

      // Convert to configured timezone and format
      const configuredTimezone = this.timezone || 'UTC';
      const localTime = dateTime.setZone(configuredTimezone);
      return localTime.toFormat('yyyy-LL-dd HH:mm:ss ZZZZ');
    } catch (error) {
      logger.error('Error formatting timestamp for display', {
        timestamp: timestamp,
        error: error.message,
      });
      return 'Error formatting timestamp';
    }
  }

  /**
   * Format date for Hardcover API (YYYY-MM-DD format)
   * Extracted from SyncManager._formatDateForHardcover()
   * 
   * @param {string|number} dateValue - Date value (ISO string or timestamp)
   * @returns {string|null} - Formatted date string or null if invalid
   */
  formatForHardcover(dateValue) {
    if (!dateValue) return null;

    try {
      // If we already have an ISO string with timezone, return the local day directly
      if (typeof dateValue === 'string') {
        // Common case: we previously set `absBook.started_at = startedAtLocal.toISO()`
        if (dateValue.includes('T')) {
          const isoDate = DateTime.fromISO(dateValue);
          if (isoDate.isValid) {
            const local = isoDate.setZone(this.timezone || 'UTC');
            const output = local.toISODate();
            logger.debug('Formatted date for Hardcover (ISO string)', {
              input: dateValue,
              output,
              timezone: this.timezone,
            });
            return output;
          }
        }

        // Try parsing as SQL or generic date
        const sql = DateTime.fromSQL(dateValue, {
          zone: this.timezone || 'UTC',
        });
        if (sql.isValid) {
          return sql.toISODate();
        }

        const parsed = DateTime.fromJSDate(new Date(dateValue), {
          zone: this.timezone || 'UTC',
        });
        if (parsed.isValid) {
          return parsed.toISODate();
        }
      }

      // If value is milliseconds (number or numeric string)
      const millis =
        typeof dateValue === 'number'
          ? dateValue
          : typeof dateValue === 'string' && /^\d+$/.test(dateValue)
            ? parseInt(dateValue, 10)
            : null;

      if (millis !== null && !isNaN(millis)) {
        const local = DateTime.fromMillis(millis, {
          zone: this.timezone || 'UTC',
        });
        if (local.isValid) {
          const output = local.toISODate();
          logger.debug('Formatted date for Hardcover (millis)', {
            input: dateValue,
            output,
            timezone: this.timezone,
          });
          return output;
        }
      }

      logger.warn('Unable to format date for Hardcover', {
        value: dateValue,
        type: typeof dateValue,
      });
      return null;
    } catch (error) {
      logger.error('Error formatting date for Hardcover', {
        dateValue: dateValue,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Convert timestamp from UTC milliseconds to configured timezone ISO string
   * Helper method for common timestamp conversion operations
   * 
   * @param {number} utcMillis - UTC timestamp in milliseconds
   * @returns {string} - ISO string in configured timezone
   */
  convertUTCMillisToLocal(utcMillis) {
    if (!utcMillis || typeof utcMillis !== 'number') {
      return null;
    }

    try {
      const utcDateTime = DateTime.fromMillis(utcMillis, { zone: 'utc' });
      const localDateTime = utcDateTime.setZone(this.timezone || 'UTC');
      return localDateTime.toISO();
    } catch (error) {
      logger.error('Error converting UTC millis to local timezone', {
        utcMillis,
        timezone: this.timezone,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Validate if a timestamp is properly formatted
   * @param {any} timestamp - Value to validate
   * @returns {boolean} - True if valid timestamp
   */
  isValidTimestamp(timestamp) {
    if (!timestamp) return false;
    
    try {
      if (typeof timestamp === 'string') {
        if (timestamp.includes('T') || timestamp.includes('-')) {
          // Try ISO first
          let dt = DateTime.fromISO(timestamp);
          if (dt.isValid) return true;
          
          // Try SQL format
          dt = DateTime.fromSQL(timestamp);
          if (dt.isValid) return true;
          
          // Try generic format
          dt = DateTime.fromFormat(timestamp, 'yyyy-LL-dd HH:mm:ss');
          return dt.isValid;
        } else {
          const tsNumber = parseInt(timestamp);
          return !isNaN(tsNumber) && DateTime.fromMillis(tsNumber).isValid;
        }
      } else if (typeof timestamp === 'number') {
        return DateTime.fromMillis(timestamp).isValid;
      }
      return false;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Get current timezone setting
   * @returns {string} - Current timezone
   */
  getTimezone() {
    return this.timezone;
  }

  /**
   * Update timezone setting
   * @param {string} newTimezone - New timezone to use
   */
  setTimezone(newTimezone) {
    this.timezone = newTimezone;
  }
}