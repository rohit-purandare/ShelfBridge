/**
 * Audiobookshelf data extraction utilities
 *
 * This module provides functions to extract book metadata
 * from Audiobookshelf book objects.
 */

import { normalizeIsbn, normalizeAsin } from './text-matching.js';

/**
 * Extract ISBN from various formats in book data
 * @param {Object} bookData - Book data object
 * @returns {string|null} - Normalized ISBN or null
 */
export function extractIsbn(bookData) {
  if (!bookData) return null;

  // Try different possible ISBN fields
  const isbnFields = ['isbn', 'isbn_10', 'isbn_13', 'isbn10', 'isbn13'];

  // Check direct fields first
  for (const field of isbnFields) {
    if (bookData[field]) {
      const normalized = normalizeIsbn(bookData[field]);
      if (normalized) return normalized;
    }
  }

  // Check metadata object
  if (bookData.metadata) {
    for (const field of isbnFields) {
      if (bookData.metadata[field]) {
        const normalized = normalizeIsbn(bookData.metadata[field]);
        if (normalized) return normalized;
      }
    }
  }

  // Check media metadata
  if (bookData.media && bookData.media.metadata) {
    for (const field of isbnFields) {
      if (bookData.media.metadata[field]) {
        const normalized = normalizeIsbn(bookData.media.metadata[field]);
        if (normalized) return normalized;
      }
    }
  }

  return null;
}

/**
 * Extract ASIN from various formats in book data
 * @param {Object} bookData - Book data object
 * @returns {string|null} - Normalized ASIN or null
 */
export function extractAsin(bookData) {
  if (!bookData) return null;

  // Try different possible ASIN fields
  const asinFields = ['asin', 'amazonASIN', 'amazon_asin'];

  // Check direct fields first
  for (const field of asinFields) {
    if (bookData[field]) {
      const normalized = normalizeAsin(bookData[field]);
      if (normalized) return normalized;
    }
  }

  // Check metadata object
  if (bookData.metadata) {
    for (const field of asinFields) {
      if (bookData.metadata[field]) {
        const normalized = normalizeAsin(bookData.metadata[field]);
        if (normalized) return normalized;
      }
    }
  }

  // Check media metadata
  if (bookData.media && bookData.media.metadata) {
    for (const field of asinFields) {
      if (bookData.media.metadata[field]) {
        const normalized = normalizeAsin(bookData.media.metadata[field]);
        if (normalized) return normalized;
      }
    }
  }

  return null;
}

/**
 * Extract title from book data
 * @param {Object} bookData - Book data object
 * @returns {string|null} - Book title or null
 */
export function extractTitle(bookData) {
  if (!bookData) return null;

  // Try different title fields in order of preference
  const titleFields = ['title', 'name'];

  for (const field of titleFields) {
    if (bookData[field] && typeof bookData[field] === 'string') {
      return bookData[field].trim();
    }
  }

  // Check metadata object
  if (bookData.metadata) {
    for (const field of titleFields) {
      if (
        bookData.metadata[field] &&
        typeof bookData.metadata[field] === 'string'
      ) {
        return bookData.metadata[field].trim();
      }
    }
  }

  // Check media metadata
  if (bookData.media && bookData.media.metadata) {
    for (const field of titleFields) {
      if (
        bookData.media.metadata[field] &&
        typeof bookData.media.metadata[field] === 'string'
      ) {
        return bookData.media.metadata[field].trim();
      }
    }
  }

  return null;
}

/**
 * Extract author from book data
 * @param {Object} bookData - Book data object
 * @returns {string|null} - Author name or null
 */
export function extractAuthor(bookData) {
  if (!bookData) return null;

  // Try different author fields
  const authorFields = ['author', 'authorName', 'authors'];

  for (const field of authorFields) {
    if (bookData[field]) {
      // Debug: Check the type and value of the author field
      const authorValue = bookData[field];

      // Handle array of authors
      if (Array.isArray(authorValue)) {
        return authorValue
          .map(author => {
            if (typeof author === 'object' && author !== null) {
              return author.name || author.displayName || '[Unknown Author]';
            }
            return author.toString();
          })
          .join(', ');
      }

      // Handle object case (extract name or convert to string)
      if (typeof authorValue === 'object' && authorValue !== null) {
        // If object has a name property, use it
        if (authorValue.name) {
          return authorValue.name.toString().trim();
        }
        // If object has a displayName property, use it
        if (authorValue.displayName) {
          return authorValue.displayName.toString().trim();
        }
        // Log warning and skip this field
        console.warn(
          `Author field '${field}' is an object without name/displayName:`,
          authorValue,
        );
        continue;
      }

      // Handle string case
      if (typeof authorValue === 'string') {
        return authorValue.trim();
      }

      // Handle other types by converting to string
      return authorValue.toString().trim();
    }
  }

  // Check metadata object
  if (bookData.metadata) {
    for (const field of authorFields) {
      if (bookData.metadata[field]) {
        const authorValue = bookData.metadata[field];

        if (Array.isArray(authorValue)) {
          return authorValue
            .map(author => {
              if (typeof author === 'object' && author !== null) {
                return author.name || author.displayName || '[Unknown Author]';
              }
              return author.toString();
            })
            .join(', ');
        }

        if (typeof authorValue === 'object' && authorValue !== null) {
          if (authorValue.name) {
            return authorValue.name.toString().trim();
          }
          if (authorValue.displayName) {
            return authorValue.displayName.toString().trim();
          }
          console.warn(
            `Metadata author field '${field}' is an object without name/displayName:`,
            authorValue,
          );
          continue;
        }

        if (typeof authorValue === 'string') {
          return authorValue.trim();
        }

        return authorValue.toString().trim();
      }
    }
  }

  // Check media metadata
  if (bookData.media && bookData.media.metadata) {
    for (const field of authorFields) {
      if (bookData.media.metadata[field]) {
        const authorValue = bookData.media.metadata[field];

        if (Array.isArray(authorValue)) {
          return authorValue
            .map(author => {
              if (typeof author === 'object' && author !== null) {
                return author.name || author.displayName || '[Unknown Author]';
              }
              return author.toString();
            })
            .join(', ');
        }

        if (typeof authorValue === 'object' && authorValue !== null) {
          if (authorValue.name) {
            return authorValue.name.toString().trim();
          }
          if (authorValue.displayName) {
            return authorValue.displayName.toString().trim();
          }
          console.warn(
            `Media metadata author field '${field}' is an object without name/displayName:`,
            authorValue,
          );
          continue;
        }

        if (typeof authorValue === 'string') {
          return authorValue.trim();
        }

        return authorValue.toString().trim();
      }
    }
  }

  return null;
}

/**
 * Extract narrator from book data
 * @param {Object} bookData - Book data object
 * @returns {string|null} - Narrator name or null
 */
export function extractNarrator(bookData) {
  if (!bookData) return null;

  // Try different narrator fields
  const narratorFields = [
    'narrator',
    'narratorName',
    'narrators',
    'voice',
    'voiceActor',
  ];

  for (const field of narratorFields) {
    if (bookData[field]) {
      if (Array.isArray(bookData[field])) {
        return bookData[field].join(', ');
      }
      return bookData[field].trim();
    }
  }

  // Check metadata object
  if (bookData.metadata) {
    for (const field of narratorFields) {
      if (bookData.metadata[field]) {
        if (Array.isArray(bookData.metadata[field])) {
          return bookData.metadata[field].join(', ');
        }
        return bookData.metadata[field].trim();
      }
    }
  }

  // Check media metadata
  if (bookData.media && bookData.media.metadata) {
    for (const field of narratorFields) {
      if (bookData.media.metadata[field]) {
        if (Array.isArray(bookData.media.metadata[field])) {
          return bookData.media.metadata[field].join(', ');
        }
        return bookData.media.metadata[field].trim();
      }
    }
  }

  return null;
}

/**
 * Extract series information from book data
 * @param {Object} bookData - Book data object
 * @returns {Object} - Series info {name, sequence}
 */
export function extractSeries(bookData) {
  const series = { name: null, sequence: null };

  if (!bookData) return series;

  // Try different series fields
  const seriesFields = ['series', 'seriesName'];
  const sequenceFields = [
    'sequence',
    'seriesSequence',
    'book',
    'bookNumber',
    'volume',
  ];

  // Check direct fields
  for (const field of seriesFields) {
    if (bookData[field] && typeof bookData[field] === 'string') {
      series.name = bookData[field].trim();
      break;
    }
  }

  for (const field of sequenceFields) {
    if (bookData[field] !== undefined && bookData[field] !== null) {
      series.sequence = parseFloat(bookData[field]);
      break;
    }
  }

  // Check metadata object
  if (bookData.metadata) {
    if (!series.name) {
      for (const field of seriesFields) {
        if (
          bookData.metadata[field] &&
          typeof bookData.metadata[field] === 'string'
        ) {
          series.name = bookData.metadata[field].trim();
          break;
        }
      }
    }

    if (series.sequence === null) {
      for (const field of sequenceFields) {
        if (
          bookData.metadata[field] !== undefined &&
          bookData.metadata[field] !== null
        ) {
          series.sequence = parseFloat(bookData.metadata[field]);
          break;
        }
      }
    }
  }

  // Check media metadata
  if (bookData.media && bookData.media.metadata) {
    if (!series.name) {
      for (const field of seriesFields) {
        if (
          bookData.media.metadata[field] &&
          typeof bookData.media.metadata[field] === 'string'
        ) {
          series.name = bookData.media.metadata[field].trim();
          break;
        }
      }
    }

    if (series.sequence === null) {
      for (const field of sequenceFields) {
        if (
          bookData.media.metadata[field] !== undefined &&
          bookData.media.metadata[field] !== null
        ) {
          series.sequence = parseFloat(bookData.media.metadata[field]);
          break;
        }
      }
    }
  }

  return series;
}

/**
 * Extract publication year from book data
 * @param {Object} bookData - Book data object
 * @returns {number|null} - Publication year or null
 */
export function extractPublicationYear(bookData) {
  if (!bookData) return null;

  const yearFields = [
    'publishedYear',
    'year',
    'publicationYear',
    'releaseDate',
  ];

  // Check direct fields
  for (const field of yearFields) {
    if (bookData[field]) {
      const year = parseInt(bookData[field]);
      if (!isNaN(year) && year > 1000 && year < 3000) {
        return year;
      }
    }
  }

  // Check metadata object
  if (bookData.metadata) {
    for (const field of yearFields) {
      if (bookData.metadata[field]) {
        const year = parseInt(bookData.metadata[field]);
        if (!isNaN(year) && year > 1000 && year < 3000) {
          return year;
        }
      }
    }
  }

  // Check media metadata
  if (bookData.media && bookData.media.metadata) {
    for (const field of yearFields) {
      if (bookData.media.metadata[field]) {
        const year = parseInt(bookData.media.metadata[field]);
        if (!isNaN(year) && year > 1000 && year < 3000) {
          return year;
        }
      }
    }
  }

  return null;
}

/**
 * Extract audio duration from Audiobookshelf book data
 * @param {Object} bookData - Book data object
 * @returns {number|null} - Duration in seconds or null
 */
export function extractAudioDurationFromAudiobookshelf(bookData) {
  if (!bookData) return null;

  // Try different duration fields
  const durationFields = ['duration', 'length', 'totalLength'];

  // Check direct fields
  for (const field of durationFields) {
    if (bookData[field] && typeof bookData[field] === 'number') {
      return bookData[field];
    }
  }

  // Check media object
  if (bookData.media) {
    for (const field of durationFields) {
      if (bookData.media[field] && typeof bookData.media[field] === 'number') {
        return bookData.media[field];
      }
    }
  }

  // Check metadata object
  if (bookData.metadata) {
    for (const field of durationFields) {
      if (
        bookData.metadata[field] &&
        typeof bookData.metadata[field] === 'number'
      ) {
        return bookData.metadata[field];
      }
    }
  }

  return null;
}

/**
 * Detect the format of the user's book from Audiobookshelf metadata
 *
 * Simplified for two-stage matching - trusts what Audiobookshelf tells us directly.
 * Audiobookshelf only handles audiobooks and ebooks (never physical).
 *
 * @param {Object} targetMetadata - Book metadata from Audiobookshelf
 * @returns {string} - Detected format: 'audiobook' or 'ebook'
 */
export function detectUserBookFormat(targetMetadata) {
  if (!targetMetadata) return 'ebook'; // Default fallback

  // Trust Audiobookshelf's explicit media type first
  if (targetMetadata.mediaType) {
    const mediaType = targetMetadata.mediaType.toLowerCase();
    if (mediaType.includes('audio') || mediaType === 'book') {
      return 'audiobook';
    }
    if (mediaType.includes('ebook')) {
      return 'ebook';
    }
  }

  // Trust library type if available
  if (targetMetadata.libraryType) {
    const libType = targetMetadata.libraryType.toLowerCase();
    if (libType.includes('audio')) return 'audiobook';
    if (libType.includes('ebook') || libType.includes('book')) return 'ebook';
  }

  // Check for obvious audiobook indicators
  if (
    targetMetadata.duration ||
    targetMetadata.media?.duration ||
    targetMetadata.narrator ||
    targetMetadata.media?.metadata?.narrator ||
    targetMetadata.media?.audioFiles?.length > 0
  ) {
    return 'audiobook';
  }

  // Check for obvious ebook indicators
  if (
    targetMetadata.media?.ebookFiles?.length > 0 ||
    targetMetadata.format?.toLowerCase().includes('epub') ||
    targetMetadata.format?.toLowerCase().includes('pdf') ||
    targetMetadata.format?.toLowerCase().includes('mobi')
  ) {
    return 'ebook';
  }

  // Default to ebook (most common fallback)
  return 'ebook';
}
