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

    // Memoization cache for identifier lookup
    this._identifierLookupCache = null;
    this._lastLibraryDataHash = null;

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
   * Get or create identifier lookup table with memoization
   * @returns {Object} - Cached identifier lookup table
   * @private
   */
  _getIdentifierLookup() {
    // Create a simple hash of the library data to detect changes
    const currentDataHash = this._hashLibraryData();

    // Return cached lookup if available and current
    if (
      this._identifierLookupCache &&
      this._lastLibraryDataHash === currentDataHash
    ) {
      logger.debug('Using cached identifier lookup table', {
        librarySize: this.userLibraryData ? this.userLibraryData.length : 0,
        cacheHash: currentDataHash,
      });
      return this._identifierLookupCache;
    }

    // Build new lookup table and cache it
    logger.debug('Building new identifier lookup table', {
      librarySize: this.userLibraryData ? this.userLibraryData.length : 0,
      previousHash: this._lastLibraryDataHash,
      newHash: currentDataHash,
    });

    this._identifierLookupCache = createIdentifierLookup(
      this.userLibraryData,
      this.formatMapper,
    );
    this._lastLibraryDataHash = currentDataHash;

    const lookupSize = Object.keys(this._identifierLookupCache).length;
    logger.debug('Identifier lookup table built and cached', {
      identifierCount: lookupSize,
      cacheHash: currentDataHash,
    });

    return this._identifierLookupCache;
  }

  /**
   * Create a simple hash of library data for change detection
   * @returns {string} - Hash representing current library state
   * @private
   */
  _hashLibraryData() {
    if (!this.userLibraryData) {
      return 'no-data';
    }

    // Create a simple hash based on library size and a sample of IDs
    // This is lightweight but catches most changes
    const librarySize = this.userLibraryData.length;
    const sampleIds = this.userLibraryData
      .slice(0, Math.min(5, librarySize))
      .map(book => book.id || book.book?.id)
      .filter(Boolean)
      .join(',');

    const formatMapperHash = this.formatMapper ? 'with-mapper' : 'no-mapper';

    return `${librarySize}-${sampleIds}-${formatMapperHash}`;
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

    // Get identifier lookup from cache or create if needed
    if (!this.userLibraryData) {
      logger.warn('No user library data available for book matching');
      return {
        match: null,
        extractedMetadata,
      };
    }

    const identifierLookup = this._getIdentifierLookup();

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
          logger.debug(
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
            tier: strategy.getTier(),
            error: error.message,
            stack: error.stack,
            book: {
              title: extractedMetadata.title,
              author: extractedMetadata.author,
              identifiers: extractedMetadata.identifiers,
            },
          },
        );
        // Continue to next strategy
      }
    }

    logger.debug(
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

    // Invalidate cache when library data changes
    this._invalidateCache();

    logger.debug('Updated user library data for book matching', {
      librarySize: userLibraryData ? userLibraryData.length : 0,
      cacheInvalidated: true,
    });
  }

  /**
   * Invalidate the cached identifier lookup table
   * @private
   */
  _invalidateCache() {
    this._identifierLookupCache = null;
    this._lastLibraryDataHash = null;
    logger.debug('Identifier lookup cache invalidated');
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
