/**
 * Book data normalization utilities
 *
 * This module provides functions to normalize book identifiers and metadata
 * for consistent matching across different sources.
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

  // ASIN should be 10 characters and start with a letter (typically 'B')
  // Real ASINs are not purely numeric
  if (
    normalized.length === 10 &&
    /^[A-Z]/.test(normalized) &&
    !/^\d+$/.test(normalized)
  ) {
    return normalized;
  }

  return null;
}

/**
 * Normalize title for comparison
 * @param {string} title - Title to normalize
 * @returns {string} - Normalized title
 */
export function normalizeTitle(title) {
  if (!title) return '';

  return (
    title
      .toLowerCase()
      // Remove articles (a, an, the) at the beginning
      .replace(/^(a|an|the)\s+/i, '')
      // Remove punctuation and special characters
      .replace(/[^\w\s]/g, '')
      // Replace multiple spaces with single space
      .replace(/\s+/g, ' ')
      // Normalize whitespace
      .trim()
  );
}

/**
 * Normalize author name for comparison
 * @param {string} author - Author name to normalize
 * @returns {string} - Normalized author name
 */
export function normalizeAuthor(author) {
  if (!author) return '';

  return (
    author
      .toLowerCase()
      // Remove common suffixes like Jr., Sr., III
      .replace(/\s+(jr\.?|sr\.?|iii?|iv|ph\.?d\.?|m\.?d\.?)$/i, '')
      // Remove punctuation
      .replace(/[^\w\s]/g, '')
      // Replace multiple spaces with single space
      .replace(/\s+/g, ' ')
      // Normalize whitespace
      .trim()
  );
}

/**
 * Normalize narrator name for comparison
 * @param {string} narrator - Narrator name to normalize
 * @returns {string} - Normalized narrator name
 */
export function normalizeNarrator(narrator) {
  if (!narrator) return '';

  return (
    narrator
      .toLowerCase()
      // Remove punctuation
      .replace(/[^\w\s]/g, '')
      // Replace multiple spaces with single space
      .replace(/\s+/g, ' ')
      // Normalize whitespace
      .trim()
  );
}
