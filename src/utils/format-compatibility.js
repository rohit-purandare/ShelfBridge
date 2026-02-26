/**
 * Format compatibility utilities
 *
 * Maps Hardcover reading formats to internal format identifiers and checks
 * compatibility between source (Audiobookshelf) and target (Hardcover) formats.
 *
 * Extracted from sync-manager.js _mapHardcoverFormatToInternal,
 * _areFormatsCompatible, and _checkFormatCompatibility methods.
 */

/**
 * Map Hardcover's reading_format.format to internal format system
 * @param {Object} edition - Edition object with reading_format and audio_seconds
 * @returns {string} Internal format: 'audiobook' | 'ebook' | 'book' | 'mixed'
 */
export function mapHardcoverFormatToInternal(edition) {
  // Use Hardcover's format classification as source of truth
  const hardcoverFormat = edition.reading_format?.format;

  // Map Hardcover formats to our internal system
  switch (hardcoverFormat) {
    case 'Listened':
      return 'audiobook';
    case 'Ebook':
      return 'ebook';
    case 'Read':
      return 'book';
    case 'Both':
      return 'mixed';
    default:
      // Fallback to edition capabilities if no explicit format
      if (edition.audio_seconds && edition.audio_seconds > 0) {
        return 'audiobook';
      }
      return 'book'; // Default for text-based books
  }
}

/**
 * Check if two formats are compatible for syncing
 * @param {string} sourceFormat - Format from source ('audiobook', 'ebook')
 * @param {string} editionFormat - Format from edition ('audiobook', 'ebook', 'book', 'mixed')
 * @returns {boolean} True if formats are compatible
 */
export function areFormatsCompatible(sourceFormat, editionFormat) {
  // Exact match
  if (sourceFormat === editionFormat) {
    return true;
  }

  // Audiobook and ebook are compatible (cross-digital)
  if (
    (sourceFormat === 'audiobook' && editionFormat === 'ebook') ||
    (sourceFormat === 'ebook' && editionFormat === 'audiobook')
  ) {
    return true;
  }

  // Physical edition ('book') is NOT compatible with audiobook
  if (sourceFormat === 'audiobook' && editionFormat === 'book') {
    return false;
  }

  // Allow ebook → physical fallback (acceptable)
  if (sourceFormat === 'ebook' && editionFormat === 'book') {
    return true;
  }

  // Default to compatible for unknown formats
  return true;
}

/**
 * Check if any edition in search results has a compatible format with the source
 * @param {Array} searchResults - Edition objects from identifier search
 * @param {string} sourceFormat - Format from Audiobookshelf ('audiobook' or 'ebook')
 * @returns {boolean} True if at least one edition has compatible format
 */
export function checkFormatCompatibility(searchResults, sourceFormat) {
  if (!sourceFormat || searchResults.length === 0) {
    return true; // No format constraint or no results
  }

  // Check if ANY edition has compatible format
  return searchResults.some(edition => {
    const editionFormat = mapHardcoverFormatToInternal(edition);
    return areFormatsCompatible(sourceFormat, editionFormat);
  });
}
