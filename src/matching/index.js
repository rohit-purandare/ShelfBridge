/**
 * Book Matching Module
 *
 * This module provides comprehensive book matching functionality for ShelfBridge.
 * It includes three-tier matching strategies and sophisticated scoring algorithms.
 */

export { BookMatcher } from './book-matcher.js';
export { calculateMatchingScore } from './scoring/match-scorer.js';
export { extractBookIdentifiers } from './utils/identifier-extractor.js';
export { createIdentifierLookup } from './utils/identifier-lookup.js';

// Export individual strategies if needed
export { AsinMatcher } from './strategies/asin-matcher.js';
export { IsbnMatcher } from './strategies/isbn-matcher.js';
export { TitleAuthorMatcher } from './strategies/title-author-matcher.js';

// Export utility functions
export {
  normalizeIsbn,
  normalizeAsin,
  normalizeTitle,
  normalizeAuthor,
  normalizeNarrator,
} from './utils/normalization.js';

export {
  calculateTextSimilarity,
  calculateDurationSimilarity,
} from './utils/similarity.js';

export {
  extractIsbn,
  extractAsin,
  extractTitle,
  extractAuthor,
  extractNarrator,
  extractSeries,
  extractPublicationYear,
  extractAudioDurationFromAudiobookshelf,
  detectUserBookFormat,
} from './utils/audiobookshelf-extractor.js';

export {
  extractAuthorFromSearchResult,
  extractNarratorFromSearchResult,
  extractFormatFromSearchResult,
  extractActivityFromSearchResult,
  extractAudioDurationFromSearchResult,
} from './utils/hardcover-extractor.js';
