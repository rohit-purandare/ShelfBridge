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
  constructor(hardcoverClient = null) {
    this.hardcoverClient = hardcoverClient;
  }

  /**
   * Attempt to match a book using ASIN
   * @param {Object} absBook - Audiobookshelf book object
   * @param {Object} identifiers - Extracted identifiers from the book
   * @param {Object} identifierLookup - Lookup table of identifiers to Hardcover books
   * @param {Function} findUserBookByBookId - Function to find user books by book ID (optional)
   * @returns {Object|null} - Hardcover match object or null if not found
   */
  async findMatch(
    absBook,
    identifiers,
    identifierLookup,
    findUserBookByBookId = null,
  ) {
    const title = extractTitle(absBook) || 'Unknown Title';

    if (!identifiers.asin) {
      logger.debug(`❌ No ASIN available for ${title}`);
      return null;
    }

    if (!identifierLookup[identifiers.asin]) {
      logger.debug(
        `❌ ASIN ${identifiers.asin} not found in user's Hardcover library for ${title}`,
      );

      // Try book-level matching if we have the necessary functions
      if (this.hardcoverClient && findUserBookByBookId) {
        logger.debug(`🔍 Attempting book-level ASIN search for ${title}`);

        try {
          // Search Hardcover's global database for this ASIN
          const searchResults = await this.hardcoverClient.searchBooksByAsin(
            identifiers.asin,
          );
          logger.debug(
            `ASIN search returned ${searchResults.length} results for ${identifiers.asin}`,
          );

          if (searchResults.length > 0) {
            // Check if we have any edition of the same book
            for (const result of searchResults) {
              const bookId = result.book?.id;
              if (bookId) {
                logger.debug(
                  `Checking if book ID ${bookId} exists in user library`,
                );
                const existingUserBook = findUserBookByBookId(bookId);
                if (existingUserBook) {
                  logger.debug(
                    `📚 Found different edition of ${title} in library via ASIN book-level search`,
                    {
                      searchAsin: identifiers.asin,
                      foundBookId: bookId,
                      userBookId: existingUserBook.id,
                      libraryTitle: existingUserBook.book.title,
                    },
                  );

                  // Find the user's preferred edition (first one found)
                  const userEdition = existingUserBook.book.editions?.[0];
                  const userEditionId = userEdition?.id;

                  return {
                    userBook: existingUserBook,
                    edition: {
                      id: userEditionId,
                      format: userEdition?.format || 'unknown',
                    },
                    _matchType: 'asin_cross_edition',
                    _tier: 1,
                    _needsScoring: false,
                  };
                }
              }
            }

            // If we found ASIN results but user doesn't have the book, return for auto-add consideration
            const firstResult = searchResults[0];
            logger.debug(
              `📍 ASIN match found in Hardcover database but not in user library - returning for auto-add consideration`,
              {
                asin: identifiers.asin,
                title: title,
                hardcoverBookId: firstResult.book?.id,
                hardcoverTitle: firstResult.book?.title,
              },
            );

            return {
              userBook: null,
              edition: firstResult,
              _matchType: 'asin_search_result',
              _tier: 1,
              _needsScoring: false,
              _needsBookIdLookup: true, // Book ID needs to be looked up from edition
              _isSearchResult: true, // Flag for sync manager to handle auto-add with progress threshold
            };
          }

          logger.debug(
            `❌ ASIN ${identifiers.asin} not found in Hardcover's database for ${title}`,
          );
        } catch (error) {
          logger.warn(
            `Error during ASIN book-level search for ${title}: ${error.message}`,
          );
        }
      }

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
