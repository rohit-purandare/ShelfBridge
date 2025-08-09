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
import { createIdentifierLookup } from './utils/identifier-lookup.js';
import { AsinMatcher } from './strategies/asin-matcher.js';
import { IsbnMatcher } from './strategies/isbn-matcher.js';
import { TitleAuthorMatcher } from './strategies/title-author-matcher.js';
import {
  extractTitle,
  extractAuthor,
} from './utils/audiobookshelf-extractor.js';

/**
 * Book Matcher - Orchestrates the multi-tier book matching process
 */
export class BookMatcher {
  /**
   * Initialize the book matcher
   * @param {Object} hardcoverClient - Hardcover API client
   * @param {Object} cache - Book cache instance
   * @param {Object} config - Global configuration
   */
  constructor(hardcoverClient, cache, config) {
    this.hardcoverClient = hardcoverClient;
    this.cache = cache;
    this.config = config;
    this.userLibraryData = null;
    this.formatMapper = null;

    // Initialize matching strategies
    this.strategies = [
      new AsinMatcher(),
      new IsbnMatcher(),
      new TitleAuthorMatcher(hardcoverClient, cache, config),
    ];

    logger.debug('BookMatcher initialized', {
      strategiesCount: this.strategies.length,
    });
  }

  /**
   * Find a book match using the three-tier strategy
   * @param {Object} absBook - Audiobookshelf book object
   * @param {string} userId - User ID for caching and library access
   * @returns {Object} - Result object containing { match, extractedMetadata }
   *   - match: Hardcover match object or null if not found
   *   - extractedMetadata: { title, author, identifiers } extracted from absBook
   */
  async findMatch(absBook, userId) {
    // Extract metadata once for use throughout matching process
    const extractedMetadata = {
      title: extractTitle(absBook) || 'Unknown Title',
      author: extractAuthor(absBook) || 'Unknown Author',
      identifiers: extractBookIdentifiers(absBook),
    };

    logger.debug(`🔍 Starting book matching for "${extractedMetadata.title}"`, {
      identifiers: extractedMetadata.identifiers,
      hasAsin: !!extractedMetadata.identifiers.asin,
      hasIsbn: !!extractedMetadata.identifiers.isbn,
      author: extractedMetadata.author,
    });

    // Create identifier lookup from user library data
    if (!this.userLibraryData) {
      logger.warn('No user library data available for book matching');
      return {
        match: null,
        extractedMetadata,
      };
    }

    const identifierLookup = createIdentifierLookup(
      this.userLibraryData,
      this.formatMapper,
    );

    // Try each strategy in order (Tier 1, 2, 3)
    for (const strategy of this.strategies) {
      try {
        let match = null;

        logger.debug(
          `📍 Tier ${strategy.getTier()}: Trying ${strategy.getName()} for "${extractedMetadata.title}"`,
        );

        if (strategy.getTier() <= 2) {
          // Identifier-based strategies (ASIN, ISBN)
          match = await strategy.findMatch(
            absBook,
            extractedMetadata.identifiers,
            identifierLookup,
          );
        } else {
          // Title/Author strategy
          if (this._isTitleAuthorMatchingEnabled()) {
            logger.debug(
              `📚 Attempting title/author matching for "${extractedMetadata.title}" (no identifiers available)`,
            );

            // Pass user library lookup function to the strategy
            match = await strategy.findMatch(
              absBook,
              userId,
              this._findUserBookByEditionId.bind(this),
            );
          } else {
            logger.debug(
              `⚠️ Title/Author matching disabled for "${extractedMetadata.title}" - check config.title_author_matching.enabled`,
            );
          }
        }

        if (match) {
          logger.info(
            `✅ Match found using ${strategy.getName()} for "${extractedMetadata.title}"`,
            {
              strategy: strategy.getName(),
              tier: strategy.getTier(),
              matchType: match._matchType,
              userBookId: match.userBook?.id,
              editionId: match.edition?.id,
              confidence: match._matchingScore?.totalScore || 'N/A',
            },
          );

          return {
            match,
            extractedMetadata,
          };
        }

        logger.debug(
          `❌ No match found using ${strategy.getName()} for "${extractedMetadata.title}"`,
        );
      } catch (error) {
        logger.warn(
          `Error in ${strategy.getName()} for "${extractedMetadata.title}": ${error.message}`,
          {
            strategy: strategy.getName(),
            error: error.message,
          },
        );
        // Continue to next strategy
      }
    }

    logger.info(
      `🚫 No match found for "${extractedMetadata.title}" using any matching strategy`,
      {
        availableIdentifiers: extractedMetadata.identifiers,
        strategiesTried: this.strategies.map(s => s.getName()),
        titleAuthorEnabled: this._isTitleAuthorMatchingEnabled(),
      },
    );

    return {
      match: null,
      extractedMetadata,
    };
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
   * Find user book by edition ID using the injected lookup function
   * @param {string} editionId - Edition ID to find
   * @returns {Object|null} - User book or null if not found
   * @private
   */
  _findUserBookByEditionId(editionId) {
    // This method is injected from SyncManager which owns the user library data
    if (this._findUserBookByEditionIdImpl) {
      return this._findUserBookByEditionIdImpl(editionId);
    }

    logger.warn('No user library lookup function available in BookMatcher');
    return null;
  }

  /**
   * Set the user library data for book matching
   * @param {Array} userLibraryData - User's Hardcover library data
   * @param {Function} formatMapper - Function to map edition formats (optional)
   */
  setUserLibrary(userLibraryData, formatMapper = null) {
    this.userLibraryData = userLibraryData;
    this.formatMapper = formatMapper;
    logger.debug('Updated user library data for book matching', {
      librarySize: userLibraryData ? userLibraryData.length : 0,
    });
  }

  /**
   * Set the user library lookup function for edition lookups
   * @param {Function} lookupFunction - Function to find user book by edition ID
   */
  setUserLibraryLookup(lookupFunction) {
    this._findUserBookByEditionIdImpl = lookupFunction;
    logger.debug('Updated user library lookup function for book matching');
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
