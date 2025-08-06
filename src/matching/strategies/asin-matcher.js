/**
 * ASIN-based book matching strategy
 *
 * This strategy matches books using Amazon Standard Identification Numbers (ASINs).
 * This is typically the most reliable method for audiobooks.
 */

import logger from '../../logger.js';
import { extractTitle } from '../utils/audiobookshelf-extractor.js';

/**
 * ASIN Matching Strategy - Tier 1
 * Attempts to match books using ASIN identifiers
 */
export class AsinMatcher {
  /**
   * Attempt to match a book using ASIN
   * @param {Object} absBook - Audiobookshelf book object
   * @param {Object} identifiers - Extracted identifiers from the book
   * @param {Object} identifierLookup - Lookup table of identifiers to Hardcover books
   * @returns {Object|null} - Hardcover match object or null if not found
   */
  async findMatch(absBook, identifiers, identifierLookup) {
    const title = extractTitle(absBook) || 'Unknown Title';

    if (!identifiers.asin || !identifierLookup[identifiers.asin]) {
      logger.debug(`No ASIN match available for ${title}`, {
        asin: identifiers.asin,
        hasLookup: !!identifierLookup[identifiers.asin],
      });
      return null;
    }

    const match = identifierLookup[identifiers.asin];

    logger.debug(`Found ASIN match for ${title}`, {
      asin: identifiers.asin,
      hardcoverTitle: match.userBook.book.title,
      userBookId: match.userBook.id,
      editionId: match.edition.id,
    });

    return {
      ...match,
      _matchType: 'asin',
      _tier: 1,
      _needsScoring: false, // Direct identifier matches don't need scoring
    };
  }

  /**
   * Get the strategy name
   * @returns {string} - Strategy name
   */
  getName() {
    return 'ASIN Matcher';
  }

  /**
   * Get the strategy tier (priority level)
   * @returns {number} - Tier number (1 = highest priority)
   */
  getTier() {
    return 1;
  }
}
