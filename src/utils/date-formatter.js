/**
 * Date and timestamp formatting utilities
 *
 * Provides timezone-aware formatting for display timestamps and
 * Hardcover API date values. Uses Luxon for timezone handling.
 *
 * Extracted from sync-manager.js _formatTimestampForDisplay and
 * _formatDateForHardcover methods.
 */

import { DateTime } from 'luxon';
import logger from '../logger.js';

/**
 * Format a timestamp for human-readable display with timezone
 * @param {string|number} timestamp - ISO string, SQL string, or milliseconds
 * @param {string} [timezone='UTC'] - IANA timezone identifier
 * @returns {string} Formatted string like '2024-01-15 14:30:00 EST', 'N/A', or error message
 */
export function formatTimestampForDisplay(timestamp, timezone = 'UTC') {
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
    const configuredTimezone = timezone || 'UTC';
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
 * Format a date value for the Hardcover API (YYYY-MM-DD)
 * @param {string|number} dateValue - ISO string, SQL string, JS Date string, or milliseconds
 * @param {string} [timezone='UTC'] - IANA timezone identifier
 * @returns {string|null} Date in 'YYYY-MM-DD' format or null if unparseable
 */
export function formatDateForHardcover(dateValue, timezone = 'UTC') {
  if (!dateValue) return null;

  try {
    const tz = timezone || 'UTC';

    // If we already have an ISO string with timezone, return the local day directly
    if (typeof dateValue === 'string') {
      // Common case: we previously set `absBook.started_at = startedAtLocal.toISO()`
      if (dateValue.includes('T')) {
        const isoDate = DateTime.fromISO(dateValue);
        if (isoDate.isValid) {
          const local = isoDate.setZone(tz);
          const output = local.toISODate();
          logger.debug('Formatted date for Hardcover (ISO string)', {
            input: dateValue,
            output,
            timezone: tz,
          });
          return output;
        }
      }

      // Try parsing as SQL or generic date
      const sql = DateTime.fromSQL(dateValue, { zone: tz });
      if (sql.isValid) {
        return sql.toISODate();
      }

      const parsed = DateTime.fromJSDate(new Date(dateValue), { zone: tz });
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
      const local = DateTime.fromMillis(millis, { zone: tz });
      if (local.isValid) {
        const output = local.toISODate();
        logger.debug('Formatted date for Hardcover (millis)', {
          input: dateValue,
          output,
          timezone: tz,
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
