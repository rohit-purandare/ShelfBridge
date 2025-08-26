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
  constructor(hardcoverClient = null) {
    this.hardcoverClient = hardcoverClient;
  }

  /**
   * Attempt to match a book using ISBN
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

    if (!identifiers.isbn) {
      logger.debug(`❌ No ISBN available for ${title}`);
      return null;
    }

    if (!identifierLookup[identifiers.isbn]) {
      logger.debug(
        `❌ ISBN ${identifiers.isbn} not found in user's Hardcover library for ${title}`,
      );

      // Try book-level matching if we have the necessary functions
      if (this.hardcoverClient && findUserBookByBookId) {
        logger.debug(`🔍 Attempting book-level ISBN search for ${title}`);

        try {
          // Search Hardcover's global database for this ISBN
          const searchResults = await this.hardcoverClient.searchBooksByIsbn(
            identifiers.isbn,
          );
          logger.debug(
            `ISBN search returned ${searchResults.length} results for ${identifiers.isbn}`,
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
                    `📚 Found different edition of ${title} in library via ISBN book-level search`,
                    {
                      searchIsbn: identifiers.isbn,
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
                    _matchType: 'isbn_cross_edition',
                    _tier: 2,
                    _needsScoring: false,
                  };
                }
              }
            }

            // If we found ISBN results but user doesn't have the book, return for auto-add consideration
            const firstResult = searchResults[0];
            logger.debug(
              `📍 ISBN match found in Hardcover database but not in user library - returning for auto-add consideration`,
              {
                isbn: identifiers.isbn,
                title: title,
                hardcoverBookId: firstResult.book?.id,
                hardcoverTitle: firstResult.book?.title,
              },
            );

            return {
              userBook: null,
              edition: firstResult,
              _matchType: 'isbn_search_result',
              _tier: 2,
              _needsScoring: false,
              _needsBookIdLookup: true, // Book ID needs to be looked up from edition
              _isSearchResult: true, // Flag for sync manager to handle auto-add with progress threshold
            };
          }

          logger.debug(
            `❌ ISBN ${identifiers.isbn} not found in Hardcover's database for ${title}`,
          );
        } catch (error) {
          logger.warn(
            `Error during ISBN book-level search for ${title}: ${error.message}`,
          );
        }
      }

      return null;
    }

    const match = identifierLookup[identifiers.isbn];

    logger.debug(`Found ISBN match for ${title}`, {
      isbn: identifiers.isbn,
      hardcoverTitle: match.userBook?.book?.title || 'Unknown Title',
      userBookId: match.userBook?.id || 'No User Book ID',
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
