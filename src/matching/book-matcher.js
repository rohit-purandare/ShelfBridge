/**
 * Main Book Matching Orchestrator
 *
 * This class coordinates the three-tier book matching strategy:
 * 1. ASIN-based matching (Tier 1)
 * 2. ISBN-based matching (Tier 2)
 * 3. Title/Author-based matching (Tier 3)
 */

import logger from '../logger.js';
import { extractBookIdentifiers } from './utils/identifier-extractor.js';
import { AsinMatcher } from './strategies/asin-matcher.js';
import { IsbnMatcher } from './strategies/isbn-matcher.js';
import { TitleAuthorMatcher } from './strategies/title-author-matcher.js';
import { extractTitle } from './utils/audiobookshelf-extractor.js';

/**
 * Book Matcher - Orchestrates the multi-tier book matching process
 */
export class BookMatcher {
  /**
   * Initialize the book matcher
   * @param {Object} hardcoverClient - Hardcover API client
   * @param {Object} cache - Book cache instance
   * @param {Object} config - Global configuration
   * @param {Object} userLibrary - User's Hardcover library (for _findUserBookByEditionId)
   */
  constructor(hardcoverClient, cache, config, userLibrary = null) {
    this.hardcoverClient = hardcoverClient;
    this.cache = cache;
    this.config = config;
    this.userLibrary = userLibrary;

    // Initialize matching strategies
    this.strategies = [
      new AsinMatcher(),
      new IsbnMatcher(),
      new TitleAuthorMatcher(hardcoverClient, cache, config),
    ];

    logger.debug('BookMatcher initialized', {
      strategiesCount: this.strategies.length,
      hasUserLibrary: !!userLibrary,
    });
  }

  /**
   * Find a book match using the three-tier strategy
   * @param {Object} absBook - Audiobookshelf book object
   * @param {Object} identifierLookup - Lookup table of identifiers to Hardcover books
   * @param {string} userId - User ID for caching and library access
   * @returns {Object|null} - Hardcover match object or null if not found
   */
  async findMatch(absBook, identifierLookup, userId) {
    const title = extractTitle(absBook) || 'Unknown Title';

    logger.debug(`Starting book matching for "${title}"`);

    // Extract identifiers once for use across strategies
    const identifiers = extractBookIdentifiers(absBook);

    logger.debug(`Extracted identifiers for "${title}"`, {
      identifiers: identifiers,
    });

    // Try each strategy in order (Tier 1, 2, 3)
    for (const strategy of this.strategies) {
      try {
        let match = null;

        logger.debug(
          `Trying ${strategy.getName()} (Tier ${strategy.getTier()}) for "${title}"`,
        );

        if (strategy.getTier() <= 2) {
          // Identifier-based strategies (ASIN, ISBN)
          match = await strategy.findMatch(
            absBook,
            identifiers,
            identifierLookup,
          );
        } else {
          // Title/Author strategy
          if (this._isTitleAuthorMatchingEnabled()) {
            logger.debug(`Attempting title/author matching for "${title}"`);

            // Pass user library lookup function to the strategy
            match = await strategy.findMatch(
              absBook,
              userId,
              this._findUserBookByEditionId.bind(this),
            );
          }
        }

        if (match) {
          logger.debug(
            `Match found using ${strategy.getName()} for "${title}"`,
            {
              strategy: strategy.getName(),
              tier: strategy.getTier(),
              matchType: match._matchType,
              userBookId: match.userBook?.id,
              editionId: match.edition?.id,
            },
          );

          return match;
        }

        logger.debug(
          `No match found using ${strategy.getName()} for "${title}"`,
        );
      } catch (error) {
        logger.warn(
          `Error in ${strategy.getName()} for "${title}": ${error.message}`,
          {
            strategy: strategy.getName(),
            error: error.message,
          },
        );
        // Continue to next strategy
      }
    }

    logger.debug(`No match found for "${title}" in Hardcover library`, {
      searchedIdentifiers: identifiers,
    });

    return null;
  }

  /**
   * Check if title/author matching is enabled
   * @returns {boolean} - True if enabled
   * @private
   */
  _isTitleAuthorMatchingEnabled() {
    const titleAuthorConfig = this.config.title_author_matching || {};
    return titleAuthorConfig.enabled !== false; // Default enabled
  }

  /**
   * Find user book by edition ID in the user's library
   * @param {string} editionId - Edition ID to find
   * @returns {Object|null} - User book or null if not found
   * @private
   */
  _findUserBookByEditionId(editionId) {
    if (!this.userLibrary || !Array.isArray(this.userLibrary)) {
      return null;
    }

    for (const userBook of this.userLibrary) {
      if (userBook.edition && userBook.edition.id === editionId) {
        return userBook;
      }
    }

    return null;
  }

  /**
   * Set the user library for edition lookups
   * @param {Array} userLibrary - User's Hardcover library
   */
  setUserLibrary(userLibrary) {
    this.userLibrary = userLibrary;
    logger.debug('Updated user library for book matching', {
      librarySize: userLibrary ? userLibrary.length : 0,
    });
  }

  /**
   * Get matching statistics
   * @returns {Object} - Statistics about matching strategies
   */
  getStatistics() {
    return {
      strategies: this.strategies.map(strategy => ({
        name: strategy.getName(),
        tier: strategy.getTier(),
      })),
      titleAuthorMatchingEnabled: this._isTitleAuthorMatchingEnabled(),
    };
  }
}
