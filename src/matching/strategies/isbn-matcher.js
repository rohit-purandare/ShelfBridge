/**
 * ISBN-based book matching strategy
 *
 * This strategy matches books using International Standard Book Numbers (ISBNs).
 * This is typically reliable for books with ISBN data.
 */

import logger from '../../logger.js';
import { extractTitle } from '../utils/audiobookshelf-extractor.js';

/**
 * ISBN Matching Strategy - Tier 2
 * Attempts to match books using ISBN identifiers
 */
export class IsbnMatcher {
  /**
   * Attempt to match a book using ISBN
   * @param {Object} absBook - Audiobookshelf book object
   * @param {Object} identifiers - Extracted identifiers from the book
   * @param {Object} identifierLookup - Lookup table of identifiers to Hardcover books
   * @returns {Object|null} - Hardcover match object or null if not found
   */
  async findMatch(absBook, identifiers, identifierLookup) {
    const title = extractTitle(absBook) || 'Unknown Title';

    if (!identifiers.isbn) {
      logger.debug(`❌ No ISBN available for ${title}`);
      return null;
    }

    if (!identifierLookup[identifiers.isbn]) {
      logger.debug(
        `❌ ISBN ${identifiers.isbn} not found in user's Hardcover library for ${title}`,
      );
      return null;
    }

    const match = identifierLookup[identifiers.isbn];

    logger.debug(`Found ISBN match for ${title}`, {
      isbn: identifiers.isbn,
      hardcoverTitle: match.userBook.book.title,
      userBookId: match.userBook.id,
      editionId: match.edition.id,
    });

    return {
      ...match,
      _matchType: 'isbn',
      _tier: 2,
      _needsScoring: false, // Direct identifier matches don't need scoring
    };
  }

  /**
   * Get the strategy name
   * @returns {string} - Strategy name
   */
  getName() {
    return 'ISBN Matcher';
  }

  /**
   * Get the strategy tier (priority level)
   * @returns {number} - Tier number (2 = second priority)
   */
  getTier() {
    return 2;
  }
}
