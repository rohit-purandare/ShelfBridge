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
import {
  extractTitle,
  extractAuthor,
  detectUserBookFormat,
} from './utils/audiobookshelf-extractor.js';
import { normalizeIsbn, normalizeAsin } from './utils/text-matching.js';

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

    // Memoization caches for lookup tables
    this._identifierLookupCache = null;
    this._editionLookupCache = null;
    this._bookLookupCache = null;
    this._lastLibraryDataHash = null;

    // Initialize matching strategies
    this.strategies = [
      new AsinMatcher(hardcoverClient),
      new IsbnMatcher(hardcoverClient),
      new TitleAuthorMatcher(hardcoverClient, cache, config),
    ];

    logger.debug('BookMatcher initialized', {
      strategiesCount: this.strategies.length,
    });
  }

  /**
   * Get or create identifier, edition, and book lookup tables with memoization
   * @returns {Object} - Object containing all cached lookup tables
   * @private
   */
  _getLookupTables() {
    // Create a simple hash of the library data to detect changes
    const currentDataHash = this._hashLibraryData();

    // Return cached lookups if available and current
    if (
      this._identifierLookupCache &&
      this._editionLookupCache &&
      this._bookLookupCache &&
      this._lastLibraryDataHash === currentDataHash
    ) {
      logger.debug('Using cached lookup tables', {
        librarySize: this.userLibraryData ? this.userLibraryData.length : 0,
        cacheHash: currentDataHash,
      });
      return {
        identifierLookup: this._identifierLookupCache,
        editionLookup: this._editionLookupCache,
        bookLookup: this._bookLookupCache,
      };
    }

    // Build new lookup tables and cache them
    logger.debug('Building new lookup tables', {
      librarySize: this.userLibraryData ? this.userLibraryData.length : 0,
      previousHash: this._lastLibraryDataHash,
      newHash: currentDataHash,
    });

    const lookupTables = this._createLookupTables();
    this._identifierLookupCache = lookupTables.identifierLookup;
    this._editionLookupCache = lookupTables.editionLookup;
    this._bookLookupCache = lookupTables.bookLookup;
    this._lastLibraryDataHash = currentDataHash;

    const identifierCount = Object.keys(this._identifierLookupCache).length;
    const editionCount = Object.keys(this._editionLookupCache).length;
    const bookCount = Object.keys(this._bookLookupCache).length;
    logger.debug('Lookup tables built and cached', {
      identifierCount,
      editionCount,
      bookCount,
      cacheHash: currentDataHash,
    });

    return {
      identifierLookup: this._identifierLookupCache,
      editionLookup: this._editionLookupCache,
      bookLookup: this._bookLookupCache,
    };
  }

  /**
   * Get cached identifier lookup table (for backwards compatibility)
   * @returns {Object} - Cached identifier lookup table
   * @private
   */
  _getIdentifierLookup() {
    return this._getLookupTables().identifierLookup;
  }

  /**
   * Get cached edition lookup table
   * @returns {Object} - Cached edition lookup table
   * @private
   */
  _getEditionLookup() {
    return this._getLookupTables().editionLookup;
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
   * Create identifier, edition, and book lookup tables in a single pass
   * @returns {Object} - Object containing all lookup tables
   * @private
   */
  _createLookupTables() {
    const identifierLookup = {};
    const editionLookup = {};
    const bookLookup = {};

    if (!this.userLibraryData) {
      return { identifierLookup, editionLookup, bookLookup };
    }

    /**
     * Helper function to check if an edition has length data
     * @param {Object} edition - Edition object
     * @returns {boolean} - True if edition has audio_seconds or pages
     */
    const hasLengthData = edition => {
      return !!(
        (edition.audio_seconds && edition.audio_seconds > 0) ||
        (edition.pages && edition.pages > 0)
      );
    };

    /**
     * Helper function to determine if we should store this edition in the identifier lookup
     * Prioritizes editions with length data (audio_seconds or pages)
     * @param {string} identifier - The normalized identifier (ISBN/ASIN)
     * @param {Object} newEdition - The edition we're considering adding
     * @returns {boolean} - True if we should store/overwrite with this edition
     */
    const shouldStoreEdition = (identifier, newEdition) => {
      const existing = identifierLookup[identifier];

      // No existing entry - always store
      if (!existing) {
        return true;
      }

      const newHasLength = hasLengthData(newEdition);
      const existingHasLength = hasLengthData(existing.edition);

      // Prioritize editions with length data
      if (newHasLength && !existingHasLength) {
        return true; // Replace existing with better edition
      }

      // Keep existing if it has length data and new one doesn't
      if (!newHasLength && existingHasLength) {
        return false;
      }

      // Both have length data or both don't - keep existing (first found)
      return false;
    };

    // Single pass through library data to build all tables
    for (const userBook of this.userLibraryData) {
      const book = userBook.book;
      if (!book || !book.editions) continue;

      // Build book lookup table (book ID -> user book)
      if (book.id) {
        bookLookup[book.id] = userBook;
      }

      for (const edition of book.editions) {
        // Apply format mapping if provided
        const editionWithFormat = this.formatMapper
          ? {
              ...edition,
              format: this.formatMapper(edition),
            }
          : edition;

        // Build identifier lookup table (ISBN, ASIN)
        // Add ISBN-10
        if (edition.isbn_10) {
          const normalizedIsbn = normalizeIsbn(edition.isbn_10);
          if (
            normalizedIsbn &&
            shouldStoreEdition(normalizedIsbn, editionWithFormat)
          ) {
            identifierLookup[normalizedIsbn] = {
              userBook,
              edition: editionWithFormat,
            };
          }
        }

        // Add ISBN-13
        if (edition.isbn_13) {
          const normalizedIsbn = normalizeIsbn(edition.isbn_13);
          if (
            normalizedIsbn &&
            shouldStoreEdition(normalizedIsbn, editionWithFormat)
          ) {
            identifierLookup[normalizedIsbn] = {
              userBook,
              edition: editionWithFormat,
            };
          }
        }

        // Add ASIN
        if (edition.asin) {
          const normalizedAsin = normalizeAsin(edition.asin);
          if (
            normalizedAsin &&
            shouldStoreEdition(normalizedAsin, editionWithFormat)
          ) {
            identifierLookup[normalizedAsin] = {
              userBook,
              edition: editionWithFormat,
            };
          }
        }

        // Build edition lookup table (edition ID -> user book)
        if (edition.id) {
          editionLookup[edition.id] = userBook;
        }
      }
    }

    return { identifierLookup, editionLookup, bookLookup };
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
            this.findUserBookByBookId.bind(this),
          );
        } else {
          // Title/Author strategy
          if (this._isTitleAuthorMatchingEnabled()) {
            logger.debug(
              `📚 Attempting title/author matching for "${extractedMetadata.title}" (no identifiers available)`,
            );

            // Pass optimized user library lookup functions to the strategy
            match = await strategy.findMatch(
              absBook,
              userId,
              this.findUserBookByEditionId.bind(this),
              this.findUserBookByBookId.bind(this),
            );
          } else {
            logger.debug(
              `⚠️ Title/Author matching disabled for "${extractedMetadata.title}" - check config.title_author_matching.enabled`,
            );
          }
        }

        if (match) {
          // Enhance identifier matches with cross-edition search for length data
          if (strategy.getTier() <= 2 && match.userBook) {
            const sourceFormat = detectUserBookFormat(absBook);
            const matchType = match._matchType || 'identifier';
            match = this._enhanceMatchWithLengthData(
              match,
              sourceFormat,
              matchType,
            );
          }

          logger.debug(
            `✅ Match found using ${strategy.getName()} for "${extractedMetadata.title}"`,
            {
              strategy: strategy.getName(),
              tier: strategy.getTier(),
              matchType: match._matchType,
              userBookId: match.userBook?.id,
              editionId: match.edition?.id,
              confidence: match._matchingScore?.totalScore || 'N/A',
              editionUpgraded: match._editionUpgraded || false,
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
   * Enhance identifier match by finding a better edition with length data if needed
   * @param {Object} match - The initial match object
   * @param {string} sourceFormat - The format from the source book (audiobook/ebook)
   * @param {string} matchType - Type of match (asin/isbn)
   * @returns {Object} - Enhanced match object or original if no better edition found
   * @private
   */
  _enhanceMatchWithLengthData(
    match,
    sourceFormat = null,
    matchType = 'identifier',
  ) {
    // If no match or no userBook, return as-is
    if (!match || !match.userBook) {
      return match;
    }

    const currentEdition = match.edition;

    // Check if current edition has length data (positive values only)
    const hasLength = !!(
      (currentEdition?.audio_seconds && currentEdition.audio_seconds > 0) ||
      (currentEdition?.pages && currentEdition.pages > 0)
    );

    // Apply format mapping if available (with error handling)
    let currentEditionFormat;
    try {
      currentEditionFormat = this.formatMapper
        ? this.formatMapper(currentEdition)
        : currentEdition?.format;
    } catch (error) {
      logger.warn('Format mapper error, falling back to direct format', {
        error: error.message,
        editionId: currentEdition?.id,
      });
      currentEditionFormat = currentEdition?.format;
    }

    // Check if format matches source (handle undefined formats gracefully)
    const formatMatches =
      sourceFormat &&
      currentEditionFormat &&
      currentEditionFormat === sourceFormat;

    if (hasLength && formatMatches) {
      // Current edition has length data AND format matches - optimal match
      logger.debug(
        'Current edition already has length data and format matches',
        {
          editionId: currentEdition.id,
          format: currentEditionFormat,
          sourceFormat: sourceFormat,
          hasAudioSeconds: !!currentEdition.audio_seconds,
          hasPages: !!currentEdition.pages,
        },
      );
      return match;
    }

    // If we get here, either:
    // 1. No length data (need to find edition with length), OR
    // 2. Has length but wrong format (need to find better format match)
    if (hasLength && !formatMatches) {
      logger.debug('Current edition has length but format mismatch', {
        editionId: currentEdition.id,
        currentFormat: currentEditionFormat,
        sourceFormat: sourceFormat,
        reason: 'searching_for_better_format_match',
      });
    }

    // Search for better edition (either with length data or better format match)
    const book = match.userBook.book;

    if (!book || !book.editions || book.editions.length <= 1) {
      // No other editions to check
      logger.debug(
        'No alternative editions available for cross-edition search',
        {
          bookId: book?.id,
          editionCount: book?.editions?.length || 0,
        },
      );
      return match;
    }

    const searchReason = hasLength ? 'format_mismatch' : 'missing_length_data';

    logger.debug('Searching for better edition', {
      bookId: book.id,
      bookTitle: book.title,
      currentEditionId: currentEdition.id,
      currentFormat: currentEditionFormat,
      totalEditions: book.editions.length,
      sourceFormat,
      matchType,
      searchReason,
      hasLength,
    });

    // Validate editions array (defensive programming)
    if (!Array.isArray(book.editions)) {
      logger.warn('Book editions is not an array, keeping original match', {
        bookId: book.id,
        editionsType: typeof book.editions,
      });
      return match;
    }

    // Find all editions with length data (positive values only)
    const editionsWithLength = book.editions.filter(edition => {
      // Safety check: skip malformed editions
      if (!edition || typeof edition !== 'object') {
        return false;
      }
      return !!(
        (edition.audio_seconds && edition.audio_seconds > 0) ||
        (edition.pages && edition.pages > 0)
      );
    });

    if (editionsWithLength.length === 0) {
      logger.debug('No editions with length data found', {
        bookId: book.id,
        editionsChecked: book.editions.length,
      });
      return match;
    }

    // Score editions based on format match and data quality
    const scoredEditions = editionsWithLength.map(edition => {
      let score = 0;

      // Apply format mapping if available
      const editionWithFormat = this.formatMapper
        ? { ...edition, format: this.formatMapper(edition) }
        : edition;

      const editionFormat = editionWithFormat.format;

      // Prefer editions matching source format (40 points)
      if (sourceFormat && editionFormat === sourceFormat) {
        score += 40;
      }

      // Prefer editions with both audio_seconds AND pages (30 points)
      if (edition.audio_seconds && edition.pages) {
        score += 30;
      } else if (edition.audio_seconds || edition.pages) {
        score += 15; // Has at least one type of length data
      }

      // Prefer editions with more complete data (20 points max)
      const completenessFields = [
        'asin',
        'isbn_10',
        'isbn_13',
        'format',
        'users_count',
      ];
      const completeness = completenessFields.filter(
        field => edition[field],
      ).length;
      score += (completeness / completenessFields.length) * 20;

      // Prefer more popular editions (10 points max)
      if (edition.users_count) {
        score += Math.min(10, Math.log10(edition.users_count + 1));
      }

      return {
        edition: editionWithFormat,
        score,
      };
    });

    // Sort by score descending
    scoredEditions.sort((a, b) => b.score - a.score);

    const bestEdition = scoredEditions[0];

    // Safety check: ensure we have a valid scored edition
    if (!bestEdition || !bestEdition.edition) {
      logger.warn('Scoring returned invalid result, keeping original match', {
        bookId: book.id,
        scoredCount: scoredEditions.length,
      });
      return match;
    }

    // Calculate current edition's score for comparison (if it has length)
    let currentEditionScore = 0;
    if (hasLength) {
      // Score current edition using same logic
      if (formatMatches) currentEditionScore += 40;
      if (currentEdition.audio_seconds && currentEdition.pages) {
        currentEditionScore += 30;
      } else if (currentEdition.audio_seconds || currentEdition.pages) {
        currentEditionScore += 15;
      }
      const completenessFields = [
        'asin',
        'isbn_10',
        'isbn_13',
        'format',
        'users_count',
      ];
      const completeness = completenessFields.filter(
        field => currentEdition[field],
      ).length;
      currentEditionScore += (completeness / completenessFields.length) * 20;
      if (currentEdition.users_count) {
        currentEditionScore += Math.min(
          10,
          Math.log10(currentEdition.users_count + 1),
        );
      }
    }

    // Only upgrade if new edition is significantly better
    // Require at least 5 point improvement to avoid lateral moves
    const MIN_IMPROVEMENT = 5;
    const improvement = bestEdition.score - currentEditionScore;

    if (improvement < MIN_IMPROVEMENT) {
      logger.debug('New edition not significantly better, keeping original', {
        bookId: book.id,
        currentScore: currentEditionScore.toFixed(2),
        bestScore: bestEdition.score.toFixed(2),
        improvement: improvement.toFixed(2),
        minRequired: MIN_IMPROVEMENT,
      });
      return match;
    }

    logger.debug('Found better edition with length data', {
      bookId: book.id,
      originalEditionId: currentEdition.id,
      newEditionId: bestEdition.edition.id,
      currentScore: currentEditionScore.toFixed(2),
      newScore: bestEdition.score.toFixed(2),
      improvement: improvement.toFixed(2),
      hasAudioSeconds: !!bestEdition.edition.audio_seconds,
      hasPages: !!bestEdition.edition.pages,
      formatMatch: bestEdition.edition.format === sourceFormat,
      matchType: `${matchType}_cross_edition_enriched`,
    });

    // Return enhanced match with better edition
    return {
      ...match,
      edition: bestEdition.edition,
      _originalEditionId: currentEdition.id,
      _matchType: `${matchType}_cross_edition_enriched`,
      _editionUpgraded: true,
      _upgradeReason: hasLength
        ? 'format_match_improvement'
        : 'length_data_enrichment',
      _scoreImprovement: improvement,
    };
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
   * Invalidate all cached lookup tables
   * @private
   */
  _invalidateCache() {
    this._identifierLookupCache = null;
    this._editionLookupCache = null;
    this._bookLookupCache = null;
    this._lastLibraryDataHash = null;
    logger.debug('All lookup caches invalidated');
  }

  /**
   * Find user book by edition ID using cached lookup table (optimized)
   * @param {string|number} editionId - Edition ID to find
   * @returns {Object|null} - User book or null if not found
   */
  findUserBookByEditionId(editionId) {
    const editionLookup = this._getEditionLookup();
    return editionLookup[editionId] || null;
  }

  /**
   * Find user book by book ID using cached lookup table (optimized)
   * @param {string|number} bookId - Book ID to find
   * @returns {Object|null} - User book or null if not found
   */
  findUserBookByBookId(bookId) {
    const { bookLookup } = this._getLookupTables();
    return bookLookup[bookId] || null;
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
