import { AudiobookshelfClient } from './audiobookshelf-client.js';
import { TaskQueue } from './utils/task-queue.js';
import { HardcoverClient } from './hardcover-client.js';
import { BookCache } from './book-cache.js';
import ProgressManager from './progress-manager.js';
import { BookMatcher, extractBookIdentifiers } from './matching/index.js';
import { formatDurationForLogging } from './utils/time.js';
import { DateTime } from 'luxon';
import { setMaxListeners } from 'events';
import logger from './logger.js';
import { Transaction } from './utils/transaction.js';
import SessionManager from './session-manager.js';
import { TimestampFormatter } from './sync/utils/TimestampFormatter.js';
import { CacheKeyGenerator } from './sync/utils/CacheKeyGenerator.js';

export class SyncManager {
  constructor(user, globalConfig, dryRun = false, verbose = false) {
    this.user = user;
    this.userId = user.id;
    this.globalConfig = globalConfig;
    this.dryRun = dryRun;
    this.verbose = verbose;
    // Initialize per-user task queue respecting global worker limits
    const workers = this.globalConfig.workers || 3;
    this.taskQueue = new TaskQueue({ concurrency: workers });
    this.abortController = new AbortController();

    // Track books currently being processed to prevent race conditions
    this.booksBeingProcessed = new Set();

    // Increase max listeners for AbortSignal to handle parallel processing
    // This prevents MaxListenersExceededWarning when processing many books
    const maxBooks = this.globalConfig.max_books_to_fetch || 500;
    const requiredListeners = Math.max(20, maxBooks + 10); // Buffer for safety
    setMaxListeners(requiredListeners, this.abortController.signal);

    this.timezone = globalConfig.timezone || 'UTC';

    // Initialize timestamp formatter utility
    this.timestampFormatter = new TimestampFormatter(this.timezone);

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

    // Initialize session manager for delayed updates
    this.sessionManager = new SessionManager(
      this.cache,
      globalConfig.delayed_updates || {},
    );

    // Initialize book matcher
    this.bookMatcher = new BookMatcher(
      this.hardcover,
      this.cache,
      globalConfig,
    );

    // Timing data
    this.timingData = {};

    logger.debug('SyncManager initialized', {
      user_id: this.userId,
      dryRun: this.dryRun,
      timezone: this.timezone,
      libraryConfig: libraryConfig,
    });
  }

  _isZeroProgress(progressValue) {
    // Use centralized ProgressManager for consistent zero progress detection
    return ProgressManager.isZeroProgress(progressValue, {
      threshold: this.globalConfig.min_progress_threshold || 5.0,
      context: `user ${this.userId} zero progress check`,
    });
  }

  async syncProgress() {
    const startTime = Date.now();
    logger.debug(`Starting sync for user: ${this.userId}`);
    console.log(`🔄 Starting sync for ${this.userId}`);

    // Increment sync count (for tracking purposes)
    const _syncTracking = await this.cache.incrementSyncCount(this.userId);

    // Process expired sessions before starting new sync
    await this._processExpiredSessions();

    // Simple unified sync message (completion detection now always runs)
    console.log(`🔄 Starting sync...`);

    const result = {
      books_processed: 0,
      books_synced: 0,
      books_completed: 0,
      books_auto_added: 0,
      books_skipped: 0,
      books_delayed: 0,
      expired_sessions_processed: 0,
      errors: [],
      timing: {},
      book_details: [], // Add detailed book results
    };

    try {
      // Get books from Audiobookshelf
      const absBooks = await this.audiobookshelf.getReadingProgress();

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

        // Always store fresh stats from scan
        await this.cache.storeLibraryStats(this.userId, filteringStats);
        result.stats_source = 'realtime';
      } else {
        // No stats from scan - try to get cached library stats
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

      // Filter out metadata-only entries for actual processing
      const realBooks = absBooks.filter(book => !book._isMetadataOnly);
      if (realBooks.length === 0 && !filteringStats) {
        logger.debug('No books found that need syncing');
        console.log('No books found that need syncing.');
        return result;
      }

      // Deduplicate books to prevent double-processing
      const deduplicatedBooks = this._deduplicateBooks(realBooks);
      if (deduplicatedBooks.duplicatesFound > 0) {
        logger.warn(
          `Found ${deduplicatedBooks.duplicatesFound} duplicate books, removed from processing`,
          {
            originalCount: realBooks.length,
            deduplicatedCount: deduplicatedBooks.books.length,
            duplicatesFound: deduplicatedBooks.duplicatesFound,
          },
        );
      }

      // Limit books to process if configured
      let booksToProcess = deduplicatedBooks.books;
      const maxBooks = this.globalConfig.max_books_to_process;
      if (
        maxBooks &&
        maxBooks > 0 &&
        deduplicatedBooks.books.length > maxBooks
      ) {
        booksToProcess = deduplicatedBooks.books.slice(0, maxBooks);
        logger.info(
          `Limiting sync to first ${maxBooks} books (${deduplicatedBooks.books.length} total available)`,
          {
            totalBooks: deduplicatedBooks.books.length,
            maxBooks: maxBooks,
            dryRun: this.dryRun,
          },
        );
        if (this.verbose) {
          console.log(
            `📚 Limiting sync to first ${maxBooks} books (${deduplicatedBooks.books.length} total available)`,
          );
        }
      }

      // Get books from Hardcover
      const hardcoverBooks = await this.hardcover.getUserBooks();
      if (!hardcoverBooks || hardcoverBooks.length === 0) {
        logger.warn('No books found in Hardcover library');
      }

      // Store for cross-referencing in cache logic
      this.hardcoverBooks = hardcoverBooks;

      // Update book matcher with user library data
      this.bookMatcher.setUserLibrary(
        hardcoverBooks,
        this._mapHardcoverFormatToInternal.bind(this),
      );

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
        await this._syncBooksParallel(booksToProcess, result, null);
      } else {
        logger.debug('Using sequential processing');
        await this._syncBooksSequential(booksToProcess, result, null);
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
        user_id: this.userId,
      });
      result.errors.push(error.message);
      console.log(
        `\n❌ Sync failed for user: ${this.userId}: ${error.message}`,
      );
      return result;
    }
  }

  /**
   * Find a user book in the current Hardcover library that contains the given edition ID
   * @param {number} editionId - Edition ID to search for
   * @returns {Object|null} - User book object if found, null otherwise
   */
  _findUserBookByEditionId(editionId) {
    if (!this.hardcoverBooks || !Array.isArray(this.hardcoverBooks)) {
      return null;
    }

    for (const userBook of this.hardcoverBooks) {
      if (!userBook.book || !userBook.book.editions) continue;

      for (const edition of userBook.book.editions) {
        if (edition.id === editionId) {
          return userBook;
        }
      }
    }

    return null;
  }

  /**
   * Map Hardcover's reading_format.format to our internal format system
   * @param {Object} edition - Edition object with reading_format and audio_seconds
   * @returns {string} - Internal format: "audiobook", "ebook", "book", or "mixed"
   */
  _mapHardcoverFormatToInternal(edition) {
    // Use Hardcover's format classification as source of truth
    const hardcoverFormat = edition.reading_format?.format;

    // Map Hardcover formats to our internal system
    switch (hardcoverFormat) {
      case 'Listened':
        return 'audiobook';
      case 'Ebook':
        return 'ebook';
      case 'Read':
        return 'book';
      case 'Both':
        return 'mixed';
      default:
        // Fallback to edition capabilities if no explicit format
        if (edition.audio_seconds && edition.audio_seconds > 0) {
          return 'audiobook';
        }
        return 'book'; // Default for text-based books
    }
  }

  /**
   * Get Hardcover's reading_format_id for mutations
   * @param {Object} edition - Edition object with reading_format
   * @returns {number} - Reading format ID: 1=Read, 2=Listened, 3=Both, 4=Ebook
   */
  _getReadingFormatId(edition) {
    const hardcoverFormat = edition.reading_format?.format;

    switch (hardcoverFormat) {
      case 'Read':
        return 1;
      case 'Listened':
        return 2;
      case 'Both':
        return 3;
      case 'Ebook':
        return 4;
      default:
        // Fallback based on edition capabilities
        if (edition.audio_seconds && edition.audio_seconds > 0) {
          return 2; // Listened (audiobook)
        }
        return 1; // Read (default for text-based books)
    }
  }

  /**
   * Format timestamp for display using configured timezone
   * @param {string|number} timestamp - Timestamp value (ISO string or milliseconds)
   * @returns {string} - Formatted date string for display
   * @deprecated Use this.timestampFormatter.formatForDisplay() instead
   */
  _formatTimestampForDisplay(timestamp) {
    return this.timestampFormatter.formatForDisplay(timestamp);
  }

  /**
   * Format date for Hardcover API (YYYY-MM-DD format)
   * @param {string|number} dateValue - Date value (ISO string or timestamp)
   * @returns {string|null} - Formatted date string or null if invalid
   * @deprecated Use this.timestampFormatter.formatForHardcover() instead
   */
  _formatDateForHardcover(dateValue) {
    return this.timestampFormatter.formatForHardcover(dateValue);
  }

  async _syncBooksParallel(booksToProcess, result, sessionData) {
    const promises = booksToProcess.map(book =>
      this.taskQueue.enqueue(
        async () => {
          const syncResult = await this._syncSingleBook(book, sessionData);
          // Update shared result as soon as each book finishes
          this._updateResult(result, syncResult);
          return syncResult;
        },
        { signal: this.abortController.signal },
      ),
    );

    // Wait for all queued tasks to complete
    await Promise.all(promises);
  }

  async _syncBooksSequential(booksToProcess, result, sessionData) {
    for (const book of booksToProcess) {
      result.books_processed++;

      // Show progress for verbose output (basic title for display only)
      if (this.verbose) {
        const displayTitle =
          book.title ||
          book.metadata?.title ||
          book.media?.metadata?.title ||
          'Unknown Title';
        console.log(
          `  → [${result.books_processed}/${booksToProcess.length}] ${displayTitle}`,
        );
      }

      const syncResult = await this._syncSingleBook(book, sessionData);
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

  /**
   * Deduplicate books to prevent double-processing based on book ID and metadata
   * @param {Array} books - Array of books to deduplicate
   * @returns {Object} - Object with books array and duplicatesFound count
   */
  _deduplicateBooks(books) {
    const seen = new Map();
    const deduplicatedBooks = [];
    let duplicatesFound = 0;

    for (const book of books) {
      // Create a composite key based on multiple identifiers to catch different types of duplicates
      const keys = [
        book.id, // Primary ABS book ID
        book.ino, // File inode (catches same file added multiple times)
        book.mediaType && book.media
          ? `${book.mediaType}:${JSON.stringify(book.media.metadata)}`
          : null,
      ].filter(Boolean);

      // Check if any of the keys have been seen before
      let isDuplicate = false;
      for (const key of keys) {
        if (seen.has(key)) {
          isDuplicate = true;
          duplicatesFound++;
          logger.debug(`Duplicate book detected`, {
            title: book.media?.metadata?.title || book.title || 'Unknown',
            duplicateKey: key,
            originalBookId: seen.get(key).id,
            duplicateBookId: book.id,
          });
          break;
        }
      }

      if (!isDuplicate) {
        // Store all keys for this book
        for (const key of keys) {
          seen.set(key, book);
        }
        deduplicatedBooks.push(book);
      }
    }

    return {
      books: deduplicatedBooks,
      duplicatesFound,
    };
  }

  async _syncSingleBook(absBook, sessionData) {
    const startTime = performance.now();

    // Extract basic metadata first (lightweight operation) to enable early progress checking
    const { extractTitle, extractAuthor } = await import(
      './matching/utils/audiobookshelf-extractor.js'
    );
    const { extractBookIdentifiers } = await import(
      './matching/utils/identifier-extractor.js'
    );

    const title = extractTitle(absBook) || 'Unknown Title';
    const author = extractAuthor(absBook) || 'Unknown Author';
    const identifiers = extractBookIdentifiers(absBook);

    // RACE CONDITION PREVENTION: Check if this book is already being processed
    const bookKey =
      absBook.id ||
      `${title}:${author}`.toLowerCase().replace(/[^a-z0-9:]/g, '');
    if (this.booksBeingProcessed.has(bookKey)) {
      logger.debug(
        `Skipping ${title}: already being processed by another task`,
        {
          bookKey,
          title,
          author,
        },
      );
      return {
        title,
        author,
        status: 'skipped',
        reason: 'Already being processed (race condition prevented)',
        progress_before: null,
        progress_after: null,
        progress_changed: false,
        identifiers: identifiers,
        cache_found: false,
        hardcover_status: 'skipped',
        abs_id: absBook.id,
        timing: performance.now() - startTime,
        actions: ['Prevented race condition - already processing'],
        errors: [],
      };
    }

    // Mark this book as being processed
    this.booksBeingProcessed.add(bookKey);

    try {
      // Continue with normal processing...

      // OPTIMIZATION: For books with identifiers OR cached title/author matches, check progress change BEFORE expensive book matching
      const hasIdentifiers = identifiers.isbn || identifiers.asin;
      const titleAuthorId = hasIdentifiers
        ? null
        : this.cache.generateTitleAuthorIdentifier(title, author);
      let shouldPerformExpensiveMatching = true;

      // Declare variables that will be set by cache optimization or expensive matching
      let matchResult, hardcoverMatch, extractedMetadata;

      if ((hasIdentifiers || titleAuthorId) && !this.globalConfig.force_sync) {
        const identifier =
          identifiers.asin || identifiers.isbn || titleAuthorId;
        const identifierType = identifiers.asin
          ? 'asin'
          : identifiers.isbn
            ? 'isbn'
            : 'title_author';

        // Check if we have cached data for this book
        const cachedInfo = await this.cache.getCachedBookInfo(
          this.userId,
          identifier,
          title,
          identifierType,
        );

        if (cachedInfo.exists) {
          // Validate progress for early check
          const validatedProgress = ProgressManager.getValidatedProgress(
            absBook,
            `book "${title}" early progress check`,
            { allowNull: false },
          );

          if (validatedProgress !== null) {
            const hasChanged = await this.cache.hasProgressChanged(
              this.userId,
              identifier,
              title,
              validatedProgress,
              identifierType,
            );

            if (!hasChanged) {
              logger.debug(
                `Early skip for ${title}: Progress unchanged (${validatedProgress.toFixed(1)}%) - ${identifierType} match`,
              );
              return {
                title,
                author,
                status: 'skipped',
                reason: 'Progress unchanged (optimized early check)',
                progress_before: validatedProgress,
                progress_after: validatedProgress,
                progress_changed: false,
                identifiers: identifiers,
                cache_found: true,
                hardcover_status: 'cached',
                abs_id: absBook.id,
                timing: performance.now() - startTime,
                actions: [
                  `Early progress check - no change detected (${identifierType})`,
                ],
                errors: [],
              };
            }

            // CACHE OPTIMIZATION: For ALL cached books with progress changes,
            // use cached edition_id instead of expensive matching
            if (cachedInfo.edition_id) {
              logger.debug(
                `Progress changed for ${title}: ${validatedProgress.toFixed(1)}% - using cached edition (${identifierType})`,
              );
              shouldPerformExpensiveMatching = false;
              // Create a hardcover match from cached data
              hardcoverMatch = {
                userBook: {
                  id: null, // We don't have userBook.id in cache, will be looked up later
                  book: {
                    id: null, // We don't have book.id in cache
                    title: title,
                  },
                },
                edition: {
                  id: cachedInfo.edition_id,
                },
                _isSearchResult: false,
                _matchType: `${identifierType}_cached`,
              };
            } else {
              shouldPerformExpensiveMatching = true;
              logger.debug(
                `Progress changed for ${title}: ${validatedProgress.toFixed(1)}% - proceeding with sync (${identifierType})`,
              );
            }
          }
        } else if (hasIdentifiers) {
          // For books with identifiers but no cache, proceed with matching
          logger.debug(
            `No cached data for ${title} with ${identifierType} - proceeding with matching`,
          );
        } else {
          // For title/author books with no cache, we need to do expensive matching
          logger.debug(
            `No cached title/author data for ${title} - proceeding with expensive matching`,
          );
        }
      }

      // NOW perform expensive book matching (only for books that need sync or don't have identifiers)
      if (shouldPerformExpensiveMatching) {
        matchResult = await this.bookMatcher.findMatch(absBook, this.userId);
        hardcoverMatch = matchResult.match;
        extractedMetadata = matchResult.extractedMetadata;

        // Use extracted metadata if available, otherwise use the lightweight extraction from above
        if (!extractedMetadata.title) extractedMetadata.title = title;
        if (!extractedMetadata.author) extractedMetadata.author = author;
        if (!extractedMetadata.identifiers)
          extractedMetadata.identifiers = identifiers;
      } else {
        // For books that were skipped or using cached match, we don't need expensive matching
        extractedMetadata = { title, author, identifiers };
        // hardcoverMatch may already be set from cached data above, don't override it
        if (hardcoverMatch === undefined) {
          hardcoverMatch = null;
        }
      }

      // Validate progress with explicit error handling and position-based accuracy
      // (Re-validate even if we did early check, in case validation failed earlier)
      const validatedProgress = ProgressManager.getValidatedProgress(
        absBook,
        `book "${title}" sync`,
        { allowNull: false },
      );

      if (validatedProgress === null) {
        logger.warn(`Skipping book "${title}" due to invalid progress data`, {
          rawProgress: ProgressManager.extractProgressPercentage(absBook),
          bookId: absBook.id,
          user_id: this.userId,
        });
        return {
          title,
          author: author,
          status: 'skipped',
          reason: 'Invalid progress data - cannot validate percentage',
          progress: ProgressManager.extractProgressPercentage(absBook),
          hardcover_status: 'unknown',
          abs_id: absBook.id,
        };
      }

      const progressPercent = validatedProgress;

      logger.debug(`Processing: ${title} (${progressPercent.toFixed(1)}%)`);

      // Initialize detailed result tracking
      const syncResult = {
        title: title,
        author: author,
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
            const lastListenedAtLocal = lastListenedAtUTC.setZone(
              this.timezone,
            );
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
        const lastListenedAtUTC = DateTime.fromMillis(
          absBook.last_listened_at,
          {
            zone: 'utc',
          },
        );
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

      // Use identifiers from metadata (already extracted by BookMatcher)
      syncResult.identifiers = identifiers;
      logger.debug(
        `[DEBUG] Extracted identifiers for '${title}': ISBN='${identifiers.isbn}', ASIN='${identifiers.asin}'`,
      );

      // Check if we have identifiers OR a successful match (e.g., title/author)
      if (!identifiers.isbn && !identifiers.asin && !hardcoverMatch) {
        logger.info(
          `Skipping ${title}: No ISBN, ASIN, or title/author match found`,
        );
        syncResult.status = 'skipped';
        syncResult.reason = 'No identifiers or successful match';
        syncResult.timing = performance.now() - startTime;
        return syncResult;
      }

      // Log successful matching strategy
      if (hardcoverMatch && !identifiers.isbn && !identifiers.asin) {
        logger.info(
          `${title}: Using title/author match (no identifiers available)`,
          {
            matchType: hardcoverMatch._matchType,
            userBookId: hardcoverMatch.userBook?.id,
            editionId: hardcoverMatch.edition?.id,
          },
        );
      }

      // Multi-key cache lookup - check all possible identifiers for this book
      // This handles cases where a book's matching method changes (e.g., title/author -> ISBN)
      const possibleCacheKeys = CacheKeyGenerator.generatePossibleKeys(
        identifiers,
        hardcoverMatch,
      );

      let cachedInfo = { exists: false };
      let cacheSource = null;

      try {
        // Try each possible cache key until we find a match
        for (const { key, type } of possibleCacheKeys) {
          logger.debug(`Checking cache with ${type} key: ${key}`, {
            title: title,
            keyType: type,
          });

          const cacheResult = await this.cache.getCachedBookInfo(
            this.userId,
            key,
            title,
            type,
          );

          if (cacheResult.exists) {
            cachedInfo = cacheResult;
            cacheSource = type;
            logger.debug(`Cache hit with ${type} key for "${title}"`, {
              key: key,
              lastSync: cachedInfo.last_sync,
            });
            break;
          }
        }

        if (cachedInfo.exists) {
          syncResult.cache_found = true;
          syncResult.cache_last_sync = cachedInfo.last_sync;
          syncResult.actions.push(
            `Found in cache via ${cacheSource} (last synced: ${new Date(cachedInfo.last_sync).toLocaleDateString()})`,
          );
        } else {
          logger.debug(`No cache entries found for "${title}"`, {
            keysChecked: possibleCacheKeys.map(k => `${k.type}:${k.key}`),
          });
        }
      } catch (cacheError) {
        logger.warn(`Cache lookup failed for ${title}`, {
          error: cacheError.message,
          keysAttempted: possibleCacheKeys.length,
        });
      }

      // Set cache storage preferences for new entries
      // Use the best available identifier in priority order: ASIN > ISBN > title_author
      const storageKey = CacheKeyGenerator.generateStorageKey(
        identifiers,
        hardcoverMatch,
      );
      const identifier = storageKey?.identifier;
      const identifierType = storageKey?.identifierType;

      // Determine how the match was found using BookMatcher's metadata
      let matchedIdentifierType = null;
      if (hardcoverMatch) {
        // Use the match type provided by BookMatcher strategies
        matchedIdentifierType = hardcoverMatch._matchType || 'unknown';

        if (
          hardcoverMatch._matchType === 'title_author' ||
          hardcoverMatch._isSearchResult
        ) {
          // This was found via title/author matching
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
        } else if (hardcoverMatch._matchType === 'asin') {
          // Found by ASIN
          logger.debug(`Found ASIN match for ${title}: ${identifiers.asin}`);
          syncResult.actions.push(
            `Found in Hardcover by ASIN: ${identifiers.asin}`,
          );
          syncResult.matching_method = 'asin';
        } else if (hardcoverMatch._matchType === 'isbn') {
          // Found by ISBN
          logger.debug(`Found ISBN match for ${title}: ${identifiers.isbn}`);
          syncResult.actions.push(
            `Found in Hardcover by ISBN: ${identifiers.isbn}`,
          );
          syncResult.matching_method = 'isbn';
        }
      }

      if (!hardcoverMatch) {
        // Check if we found a book via search but it's not in user's library
        const hasSearchResult = matchResult?.match?._isSearchResult;

        if (hasSearchResult && !this.globalConfig.auto_add_books) {
          // Book found via search but auto-add is disabled
          logger.info(
            `Book found in Hardcover database but not in your library: ${title}`,
            {
              foundTitle: matchResult.match.book?.title,
              foundEditionId: matchResult.match.edition?.id,
              foundFormat: matchResult.match.edition?.format,
              userFormat: extractedMetadata.userFormat || 'unknown',
              solution:
                'Enable auto_add_books or manually add book to Hardcover library',
            },
          );

          syncResult.actions.push(
            `Found in Hardcover database but not in your library`,
          );
          syncResult.status = 'skipped';
          syncResult.reason =
            'Book found but not in library - enable auto_add_books or add manually';
          syncResult.hardcover_book_id = matchResult.match.book?.id;
          syncResult.hardcover_edition_id = matchResult.match.edition?.id;
          syncResult.timing = performance.now() - startTime;
          return syncResult;
        } else if (!this.globalConfig.auto_add_books) {
          // Not found anywhere
          syncResult.actions.push(`Not found in Hardcover library`);
          syncResult.status = 'skipped';
          syncResult.reason =
            'Book not in Hardcover library and auto_add_books disabled';
          syncResult.timing = performance.now() - startTime;
          return syncResult;
        }

        // Check if book meets minimum progress threshold before auto-adding
        if (this._isZeroProgress(progressPercent)) {
          logger.info(
            `Skipping auto-add for ${title}: Progress ${progressPercent.toFixed(1)}% below threshold ${this.globalConfig.min_progress_threshold}%`,
            {
              title: title,
              progress: progressPercent,
              threshold: this.globalConfig.min_progress_threshold,
              reason: 'below_progress_threshold',
            },
          );
          syncResult.actions.push(
            `Not found in Hardcover library - progress ${progressPercent.toFixed(1)}% below auto-add threshold ${this.globalConfig.min_progress_threshold}%`,
          );
          syncResult.status = 'skipped';
          syncResult.reason = `Progress below auto-add threshold (${progressPercent.toFixed(1)}% < ${this.globalConfig.min_progress_threshold}%)`;
          syncResult.timing = performance.now() - startTime;
          return syncResult;
        }

        // Try to auto-add the book (progress meets threshold)
        logger.info(
          `Auto-adding ${title}: Progress ${progressPercent.toFixed(1)}% meets threshold ${this.globalConfig.min_progress_threshold}%`,
          {
            title: title,
            progress: progressPercent,
            threshold: this.globalConfig.min_progress_threshold,
          },
        );
        syncResult.actions.push(
          `Not found in Hardcover library - auto-adding (progress ${progressPercent.toFixed(1)}% meets threshold)`,
        );
        const autoAddResult = await this._tryAutoAddBook(
          absBook,
          identifiers,
          title,
          author,
        );
        syncResult.status = autoAddResult.status;
        syncResult.reason = autoAddResult.reason;
        syncResult.timing = performance.now() - startTime;
        return syncResult;
      }

      // Special handling for search result matches (ASIN, ISBN, or title/author)
      if (hardcoverMatch._isSearchResult) {
        // This book was found via search but isn't in the user's library yet
        // We need to add it to the library first, then sync progress

        // Determine the match type for logging
        const matchType =
          hardcoverMatch._matchType === 'asin_search_result'
            ? 'asin'
            : hardcoverMatch._matchType === 'isbn_search_result'
              ? 'isbn'
              : 'title_author';
        const matchDescription =
          matchType === 'asin'
            ? 'ASIN match'
            : matchType === 'isbn'
              ? 'ISBN match'
              : 'title/author match';

        // Check if book meets minimum progress threshold before auto-adding
        if (this._isZeroProgress(progressPercent)) {
          logger.info(
            `Skipping ${matchDescription} auto-add for ${title}: Progress ${progressPercent.toFixed(1)}% below threshold ${this.globalConfig.min_progress_threshold}%`,
            {
              title: title,
              progress: progressPercent,
              threshold: this.globalConfig.min_progress_threshold,
              matchType: matchType,
              reason: 'below_progress_threshold',
            },
          );
          syncResult.actions.push(
            `${matchDescription} found but progress ${progressPercent.toFixed(1)}% below auto-add threshold ${this.globalConfig.min_progress_threshold}%`,
          );
          syncResult.status = 'skipped';
          syncResult.reason = `Progress below auto-add threshold for ${matchDescription} (${progressPercent.toFixed(1)}% < ${this.globalConfig.min_progress_threshold}%)`;
          syncResult.timing = performance.now() - startTime;
          return syncResult;
        }

        logger.debug(
          `${matchDescription} requires auto-add to library: ${title} (progress: ${progressPercent.toFixed(1)}%)`,
        );

        // For search results, userBook might be null (ASIN/ISBN matches) or populated (title/author matches)
        let bookId = hardcoverMatch.userBook?.book?.id;
        const editionId = hardcoverMatch.edition.id;

        // If book ID is missing, look it up from the edition ID
        if (!bookId && hardcoverMatch._needsBookIdLookup) {
          logger.debug(`Looking up book ID from edition ID: ${editionId}`);

          try {
            const bookInfo =
              await this.hardcover.getBookIdFromEdition(editionId);
            if (bookInfo && bookInfo.bookId) {
              bookId = bookInfo.bookId;
              // Update the match object with the resolved book info
              // Only update userBook if it exists (title/author matches have userBook, ASIN/ISBN matches don't)
              if (hardcoverMatch.userBook?.book) {
                hardcoverMatch.userBook.book.id = bookId;
                hardcoverMatch.userBook.book.title =
                  bookInfo.title || hardcoverMatch.userBook.book.title;
                hardcoverMatch.userBook.book.contributions =
                  bookInfo.contributions ||
                  hardcoverMatch.userBook.book.contributions;
              }

              // Update edition metadata if available
              if (bookInfo.edition) {
                Object.assign(hardcoverMatch.edition, bookInfo.edition);

                // Determine correct format using Hardcover as source of truth
                const detectedFormat = this._mapHardcoverFormatToInternal(
                  bookInfo.edition,
                );

                // Update the format in the edition object
                hardcoverMatch.edition.format = detectedFormat;

                logger.debug(
                  `Updated edition format for ${title}: ${detectedFormat}`,
                  {
                    editionId: editionId,
                    pages: bookInfo.edition.pages,
                    audioSeconds: bookInfo.edition.audio_seconds,
                    physicalFormat: bookInfo.edition.physical_format,
                    readingFormat: bookInfo.edition.reading_format?.format,
                  },
                );
              }

              hardcoverMatch._needsBookIdLookup = false;

              logger.debug(
                `Successfully resolved book ID: ${bookId} for edition: ${editionId}`,
              );
            } else {
              logger.error(
                `Failed to lookup book ID for edition: ${editionId}`,
                {
                  title: title,
                  editionId: editionId,
                },
              );
              syncResult.status = 'error';
              syncResult.reason = `Failed to resolve book ID for edition ${editionId} - may indicate API or data issue`;
              syncResult.timing = performance.now() - startTime;
              return syncResult;
            }
          } catch (error) {
            logger.error(
              `Error during book ID lookup for edition: ${editionId}`,
              {
                error: error.message,
                title: title,
                editionId: editionId,
              },
            );
            syncResult.status = 'error';
            syncResult.reason = `Failed to lookup book ID: ${error.message}`;
            syncResult.timing = performance.now() - startTime;
            return syncResult;
          }
        }

        // Final validation - we must have both IDs to proceed
        if (!bookId || !editionId) {
          logger.error(
            `Missing required IDs for adding title/author matched book to library`,
            {
              bookId: bookId,
              editionId: editionId,
              title: title,
              hasBook: !!hardcoverMatch.userBook?.book,
              hasEdition: !!hardcoverMatch.edition,
              attemptedLookup: hardcoverMatch._needsBookIdLookup,
            },
          );

          syncResult.status = 'error';
          syncResult.reason = `Failed to add matched book: Missing book ID (${bookId}) or edition ID (${editionId})`;
          syncResult.timing = performance.now() - startTime;
          return syncResult;
        }

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

            if (addResult && addResult.id) {
              syncResult.actions.push(
                `Added matched book to Hardcover library`,
              );

              // Update the match object to look like a regular library match
              // For ASIN/ISBN matches, userBook is null, so we need to create it
              if (!hardcoverMatch.userBook) {
                hardcoverMatch.userBook = {
                  id: addResult.id,
                  book: {
                    id: bookId,
                    title: title,
                    contributions: [], // Will be populated from the edition data if available
                  },
                };
              } else {
                hardcoverMatch.userBook.id = addResult.id;
              }
              hardcoverMatch._isSearchResult = false; // No longer just a search result
            } else {
              logger.error(
                `Failed to add title/author matched book to library: API returned null`,
                {
                  bookId: bookId,
                  editionId: editionId,
                  title: title,
                },
              );
              syncResult.status = 'error';
              syncResult.reason = `Failed to add matched book: API returned null response`;
              syncResult.timing = performance.now() - startTime;
              return syncResult;
            }
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
      if (!this.globalConfig.force_sync) {
        const hasChanged = await this.cache.hasProgressChanged(
          this.userId,
          identifier,
          title,
          progressPercent,
          identifierType,
        );

        if (!hasChanged) {
          logger.debug(`Skipping ${title}: Progress unchanged`);
          syncResult.status = 'skipped';
          syncResult.reason = 'Progress unchanged';
          syncResult.timing = performance.now() - startTime;
          return syncResult;
        } else {
          syncResult.progress_changed = true;
          // Log progress change details for debugging
          const previousProgress = await this.cache.getLastProgress(
            this.userId,
            identifier,
            title,
            identifierType,
          );
          const changeAnalysis = ProgressManager.detectProgressChange(
            previousProgress,
            progressPercent,
            { context: `book "${title}" change detection` },
          );
          logger.debug(`Progress change detected for ${title}`, changeAnalysis);
        }
      } else {
        syncResult.progress_changed = true;
      }

      // Session-based delayed updates decision
      if (syncResult.progress_changed) {
        const sessionDecision = await this.sessionManager.shouldDelayUpdate(
          this.userId,
          identifier,
          title,
          progressPercent,
          absBook,
          identifierType,
        );

        logger.debug(`Session decision for ${title}:`, sessionDecision);

        if (sessionDecision.shouldDelay) {
          // Delay the update - store in session
          const sessionUpdated = await this.sessionManager.updateSession(
            this.userId,
            identifier,
            title,
            progressPercent,
            identifierType,
          );

          if (sessionUpdated) {
            syncResult.status = 'delayed';
            syncResult.reason = `Session-based delay: ${sessionDecision.reason}`;
            syncResult.session_info = {
              action: sessionDecision.action,
              reason: sessionDecision.reason,
              sessionTimeout: sessionDecision.sessionTimeout,
            };
            syncResult.timing = performance.now() - startTime;
            logger.debug(`Delayed update for ${title} - stored in session`);
            return syncResult;
          } else {
            // If session update failed, fall back to immediate sync
            logger.warn(
              `Failed to store session for ${title}, falling back to immediate sync`,
            );
          }
        } else {
          // Immediate sync required
          syncResult.sync_reason = sessionDecision.reason;
          if (sessionDecision.isCompletion) {
            syncResult.completion_bypass = true;
          }
          if (sessionDecision.forcedSync) {
            syncResult.forced_sync = sessionDecision.reason;
          }
          logger.debug(
            `Immediate sync for ${title}: ${sessionDecision.reason}`,
          );
        }
      }

      // Sync the existing book
      const existingSyncResult = await this._syncExistingBook(
        absBook,
        hardcoverMatch,
        matchedIdentifierType,
        identifier,
        title,
        author,
      );

      // Merge results
      syncResult.status = existingSyncResult.status;
      syncResult.reason = existingSyncResult.reason;
      syncResult.progress_after = progressPercent;

      // Add API response info if available
      if (existingSyncResult.api_response) {
        syncResult.api_response = existingSyncResult.api_response;
      }

      // Complete session if sync was successful
      if (
        syncResult.progress_changed &&
        existingSyncResult.status === 'updated'
      ) {
        const sessionCompleted = await this.sessionManager.completeSession(
          this.userId,
          identifier,
          title,
          progressPercent,
          identifierType,
        );

        if (sessionCompleted) {
          syncResult.session_completed = true;
          logger.debug(`Completed session for ${title} after successful sync`);
        }
      }

      syncResult.timing = performance.now() - startTime;
      return syncResult;
    } finally {
      // Always remove the book from processing tracking
      this.booksBeingProcessed.delete(bookKey);
    }
  }

  async _tryAutoAddBook(absBook, identifiers, title, author) {
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
        // Try title/author fallback if identifier searches failed
        logger.info(
          `Auto-add identifier search failed for "${title}", trying title/author fallback`,
          {
            attemptedIdentifiers: {
              asin: identifiers.asin || 'N/A',
              isbn: identifiers.isbn || 'N/A',
            },
            targetTitle: title,
            targetAuthor: author || 'N/A',
            fallbackEnabled: !this.dryRun,
          },
        );

        if (!this.dryRun) {
          try {
            // Use existing TitleAuthorMatcher instead of duplicating logic
            const { TitleAuthorMatcher } = await import(
              './matching/strategies/title-author-matcher.js'
            );
            const titleAuthorMatcher = new TitleAuthorMatcher(
              this.hardcover,
              this.cache,
              this.globalConfig,
            );

            // Use the existing findMatch method for search results (not user library lookup)
            const titleAuthorMatch = await titleAuthorMatcher.findMatch(
              absBook,
              this.userId,
              null, // No user library lookup needed for auto-add
              null,
            );

            if (titleAuthorMatch && titleAuthorMatch._isSearchResult) {
              // Determine the match type for logging
              const matchType =
                titleAuthorMatch._matchType === 'asin_search_result'
                  ? 'asin'
                  : titleAuthorMatch._matchType === 'isbn_search_result'
                    ? 'isbn'
                    : 'title_author';
              const matchDescription =
                matchType === 'asin'
                  ? 'ASIN'
                  : matchType === 'isbn'
                    ? 'ISBN'
                    : 'title/author fallback';

              logger.info(
                `Auto-add ${matchDescription} successful for "${title}"`,
                {
                  matchType: titleAuthorMatch._matchType,
                  bookConfidence:
                    titleAuthorMatch._bookIdentificationScore?.totalScore?.toFixed(
                      1,
                    ) + '%' || 'N/A',
                  hardcoverTitle:
                    titleAuthorMatch.book?.title ||
                    titleAuthorMatch.edition?.book?.title,
                  hardcoverAuthor:
                    titleAuthorMatch.userBook?.book?.contributions
                      ?.map(c => c.author?.name)
                      .join(', ') || 'N/A',
                  bookId:
                    titleAuthorMatch.book?.id ||
                    titleAuthorMatch.userBook?.book?.id,
                  needsEditionLookup: titleAuthorMatch._needsEditionIdLookup,
                },
              );

              // Handle edition lookup for search API results
              if (
                titleAuthorMatch._needsEditionIdLookup &&
                titleAuthorMatch.userBook?.book?.id
              ) {
                logger.debug(
                  `Looking up edition information for book ${titleAuthorMatch.userBook.book.id}`,
                );

                const editionInfo =
                  await this.hardcover.getPreferredEditionFromBookId(
                    titleAuthorMatch.userBook.book.id,
                    'audiobook', // Prefer audiobook format for AudioBookshelf integration
                  );

                if (editionInfo) {
                  // Convert to searchResults format with proper edition data
                  searchResults = [
                    {
                      id: editionInfo.edition.id, // Now we have the real edition ID
                      book: {
                        id: editionInfo.bookId,
                        title: editionInfo.title,
                      },
                      format:
                        editionInfo.edition.reading_format?.format ||
                        'audiobook',
                      asin: editionInfo.edition.asin,
                      isbn_10: editionInfo.edition.isbn_10,
                      isbn_13: editionInfo.edition.isbn_13,
                      pages: editionInfo.edition.pages,
                      audio_seconds: editionInfo.edition.audio_seconds,
                    },
                  ];

                  logger.debug(`Edition lookup successful`, {
                    bookId: editionInfo.bookId,
                    editionId: editionInfo.edition.id,
                    format: editionInfo.edition.reading_format?.format,
                  });
                } else {
                  logger.warn(
                    `Edition lookup failed for book ${titleAuthorMatch.userBook?.book?.id || 'Unknown Book ID'}`,
                  );
                  searchResults = [];
                }
              } else {
                // Convert the match to the expected searchResults format for auto-add
                searchResults = [
                  {
                    id: titleAuthorMatch.edition.id,
                    book: titleAuthorMatch.edition.book,
                    format: titleAuthorMatch.edition.format,
                  },
                ];
              }
            } else {
              logger.info(
                `Auto-add title/author fallback failed for "${title}"`,
                {
                  searchedTitle: title,
                  searchedAuthor: author || 'N/A',
                  matchFound: !!titleAuthorMatch,
                  isSearchResult: titleAuthorMatch?._isSearchResult || false,
                  matchType: titleAuthorMatch?._matchType || 'N/A',
                  reason: !titleAuthorMatch
                    ? 'No matches found in title/author search'
                    : 'Match found but not suitable for auto-add (likely already in library)',
                },
              );
            }
          } catch (titleAuthorError) {
            logger.warn(
              `Title/author fallback search failed for auto-add of ${title}`,
              {
                error: titleAuthorError.message,
              },
            );
          }
        }

        // If still no results after all attempts
        if (searchResults.length === 0) {
          if (this.globalConfig.force_sync) {
            logger.warn(
              `Force sync: Book ${title} not found in Hardcover database - attempted identifier and title/author searches`,
              {
                searchedIdentifiers: identifiers,
                dryRun: this.dryRun,
                forceSync: true,
              },
            );
            return {
              status: 'skipped',
              reason:
                'Book not found in Hardcover (force sync attempted with all search methods)',
              title,
              forceSync: true,
            };
          } else {
            logger.info(
              `Could not find ${title} in Hardcover database after all search attempts`,
              {
                searchedIdentifiers: identifiers,
                titleAuthorAttempted: !this.dryRun,
                dryRun: this.dryRun,
              },
            );
            return {
              status: 'skipped',
              reason:
                'Book not found in Hardcover after identifier and title/author searches',
              title,
            };
          }
        }
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

      // Start transaction for auto-add operation
      const transaction = new Transaction(`auto-add: ${title}`);
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
        // Use author from metadata (already extracted)

        // Add API rollback callback
        const _apiRollbackNeeded = true;
        transaction.add(async () => {
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

          const currentProgress =
            ProgressManager.extractProgressPercentage(absBook);

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

              // Check if book should be marked as completed using ProgressManager
              const isComplete = ProgressManager.isBookComplete(
                absBook,
                `auto-added book "${title}" completion check`,
                {},
                edition, // Pass edition for consistent format detection
              );

              if (isComplete) {
                const isFinished = ProgressManager.extractFinishedFlag(absBook);
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
                  detectedBy: isFinished
                    ? 'isFinished flag'
                    : 'progress threshold',
                });
              } else {
                await this._handleProgressStatus(
                  addResult.id,
                  edition,
                  title,
                  currentProgress,
                  absBook,
                  author,
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

          await transaction.commit();
          return { status: 'auto_added', title, userBookId: addResult.id };
        } catch (cacheError) {
          // Cache transaction failed, rollback API changes
          logger.error(`Cache transaction failed for auto-add ${title}`, {
            error: cacheError.message,
            stack: cacheError.stack,
          });
          await transaction.rollback(logger);
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
    title,
    author,
  ) {
    const progressPercent = ProgressManager.extractProgressPercentage(absBook);
    const { userBook, edition } = hardcoverMatch;

    // Check if this is an auto-add scenario (userBook is null)
    if (!userBook) {
      logger.debug(`Book not in user's library, needs auto-add: ${title}`, {
        currentProgress: progressPercent,
        editionId: edition?.id,
        bookId: hardcoverMatch.book?.id,
      });

      // For auto-add scenarios, delegate to the auto-add method
      const identifiers = {
        isbn: edition?.isbn_13 || edition?.isbn_10,
        asin: edition?.asin,
      };

      return await this._tryAutoAddBook(absBook, identifiers, title, author);
    }

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
        author,
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
        // Get current progress from Hardcover for regression analysis
        const progressInfo = await this.hardcover.getBookCurrentProgress(
          userBook.id,
        );
        let previousProgress = null;

        if (
          progressInfo &&
          progressInfo.has_progress &&
          progressInfo.latest_read
        ) {
          const latestRead = progressInfo.latest_read;
          if (latestRead.edition) {
            if (
              latestRead.progress_seconds &&
              latestRead.edition.audio_seconds
            ) {
              previousProgress = ProgressManager.calculateProgressFromPosition(
                latestRead.progress_seconds,
                latestRead.edition.audio_seconds,
                {
                  type: 'seconds',
                  context: `book "${title}" previous progress calculation (audio)`,
                },
              );
            } else if (latestRead.progress_pages && latestRead.edition.pages) {
              previousProgress = ProgressManager.calculateProgressFromPosition(
                latestRead.progress_pages,
                latestRead.edition.pages,
                {
                  type: 'pages',
                  context: `book "${title}" previous progress calculation (pages)`,
                },
              );
            }
          }
        }

        // Use ProgressManager for regression analysis
        const regressionAnalysis = ProgressManager.analyzeProgressRegression(
          previousProgress,
          progressPercent,
          {
            rereadThreshold:
              this.globalConfig.reread_detection?.reread_threshold || 30,
            highProgressThreshold:
              this.globalConfig.reread_detection?.high_progress_threshold || 85,
            blockThreshold:
              this.globalConfig.reread_detection?.regression_block_threshold ||
              50,
            warnThreshold:
              this.globalConfig.reread_detection?.regression_warn_threshold ||
              15,
            context: `book "${title}" regression check`,
          },
        );

        if (regressionAnalysis.shouldBlock) {
          logger.warn(
            `Blocking progress regression for ${title}: ${regressionAnalysis.reason}`,
          );
          return {
            status: 'skipped',
            reason: `Progress regression protection: ${regressionAnalysis.reason}`,
            title,
          };
        }

        if (regressionAnalysis.shouldWarn) {
          logger.warn(
            `Progress regression detected for ${title}: ${regressionAnalysis.reason}`,
          );
        }
      }

      // Use centralized completion detection with ProgressManager
      const isComplete = ProgressManager.isBookComplete(
        absBook,
        `book "${title}" completion check`,
        {},
        edition, // Pass edition for consistent format detection
      );

      if (isComplete) {
        const isFinished = ProgressManager.extractFinishedFlag(absBook);
        logger.debug(`Book ${title} is complete`, {
          isFinished: isFinished,
          progress: progressPercent,
          detectedBy: isFinished ? 'isFinished flag' : 'progress threshold',
        });

        // Check if book was already marked as completed in cache to avoid re-processing
        const identifier = extractBookIdentifiers(absBook);
        const identifierType = identifier.asin ? 'asin' : 'isbn';
        const identifierValue = identifier.asin || identifier.isbn;

        const cachedInfo = await this.cache.getCachedBookInfo(
          this.userId,
          identifierValue,
          title,
          identifierType,
        );

        if (
          cachedInfo.exists &&
          cachedInfo.finished_at &&
          !this.globalConfig.force_sync
        ) {
          logger.debug(
            `Book ${title} already marked as completed, skipping re-processing`,
            {
              finishedAt: cachedInfo.finished_at,
              lastSync: cachedInfo.last_sync,
              userBookId: userBook.id,
            },
          );
          return { status: 'completed', title, cached: true };
        } else if (
          cachedInfo.exists &&
          cachedInfo.finished_at &&
          this.globalConfig.force_sync
        ) {
          logger.debug(`Force sync: Re-processing completed book ${title}`, {
            finishedAt: cachedInfo.finished_at,
            lastSync: cachedInfo.last_sync,
            userBookId: userBook.id,
            forceSync: true,
          });
        }

        return await this._handleCompletionStatus(
          userBook.id,
          selectedEdition,
          title,
          progressPercent,
          absBook,
          isFinished,
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
        author,
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

  async _selectEditionWithCache(
    absBook,
    hardcoverMatch,
    title,
    bookAuthor = 'Unknown Author',
  ) {
    const { userBook, edition } = hardcoverMatch;
    const author = bookAuthor; // Ensure author is available in function scope

    // Check cache first - handle missing identifiers properly for title/author matches
    const identifier = extractBookIdentifiers(absBook);
    let identifierType, identifierValue;

    if (identifier.asin) {
      identifierType = 'asin';
      identifierValue = identifier.asin;
    } else if (identifier.isbn) {
      identifierType = 'isbn';
      identifierValue = identifier.isbn;
    } else {
      // Title/author match without identifiers - create synthetic identifier
      // This prevents the "NOT NULL constraint failed" error
      identifierType = 'title_author';
      identifierValue = `title_author_${userBook.id}_${edition.id}`;
      logger.debug(
        `Created synthetic identifier for title/author match: ${identifierValue}`,
        {
          title: title,
          userBookId: userBook.id,
          editionId: edition.id,
        },
      );
    }

    // Only check cache if we have a valid identifier
    let cachedEditionId = null;
    if (identifierValue) {
      cachedEditionId = await this.cache.getEditionForBook(
        this.userId,
        identifierValue,
        title,
        identifierType,
      );
    }

    if (cachedEditionId) {
      // Find the cached edition in the book's editions
      const book = userBook.book;
      if (book && book.editions) {
        const cachedEdition = book.editions.find(e => e.id === cachedEditionId);
        if (cachedEdition) {
          // Apply format extraction consistently
          return {
            ...cachedEdition,
            format: this._mapHardcoverFormatToInternal(cachedEdition),
          };
        }
      }
    }

    // Use the matched edition and cache it in transaction
    if (edition) {
      // Use author from metadata (already extracted)

      try {
        // Only store edition mapping if we have a valid identifier
        if (identifierValue && identifierType) {
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
          logger.debug(`Successfully cached edition mapping for ${title}`, {
            identifier: identifierValue,
            identifierType: identifierType,
            editionId: edition.id,
          });
        } else {
          logger.warn(
            `Skipping cache storage for ${title}: invalid identifier`,
            {
              identifierValue: identifierValue,
              identifierType: identifierType,
            },
          );
        }

        return edition;
      } catch (error) {
        logger.error(
          `Failed to cache edition mapping for ${title}: ${error.message}`,
          {
            identifier: identifierValue,
            identifierType: identifierType,
            stack: error.stack,
          },
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

      // OPTIMIZATION: Pre-extract identifiers before API call to enable immediate caching after success
      const identifier = extractBookIdentifiers(absBook);
      let identifierType = identifier.asin ? 'asin' : 'isbn';
      let identifierValue = identifier.asin || identifier.isbn;

      // If no ISBN/ASIN available, create a fallback identifier using title + author
      if (
        !identifierValue ||
        typeof identifierValue !== 'string' ||
        identifierValue.trim() === ''
      ) {
        const author =
          absBook.media?.metadata?.authors?.[0]?.name || 'Unknown Author';
        const fallbackIdentifier = `${title}:${author}`
          .toLowerCase()
          .replace(/[^a-z0-9:]/g, '');

        logger.warn(
          `No ISBN/ASIN found for "${title}" - using fallback identifier`,
          {
            userId: this.userId,
            userBookId,
            extractedIdentifiers: identifier,
            title,
            author,
            fallbackIdentifier,
          },
        );

        identifierValue = fallbackIdentifier;
        identifierType = 'title_author';
      }

      // Start transaction for completion operation
      const transaction = new Transaction(`complete: ${title}`);
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
        transaction.add(async () => {
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

        // Store completion data in transaction (identifiers already extracted above)

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

          await transaction.commit();
          return { status: 'completed', title };
        } catch (cacheError) {
          // Cache transaction failed, rollback API changes
          logger.error(`Cache transaction failed for completion ${title}`, {
            error: cacheError.message,
            stack: cacheError.stack,
          });
          await transaction.rollback(logger);
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
    author,
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
        currentProgress = ProgressManager.calculateCurrentPosition(
          progressPercent,
          edition.audio_seconds,
          {
            type: 'seconds',
            context: `book "${title}" audio progress calculation`,
          },
        );
        useSeconds = true;
      } else if (edition.pages) {
        currentProgress = ProgressManager.calculateCurrentPosition(
          progressPercent,
          edition.pages,
          {
            type: 'pages',
            context: `book "${title}" page progress calculation`,
          },
        );
      }

      logger.debug(
        `📊 Calculated ${title} progress: ${progressPercent.toFixed(1)}%`,
        {
          [useSeconds ? 'progress' : 'progress']: useSeconds
            ? `${formatDurationForLogging(currentProgress)} of ${formatDurationForLogging(edition.audio_seconds)}`
            : `page ${currentProgress} of ${edition.pages}`,
          format: edition.format || (useSeconds ? 'audiobook' : 'book'),
        },
      );

      // Start transaction for progress operation
      const transaction = new Transaction(`progress: ${title}`);
      let previousProgress = null;

      // Get previous progress for rollback
      const identifier = extractBookIdentifiers(absBook);
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

      // Get reading format ID for enhanced accuracy
      const readingFormatId = this._getReadingFormatId(edition);

      const result = await this.hardcover.updateReadingProgress(
        userBookId,
        currentProgress,
        progressPercent,
        edition.id,
        useSeconds,
        this._formatDateForHardcover(absBook.started_at), // Use formatted date instead of raw value
        this.globalConfig.reread_detection, // Pass reread configuration
        readingFormatId, // Enhanced format accuracy
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
        transaction.add(async () => {
          logger.info(`Rolling back progress update for ${title}`);
          if (previousProgress !== null) {
            try {
              const rollbackCurrentProgress = useSeconds
                ? ProgressManager.calculateCurrentPosition(
                    previousProgress,
                    edition.audio_seconds || 0,
                    {
                      type: 'seconds',
                      context: `book "${title}" rollback calculation`,
                    },
                  )
                : ProgressManager.calculateCurrentPosition(
                    previousProgress,
                    edition.pages || 0,
                    {
                      type: 'pages',
                      context: `book "${title}" rollback calculation`,
                    },
                  );

              logger.debug(`Rolling back to previous progress`, {
                [useSeconds ? 'rollback_seconds' : 'rollback_pages']: useSeconds
                  ? `${rollbackCurrentProgress} (${formatDurationForLogging(rollbackCurrentProgress)})`
                  : rollbackCurrentProgress,
                previousProgressPercent: previousProgress,
              });

              // Get reading format ID for rollback accuracy
              const rollbackReadingFormatId = this._getReadingFormatId(edition);

              await this.hardcover.updateReadingProgress(
                userBookId,
                rollbackCurrentProgress,
                previousProgress,
                edition.id,
                useSeconds,
                this._formatDateForHardcover(absBook.started_at),
                this.globalConfig.reread_detection,
                rollbackReadingFormatId, // Enhanced format accuracy
              );
            } catch (rollbackError) {
              logger.error(`Failed to rollback progress for ${title}`, {
                error: rollbackError.message,
              });
            }
          }
        });

        try {
          // Store progress data using helper method to avoid scoping issues
          await this._storeProgressData(
            identifierValue,
            identifierType,
            title,
            author,
            edition.id,
            progressPercent,
            absBook,
          );

          await transaction.commit();
          return { status: 'synced', title };
        } catch (cacheError) {
          // Cache transaction failed, rollback API changes
          logger.error(`Cache transaction failed for progress ${title}`, {
            error: cacheError.message,
            stack: cacheError.stack,
          });
          await transaction.rollback(logger);
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
      case 'delayed':
        result.books_delayed++;
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

      // Abort any pending queued tasks and clear queue
      if (this.taskQueue) {
        this.taskQueue.clear();
      }
      if (this.abortController) {
        this.abortController.abort();
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

  /**
   * Helper method to store progress data in cache
   * Extracted to avoid scoping issues in complex nested functions
   */
  async _storeProgressData(
    identifierValue,
    identifierType,
    title,
    author,
    editionId,
    progressPercent,
    absBook,
  ) {
    logger.debug(`Caching progress data for ${title}`, {
      identifier: identifierValue,
      identifierType: identifierType,
      progress: progressPercent,
    });

    await this.cache.storeBookSyncData(
      this.userId,
      identifierValue,
      title,
      editionId,
      identifierType,
      author,
      progressPercent,
      absBook.last_listened_at,
      absBook.started_at,
    );
  }

  /**
   * Process expired sessions by syncing their final progress to Hardcover
   * This runs at the beginning of each sync cycle
   * @private
   */
  async _processExpiredSessions() {
    try {
      const processingResult = await this.sessionManager.processExpiredSessions(
        this.userId,
        async sessionData => {
          // Callback to sync expired session progress to Hardcover
          logger.info(`Processing expired session for ${sessionData.title}`, {
            finalProgress: sessionData.finalProgress,
            identifier: sessionData.identifier,
            identifierType: sessionData.identifierType,
          });

          // Create a mock book object for the sync process
          const mockBook = {
            id: `expired-session-${sessionData.identifier}`,
            progress_percentage: sessionData.finalProgress,
            is_finished: sessionData.finalProgress >= 95,
            last_listened_at: sessionData.sessionData.session_last_change,
            started_at:
              sessionData.sessionData.started_at ||
              sessionData.sessionData.session_last_change,
          };

          // Find the book match using the stored identifier
          const identifiers = {};
          identifiers[sessionData.identifierType] = sessionData.identifier;

          // Try to find existing Hardcover match
          const matchResult = await this.bookMatcher.findMatchByIdentifier(
            identifiers,
            sessionData.title,
            sessionData.identifierType,
          );

          if (matchResult && matchResult.match) {
            // Sync directly to Hardcover using the existing match
            await this._syncToHardcover(
              mockBook,
              matchResult.match,
              sessionData.identifier,
              sessionData.title,
              sessionData.finalProgress,
              sessionData.identifierType,
            );

            logger.info(
              `Successfully synced expired session for ${sessionData.title}`,
            );
          } else {
            logger.warn(
              `Could not find Hardcover match for expired session: ${sessionData.title}`,
            );
          }
        },
      );

      if (processingResult.processed > 0) {
        console.log(
          `📋 Processed ${processingResult.processed} expired sessions`,
        );
        logger.info(`Processed expired sessions`, processingResult);
      }

      return processingResult;
    } catch (err) {
      logger.error(`Error processing expired sessions: ${err.message}`);
      return { processed: 0, errors: 1 };
    }
  }

  /**
   * Sync progress directly to Hardcover (used for expired sessions)
   * @private
   */
  async _syncToHardcover(
    mockBook,
    hardcoverMatch,
    identifier,
    title,
    progressPercent,
    identifierType,
  ) {
    try {
      if (!this.dryRun) {
        // Update reading progress on Hardcover
        const result = await this.hardcover.updateReadingProgress(
          hardcoverMatch.userBookId,
          progressPercent,
          progressPercent,
          hardcoverMatch.edition.id,
          hardcoverMatch.useSeconds || false,
          mockBook.started_at,
          this.globalConfig.reread_detection,
          null, // reading format ID
        );

        if (result && result.id) {
          logger.debug(
            `Updated Hardcover progress for ${title}: ${progressPercent}%`,
          );
        }
      } else {
        logger.info(
          `[DRY RUN] Would update Hardcover progress for ${title}: ${progressPercent}%`,
        );
      }

      // Store the final progress in cache
      await this.cache.storeProgress(
        this.userId,
        identifier,
        title,
        progressPercent,
        identifierType,
        mockBook.last_listened_at,
        mockBook.started_at,
      );
    } catch (err) {
      logger.error(
        `Error syncing expired session to Hardcover for ${title}: ${err.message}`,
      );
      throw err;
    }
  }
}
