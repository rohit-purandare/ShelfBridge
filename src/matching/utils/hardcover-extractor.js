/**
 * Hardcover data extraction utilities
 *
 * This module provides functions to extract book metadata
 * from Hardcover search results and book objects.
 */
import { parseDurationString } from '../../utils/time.js';

/**
 * Extract author from Hardcover search result, optionally finding best match for target author
 * @param {Object} searchResult - Hardcover search result
 * @param {string} targetAuthor - Optional target author to find best match for
 * @returns {string} - Author name
 */
export function extractAuthorFromSearchResult(
  searchResult,
  _targetAuthor = null,
) {
  // Handle null/undefined search results
  if (!searchResult || typeof searchResult !== 'object') {
    return null;
  }

  let availableAuthors = [];

  // Priority 1: Edition-level contributions (most specific for different editions)
  if (searchResult.contributions && searchResult.contributions.length > 0) {
    // Extract ALL contributors - don't filter by role since different sources
    // may classify the same person differently (author vs translator vs co-author)
    availableAuthors = searchResult.contributions
      .filter(
        c =>
          (c.person && c.person.name) || // Original structure
          (c.author && c.author.name), // Alternative structure
      )
      .map(
        c => c.person?.name || c.author?.name, // Handle both structures
      )
      .filter(name => name); // Remove any undefined/null names
  }

  // Priority 2: Book-level contributors (fallback)
  if (
    availableAuthors.length === 0 &&
    searchResult.book &&
    typeof searchResult.book === 'object' && // Ensure book is an object, not a string
    searchResult.book.contributions &&
    searchResult.book.contributions.length > 0
  ) {
    // Extract ALL book-level contributors - same logic as edition-level
    availableAuthors = searchResult.book.contributions
      .filter(
        c =>
          (c.person && c.person.name) || // Original structure
          (c.author && c.author.name), // Alternative structure
      )
      .map(
        c => c.person?.name || c.author?.name, // Handle both structures
      )
      .filter(name => name); // Remove any undefined/null names
  }

  // Priority 3: author_names array (common in search results)
  if (
    availableAuthors.length === 0 &&
    searchResult.author_names &&
    Array.isArray(searchResult.author_names)
  ) {
    availableAuthors = searchResult.author_names.filter(
      name => name && typeof name === 'string',
    );
  }

  // Priority 4: Direct author field (fallback for older data)
  if (availableAuthors.length === 0 && searchResult.author) {
    availableAuthors = [searchResult.author];
  }

  if (availableAuthors.length === 0) {
    return null;
  }

  // Always return ALL available authors joined together
  // This ensures we capture the complete author information for matching
  // (the downstream normalization and similarity algorithms will handle the comparison)
  return availableAuthors.join(', ');
}

/**
 * Extract narrator from Hardcover search result
 * @param {Object} searchResult - Hardcover search result
 * @returns {string|null} - Narrator name or null
 */
export function extractNarratorFromSearchResult(searchResult) {
  let availableNarrators = [];

  // Priority 1: Edition-level contributions
  if (searchResult.contributions && searchResult.contributions.length > 0) {
    const narratorContribs = searchResult.contributions.filter(
      c =>
        c.contribution === 'narrator' ||
        c.contribution === 'Narrator' ||
        c.contribution?.toLowerCase().includes('narrator') ||
        c.contribution?.toLowerCase().includes('voice'),
    );

    if (narratorContribs.length > 0) {
      availableNarrators = narratorContribs
        .filter(
          c =>
            (c.author && c.author.name) || // New structure
            (c.person && c.person.name), // Legacy structure
        )
        .map(
          c => c.author?.name || c.person?.name, // Handle both structures
        )
        .filter(name => name); // Remove any undefined/null names
    }
  }

  // Priority 2: Book-level contributions (fallback)
  if (
    availableNarrators.length === 0 &&
    searchResult.book &&
    typeof searchResult.book === 'object' && // Ensure book is an object, not a string
    searchResult.book.contributions &&
    searchResult.book.contributions.length > 0
  ) {
    const narratorContribs = searchResult.book.contributions.filter(
      c =>
        c.contribution === 'narrator' ||
        c.contribution === 'Narrator' ||
        c.contribution?.toLowerCase().includes('narrator') ||
        c.contribution?.toLowerCase().includes('voice') ||
        // Legacy fallback
        c.role === 'narrator' ||
        c.role === 'Narrator' ||
        c.role?.toLowerCase().includes('narrator') ||
        c.role?.toLowerCase().includes('voice'),
    );

    if (narratorContribs.length > 0) {
      availableNarrators = narratorContribs
        .filter(
          c =>
            (c.author && c.author.name) || // New structure
            (c.person && c.person.name), // Legacy structure
        )
        .map(
          c => c.author?.name || c.person?.name, // Handle both structures
        )
        .filter(name => name); // Remove any undefined/null names
    }
  }

  if (availableNarrators.length === 0) {
    return null;
  }

  return availableNarrators.length === 1
    ? availableNarrators[0]
    : availableNarrators.join(', ');
}

/**
 * Extract format from Hardcover search result
 * @param {Object} searchResult - Hardcover search result
 * @returns {string} - Format string
 */
export function extractFormatFromSearchResult(searchResult) {
  // Try different format fields, ensuring they are strings
  if (searchResult.format && typeof searchResult.format === 'string') {
    return searchResult.format;
  }

  if (searchResult.reading_format) {
    if (typeof searchResult.reading_format === 'string') {
      return searchResult.reading_format;
    }
    // Handle object format: { format: 'audiobook' }
    if (
      typeof searchResult.reading_format === 'object' &&
      searchResult.reading_format.format
    ) {
      return searchResult.reading_format.format;
    }
  }

  // Handle physical_format field (common for physical books)
  if (
    searchResult.physical_format &&
    typeof searchResult.physical_format === 'string'
  ) {
    return 'physical'; // Normalize physical formats
  }

  if (
    searchResult.book &&
    typeof searchResult.book === 'object' &&
    searchResult.book.format &&
    typeof searchResult.book.format === 'string'
  ) {
    return searchResult.book.format;
  }

  // Check if it's an audiobook based on contributions
  if (searchResult.contributions && Array.isArray(searchResult.contributions)) {
    const hasNarrator = searchResult.contributions.some(
      c =>
        c.contribution === 'narrator' ||
        c.contribution === 'Narrator' ||
        c.contribution?.toLowerCase?.().includes('narrator') ||
        // Legacy fallback
        c.role === 'narrator' ||
        c.role === 'Narrator' ||
        c.role?.toLowerCase?.().includes('narrator'),
    );
    if (hasNarrator) {
      return 'audiobook';
    }
  }

  return 'unknown';
}

/**
 * Extract activity score from Hardcover search result
 * @param {Object} searchResult - Hardcover search result
 * @returns {number} - Activity score
 */
export function extractActivityFromSearchResult(searchResult) {
  // Try different activity fields
  if (searchResult.activity !== undefined) {
    return Number(searchResult.activity) || 0;
  }

  if (searchResult.popularity !== undefined) {
    return Number(searchResult.popularity) || 0;
  }

  if (searchResult.rating_count !== undefined) {
    return Number(searchResult.rating_count) || 0;
  }

  // Check book-level activity
  if (searchResult.book) {
    if (searchResult.book.activity !== undefined) {
      return Number(searchResult.book.activity) || 0;
    }

    if (searchResult.book.popularity !== undefined) {
      return Number(searchResult.book.popularity) || 0;
    }

    if (searchResult.book.rating_count !== undefined) {
      return Number(searchResult.book.rating_count) || 0;
    }
  }

  return 0;
}

/**
 * Extract audio duration from Hardcover search result
 * @param {Object} searchResult - Hardcover search result
 * @returns {number|null} - Duration in seconds or null
 */
export function extractAudioDurationFromSearchResult(searchResult) {
  // Try different duration fields
  const durationFields = [
    'audio_seconds',
    'duration',
    'length',
    'runtime',
    'duration_seconds',
  ];

  for (const field of durationFields) {
    if (searchResult[field] && typeof searchResult[field] === 'number') {
      return searchResult[field];
    }
  }

  // Check if duration is in string format (e.g., "10h 30m")
  if (searchResult.duration && typeof searchResult.duration === 'string') {
    return parseDurationString(searchResult.duration);
  }

  return null;
}

// Removed duplicate string similarity functions - now using text-matching.js
