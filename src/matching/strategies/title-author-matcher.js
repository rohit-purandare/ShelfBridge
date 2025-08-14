/**
 * Title/Author-based book matching strategy
 *
 * This strategy matches books using title and author text matching via the
 * Hardcover search API when identifier-based matching fails.
 */

import logger from '../../logger.js';
import {
  extractTitle,
  extractAuthor,
  extractNarrator,
} from '../utils/audiobookshelf-extractor.js';
import { extractAuthorFromSearchResult } from '../utils/hardcover-extractor.js';
import { calculateMatchingScore } from '../scoring/match-scorer.js';

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

    // Get configuration
    const config = this.config.title_author_matching || {};
    const confidenceThreshold = config.confidence_threshold || 0.7;
    const maxResults = config.max_search_results || 5;

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

      // Score and rank results
      const scoringErrors = [];
      const scoredResults = searchResults.map(result => {
        try {
          const score = calculateMatchingScore(
            result,
            title,
            author,
            narrator,
            absBook,
          );
          return {
            ...result,
            _matchingScore: score,
          };
        } catch (error) {
          // Collect errors instead of logging each one
          scoringErrors.push({
            error: error.message,
            resultId: result.id,
            resultTitle: result.title,
          });

          // Return result with minimum score so it's not selected
          return {
            ...result,
            _matchingScore: {
              totalScore: 0,
              breakdown: {},
              confidence: 'error',
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

      // Sort by confidence score
      scoredResults.sort(
        (a, b) => b._matchingScore.totalScore - a._matchingScore.totalScore,
      );

      // Find best match above threshold
      const bestMatch = scoredResults[0];
      if (
        bestMatch &&
        bestMatch._matchingScore.totalScore >= confidenceThreshold * 100
      ) {
        // Clean user-facing log
        logger.info(`📚 Found "${title}" in Hardcover by title/author search`, {
          match: bestMatch.title,
          confidence: `${bestMatch._matchingScore.totalScore.toFixed(1)}%`,
        });

        // Detailed breakdown for debugging only
        logger.debug(`Title/author match details for "${title}"`, {
          confidence: bestMatch._matchingScore.totalScore,
          breakdown: bestMatch._matchingScore.breakdown,
          searchMetadata: bestMatch._searchMetadata,
        });

        // 3. Cache successful match
        await this._cacheSuccessfulMatch(
          userId,
          titleAuthorId,
          title,
          bestMatch,
          author,
        );

        // Convert search result to match format
        const convertedMatch = this._convertSearchResultToMatch(bestMatch);

        if (!convertedMatch) {
          logger.error(
            `Failed to convert search result to match format for "${title}"`,
            {
              bestMatchId: bestMatch.id,
              bestMatchTitle: bestMatch.title,
            },
          );
          return null;
        }

        return {
          ...convertedMatch,
          _matchType: 'title_author',
          _tier: 3,
          _needsScoring: true,
        };
      } else {
        const bestScore = bestMatch ? bestMatch._matchingScore.totalScore : 0;
        logger.debug(`Best title/author match for "${title}" below threshold`, {
          bestScore: bestScore,
          threshold: confidenceThreshold * 100,
          hardcoverTitle: bestMatch ? bestMatch.title : 'N/A',
        });
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
