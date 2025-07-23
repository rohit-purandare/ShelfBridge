import { AudiobookshelfClient } from './audiobookshelf-client.js';
import { HardcoverClient } from './hardcover-client.js';
import { BookCache } from './book-cache.js';
import {
  normalizeIsbn,
  normalizeAsin,
  extractIsbn,
  extractAsin,
  extractTitle,
  extractAuthor,
  extractNarrator,
  calculateCurrentPage,
  calculateCurrentSeconds,
  calculateMatchingScore,
  formatDurationForLogging,
} from './utils.js';
import { DateTime } from 'luxon';
import logger from './logger.js';

export class SyncManager {
  constructor(user, globalConfig, dryRun = false, verbose = false) {
    this.user = user;
    this.userId = user.id;
    this.globalConfig = globalConfig;
    this.dryRun = dryRun;
    this.verbose = verbose;
    this.timezone = globalConfig.timezone || 'UTC';

    // Resolve library configuration (user-specific overrides global)
    const libraryConfig = user.libraries || globalConfig.libraries || null;

    // Initialize clients
    this.audiobookshelf = new AudiobookshelfClient(
      user.abs_url,
      user.abs_token,
      globalConfig.audiobookshelf_semaphore || 5,
      globalConfig.max_books_to_fetch || 500,
      globalConfig.page_size || 100,
      globalConfig.audiobookshelf_rate_limit || 600,
      {}, // rereadConfig - keep empty for now
      libraryConfig,
    );
    this.hardcover = new HardcoverClient(
      user.hardcover_token,
      globalConfig.hardcover_semaphore || 1,
      globalConfig.hardcover_rate_limit || 55,
    );

    // Initialize cache
    this.cache = new BookCache();

    // Timing data
    this.timingData = {};

    logger.debug('SyncManager initialized', {
      userId: this.userId,
      dryRun: this.dryRun,
      timezone: this.timezone,
      libraryConfig: libraryConfig,
    });
  }

  _isZeroProgress(progressValue) {
    // Consider undefined, null, or values below threshold as "zero progress"
    // Note: 0% should be considered zero progress for auto-add decisions
    if (progressValue === undefined || progressValue === null) {
      return true;
    }

    if (typeof progressValue === 'number') {
      // Values at or below threshold are considered zero progress
      return progressValue <= (this.globalConfig.min_progress_threshold || 5.0);
    }

    return true;
  }

  async syncProgress() {
    const startTime = Date.now();
    logger.debug(`Starting sync for user: ${this.userId}`);
    console.log(`🔄 Starting sync for ${this.userId}`);

    // Increment sync count and check if deep scan is needed
    const syncTracking = await this.cache.incrementSyncCount(this.userId);
    const shouldDeepScan =
      this.globalConfig.force_sync ||
      (await this.cache.shouldPerformDeepScan(
        this.userId,
        this.globalConfig.deep_scan_interval || 10,
      ));

    if (shouldDeepScan) {
      if (
        syncTracking.sync_count >= (this.globalConfig.deep_scan_interval || 10)
      ) {
        console.log(
          `🔍 Performing deep scan (periodic sync #${syncTracking.sync_count})`,
        );
      } else if (this.globalConfig.force_sync) {
        console.log(`🔍 Performing deep scan (forced)`);
      } else {
        console.log(`🔍 Performing deep scan (initial sync)`);
      }
    } else {
      console.log(`⚡ Performing fast sync`);
    }

    const result = {
      books_processed: 0,
      books_synced: 0,
      books_completed: 0,
      books_auto_added: 0,
      books_skipped: 0,
      errors: [],
      timing: {},
      book_details: [], // Add detailed book results
      deep_scan_performed: shouldDeepScan,
    };

    try {
      // Get books from Audiobookshelf
      const absBooks =
        await this.audiobookshelf.getReadingProgress(shouldDeepScan);

      // Record the deep scan to reset counter if one was performed
      if (shouldDeepScan) {
        await this.cache.recordDeepScan(this.userId);
      }

      if (!absBooks || absBooks.length === 0) {
        logger.debug('No books found in Audiobookshelf');
        console.log('No books found in Audiobookshelf.');
        return result;
      }

      // Extract filtering statistics if available
      const filteringStats =
        absBooks.length > 0 && absBooks[0]._filteringStats
          ? absBooks[0]._filteringStats
          : null;
      if (filteringStats) {
        result.total_books_in_library = filteringStats.totalBooksInLibrary;
        result.books_with_progress = filteringStats.totalWithProgress;
        result.books_in_progress = filteringStats.inProgressBooks; // Currently reading
        result.all_completed_books = filteringStats.allCompletedBooks;
        result.books_completed_filtered = filteringStats.completedBooksFiltered;
        result.books_never_started = filteringStats.booksNeverStarted; // Actually never started
        result.books_passed_filter = filteringStats.booksPassingFilter;

        // Add library filtering information
        if (filteringStats.libraryFiltering) {
          result.library_filtering = filteringStats.libraryFiltering;
        }

        // Store stats in cache if this was a deep scan
        if (shouldDeepScan) {
          await this.cache.storeLibraryStats(this.userId, filteringStats);
          result.stats_source = 'deep_scan';
        } else {
          result.stats_source = 'realtime';
        }
      } else {
        // Fast scan - try to get cached library stats
        if (!shouldDeepScan) {
          const cachedStats = await this.cache.getLibraryStats(this.userId);
          if (cachedStats) {
            result.total_books_in_library = cachedStats.totalBooksInLibrary;
            result.books_with_progress = cachedStats.totalWithProgress;
            result.books_in_progress = cachedStats.inProgressBooks;
            result.all_completed_books = cachedStats.allCompletedBooks;
            result.books_never_started = cachedStats.booksNeverStarted;
            result.stats_source = 'cached';
            result.stats_last_updated = cachedStats.lastUpdated;

            logger.debug(
              `Using cached library stats for user ${this.userId}`,
              cachedStats,
            );
          } else {
            result.stats_source = 'none';
          }
        }
      }

      // For fast scans, enhance realtime data with cached completed book counts
      if (!shouldDeepScan && filteringStats) {
        const cachedStats = await this.cache.getLibraryStats(this.userId);
        if (cachedStats && cachedStats.allCompletedBooks > 0) {
          // Update the completed books count from cache since fast scan doesn't find them
          result.all_completed_books = cachedStats.allCompletedBooks;
          result.stats_source = 'mixed'; // Indicate mixed data source
          result.stats_last_updated = cachedStats.lastUpdated;

          logger.debug(
            `Enhanced fast scan with cached completed books: ${cachedStats.allCompletedBooks}`,
          );
        }
      }

      // Filter out metadata-only entries for actual processing
      const realBooks = absBooks.filter(book => !book._isMetadataOnly);
      if (realBooks.length === 0 && !filteringStats) {
        logger.debug('No books found that need syncing');
        console.log('No books found that need syncing.');
        return result;
      }

      // Limit books to process if configured
      let booksToProcess = realBooks;
      const maxBooks = this.globalConfig.max_books_to_process;
      if (maxBooks && maxBooks > 0 && realBooks.length > maxBooks) {
        booksToProcess = realBooks.slice(0, maxBooks);
        logger.info(
          `Limiting sync to first ${maxBooks} books (${realBooks.length} total available)`,
          {
            totalBooks: realBooks.length,
            maxBooks: maxBooks,
            dryRun: this.dryRun,
          },
        );
        if (this.verbose) {
          console.log(
            `📚 Limiting sync to first ${maxBooks} books (${realBooks.length} total available)`,
          );
        }
      }

      // Get books from Hardcover
      const hardcoverBooks = await this.hardcover.getUserBooks();
      if (!hardcoverBooks || hardcoverBooks.length === 0) {
        logger.warn('No books found in Hardcover library');
      }

      // Create identifier lookup
      const identifierLookup = this._createIdentifierLookup(hardcoverBooks);

      logger.debug(
        `Processing ${booksToProcess.length} books from Audiobookshelf`,
      );
      if (this.verbose) {
        console.log(
          `Processing ${booksToProcess.length} books from Audiobookshelf...`,
        );
      }

      // Process books in parallel or sequential based on configuration
      if (this.globalConfig.parallel) {
        logger.debug('Using parallel processing', {
          workers: this.globalConfig.workers || 3,
        });
        await this._syncBooksParallel(
          booksToProcess,
          identifierLookup,
          result,
          null,
        );
      } else {
        logger.debug('Using sequential processing');
        await this._syncBooksSequential(
          booksToProcess,
          identifierLookup,
          result,
          null,
        );
      }

      // Log final summary with book details
      const duration = (Date.now() - startTime) / 1000;
      result.timing.total = duration;

      logger.debug('Sync completed', {
        summary: {
          books_processed: result.books_processed,
          books_synced: result.books_synced,
          books_completed: result.books_completed,
          books_auto_added: result.books_auto_added,
          books_skipped: result.books_skipped,
          errors: result.errors.length,
          duration: `${duration.toFixed(1)}s`,
        },
        book_breakdown: this._generateBookBreakdown(result.book_details),
      });
      console.log(
        `\n✅ Sync complete for user: ${this.userId} in ${duration.toFixed(1)}s`,
      );
      return result;
    } catch (error) {
      logger.error('Sync failed', {
        error: error.message,
        stack: error.stack,
        userId: this.userId,
      });
      result.errors.push(error.message);
      console.log(
        `\n❌ Sync failed for user: ${this.userId}: ${error.message}`,
      );
      return result;
    }
  }

  _createIdentifierLookup(hardcoverBooks) {
    const lookup = {};

    for (const userBook of hardcoverBooks) {
      const book = userBook.book;
      if (!book || !book.editions) continue;

      for (const edition of book.editions) {
        // Add ISBN-10
        if (edition.isbn_10) {
          const normalizedIsbn = normalizeIsbn(edition.isbn_10);
          if (normalizedIsbn) {
            lookup[normalizedIsbn] = { userBook, edition };
          }
        }

        // Add ISBN-13
        if (edition.isbn_13) {
          const normalizedIsbn = normalizeIsbn(edition.isbn_13);
          if (normalizedIsbn) {
            lookup[normalizedIsbn] = { userBook, edition };
          }
        }

        // Add ASIN
        if (edition.asin) {
          const normalizedAsin = normalizeAsin(edition.asin);
          if (normalizedAsin) {
            lookup[normalizedAsin] = { userBook, edition };
          }
        }
      }
    }

    return lookup;
  }

  /**
   * Find a book in the Hardcover library using identifiers and title/author matching
   * @param {Object} absBook - Audiobookshelf book object
   * @param {Object} identifierLookup - Lookup table of identifiers to Hardcover books
   * @returns {Object|null} - Hardcover match object or null if not found
   */
  async _findBookInHardcover(absBook, identifierLookup) {
    const identifiers = this._extractBookIdentifier(absBook);
    const title = extractTitle(absBook) || 'Unknown Title';

    logger.debug(`Searching for ${title} in Hardcover library`, {
      identifiers: identifiers,
    });

    // 1. Try ASIN first (for audiobooks)
    if (identifiers.asin && identifierLookup[identifiers.asin]) {
      const match = identifierLookup[identifiers.asin];
      logger.debug(`Found ASIN match for ${title}`, {
        asin: identifiers.asin,
        hardcoverTitle: match.userBook.book.title,
        userBookId: match.userBook.id,
        editionId: match.edition.id,
      });
      return match;
    }

    // 2. Fall back to ISBN
    if (identifiers.isbn && identifierLookup[identifiers.isbn]) {
      const match = identifierLookup[identifiers.isbn];
      logger.debug(`Found ISBN match for ${title}`, {
        isbn: identifiers.isbn,
        hardcoverTitle: match.userBook.book.title,
        userBookId: match.userBook.id,
        editionId: match.edition.id,
      });
      return match;
    }

    // 3. NEW: Try title/author matching if enabled
    const titleAuthorConfig = this.globalConfig.title_author_matching || {};
    if (titleAuthorConfig.enabled !== false) {
      // Default enabled
      logger.debug(`Attempting title/author matching for ${title}`);
      const titleAuthorMatch = await this._findBookByTitleAuthor(absBook);
      if (titleAuthorMatch) {
        return titleAuthorMatch;
      }
    }

    logger.debug(`No match found for ${title} in Hardcover library`, {
      searchedIdentifiers: identifiers,
    });
    return null;
  }

  /**
   * Find a book using title/author matching via Hardcover search API
   * @param {Object} absBook - Audiobookshelf book object
   * @returns {Object|null} - Hardcover match object or null if not found
   */
  async _findBookByTitleAuthor(absBook) {
    const title = extractTitle(absBook);
    const author = extractAuthor(absBook);
    const narrator = extractNarrator(absBook);

    if (!title) {
      logger.debug('Cannot perform title/author matching: no title found');
      return null;
    }

    // Get configuration
    const config = this.globalConfig.title_author_matching || {};
    const confidenceThreshold = config.confidence_threshold || 0.7; // Raised from 0.6 to 0.7 for better precision
    const maxResults = config.max_search_results || 5;

    try {
      // 1. Check existing cache for successful title/author match
      const titleAuthorId = this.cache.generateTitleAuthorIdentifier(
        title,
        author,
      );
      const cachedBookInfo = await this.cache.getCachedBookInfo(
        this.userId,
        titleAuthorId,
        title,
        'title_author',
      );

      if (cachedBookInfo && cachedBookInfo.edition_id) {
        logger.debug(`Title/author cache HIT for "${title}"`, {
          identifier: titleAuthorId,
          editionId: cachedBookInfo.edition_id,
          cached: 'CACHE_HIT',
        });

        // Convert cached edition to match format
        return {
          userBook: {
            id: cachedBookInfo.edition_id,
            book: { title: cachedBookInfo.title },
          },
          edition: {
            id: cachedBookInfo.edition_id,
            format: 'audiobook', // We'll determine actual format later
          },
          _isSearchResult: true,
          _matchingScore: { totalScore: 85, confidence: 'high' }, // Cached results are trusted
        };
      }

      // 2. Cache miss - perform API search
      logger.debug(
        `Title/author cache miss for "${title}" - calling edition search API`,
      );
      const searchResults = await this.hardcover.searchEditionsByTitleAuthor(
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

        // 3. Cache successful match in existing books table for future performance
        try {
          await this.cache.storeEditionMapping(
            this.userId,
            titleAuthorId,
            title, // Use the original book title from Audiobookshelf
            bestMatch.id, // edition_id
            'title_author',
            bestMatch.author_names?.[0] || author || '',
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

        // Convert search result to match format compatible with existing code
        return this._convertSearchResultToMatch(bestMatch);
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
      );
      return null; // Graceful fallback
    }
  }

  /**
   * Convert search result to match format compatible with existing matching code
   * @param {Object} searchResult - Hardcover search result with matching score
   * @returns {Object} - Match object in expected format
   */
  _convertSearchResultToMatch(searchResult) {
    // Create a simplified match object that works with existing code
    // Note: This won't have the full userBook structure since it's from search, not user library
    return {
      edition: {
        id: searchResult.id || 'search-result',
        format: searchResult.format || 'unknown',
        pages: searchResult.pages || null,
        audio_seconds: searchResult.audio_seconds || null,
        isbn_10: searchResult.isbn_10 || null,
        isbn_13: searchResult.isbn_13 || null,
        asin: searchResult.asin || null,
      },
      userBook: {
        id: null, // Will be created during auto-add process
        book: {
          id: searchResult.book?.id || searchResult.id,
          title: searchResult.title,
          contributions: searchResult.contributions || [],
        },
      },
      _isSearchResult: true, // Flag to indicate this came from search, not user library
      _matchingScore: searchResult._matchingScore,
    };
  }

  /**
   * Extract book identifiers (ISBN and ASIN) from Audiobookshelf book object
   * @param {Object} absBook - Audiobookshelf book object
   * @returns {Object} - Object containing isbn and asin properties
   */
  _extractBookIdentifier(absBook) {
    const identifiers = {
      isbn: null,
      asin: null,
    };

    try {
      // Extract ISBN
      const isbn = extractIsbn(absBook);
      if (isbn) {
        const normalizedIsbn = normalizeIsbn(isbn);
        if (normalizedIsbn) {
          identifiers.isbn = normalizedIsbn;
        }
      }

      // Extract ASIN
      const asin = extractAsin(absBook);
      if (asin) {
        const normalizedAsin = normalizeAsin(asin);
        if (normalizedAsin) {
          identifiers.asin = normalizedAsin;
        }
      }

      logger.debug('Extracted book identifiers', {
        title: extractTitle(absBook),
        isbn: identifiers.isbn,
        asin: identifiers.asin,
      });
    } catch (error) {
      logger.error('Error extracting book identifiers', {
        error: error.message,
        title: extractTitle(absBook),
      });
    }

    return identifiers;
  }

  /**
   * Extract author information from book data
   * @param {Object} absBook - Audiobookshelf book object
   * @param {Object} hardcoverMatch - Hardcover match object (optional)
   * @returns {string|null} - Author name or null if not found
   */
  _extractAuthorFromData(absBook, hardcoverMatch = null) {
    let author = null;

    try {
      // First try to get author from Audiobookshelf
      if (absBook) {
        author = extractAuthor(absBook);
        if (author) {
          logger.debug('Extracted author from Audiobookshelf', {
            title: extractTitle(absBook),
            author: author,
          });
          return author;
        }
      }

      // Fall back to Hardcover data if available
      if (
        hardcoverMatch &&
        hardcoverMatch.userBook &&
        hardcoverMatch.userBook.book
      ) {
        const book = hardcoverMatch.userBook.book;
        if (book.contributions && book.contributions.length > 0) {
          const authorContribution = book.contributions.find(c => c.author);
          if (authorContribution && authorContribution.author) {
            author = authorContribution.author.name;
            logger.debug('Extracted author from Hardcover', {
              title: book.title,
              author: author,
            });
            return author;
          }
        }
      }

      logger.debug('No author found in book data', {
        title: absBook ? extractTitle(absBook) : 'Unknown',
      });
    } catch (error) {
      logger.error('Error extracting author from book data', {
        error: error.message,
        title: absBook ? extractTitle(absBook) : 'Unknown',
      });
    }

    return author;
  }

  /**
   * Format timestamp for display using configured timezone
   * @param {string|number} timestamp - Timestamp value (ISO string or milliseconds)
   * @returns {string} - Formatted date string for display
   */
  _formatTimestampForDisplay(timestamp) {
    if (!timestamp) return 'N/A';

    try {
      let dateTime;

      if (typeof timestamp === 'string') {
        // Handle ISO string or timestamp as string
        if (timestamp.includes('T') || timestamp.includes('-')) {
          // ISO string format - these are typically in UTC or have timezone info
          dateTime = DateTime.fromISO(timestamp);
          if (!dateTime.isValid) {
            // Try parsing as SQL format or other common formats
            dateTime = DateTime.fromSQL(timestamp);
            if (!dateTime.isValid) {
              dateTime = DateTime.fromFormat(timestamp, 'yyyy-LL-dd HH:mm:ss');
            }
          }
        } else {
          // Timestamp as string - assume UTC milliseconds
          const tsNumber = parseInt(timestamp);
          if (!isNaN(tsNumber)) {
            dateTime = DateTime.fromMillis(tsNumber, { zone: 'utc' });
          } else {
            return 'Invalid timestamp';
          }
        }
      } else if (typeof timestamp === 'number') {
        // Timestamp in milliseconds - assume UTC
        dateTime = DateTime.fromMillis(timestamp, { zone: 'utc' });
      } else {
        return 'Invalid timestamp';
      }

      if (!dateTime.isValid) {
        return 'Invalid timestamp';
      }

      // Convert to configured timezone and format
      const configuredTimezone = this.timezone || 'UTC';
      const localTime = dateTime.setZone(configuredTimezone);
      return localTime.toFormat('yyyy-LL-dd HH:mm:ss ZZZZ');
    } catch (error) {
      logger.error('Error formatting timestamp for display', {
        timestamp: timestamp,
        error: error.message,
      });
      return 'Error formatting timestamp';
    }
  }

  /**
   * Format date for Hardcover API (YYYY-MM-DD format)
   * @param {string|number} dateValue - Date value (ISO string or timestamp)
   * @returns {string|null} - Formatted date string or null if invalid
   */
  _formatDateForHardcover(dateValue) {
    if (!dateValue) return null;

    try {
      let date;

      if (typeof dateValue === 'number') {
        // Handle timestamp (milliseconds)
        date = new Date(dateValue);
      } else if (typeof dateValue === 'string') {
        // Handle ISO string or other date formats
        if (dateValue.includes('T') || dateValue.includes('-')) {
          // Already a date string, try to parse it
          date = new Date(dateValue);
        } else {
          // Might be a timestamp as string
          const timestamp = parseInt(dateValue);
          if (!isNaN(timestamp)) {
            date = new Date(timestamp);
          } else {
            date = new Date(dateValue);
          }
        }
      } else {
        logger.warn('Invalid date format', {
          dateValue,
          type: typeof dateValue,
        });
        return null;
      }

      // Validate the date
      if (isNaN(date.getTime())) {
        logger.warn('Invalid date value', { dateValue });
        return null;
      }

      // Format as YYYY-MM-DD
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');

      const formattedDate = `${year}-${month}-${day}`;

      logger.debug('Formatted date for Hardcover', {
        input: dateValue,
        inputType: typeof dateValue,
        output: formattedDate,
      });

      return formattedDate;
    } catch (error) {
      logger.error('Error formatting date for Hardcover', {
        dateValue: dateValue,
        error: error.message,
      });
      return null;
    }
  }

  async _syncBooksParallel(
    booksToProcess,
    identifierLookup,
    result,
    sessionData,
  ) {
    const workers = this.globalConfig.workers || 3;
    const chunks = [];

    // Split books into chunks for parallel processing
    for (let i = 0; i < booksToProcess.length; i += workers) {
      chunks.push(booksToProcess.slice(i, i + workers));
    }

    // Process chunks sequentially, books within chunks in parallel
    for (const chunk of chunks) {
      const promises = chunk.map(book =>
        this._syncSingleBook(book, identifierLookup, sessionData),
      );
      const chunkResults = await Promise.all(promises);

      // Update results with all chunk results
      chunkResults.forEach(syncResult => {
        this._updateResult(result, syncResult);
      });
    }
  }

  async _syncBooksSequential(
    booksToProcess,
    identifierLookup,
    result,
    sessionData,
  ) {
    for (const book of booksToProcess) {
      result.books_processed++;

      // Show progress for verbose output
      if (this.verbose) {
        const title = extractTitle(book) || 'Unknown Title';
        console.log(
          `  → [${result.books_processed}/${booksToProcess.length}] ${title}`,
        );
      }

      const syncResult = await this._syncSingleBook(
        book,
        identifierLookup,
        sessionData,
      );
      this._updateResult(result, syncResult);
    }
  }

  _chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  async _syncSingleBook(absBook, identifierLookup, sessionData) {
    const startTime = performance.now();
    const title = extractTitle(absBook) || 'Unknown Title';
    const progressPercent = absBook.progress_percentage || 0;

    logger.debug(`Processing: ${title} (${progressPercent.toFixed(1)}%)`);

    // Initialize detailed result tracking
    const syncResult = {
      title: title,
      author: this._extractAuthorFromData(absBook, null),
      status: 'unknown',
      reason: null,
      progress_before: progressPercent,
      progress_after: progressPercent,
      progress_changed: false,
      identifiers: {},
      cache_found: false,
      cache_last_sync: null,
      hardcover_info: null,
      api_response: null,
      last_listened_at: absBook.last_listened_at,
      completed_at: null,
      actions: [],
      errors: [],
      timing: null,
    };

    // Add last listened timestamp from playback sessions
    let usedSessionData = false;
    if (
      sessionData &&
      sessionData.sessions &&
      sessionData.sessions.length > 0
    ) {
      // Find sessions for this specific book
      const bookSessions = sessionData.sessions.filter(
        session => session.libraryItemId === absBook.id,
      );

      if (bookSessions.length > 0) {
        // Get the most recent session's updatedAt
        const latestSession = bookSessions.reduce((latest, session) => {
          return !latest || session.updatedAt > latest.updatedAt
            ? session
            : latest;
        });

        if (latestSession && latestSession.updatedAt) {
          // Convert to configured timezone
          const lastListenedAtUTC = DateTime.fromMillis(
            latestSession.updatedAt,
            { zone: 'utc' },
          );
          const lastListenedAtLocal = lastListenedAtUTC.setZone(this.timezone);
          absBook.last_listened_at = lastListenedAtLocal.toISO();
          syncResult.last_listened_at = absBook.last_listened_at;
          usedSessionData = true;
          logger.debug(
            `[DEBUG] Found session updatedAt for ${title}: ${latestSession.updatedAt} (${lastListenedAtLocal.toFormat('yyyy-LL-dd HH:mm:ss ZZZZ')})`,
          );
        }
      } else {
        logger.debug(`[DEBUG] No playbook sessions found for ${title}`);
      }
    }

    // Convert last_listened_at from media progress to configured timezone (if no sessions found for this book)
    if (absBook.last_listened_at && !usedSessionData) {
      const lastListenedAtUTC = DateTime.fromMillis(absBook.last_listened_at, {
        zone: 'utc',
      });
      const lastListenedAtLocal = lastListenedAtUTC.setZone(this.timezone);
      absBook.last_listened_at = lastListenedAtLocal.toISO();
      syncResult.last_listened_at = absBook.last_listened_at;
      logger.debug(
        `[DEBUG] Converted lastUpdate for ${title}: ${lastListenedAtLocal.toFormat('yyyy-LL-dd HH:mm:ss ZZZZ')}`,
      );
    }

    // Convert startedAt from media progress to configured timezone
    if (absBook.started_at) {
      const startedAtUTC = DateTime.fromMillis(absBook.started_at, {
        zone: 'utc',
      });
      const startedAtLocal = startedAtUTC.setZone(this.timezone);
      absBook.started_at = startedAtLocal.toISO();
      logger.debug(
        `[DEBUG] startedAt for ${title}: ${startedAtLocal.toFormat('yyyy-LL-dd HH:mm:ss ZZZZ')}`,
      );
    }
    // Convert finishedAt from media progress to configured timezone
    if (absBook.finished_at) {
      const finishedAtUTC = DateTime.fromMillis(absBook.finished_at, {
        zone: 'utc',
      });
      const finishedAtLocal = finishedAtUTC.setZone(this.timezone);
      absBook.finished_at = finishedAtLocal.toISO();
      syncResult.completed_at = absBook.finished_at;
      logger.debug(
        `[DEBUG] finishedAt for ${title}: ${finishedAtLocal.toFormat('yyyy-LL-dd HH:mm:ss ZZZZ')}`,
      );
    }

    // Extract identifiers
    const identifiers = this._extractBookIdentifier(absBook);
    syncResult.identifiers = identifiers;
    logger.debug(
      `[DEBUG] Extracted identifiers for '${title}': ISBN='${identifiers.isbn}', ASIN='${identifiers.asin}'`,
    );
    if (!identifiers.isbn && !identifiers.asin) {
      logger.info(`Skipping ${title}: No ISBN or ASIN found`);
      syncResult.status = 'skipped';
      syncResult.reason = 'No ISBN or ASIN';
      syncResult.timing = performance.now() - startTime;
      return syncResult;
    }

    // Check cache for existing sync data
    const identifier = identifiers.asin || identifiers.isbn;
    const identifierType = identifiers.asin ? 'asin' : 'isbn';

    try {
      const cachedInfo = await this.cache.getCachedBookInfo(
        this.userId,
        identifier,
        title,
        identifierType,
      );
      if (cachedInfo.exists) {
        syncResult.cache_found = true;
        syncResult.cache_last_sync = cachedInfo.last_sync;
        syncResult.actions.push(
          `Found in cache (last synced: ${new Date(cachedInfo.last_sync).toLocaleDateString()})`,
        );
      }
    } catch (cacheError) {
      logger.warn(`Cache lookup failed for ${title}`, {
        error: cacheError.message,
      });
    }

    // Try to find match in Hardcover using enhanced matching
    const hardcoverMatch = await this._findBookInHardcover(
      absBook,
      identifierLookup,
    );
    let matchedIdentifierType = null;

    // Determine how the match was found and add appropriate sync result info
    if (hardcoverMatch) {
      if (hardcoverMatch._isSearchResult) {
        // This was found via title/author matching
        matchedIdentifierType = 'title_author';
        const confidence = hardcoverMatch._matchingScore
          ? Math.round(hardcoverMatch._matchingScore.totalScore)
          : 'unknown';
        logger.debug(
          `Found title/author match for ${title} (confidence: ${confidence}%)`,
        );
        syncResult.actions.push(
          `Found in Hardcover by title/author match (confidence: ${confidence}%)`,
        );
        syncResult.matching_method = 'title_author';
        syncResult.confidence_score = confidence;
      } else if (identifiers.asin && identifierLookup[identifiers.asin]) {
        // Found by ASIN
        matchedIdentifierType = 'asin';
        logger.debug(`Found ASIN match for ${title}: ${identifiers.asin}`);
        syncResult.actions.push(
          `Found in Hardcover by ASIN: ${identifiers.asin}`,
        );
        syncResult.matching_method = 'asin';
      } else if (identifiers.isbn && identifierLookup[identifiers.isbn]) {
        // Found by ISBN
        matchedIdentifierType = 'isbn';
        logger.debug(`Found ISBN match for ${title}: ${identifiers.isbn}`);
        syncResult.actions.push(
          `Found in Hardcover by ISBN: ${identifiers.isbn}`,
        );
        syncResult.matching_method = 'isbn';
      }
    }

    if (!hardcoverMatch) {
      // Try to auto-add the book
      syncResult.actions.push(`Not found in Hardcover library`);
      const autoAddResult = await this._tryAutoAddBook(absBook, identifiers);
      syncResult.status = autoAddResult.status;
      syncResult.reason = autoAddResult.reason;
      syncResult.timing = performance.now() - startTime;
      return syncResult;
    }

    // Special handling for title/author matches from search results
    if (hardcoverMatch._isSearchResult) {
      // This book was found via search but isn't in the user's library yet
      // We need to add it to the library first, then sync progress
      logger.debug(`Title/author match requires auto-add to library: ${title}`);

      const bookId = hardcoverMatch.userBook.book.id;
      const editionId = hardcoverMatch.edition.id;

      try {
        if (!this.dryRun) {
          logger.debug(`Adding title/author matched book to library`, {
            bookId: bookId,
            editionId: editionId,
            title: title,
          });

          const addResult = await this.hardcover.addBookToLibrary(
            bookId,
            2,
            editionId,
          );
          syncResult.actions.push(`Added matched book to Hardcover library`);

          // Update the match object to look like a regular library match
          hardcoverMatch.userBook.id = addResult.id || 'auto-added';
          hardcoverMatch._isSearchResult = false; // No longer just a search result
        } else {
          logger.debug(
            `[DRY RUN] Would add title/author matched book to library`,
          );
          syncResult.actions.push(
            `[DRY RUN] Would add matched book to library`,
          );
        }
      } catch (error) {
        logger.error(
          `Failed to add title/author matched book to library: ${error.message}`,
        );
        syncResult.status = 'error';
        syncResult.reason = `Failed to add matched book: ${error.message}`;
        syncResult.timing = performance.now() - startTime;
        return syncResult;
      }
    }

    // Store Hardcover edition info
    if (hardcoverMatch.edition) {
      syncResult.hardcover_info = {
        edition_id: hardcoverMatch.edition.id,
        format: hardcoverMatch.edition.format,
        pages: hardcoverMatch.edition.pages,
        duration: hardcoverMatch.edition.audio_seconds
          ? `${Math.floor(hardcoverMatch.edition.audio_seconds / 3600)}h ${Math.floor((hardcoverMatch.edition.audio_seconds % 3600) / 60)}m`
          : null,
      };
    }

    // Check if progress has changed (unless force sync is enabled)
    if (
      !this.globalConfig.force_sync &&
      !(await this.cache.hasProgressChanged(
        this.userId,
        identifier,
        title,
        progressPercent,
        identifierType,
      ))
    ) {
      // Remove the verbose console log - keep only debug logging
      logger.debug(`Skipping ${title}: Progress unchanged`);
      syncResult.status = 'skipped';
      syncResult.reason = 'Progress unchanged';
      syncResult.timing = performance.now() - startTime;
      return syncResult;
    } else {
      syncResult.progress_changed = true;
    }

    // Sync the existing book
    const existingSyncResult = await this._syncExistingBook(
      absBook,
      hardcoverMatch,
      matchedIdentifierType,
      identifier,
    );

    // Merge results
    syncResult.status = existingSyncResult.status;
    syncResult.reason = existingSyncResult.reason;
    syncResult.progress_after = progressPercent;

    // Add API response info if available
    if (existingSyncResult.api_response) {
      syncResult.api_response = existingSyncResult.api_response;
    }

    syncResult.timing = performance.now() - startTime;
    return syncResult;
  }

  async _tryAutoAddBook(absBook, identifiers) {
    const title = extractTitle(absBook) || 'Unknown Title';
    logger.info(`Attempting to auto-add ${title} to Hardcover`, {
      identifiers: identifiers,
      title: title,
      dryRun: this.dryRun,
    });

    try {
      // In dry run mode, simulate search results instead of making API calls
      let searchResults = [];

      if (this.dryRun) {
        logger.debug(
          `[DRY RUN] Simulating search for ${title} instead of making API calls`,
        );
        // Simulate a successful search result for dry run
        searchResults = [
          {
            id: 'dry-run-edition-id',
            book: {
              id: 'dry-run-book-id',
              title: title,
            },
            format: 'audiobook',
          },
        ];
      } else {
        // Search for the book by ISBN or ASIN (only in non-dry-run mode)
        if (identifiers.asin) {
          logger.debug(`Searching Hardcover by ASIN: ${identifiers.asin}`);
          searchResults = await this.hardcover.searchBooksByAsin(
            identifiers.asin,
          );
          logger.debug(`ASIN search returned ${searchResults.length} results`);
        }

        if (searchResults.length === 0 && identifiers.isbn) {
          logger.debug(`Searching Hardcover by ISBN: ${identifiers.isbn}`);
          searchResults = await this.hardcover.searchBooksByIsbn(
            identifiers.isbn,
          );
          logger.debug(`ISBN search returned ${searchResults.length} results`);
        }
      }

      if (searchResults.length === 0) {
        logger.info(`Could not find ${title} in Hardcover database`, {
          searchedIdentifiers: identifiers,
          dryRun: this.dryRun,
        });
        return {
          status: 'skipped',
          reason: 'Book not found in Hardcover',
          title,
        };
      }

      // Add the first result to library
      const edition = searchResults[0];
      const bookId = edition.book.id;
      const editionId = edition.id;

      logger.debug(`Found match in Hardcover`, {
        title: title,
        hardcoverTitle: edition.book.title,
        bookId: bookId,
        editionId: editionId,
        format: edition.format,
        dryRun: this.dryRun,
      });

      if (this.dryRun) {
        logger.debug(
          `[DRY RUN] Would add ${title} to library (book_id: ${bookId}, edition_id: ${editionId})`,
        );
        return { status: 'auto_added', title, bookId, editionId };
      }

      // Prepare rollback callback in case API fails
      const rollbackCallbacks = [];
      const _apiRollbackNeeded = false;

      logger.debug(`Adding ${title} to Hardcover library`, {
        bookId: bookId,
        editionId: editionId,
      });

      const addResult = await this.hardcover.addBookToLibrary(
        bookId,
        2,
        editionId,
      );

      if (addResult) {
        logger.info(`Successfully added ${title} to library`, {
          userBookId: addResult.id,
          hardcoverTitle: edition.book.title,
        });

        // Store cache data in transaction
        const identifier = identifiers.asin || identifiers.isbn;
        const identifierType = identifiers.asin ? 'asin' : 'isbn';
        const author = this._extractAuthorFromData(absBook, {
          userBook: null,
          edition,
        });

        // Add API rollback callback
        const _apiRollbackNeeded = true;
        rollbackCallbacks.push(async () => {
          logger.info(`Rolling back auto-add for ${title}`);
          // Note: Hardcover doesn't have a remove from library API, so we log the issue
          logger.warn(
            `Manual cleanup needed: Remove ${title} from Hardcover library`,
          );
        });

        try {
          logger.debug(`Caching auto-add data for ${title}`, {
            identifier: identifier,
            identifierType: identifierType,
            editionId: editionId,
            author: author,
          });

          const currentProgress = absBook.progress_percentage || 0;

          // Store initial cache data
          await this.cache.storeBookSyncData(
            this.userId,
            identifier,
            title,
            editionId,
            identifierType,
            author,
            currentProgress, // Use actual current progress instead of 0
            absBook.last_listened_at,
            absBook.started_at,
          );

          // If there's meaningful progress, immediately sync it to Hardcover
          if (currentProgress > 0 && !this._isZeroProgress(currentProgress)) {
            logger.info(
              `Auto-added book has ${currentProgress}% progress, syncing immediately`,
              {
                title: title,
                progress: currentProgress,
              },
            );

            try {
              // Create hardcover match object for progress sync
              const _hardcoverMatch = {
                userBook: { id: addResult.id, book: edition.book },
                edition: edition,
              };

              // Check if book should be marked as completed
              const isFinished =
                absBook.is_finished === true || absBook.is_finished === 1;
              if (isFinished) {
                await this._handleCompletionStatus(
                  addResult.id,
                  edition,
                  title,
                  currentProgress,
                  absBook,
                  isFinished,
                );
                logger.info(`Auto-added book marked as completed`, {
                  title: title,
                });
              } else if (currentProgress >= 95) {
                await this._handleCompletionStatus(
                  addResult.id,
                  edition,
                  title,
                  currentProgress,
                  absBook,
                  false,
                );
                logger.info(
                  `Auto-added book marked as completed (high progress)`,
                  { title: title },
                );
              } else {
                await this._handleProgressStatus(
                  addResult.id,
                  edition,
                  title,
                  currentProgress,
                  absBook,
                );
                logger.info(`Auto-added book progress synced`, {
                  title: title,
                  progress: currentProgress,
                });
              }
            } catch (progressSyncError) {
              // Don't fail the entire auto-add if progress sync fails
              logger.warn(
                `Failed to sync progress for auto-added book ${title}`,
                {
                  error: progressSyncError.message,
                  progress: currentProgress,
                },
              );
            }
          }

          return { status: 'auto_added', title, userBookId: addResult.id };
        } catch (cacheError) {
          // Cache transaction failed, rollback API changes
          logger.error(`Cache transaction failed for auto-add ${title}`, {
            error: cacheError.message,
            stack: cacheError.stack,
          });
          // Execute rollback callbacks
          for (const callback of rollbackCallbacks) {
            await callback();
          }
          throw cacheError;
        }
      } else {
        logger.error(`Failed to add ${title} to library`, {
          bookId: bookId,
          editionId: editionId,
        });
        return { status: 'error', reason: 'Failed to add to library', title };
      }
    } catch (error) {
      logger.error(`Error auto-adding ${title}`, {
        error: error.message,
        stack: error.stack,
        identifiers: identifiers,
      });
      return { status: 'error', reason: error.message, title };
    }
  }

  async _syncExistingBook(
    absBook,
    hardcoverMatch,
    _identifierType,
    _identifier,
  ) {
    const title = extractTitle(absBook) || 'Unknown Title';
    const progressPercent = absBook.progress_percentage || 0;
    const { userBook, edition } = hardcoverMatch;

    logger.debug(`Syncing existing book: ${title}`, {
      currentProgress: progressPercent,
      hardcoverTitle: userBook.book.title,
      userBookId: userBook.id,
      editionId: edition?.id,
    });

    try {
      // Select the best edition
      const selectedEdition = await this._selectEditionWithCache(
        absBook,
        hardcoverMatch,
        title,
      );
      if (!selectedEdition) {
        logger.error(`No suitable edition found for ${title}`, {
          availableEditions: userBook.book.editions?.length || 0,
        });
        return { status: 'error', reason: 'No suitable edition found', title };
      }

      logger.debug(`Selected edition for ${title}`, {
        editionId: selectedEdition.id,
        format: selectedEdition.format,
        pages: selectedEdition.pages,
        audioSeconds: selectedEdition.audio_seconds,
      });

      // Check for progress regression protection if enabled
      // First, get sync tracking to detect first sync scenarios
      const syncTracking = await this.cache.getSyncTracking(this.userId);
      const isFirstSync = syncTracking.total_syncs === 1;
      const isForceSync = this.globalConfig.force_sync === true;

      // Determine if protection should be applied
      let shouldProtectAgainstRegression =
        this.globalConfig.prevent_progress_regression !== false;

      // Disable protection for first sync or force sync
      if (shouldProtectAgainstRegression && isFirstSync) {
        shouldProtectAgainstRegression = false;
        logger.debug(
          `Disabling progress regression protection for ${title}: first sync detected`,
          {
            userBookId: userBook.id,
            totalSyncs: syncTracking.total_syncs,
          },
        );
      } else if (shouldProtectAgainstRegression && isForceSync) {
        shouldProtectAgainstRegression = false;
        logger.debug(
          `Disabling progress regression protection for ${title}: force sync enabled`,
          {
            userBookId: userBook.id,
            forceSync: isForceSync,
          },
        );
      }

      if (shouldProtectAgainstRegression) {
        const regressionCheck = await this._checkProgressRegression(
          userBook.id,
          progressPercent,
          title,
        );
        if (regressionCheck.shouldBlock) {
          logger.warn(
            `Blocking potential progress regression for ${title}: ${regressionCheck.reason}`,
          );
          return {
            status: 'skipped',
            reason: `Progress regression protection: ${regressionCheck.reason}`,
            title,
          };
        }
        if (regressionCheck.shouldWarn) {
          logger.warn(
            `Progress regression detected for ${title}: ${regressionCheck.reason}`,
          );
        }
      }

      // Use Audiobookshelf's is_finished flag if present, prioritize it over percentage
      const isFinished =
        absBook.is_finished === true || absBook.is_finished === 1;

      // Prioritize is_finished flag, then fall back to progress percentage
      if (isFinished) {
        logger.debug(`Book ${title} is marked as finished in Audiobookshelf`, {
          isFinished: isFinished,
          progress: progressPercent,
        });
        return await this._handleCompletionStatus(
          userBook.id,
          selectedEdition,
          title,
          progressPercent,
          absBook,
          isFinished,
        );
      } else if (progressPercent >= 95) {
        logger.debug(`Book ${title} is completed based on high progress`, {
          isFinished: isFinished,
          progress: progressPercent,
        });
        return await this._handleCompletionStatus(
          userBook.id,
          selectedEdition,
          title,
          progressPercent,
          absBook,
          false,
        );
      }

      // Handle progress update
      logger.debug(`Updating progress for ${title}`, {
        progress: progressPercent,
      });
      return await this._handleProgressStatus(
        userBook.id,
        selectedEdition,
        title,
        progressPercent,
        absBook,
      );
    } catch (error) {
      logger.error(`Error syncing existing book ${title}`, {
        error: error.message,
        stack: error.stack,
        userBookId: userBook.id,
      });
      return { status: 'error', reason: error.message, title };
    }
  }

  /**
   * Check for progress regression and determine if sync should be blocked
   * @param {number} userBookId - Hardcover user book ID
   * @param {number} newProgressPercent - New progress percentage
   * @param {string} title - Book title for logging
   * @returns {Object} Result with shouldBlock, shouldWarn, and reason
   */
  async _checkProgressRegression(userBookId, newProgressPercent, title) {
    const result = {
      shouldBlock: false,
      shouldWarn: false,
      reason: '',
    };

    try {
      // Get current progress from Hardcover
      const progressInfo =
        await this.hardcover.getBookCurrentProgress(userBookId);

      if (
        !progressInfo ||
        !progressInfo.has_progress ||
        !progressInfo.latest_read
      ) {
        return result; // No existing progress to compare
      }

      const latestRead = progressInfo.latest_read;

      // If book was completed (has finished_at), block any progress updates
      if (latestRead.finished_at) {
        // Get reread threshold from config
        const rereadThreshold =
          this.globalConfig.reread_detection?.reread_threshold || 30;

        // Check if this might be a re-reading scenario
        if (newProgressPercent <= rereadThreshold) {
          result.shouldWarn = true;
          result.reason = `Book was completed on ${latestRead.finished_at}, but new progress is ${newProgressPercent}% (possible re-reading)`;
        } else {
          result.shouldBlock = true;
          result.reason = `Book was completed on ${latestRead.finished_at}, blocking regression to ${newProgressPercent}%`;
        }
        return result;
      }

      // Calculate previous progress percentage if we have edition info
      let previousProgressPercent = 0;
      if (latestRead.edition) {
        if (latestRead.progress_seconds && latestRead.edition.audio_seconds) {
          previousProgressPercent =
            (latestRead.progress_seconds / latestRead.edition.audio_seconds) *
            100;
        } else if (latestRead.progress_pages && latestRead.edition.pages) {
          previousProgressPercent =
            (latestRead.progress_pages / latestRead.edition.pages) * 100;
        }
      }

      // Get thresholds from config
      const HIGH_PROGRESS_THRESHOLD =
        this.globalConfig.reread_detection?.high_progress_threshold || 85;
      const REGRESSION_BLOCK_THRESHOLD =
        this.globalConfig.reread_detection?.regression_block_threshold || 50;
      const REGRESSION_WARN_THRESHOLD =
        this.globalConfig.reread_detection?.regression_warn_threshold || 15;

      if (previousProgressPercent >= HIGH_PROGRESS_THRESHOLD) {
        const progressDrop = previousProgressPercent - newProgressPercent;

        if (progressDrop >= REGRESSION_BLOCK_THRESHOLD) {
          result.shouldBlock = true;
          result.reason = `Significant progress regression: ${previousProgressPercent.toFixed(1)}% → ${newProgressPercent.toFixed(1)}%`;
        } else if (progressDrop >= REGRESSION_WARN_THRESHOLD) {
          result.shouldWarn = true;
          result.reason = `Progress regression: ${previousProgressPercent.toFixed(1)}% → ${newProgressPercent.toFixed(1)}%`;
        }
      }
    } catch (error) {
      logger.error(`Error checking progress regression for ${title}`, {
        error: error.message,
        userBookId,
      });
    }

    return result;
  }

  async _selectEditionWithCache(absBook, hardcoverMatch, title) {
    const { userBook, edition } = hardcoverMatch;

    // Check cache first
    const identifier = this._extractBookIdentifier(absBook);
    const identifierType = identifier.asin ? 'asin' : 'isbn';
    const identifierValue = identifier.asin || identifier.isbn;

    const cachedEditionId = await this.cache.getEditionForBook(
      this.userId,
      identifierValue,
      title,
      identifierType,
    );

    if (cachedEditionId) {
      // Find the cached edition in the book's editions
      const book = userBook.book;
      if (book && book.editions) {
        const cachedEdition = book.editions.find(e => e.id === cachedEditionId);
        if (cachedEdition) {
          return cachedEdition;
        }
      }
    }

    // Use the matched edition and cache it in transaction
    if (edition) {
      const author = this._extractAuthorFromData(absBook, hardcoverMatch);

      try {
        // Store edition mapping in transaction
        await this.cache.executeTransaction(
          [
            () =>
              this.cache._storeEditionMappingOperation(
                this.userId,
                identifierValue,
                title,
                edition.id,
                identifierType,
                author,
              ),
          ],
          {
            description: `Cache edition mapping for ${title}`,
            timeout: 2000,
          },
        );

        return edition;
      } catch (error) {
        logger.error(
          `Failed to cache edition mapping for ${title}: ${error.message}`,
        );
        // Still return the edition even if caching fails
        return edition;
      }
    }

    return null;
  }

  async _handleCompletionStatus(
    userBookId,
    edition,
    title,
    progressPercent,
    absBook,
    isFinished = false,
  ) {
    logger.info(`Marking ${title} as completed`, {
      progress: progressPercent,
      isFinished: isFinished,
      userBookId: userBookId,
      editionId: edition.id,
      format: edition.audio_seconds ? 'audiobook' : 'text',
    });

    if (this.dryRun) {
      logger.debug(`[DRY RUN] Would mark ${title} as completed`);
      return { status: 'completed', title };
    }

    try {
      let totalValue = 0;
      let useSeconds = false;
      if (edition.audio_seconds) {
        totalValue = edition.audio_seconds;
        useSeconds = true;
      } else if (edition.pages) {
        totalValue = edition.pages;
      }

      logger.debug(`🎯 Marking ${title} complete`, {
        total: useSeconds
          ? formatDurationForLogging(totalValue)
          : `${totalValue} pages`,
        format: useSeconds ? 'audiobook' : 'ebook',
      });

      // Pass finished_at and started_at to Hardcover client if present
      const finishedAt = absBook.finished_at
        ? this._formatDateForHardcover(absBook.finished_at)
        : null;
      const startedAt = absBook.started_at
        ? this._formatDateForHardcover(absBook.started_at)
        : null;

      logger.debug(`Completion dates for ${title}`, {
        startedAt: startedAt,
        finishedAt: finishedAt,
        rawStartedAt: absBook.started_at,
        rawFinishedAt: absBook.finished_at,
      });

      // Prepare rollback callback for API failure
      const rollbackCallbacks = [];
      const _apiSuccess = false;

      const success = await this.hardcover.markBookCompleted(
        userBookId,
        edition.id,
        totalValue,
        useSeconds,
        finishedAt,
        startedAt,
      );

      if (success) {
        logger.info(`Successfully marked ${title} as completed`, {
          userBookId: userBookId,
          totalValue: totalValue,
          useSeconds: useSeconds,
        });
        const _apiSuccess = true;

        // Add API rollback callback
        rollbackCallbacks.push(async () => {
          logger.info(`Rolling back completion status for ${title}`);
          // Try to revert the completion (this may not always be possible)
          try {
            await this.hardcover.updateBookStatus(userBookId, 2); // Set back to "reading"
          } catch (rollbackError) {
            logger.error(`Failed to rollback completion for ${title}`, {
              error: rollbackError.message,
            });
          }
        });

        // Store completion data in transaction
        const identifier = this._extractBookIdentifier(absBook);
        const identifierType = identifier.asin ? 'asin' : 'isbn';
        const identifierValue = identifier.asin || identifier.isbn;

        try {
          logger.debug(`Caching completion data for ${title}`, {
            identifier: identifierValue,
            identifierType: identifierType,
            progress: 100,
          });

          await this.cache.storeBookCompletionData(
            this.userId,
            identifierValue,
            title,
            identifierType,
            absBook.last_listened_at,
            absBook.started_at,
            absBook.finished_at,
          );

          return { status: 'completed', title };
        } catch (cacheError) {
          // Cache transaction failed, rollback API changes
          logger.error(`Cache transaction failed for completion ${title}`, {
            error: cacheError.message,
            stack: cacheError.stack,
          });
          for (const callback of rollbackCallbacks) {
            await callback();
          }
          throw cacheError;
        }
      } else {
        logger.error(`Failed to mark ${title} as completed`, {
          userBookId: userBookId,
          editionId: edition.id,
        });
        return {
          status: 'error',
          reason: 'Failed to mark as completed',
          title,
        };
      }
    } catch (error) {
      logger.error(`Error marking ${title} as completed`, {
        error: error.message,
        stack: error.stack,
        userBookId: userBookId,
      });
      return { status: 'error', reason: error.message, title };
    }
  }

  async _handleProgressStatus(
    userBookId,
    edition,
    title,
    progressPercent,
    absBook,
  ) {
    logger.info(`Updating progress for ${title}`, {
      progress: progressPercent,
      userBookId: userBookId,
      editionId: edition.id,
      format: edition.audio_seconds ? 'audiobook' : 'text',
    });

    if (this.dryRun) {
      logger.debug(
        `[DRY RUN] Would update progress for ${title} to ${progressPercent.toFixed(1)}%`,
      );
      return { status: 'synced', title };
    }

    try {
      // Calculate current progress value
      let currentProgress = 0;
      let useSeconds = false;

      if (edition.audio_seconds) {
        currentProgress = calculateCurrentSeconds(
          progressPercent,
          edition.audio_seconds,
        );
        useSeconds = true;
      } else if (edition.pages) {
        currentProgress = calculateCurrentPage(progressPercent, edition.pages);
      }

      logger.debug(
        `📊 Calculated ${title} progress: ${progressPercent.toFixed(1)}%`,
        {
          [useSeconds ? 'progress' : 'progress']: useSeconds
            ? `${formatDurationForLogging(currentProgress)} of ${formatDurationForLogging(edition.audio_seconds)}`
            : `page ${currentProgress} of ${edition.pages}`,
          format: useSeconds ? 'audiobook' : 'ebook',
        },
      );

      // Prepare rollback callback for API failure
      const rollbackCallbacks = [];
      let previousProgress = null;

      // Get previous progress for rollback
      const identifier = this._extractBookIdentifier(absBook);
      const identifierType = identifier.asin ? 'asin' : 'isbn';
      const identifierValue = identifier.asin || identifier.isbn;

      previousProgress = await this.cache.getLastProgress(
        this.userId,
        identifierValue,
        title,
        identifierType,
      );

      logger.debug(`Previous progress for ${title}`, {
        previousProgress: previousProgress,
        newProgress: progressPercent,
        format: useSeconds ? 'audiobook (seconds)' : 'text (pages)',
      });

      const result = await this.hardcover.updateReadingProgress(
        userBookId,
        currentProgress,
        progressPercent,
        edition.id,
        useSeconds,
        this._formatDateForHardcover(absBook.started_at), // Use formatted date instead of raw value
        this.globalConfig.reread_detection, // Pass reread configuration
      );

      if (result && result.id) {
        logger.info(`Successfully updated progress for ${title}`, {
          userBookId: userBookId,
          progressPercent: progressPercent,
          [useSeconds ? 'progress_seconds' : 'progress_pages']: useSeconds
            ? `${currentProgress} (${formatDurationForLogging(currentProgress)})`
            : currentProgress,
          resultId: result.id,
        });

        // Add API rollback callback
        rollbackCallbacks.push(async () => {
          logger.info(`Rolling back progress update for ${title}`);
          if (previousProgress !== null) {
            try {
              const rollbackCurrentProgress = useSeconds
                ? calculateCurrentSeconds(
                    previousProgress,
                    edition.audio_seconds || 0,
                  )
                : calculateCurrentPage(previousProgress, edition.pages || 0);

              logger.debug(`Rolling back to previous progress`, {
                [useSeconds ? 'rollback_seconds' : 'rollback_pages']: useSeconds
                  ? `${rollbackCurrentProgress} (${formatDurationForLogging(rollbackCurrentProgress)})`
                  : rollbackCurrentProgress,
                previousProgressPercent: previousProgress,
              });

              await this.hardcover.updateReadingProgress(
                userBookId,
                rollbackCurrentProgress,
                previousProgress,
                edition.id,
                useSeconds,
                this._formatDateForHardcover(absBook.started_at),
                this.globalConfig.reread_detection,
              );
            } catch (rollbackError) {
              logger.error(`Failed to rollback progress for ${title}`, {
                error: rollbackError.message,
              });
            }
          }
        });

        try {
          logger.debug(`Caching progress data for ${title}`, {
            identifier: identifierValue,
            identifierType: identifierType,
            progress: progressPercent,
          });

          // Store progress data in transaction
          await this.cache.storeBookSyncData(
            this.userId,
            identifierValue,
            title,
            edition.id,
            identifierType,
            this._extractAuthorFromData(absBook, { userBook: null, edition }),
            progressPercent,
            absBook.last_listened_at,
            absBook.started_at,
          );

          return { status: 'synced', title };
        } catch (cacheError) {
          // Cache transaction failed, rollback API changes
          logger.error(`Cache transaction failed for progress ${title}`, {
            error: cacheError.message,
            stack: cacheError.stack,
          });
          for (const callback of rollbackCallbacks) {
            await callback();
          }
          throw cacheError;
        }
      } else {
        logger.error(`Failed to update progress for ${title}`, {
          userBookId: userBookId,
          currentProgress: currentProgress,
          progressPercent: progressPercent,
        });
        return { status: 'error', reason: 'Failed to update progress', title };
      }
    } catch (error) {
      logger.error(`Error updating progress for ${title}`, {
        error: error.message,
        stack: error.stack,
        userBookId: userBookId,
      });
      return { status: 'error', reason: error.message, title };
    }
  }

  _updateResult(result, syncResult) {
    result.books_processed++;

    // Create detailed book info for verbose output
    const bookDetail = {
      title: syncResult.title || 'Unknown Title',
      author: syncResult.author || null,
      status: syncResult.status,
      reason: syncResult.reason || null,
      progress: {
        before:
          syncResult.progress_before !== undefined
            ? syncResult.progress_before
            : null,
        after:
          syncResult.progress_after !== undefined
            ? syncResult.progress_after
            : null,
        changed: syncResult.progress_changed || false,
      },
      identifiers: syncResult.identifiers || {},
      cache_status: {
        found: syncResult.cache_found || false,
        last_sync: syncResult.cache_last_sync || null,
      },
      hardcover_info: syncResult.hardcover_info || null,
      api_response: syncResult.api_response || null,
      timestamps: {
        last_listened_at: syncResult.last_listened_at || null,
        completed_at: syncResult.completed_at || null,
      },
      actions: syncResult.actions || [],
      errors: syncResult.errors || [],
      timing: syncResult.timing || null,
    };

    result.book_details.push(bookDetail);

    switch (syncResult.status) {
      case 'synced':
        result.books_synced++;
        break;
      case 'completed':
        result.books_completed++;
        break;
      case 'auto_added':
        result.books_auto_added++;
        break;
      case 'skipped':
        result.books_skipped++;
        break;
      case 'error':
        result.errors.push(`${syncResult.title}: ${syncResult.reason}`);
        break;
    }
  }

  async getCacheStats() {
    return await this.cache.getCacheStats();
  }

  async clearCache() {
    await this.cache.clearCache();
  }

  async exportToJson(filename) {
    await this.cache.exportToJson(filename);
  }

  async getBooksByAuthor(authorName) {
    return await this.cache.getBooksByAuthor(this.userId, authorName);
  }

  getTimingData() {
    return this.timingData;
  }

  printTimingSummary() {
    logger.info('=== Timing Summary ===');
    for (const [key, value] of Object.entries(this.timingData)) {
      logger.info(`${key}: ${value}ms`);
    }
  }

  /**
   * Clean up resources (database connections, etc.)
   * Should be called when the SyncManager is no longer needed
   */
  cleanup() {
    try {
      // Clean up API client connections
      if (this.audiobookshelf && this.audiobookshelf.cleanup) {
        this.audiobookshelf.cleanup();
      }
      if (this.hardcover && this.hardcover.cleanup) {
        this.hardcover.cleanup();
      }

      // Clean up database connection
      if (this.cache) {
        this.cache.close();
        logger.debug('SyncManager: Database connection closed');
      }
    } catch (error) {
      logger.error('Error during SyncManager cleanup', {
        error: error.message,
        stack: error.stack,
      });
    }
  }

  /**
   * Destructor-like method for cleanup
   */
  destroy() {
    this.cleanup();
  }

  /**
   * Generate a breakdown of book statuses for logging
   */
  _generateBookBreakdown(bookDetails) {
    const breakdown = {
      by_status: {},
      by_action: {},
      errors: [],
      progress_changes: [],
    };

    bookDetails.forEach(book => {
      // Count by status
      breakdown.by_status[book.status] =
        (breakdown.by_status[book.status] || 0) + 1;

      // Count by primary action
      const primaryAction =
        book.actions[book.actions.length - 1] || 'No action';
      breakdown.by_action[primaryAction] =
        (breakdown.by_action[primaryAction] || 0) + 1;

      // Collect errors
      if (book.errors.length > 0) {
        breakdown.errors.push({
          title: book.title,
          errors: book.errors,
        });
      }

      // Collect progress changes
      if (book.progress.changed) {
        breakdown.progress_changes.push({
          title: book.title,
          before: book.progress.before,
          after: book.progress.after,
        });
      }
    });

    return breakdown;
  }
}
