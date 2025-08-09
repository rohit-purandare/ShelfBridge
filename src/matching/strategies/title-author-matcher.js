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
   * @returns {Object|null} - Hardcover match object or null if not found
   */
  async findMatch(absBook, userId, findUserBookByEditionId = null) {
    // Store the user library lookup function for use in this matching session
    this._findUserBookByEditionIdImpl = findUserBookByEditionId;

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

      // 2. Cache miss - perform API search
      logger.debug(
        `Title/author cache miss for "${title}" - calling edition search API`,
      );

      const searchResults =
        await this.hardcoverClient.searchEditionsByTitleAuthor(
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
          logger.warn(
            `Error scoring search result for "${title}": ${error.message}`,
            {
              error: error.message,
              result: {
                id: result.id,
                title: result.title,
                book: result.book?.title,
              },
            },
          );
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
    const editionId = searchResult.id;
    const bookId = searchResult.book?.id;

    logger.debug('Converting search result to match format', {
      searchResultId: searchResult.id,
      searchResultTitle: searchResult.title,
      bookId: bookId,
      editionId: editionId,
      hasBookObject: !!searchResult.book,
    });

    if (!editionId) {
      logger.error('Cannot convert search result: missing edition ID', {
        searchResult: searchResult,
      });
      return null;
    }

    // Create match object
    const match = {
      userBook: {
        id: bookId || editionId, // Fallback to edition ID if book ID missing
        book: {
          title: searchResult.title || 'Unknown Title',
          id: bookId || editionId,
        },
      },
      edition: {
        id: editionId,
        format: searchResult.format || 'unknown',
      },
      _isSearchResult: true,
      _matchingScore: searchResult._matchingScore,
      _needsBookIdLookup: !bookId, // Need lookup if we don't have book ID
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
