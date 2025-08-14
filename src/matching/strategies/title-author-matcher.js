/**
 * Title/Author-based book matching strategy (Two-Stage Approach)
 *
 * This strategy implements a two-stage matching process:
 * Stage 1: Book Identification - Uses focused scoring to identify the correct book
 * Stage 2: Edition Selection - Selects the best edition/format using preferences
 *
 * This approach separates concerns and reduces false negatives where good book
 * matches fail due to edition-specific metadata issues.
 */

import logger from '../../logger.js';
import {
  extractTitle,
  extractAuthor,
  extractNarrator,
  detectUserBookFormat,
} from '../utils/audiobookshelf-extractor.js';
import { extractAuthorFromSearchResult } from '../utils/hardcover-extractor.js';
import { calculateBookIdentificationScore } from '../scoring/book-identification-scorer.js';
import { selectBestEdition } from '../edition-selector.js';

/**
 * Title/Author Matching Strategy - Tier 3
 * Attempts to match books using title and author text matching
 */
export class TitleAuthorMatcher {
  constructor(hardcoverClient, cache, config) {
    this.hardcoverClient = hardcoverClient;
    this.cache = cache;
    this.config = config;
  }

  /**
   * Attempt to match a book using title and author search
   * @param {Object} absBook - Audiobookshelf book object
   * @param {string} userId - User ID for caching
   * @param {Function} findUserBookByEditionId - Function to find user books by edition ID
   * @param {Function} findUserBookByBookId - Function to find user books by book ID
   * @returns {Object|null} - Hardcover match object or null if not found
   */
  async findMatch(
    absBook,
    userId,
    findUserBookByEditionId = null,
    findUserBookByBookId = null,
  ) {
    // Store the user library lookup functions for use in this matching session
    this._findUserBookByEditionIdImpl = findUserBookByEditionId;
    this._findUserBookByBookIdImpl = findUserBookByBookId;

    const title = extractTitle(absBook);
    const author = extractAuthor(absBook);
    const narrator = extractNarrator(absBook);

    if (!title) {
      logger.debug('Cannot perform title/author matching: no title found');
      return null;
    }

    // Get configuration for two-stage matching
    const config = this.config.title_author_matching || {};
    const confidenceThreshold = config.confidence_threshold || 0.7; // Used as book ID threshold
    const maxResults = config.max_search_results || 5;

    // Detect user's book format for edition selection
    const userFormat = detectUserBookFormat(absBook);

    try {
      // 1. Check existing cache for successful title/author match
      const titleAuthorId = this._generateTitleAuthorIdentifier(title, author);
      logger.debug(
        `Checking cache for title/author: "${title}" by "${author}"`,
        {
          titleAuthorId: titleAuthorId,
          user_id: userId,
        },
      );

      const cachedBookInfo = await this.cache.getCachedBookInfo(
        userId,
        titleAuthorId,
        title,
        'title_author',
      );

      if (cachedBookInfo && cachedBookInfo.edition_id) {
        logger.debug(`Found cached title/author match for "${title}"`, {
          editionId: cachedBookInfo.edition_id,
        });

        return await this._handleCachedMatch(
          cachedBookInfo,
          title,
          titleAuthorId,
        );
      } else {
        logger.debug(`No cached title/author match found for "${title}"`, {
          cachedBookInfo: cachedBookInfo,
        });
      }

      // 2. Cache miss - perform API search using the reliable search API
      logger.debug(
        `Title/author cache miss for "${title}" - using search API (more reliable than direct GraphQL)`,
      );

      const searchResults = await this.hardcoverClient.searchBooksForMatching(
        title,
        author,
        narrator,
        maxResults,
      );

      if (searchResults.length === 0) {
        logger.debug(`No search results found for "${title}"`);
        return null;
      }

      // ========================================================================
      // STAGE 1: BOOK IDENTIFICATION SCORING
      // ========================================================================

      logger.debug(
        `Stage 1: Book identification for "${title}" (threshold: ${(confidenceThreshold * 100).toFixed(1)}%, format: ${userFormat})`,
      );

      const scoringErrors = [];
      const bookScoredResults = searchResults.map(result => {
        try {
          // Use book identification scoring instead of full scoring
          const bookScore = calculateBookIdentificationScore(
            result,
            title,
            author,
            absBook,
          );

          return {
            ...result,
            _bookIdentificationScore: bookScore,
          };
        } catch (error) {
          scoringErrors.push({
            error: error.message,
            resultId: result.id,
            resultTitle: result.title,
          });

          // Return result with minimum score so it's not selected
          return {
            ...result,
            _bookIdentificationScore: {
              totalScore: 0,
              breakdown: {},
              confidence: 'none',
              isBookMatch: false,
            },
          };
        }
      });

      // Log scoring errors once with summary
      if (scoringErrors.length > 0) {
        const uniqueErrors = [...new Set(scoringErrors.map(e => e.error))];
        logger.warn(
          `Scoring errors for "${title}": ${scoringErrors.length} results failed (${uniqueErrors.length} unique errors)`,
          {
            errorCount: scoringErrors.length,
            uniqueErrors,
            // Only include first few failed results to avoid spam
            sampleFailures: scoringErrors.slice(0, 2).map(e => ({
              id: e.resultId,
              title: e.resultTitle,
              error: e.error,
            })),
          },
        );
      }

      // Sort by book identification score descending
      bookScoredResults.sort(
        (a, b) =>
          b._bookIdentificationScore.totalScore -
          a._bookIdentificationScore.totalScore,
      );

      // Find best book match above identification threshold
      const bestBookMatch = bookScoredResults[0];

      if (
        bestBookMatch &&
        bestBookMatch._bookIdentificationScore.isBookMatch &&
        bestBookMatch._bookIdentificationScore.totalScore >=
          confidenceThreshold * 100
      ) {
        // ====================================================================
        // STAGE 2: EDITION SELECTION
        // ====================================================================

        logger.debug(
          `Stage 2: Edition selection for "${title}" (book ID: ${bestBookMatch.id})`,
        );

        let selectedEditionResult = null;
        let finalMatch = null;

        // Check if we already have editions data in the search result
        if (bestBookMatch.editions && bestBookMatch.editions.length > 0) {
          // Use the edition selector to pick the best edition
          selectedEditionResult = selectBestEdition(
            bestBookMatch,
            absBook,
            userFormat,
          );
        } else {
          // Need to fetch editions from the book ID
          logger.debug(`Fetching editions for book ID ${bestBookMatch.id}`);
          try {
            const editionData =
              await this.hardcoverClient.getPreferredEditionFromBookId(
                bestBookMatch.id,
                userFormat,
              );

            if (editionData) {
              selectedEditionResult = {
                bookId: editionData.bookId,
                title: editionData.title,
                edition: editionData.edition,
                selectionReason: {
                  automatic: `Preferred ${userFormat} edition from book ID`,
                },
                alternativeEditions: [],
              };
            }
          } catch (error) {
            logger.warn(
              `Failed to fetch editions for book ID ${bestBookMatch.id}:`,
              error.message,
            );
          }
        }

        if (!selectedEditionResult) {
          logger.warn(
            `No suitable edition found for "${title}" despite successful book identification`,
          );
          return null;
        }

        // Determine final confidence based on book identification
        const bookConfidence =
          bestBookMatch._bookIdentificationScore.totalScore;
        const isHighConfidence = bookConfidence >= 75; // High confidence threshold

        // Log successful match with two-stage details
        logger.info(`📚 Found "${title}" via two-stage matching`, {
          bookMatch: selectedEditionResult.title,
          bookConfidence: `${bookConfidence.toFixed(1)}%`,
          finalConfidence: isHighConfidence ? 'high' : 'medium',
          selectedEdition: selectedEditionResult.edition.id,
          editionFormat:
            selectedEditionResult.edition.reading_format?.format ||
            selectedEditionResult.edition.physical_format,
        });

        // Detailed breakdown for debugging
        logger.debug(`Two-stage match details for "${title}"`, {
          stage1: {
            confidence: bookConfidence,
            breakdown: bestBookMatch._bookIdentificationScore.breakdown,
            threshold: confidenceThreshold * 100,
          },
          stage2: {
            selectedEdition: selectedEditionResult.edition.id,
            selectionReason: selectedEditionResult.selectionReason,
            alternativeEditions:
              selectedEditionResult.alternativeEditions?.length || 0,
          },
        });

        // Create the match object with edition details
        finalMatch = {
          userBook: null, // Will be set if user already has this book
          edition: {
            id: selectedEditionResult.edition.id,
            asin: selectedEditionResult.edition.asin,
            isbn_10: selectedEditionResult.edition.isbn_10,
            isbn_13: selectedEditionResult.edition.isbn_13,
            pages: selectedEditionResult.edition.pages,
            audio_seconds: selectedEditionResult.edition.audio_seconds,
            format:
              selectedEditionResult.edition.reading_format?.format ||
              selectedEditionResult.edition.physical_format ||
              'unknown',
            users_count: selectedEditionResult.edition.users_count,
          },
          book: {
            id: selectedEditionResult.bookId,
            title: selectedEditionResult.title,
          },
          _matchType: 'title_author_two_stage',
          _tier: 3,
          _bookIdentificationScore: bestBookMatch._bookIdentificationScore,
          _editionSelectionResult: selectedEditionResult,
          _needsScoring: false, // Already scored in two stages
        };

        // Cache successful match using edition ID
        await this._cacheSuccessfulMatch(
          userId,
          titleAuthorId,
          title,
          finalMatch,
          author,
        );

        return finalMatch;
      } else {
        const bestScore = bestBookMatch
          ? bestBookMatch._bookIdentificationScore.totalScore
          : 0;
        logger.debug(
          `Best book identification for "${title}" below threshold`,
          {
            bookScore: bestScore.toFixed(1),
            threshold: (confidenceThreshold * 100).toFixed(1),
            hardcoverTitle: bestBookMatch ? bestBookMatch.title : 'N/A',
            isBookMatch: bestBookMatch
              ? bestBookMatch._bookIdentificationScore.isBookMatch
              : false,
          },
        );
        return null;
      }
    } catch (error) {
      logger.warn(
        `Title/author search failed for "${title}": ${error.message}`,
        {
          error: error.message,
          stack: error.stack,
          targetTitle: title,
          targetAuthor: author,
          targetNarrator: narrator,
        },
      );
      return null;
    }
  }

  /**
   * Handle cached match result
   * @param {Object} cachedBookInfo - Cached book information
   * @param {string} title - Book title
   * @param {string} titleAuthorId - Title/author identifier
   * @returns {Object|null} - Match object or null
   * @private
   */
  async _handleCachedMatch(cachedBookInfo, title, titleAuthorId) {
    logger.debug(`Title/author cache HIT for "${title}"`, {
      identifier: titleAuthorId,
      editionId: cachedBookInfo.edition_id,
      cached: 'CACHE_HIT',
    });

    // Check if this cached edition already exists in user's current Hardcover library
    const existingUserBook = this._findUserBookByEditionId(
      cachedBookInfo.edition_id,
    );

    if (existingUserBook) {
      // Book is already in library - use real user book ID
      logger.debug(`Cached edition found in current library for "${title}"`, {
        editionId: cachedBookInfo.edition_id,
        realUserBookId: existingUserBook.id,
        libraryTitle: existingUserBook.book.title,
      });

      return {
        userBook: existingUserBook,
        edition: {
          id: cachedBookInfo.edition_id,
          format: 'audiobook',
        },
        _isSearchResult: false,
        _matchingScore: { totalScore: 85, confidence: 'high' },
        _needsBookIdLookup: false,
        _matchType: 'title_author_cached',
        _tier: 3,
      };
    } else {
      // Book not in current library - needs auto-add
      logger.debug(
        `Cached edition NOT found in current library for "${title}"`,
        {
          editionId: cachedBookInfo.edition_id,
          willAutoAdd: true,
        },
      );

      return {
        userBook: {
          id: cachedBookInfo.edition_id,
          book: { title: cachedBookInfo.title },
        },
        edition: {
          id: cachedBookInfo.edition_id,
          format: 'audiobook',
        },
        _isSearchResult: true,
        _matchingScore: { totalScore: 85, confidence: 'high' },
        _needsBookIdLookup: true,
        _matchType: 'title_author_cached',
        _tier: 3,
      };
    }
  }

  /**
   * Cache successful match for future use
   * @param {string} userId - User ID
   * @param {string} titleAuthorId - Title/author identifier
   * @param {string} title - Book title
   * @param {Object} bestMatch - Best matching result
   * @param {string} author - Book author
   * @private
   */
  async _cacheSuccessfulMatch(userId, titleAuthorId, title, bestMatch, author) {
    try {
      await this.cache.storeEditionMapping(
        userId,
        titleAuthorId,
        title,
        bestMatch.id,
        'title_author',
        extractAuthorFromSearchResult(bestMatch) || author || '',
      );
      logger.debug(`Cached title/author match for "${title}"`, {
        identifier: titleAuthorId,
        editionId: bestMatch.id,
      });
    } catch (cacheError) {
      logger.warn(
        `Failed to cache title/author match for "${title}": ${cacheError.message}`,
      );
      // Continue anyway - caching failure shouldn't break sync
    }
  }

  /**
   * Convert search result to match format
   * @param {Object} searchResult - Hardcover search result
   * @returns {Object|null} - Match object or null
   * @private
   */
  _convertSearchResultToMatch(searchResult) {
    // All search results now come from the search API (book-level results)
    const bookId = searchResult.id;
    const editionId = null; // Search API returns book IDs, not edition IDs

    logger.debug('Converting search API result', {
      bookId: bookId,
      searchResultTitle: searchResult.title,
      hasContributions: !!(
        searchResult.contributions && searchResult.contributions.length > 0
      ),
    });

    if (!bookId) {
      logger.error('Cannot convert search result: missing book ID', {
        searchResult: searchResult,
      });
      return null;
    }

    // Skip edition-level check since search API returns book-level results

    // If we have a book ID, check if we have any edition of this book
    if (bookId) {
      const existingByBook = this._findUserBookByBookId(bookId);
      if (existingByBook) {
        logger.debug('Found different edition of same book in user library', {
          searchResultTitle: searchResult.title,
          searchEditionId: editionId,
          foundUserBookId: existingByBook.id,
          foundBookId: existingByBook.book.id,
          libraryTitle: existingByBook.book.title,
        });

        // Find the user's preferred edition (first one found)
        const userEdition = existingByBook.book.editions?.[0];
        const userEditionId = userEdition?.id || editionId;

        return {
          userBook: existingByBook,
          edition: {
            id: userEditionId,
            format: userEdition?.format || searchResult.format || 'audiobook',
          },
          _isSearchResult: false, // Use existing library book
          _matchingScore: searchResult._matchingScore,
          _needsBookIdLookup: false,
          _matchType: 'title_author_different_edition',
          _tier: 3,
        };
      }
    }

    // No existing edition found - this will need auto-add
    logger.debug('No existing edition found, will need auto-add', {
      searchResultTitle: searchResult.title,
      searchEditionId: editionId,
      searchBookId: bookId,
    });

    // Create match object for auto-add (search API results are book-level)
    const match = {
      userBook: {
        id: bookId,
        book: {
          title: searchResult.title || 'Unknown Title',
          id: bookId,
          contributions: searchResult.contributions || [],
        },
      },
      edition: {
        id: bookId, // Use book ID as placeholder until we can get proper edition info
        format: 'unknown', // Will be determined during auto-add process
      },
      _isSearchResult: true,
      _matchingScore: searchResult._matchingScore,
      _needsBookIdLookup: false, // We have the book ID
      _needsEditionIdLookup: true, // Always need edition lookup for search API results
      _matchType: 'title_author_auto_add',
      _tier: 3,
    };

    return match;
  }

  /**
   * Generate title/author identifier for caching using the authoritative cache implementation
   * @param {string} title - Book title
   * @param {string} author - Book author
   * @returns {string} - Cache identifier
   * @private
   */
  _generateTitleAuthorIdentifier(title, author) {
    // Use the authoritative implementation from BookCache
    return this.cache.generateTitleAuthorIdentifier(title, author);
  }

  /**
   * Find user book by edition ID using the provided implementation
   * @param {string} editionId - Edition ID to find
   * @returns {Object|null} - User book or null
   * @private
   */
  _findUserBookByEditionId(editionId) {
    // Use the implementation provided by BookMatcher if available
    if (this._findUserBookByEditionIdImpl) {
      return this._findUserBookByEditionIdImpl(editionId);
    }

    logger.warn(
      'No user library lookup function available in TitleAuthorMatcher',
    );
    return null;
  }

  /**
   * Find user book by book ID using the provided implementation
   * @param {string} bookId - Book ID to find
   * @returns {Object|null} - User book or null
   * @private
   */
  _findUserBookByBookId(bookId) {
    // Use the implementation provided by BookMatcher if available
    if (this._findUserBookByBookIdImpl) {
      return this._findUserBookByBookIdImpl(bookId);
    }

    logger.warn('No book ID lookup function available in TitleAuthorMatcher');
    return null;
  }

  /**
   * Get the strategy name
   * @returns {string} - Strategy name
   */
  getName() {
    return 'Title/Author Matcher';
  }

  /**
   * Get the strategy tier (priority level)
   * @returns {number} - Tier number (3 = lowest priority)
   */
  getTier() {
    return 3;
  }
}
