/**
 * Time and duration utility functions
 *
 * This module provides functions for time manipulation, duration formatting,
 * and timing utilities used throughout the application.
 */

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
  if (secs > 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

/**
 * Parse duration string like "10h 30m" to seconds
 * @param {string} durationStr - Duration string
 * @returns {number|null} - Duration in seconds or null
 */
export function parseDurationString(durationStr) {
  if (!durationStr) return null;

  const hourMatch = durationStr.match(/(\d+)h/);
  const minuteMatch = durationStr.match(/(\d+)m/);
  const secondMatch = durationStr.match(/(\d+)s/);

  let totalSeconds = 0;

  if (hourMatch) {
    totalSeconds += parseInt(hourMatch[1]) * 3600;
  }
  if (minuteMatch) {
    totalSeconds += parseInt(minuteMatch[1]) * 60;
  }
  if (secondMatch) {
    totalSeconds += parseInt(secondMatch[1]);
  }

  return totalSeconds > 0 ? totalSeconds : null;
}

/**
 * Sleep for a specified number of milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} - Promise that resolves after the delay
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
