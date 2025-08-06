import axios from 'axios';
import { Agent } from 'https';
import { Agent as HttpAgent } from 'http';
import { RateLimiter, Semaphore, normalizeApiToken } from './utils.js';
import ProgressManager from './progress-manager.js';
import logger from './logger.js';

// Remove the global semaphore, make it per-instance

export class AudiobookshelfClient {
  constructor(
    baseUrl,
    token,
    semaphoreConcurrency = 1,
    maxBooksToFetch = null,
    pageSize = 100,
    rateLimitPerMinute = 600,
    rereadConfig = {},
    libraryConfig = null,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.token = normalizeApiToken(token, 'Audiobookshelf');
    this.semaphore = new Semaphore(semaphoreConcurrency);
    this.rateLimiter = new RateLimiter(rateLimitPerMinute);
    this.maxBooksToFetch = maxBooksToFetch;
    this.pageSize = pageSize;
    this.rereadConfig = rereadConfig;
    this.libraryConfig = libraryConfig;

    // Create HTTP agents with keep-alive for connection reuse
    const isHttps = this.baseUrl.startsWith('https');
    const agent = isHttps
      ? new Agent({
          keepAlive: true,
          maxSockets: 10,
          maxFreeSockets: 5,
          timeout: 60000,
          freeSocketTimeout: 30000, // Keep connections alive for 30s
        })
      : new HttpAgent({
          keepAlive: true,
          maxSockets: 10,
          maxFreeSockets: 5,
          timeout: 60000,
          freeSocketTimeout: 30000,
        });

    // Create axios instance with default config
    this.axios = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 second timeout
      httpsAgent: isHttps ? agent : undefined,
      httpAgent: !isHttps ? agent : undefined,
      // Optimize for multiple requests
      maxRedirects: 5,
      validateStatus: status => status < 500, // Don't retry 4xx errors
    });

    // Store agent for cleanup
    this._httpAgent = agent;

    // Add request interceptor for rate limiting and logging
    this.axios.interceptors.request.use(async config => {
      await this.rateLimiter.waitIfNeeded('audiobookshelf');
      return config;
    });

    // Add response interceptor for logging
    this.axios.interceptors.response.use(
      response => {
        logger.debug(
          `${response.config.method?.toUpperCase()} ${response.config.url} -> ${response.status}`,
        );
        return response;
      },
      error => {
        const status = error.response?.status || 'ERR';
        logger.debug(
          `${error.config?.method?.toUpperCase()} ${error.config?.url} -> ${status}`,
        );
        return Promise.reject(error);
      },
    );

    logger.debug('AudiobookshelfClient initialized', {
      baseUrl: this.baseUrl,
      semaphoreConcurrency,
      rateLimitPerMinute,
      keepAlive: true,
    });
  }

  /**
   * Clean up HTTP connections and resources
   */
  cleanup() {
    if (this._httpAgent) {
      this._httpAgent.destroy();
      logger.debug('AudiobookshelfClient HTTP agent cleaned up');
    }
  }

  async testConnection() {
    try {
      const response = await this._makeRequest('GET', '/ping');
      return response !== null;
    } catch (error) {
      logger.error('Audiobookshelf connection test failed', {
        error: error.message,
        stack: error.stack,
      });
      return false;
    }
  }

  async getReadingProgress() {
    logger.debug('Fetching reading progress from Audiobookshelf');

    try {
      // Get user info first
      const userData = await this._getCurrentUser();
      if (!userData) {
        throw new Error('Could not get current user data, aborting sync.');
      }

      // Get all libraries and apply filtering
      const allLibraries = await this.getLibraries();
      const libraryFilter = this.filterLibraries(allLibraries);
      const librariesToProcess = libraryFilter.libraries;

      // Log library filtering results
      if (libraryFilter.stats.unmatched.length > 0) {
        console.log(
          `⚠️  Warning: Some library filters didn't match any libraries: ${libraryFilter.stats.unmatched.join(', ')}`,
        );
        console.log(
          `📚 Available libraries: ${allLibraries.map(lib => lib.name).join(', ')}`,
        );
      }

      if (libraryFilter.stats.excluded > 0) {
        console.log(
          `📚 Processing ${libraryFilter.stats.included} of ${libraryFilter.stats.total} libraries (${libraryFilter.stats.excluded} excluded by filter)`,
        );
      }

      // Check if no libraries match the filter
      if (librariesToProcess.length === 0) {
        console.log(`❌ No libraries match your filter configuration!`);
        console.log(
          `📚 Available libraries: ${allLibraries.map(lib => lib.name).join(', ')}`,
        );
        logger.warn('No libraries match filter configuration', {
          libraryConfig: this.libraryConfig,
          availableLibraries: allLibraries.map(lib => ({
            id: lib.id,
            name: lib.name,
          })),
        });
        // Return empty result but don't throw error
        return [];
      }

      // Get total library size for complete filtering stats (only from libraries being processed)
      let totalBooksInLibrary = 0;
      for (const library of librariesToProcess) {
        const response = await this._makeRequest(
          'GET',
          `/api/libraries/${library.id}/items?limit=1&page=0`,
        );
        if (response && response.total !== undefined) {
          totalBooksInLibrary += response.total;
        }
      }
      logger.debug('Total books in filtered libraries', {
        count: totalBooksInLibrary,
        librariesProcessed: librariesToProcess.length,
        librariesSkipped: libraryFilter.stats.excluded,
      });

      // Get library items in progress (these have some progress)
      const progressItems = await this._getItemsInProgress();
      logger.debug('Found items in progress', { count: progressItems.length });

      // Always check for completed books to ensure completion detection on every sync
      logger.debug('Checking for completed books across filtered libraries');
      const completedBooksList =
        await this._getCompletedBooksFromLibraries(librariesToProcess);
      logger.debug('Found books with completion status', {
        count: completedBooksList.length,
      });

      // Combine progress items with completed books (avoiding duplicates)
      const allBooksWithAnyProgress = this._combineProgressAndCompletedBooks(
        progressItems,
        completedBooksList,
      );
      logger.debug('Total books with any progress (in-progress + completed)', {
        count: allBooksWithAnyProgress.length,
      });

      // Only process books that actually have reading progress
      const booksToSync = [];

      // Fetch details for ALL books with any progress (in-progress + completed) in parallel
      const allProgressPromises = allBooksWithAnyProgress.map(item =>
        this._getLibraryItemDetails(item.id).catch(error => {
          // Only catch recoverable errors, let critical ones propagate
          if (this._isRecoverableError(error)) {
            logger.debug('Recoverable error fetching details for item', {
              itemId: item.id,
              error: error.message,
            });
            return null;
          } else {
            logger.error('Critical error fetching details for item', {
              itemId: item.id,
              error: error.message,
            });
            throw error; // Re-throw critical errors
          }
        }),
      );

      const progressResults = await Promise.all(allProgressPromises);

      // Debug: Show all books found in progress
      logger.debug('Books found in items-in-progress API:', {
        books: progressResults.filter(Boolean).map(book => {
          const title =
            (book &&
              book.media &&
              book.media.metadata &&
              book.media.metadata.title) ||
            book.title ||
            'Unknown';
          const isFinished = ProgressManager.extractFinishedFlag(book);
          const progress = ProgressManager.extractProgressPercentage(book);
          return { title, isFinished, progress: progress.toFixed(1) + '%' };
        }),
      });

      // Include all books for sync - let the cache check and proper re-reading detection
      // in sync-manager.js handle whether the book actually needs syncing
      const booksNeedingSync = progressResults.filter(book => {
        if (!book) return false;

        const title =
          (book.media && book.media.metadata && book.media.metadata.title) ||
          book.title ||
          'Unknown';
        const isFinished = ProgressManager.extractFinishedFlag(book);
        const progress = ProgressManager.extractProgressPercentage(book);

        logger.debug(
          `Including book for sync consideration: ${title} (${progress.toFixed(1)}% progress, finished: ${isFinished})`,
        );
        return true;
      });

      booksToSync.push(...booksNeedingSync);
      // Count filtering statistics
      const validBooks = progressResults.filter(Boolean);
      const allCompletedBooks = validBooks.filter(book => {
        const isFinished = ProgressManager.extractFinishedFlag(book);
        return isFinished; // Count ALL completed books, regardless of progress
      });

      // Since we no longer filter out completed books early, this count should be 0
      // Actual filtering now happens later in the sync process based on cache checks
      const completedBooksFiltered = [];

      logger.debug('Book filtering summary', {
        totalWithProgress: validBooks.length,
        allCompletedBooks: allCompletedBooks.length,
        completedBooksFiltered: completedBooksFiltered.length,
        booksNeedingSync: booksNeedingSync.length,
        filteringDetails: {
          note: 'Early filtering removed - all books passed to sync logic for cache checking',
        },
      });

      // Calculate accurate book categorization
      const inProgressBooks = validBooks.filter(book => {
        const isFinished = ProgressManager.extractFinishedFlag(book);
        return !isFinished; // Books that are currently being read
      });

      const booksNeverStarted = totalBooksInLibrary - validBooks.length;

      // Store filtering stats for sync summary (attach to first book or create metadata)
      const filteringStats = {
        totalBooksInLibrary: totalBooksInLibrary,
        totalWithProgress: validBooks.length, // All books with ANY progress (in-progress + completed)
        inProgressBooks: inProgressBooks.length, // Currently reading
        allCompletedBooks: allCompletedBooks.length, // All completed books
        completedBooksFiltered: completedBooksFiltered.length, // Completed books filtered out
        booksNeverStarted: booksNeverStarted, // Books with no progress at all
        booksPassingFilter: booksNeedingSync.length,
        // Library filtering stats
        libraryFiltering: libraryFilter.stats,
      };

      if (booksNeedingSync.length > 0) {
        booksNeedingSync[0]._filteringStats = filteringStats;
      } else {
        // Even if no books need syncing, return the stats
        booksToSync.push({
          _isMetadataOnly: true,
          _filteringStats: filteringStats,
        });
      }

      // Debug: print all book titles and their progress
      booksToSync.forEach(book => {
        const title =
          (book.media && book.media.metadata && book.media.metadata.title) ||
          book.title ||
          'Unknown';
        const progress = ProgressManager.extractProgressPercentage(book);
        logger.debug('Book progress', { title, progress });
      });

      return booksToSync;
    } catch (error) {
      logger.error('Error fetching reading progress', {
        error: error.message,
        stack: error.stack,
      });
      return [];
    }
  }

  async _getCurrentUser() {
    try {
      const response = await this._makeRequest('GET', '/api/me');
      return response;
    } catch (error) {
      // User info failure is always critical - re-throw
      logger.error('Critical error getting current user', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  async _getItemsInProgress() {
    try {
      const response = await this._makeRequest(
        'GET',
        '/api/me/items-in-progress',
      );
      return response.libraryItems || [];
    } catch (error) {
      // Check if this is a recoverable error
      if (this._isRecoverableError(error)) {
        logger.debug('No items in progress (recoverable error)', {
          error: error.message,
        });
        return [];
      } else {
        logger.error('Critical error getting items in progress', {
          error: error.message,
          stack: error.stack,
        });
        throw error;
      }
    }
  }

  async _getCompletedBooksFromLibraries(libraries) {
    try {
      logger.debug(
        `Starting completion check across ${libraries.length} libraries`,
      );

      // Process all libraries in parallel for maximum speed
      const libraryPromises = libraries.map(async library => {
        try {
          const sampleSize = Math.min(100, this.maxBooksToFetch || 100);
          logger.debug(
            `Scanning library ${library.name} (ID: ${library.id}) with sample size ${sampleSize}`,
          );

          const libraryItems = await this.getLibraryItems(
            library.id,
            sampleSize,
          );

          if (!libraryItems || libraryItems.length === 0) {
            logger.debug(`No items found in library ${library.name}`);
            return [];
          }

          logger.debug(
            `Checking ${libraryItems.length} books from library ${library.name} for completion status`,
          );

          // Check ALL books' progress in parallel (semaphore will throttle)
          const progressPromises = libraryItems.map(async item => {
            try {
              const progress = await this._getUserProgress(item.id);

              if (progress && progress.isFinished) {
                logger.debug(
                  `Found completed book: ${item.media?.metadata?.title || item.id}`,
                );
                return {
                  id: item.id,
                  libraryId: library.id,
                  title: item.media?.metadata?.title || 'Unknown',
                  isCompleted: true,
                };
              }
              return null;
            } catch (error) {
              // Skip books we can't get progress for
              logger.debug(
                `Could not get progress for book ${item.id}: ${error.message}`,
              );
              return null;
            }
          });

          const completedBooksInLibrary = (
            await Promise.all(progressPromises)
          ).filter(Boolean);

          logger.debug(
            `Found ${completedBooksInLibrary.length} completed books in library ${library.name}`,
          );

          return completedBooksInLibrary;
        } catch (error) {
          logger.warn(`Error processing library ${library.name}`, {
            error: error.message,
          });
          return [];
        }
      });

      // Wait for all libraries to complete and flatten results
      const libraryResults = await Promise.all(libraryPromises);
      const completedBooks = libraryResults.flat();

      logger.debug(
        `Completion check complete: Found ${completedBooks.length} completed books across all libraries`,
      );
      return completedBooks;
    } catch (error) {
      logger.error('Error finding completed books', {
        error: error.message,
      });
      return [];
    }
  }

  _combineProgressAndCompletedBooks(progressItems, completedBooks) {
    // Create a map of in-progress book IDs for deduplication
    const progressBookIds = new Set(progressItems.map(item => item.id));

    // Add completed books that aren't already in progress items
    const uniqueCompletedBooks = completedBooks.filter(
      book => !progressBookIds.has(book.id),
    );

    logger.debug('Combining book lists', {
      inProgressCount: progressItems.length,
      completedCount: completedBooks.length,
      uniqueCompletedCount: uniqueCompletedBooks.length,
    });

    // Return combined list
    return [...progressItems, ...uniqueCompletedBooks];
  }

  async _getLibraryItemDetails(itemId) {
    try {
      const itemData = await this._makeRequest('GET', `/api/items/${itemId}`);

      // Get user's progress for this item
      const progressData = await this._getUserProgress(itemId);

      // Combine item data with progress
      if (progressData) {
        itemData.progress_percentage = progressData.progress * 100;
        itemData.current_time = progressData.currentTime;
        itemData.is_finished = progressData.isFinished;

        // Use media progress startedAt if available
        if (progressData.startedAt) {
          itemData.started_at = progressData.startedAt;
          logger.debug('Raw startedAt for book', {
            title: itemData.media?.metadata?.title,
            startedAt: progressData.startedAt,
            startedAtISO: new Date(progressData.startedAt).toISOString(),
          });
        }
        // Use media progress finishedAt if available
        if (progressData.finishedAt) {
          itemData.finished_at = progressData.finishedAt;
          logger.debug('Raw finishedAt for book', {
            title: itemData.media?.metadata?.title,
            finishedAt: progressData.finishedAt,
            finishedAtISO: new Date(progressData.finishedAt).toISOString(),
          });
        }
        // Use media progress lastUpdate for last listened
        if (progressData.lastUpdate) {
          itemData.last_listened_at = progressData.lastUpdate;
          logger.debug('Raw lastUpdate for book', {
            title: itemData.media?.metadata?.title,
            lastUpdate: progressData.lastUpdate,
            lastUpdateISO: new Date(progressData.lastUpdate).toISOString(),
          });
        } else {
          itemData.last_listened_at = null;
          logger.debug('No lastUpdate for book', {
            title: itemData.media?.metadata?.title,
          });
        }
      }

      return itemData;
    } catch (error) {
      // Check if this is a recoverable error (item not found, access denied to specific item)
      if (this._isRecoverableError(error)) {
        logger.debug('Recoverable error getting library item details', {
          itemId,
          error: error.message,
        });
        return null;
      } else {
        logger.error('Critical error getting library item details', {
          itemId,
          error: error.message,
          stack: error.stack,
        });
        throw error;
      }
    }
  }
  async _getUserProgress(itemId) {
    try {
      // This endpoint can return 404 if there's no progress, which is normal
      const response = await this._makeRequest(
        'GET',
        `/api/me/progress/${itemId}`,
        null,
        [404],
      );
      return response;
    } catch (_error) {
      // Not an error, just means no progress data
      return null;
    }
  }

  async _getPlaybackSessions() {
    try {
      // Get all user's listening sessions with pagination - this gives us updatedAt timestamps
      let page = 0;
      let allSessions = [];
      let total = 0;
      let _itemsPerPage = 10;

      while (true) {
        const response = await this._makeRequest(
          'GET',
          `/api/sessions?page=${page}`,
          null,
          [404],
        );
        if (!response) break;

        if (page === 0) {
          total = response.total;
          _itemsPerPage = response.itemsPerPage;
        }

        allSessions = allSessions.concat(response.sessions || []);

        if (allSessions.length >= total) break;
        page++;
      }

      logger.debug('Fetched playback sessions', {
        totalSessions: allSessions.length,
        pages: page + 1,
      });
      return { sessions: allSessions };
    } catch (error) {
      // Not an error, just means no session data
      logger.error('Error fetching playback sessions', {
        error: error.message,
        stack: error.stack,
      });
      return null;
    }
  }

  async getLibraries() {
    try {
      const response = await this._makeRequest('GET', '/api/libraries');
      return response.libraries || [];
    } catch (error) {
      // Library access failure is critical - re-throw
      logger.error('Critical error getting libraries', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Filter libraries based on configuration
   * @param {Array} allLibraries - All available libraries
   * @returns {Object} - { libraries: filtered libraries, stats: filtering stats }
   */
  filterLibraries(allLibraries) {
    if (
      !this.libraryConfig ||
      (!this.libraryConfig.include && !this.libraryConfig.exclude)
    ) {
      // No filtering configured, return all libraries
      logger.debug('No library filtering configured, using all libraries', {
        totalLibraries: allLibraries.length,
      });
      return {
        libraries: allLibraries,
        stats: {
          total: allLibraries.length,
          included: allLibraries.length,
          excluded: 0,
          unmatched: [],
        },
      };
    }

    const { include, exclude } = this.libraryConfig;
    let filteredLibraries = [];
    const stats = {
      total: allLibraries.length,
      included: 0,
      excluded: 0,
      unmatched: [],
    };

    if (include && include.length > 0) {
      // Include mode: only include specified libraries
      const unmatchedIncludes = [...include];

      filteredLibraries = allLibraries.filter(library => {
        // Check both name and ID for matches (case-insensitive for names)
        const nameMatch = include.some(
          item => item.toLowerCase() === library.name.toLowerCase(),
        );
        const idMatch = include.some(item => item === library.id);

        if (nameMatch || idMatch) {
          // Remove matched items from unmatched list
          const matchedItem = include.find(
            item =>
              item.toLowerCase() === library.name.toLowerCase() ||
              item === library.id,
          );
          const index = unmatchedIncludes.indexOf(matchedItem);
          if (index > -1) {
            unmatchedIncludes.splice(index, 1);
          }
          return true;
        }
        return false;
      });

      stats.included = filteredLibraries.length;
      stats.excluded = allLibraries.length - filteredLibraries.length;
      stats.unmatched = unmatchedIncludes;

      logger.debug('Applied library include filter', {
        includeConfig: include,
        matchedLibraries: filteredLibraries.map(lib => ({
          id: lib.id,
          name: lib.name,
        })),
        unmatchedFilters: unmatchedIncludes,
      });
    } else if (exclude && exclude.length > 0) {
      // Exclude mode: exclude specified libraries
      const unmatchedExcludes = [...exclude];

      filteredLibraries = allLibraries.filter(library => {
        // Check both name and ID for matches (case-insensitive for names)
        const nameMatch = exclude.some(
          item => item.toLowerCase() === library.name.toLowerCase(),
        );
        const idMatch = exclude.some(item => item === library.id);

        if (nameMatch || idMatch) {
          // Remove matched items from unmatched list
          const matchedItem = exclude.find(
            item =>
              item.toLowerCase() === library.name.toLowerCase() ||
              item === library.id,
          );
          const index = unmatchedExcludes.indexOf(matchedItem);
          if (index > -1) {
            unmatchedExcludes.splice(index, 1);
          }
          return false; // Exclude this library
        }
        return true; // Include this library
      });

      stats.included = filteredLibraries.length;
      stats.excluded = allLibraries.length - filteredLibraries.length;
      stats.unmatched = unmatchedExcludes;

      logger.debug('Applied library exclude filter', {
        excludeConfig: exclude,
        includedLibraries: filteredLibraries.map(lib => ({
          id: lib.id,
          name: lib.name,
        })),
        unmatchedFilters: unmatchedExcludes,
      });
    }

    // Log warnings for unmatched library names/IDs
    if (stats.unmatched.length > 0) {
      logger.warn('Some library filters did not match any libraries', {
        unmatchedFilters: stats.unmatched,
        availableLibraries: allLibraries.map(lib => ({
          id: lib.id,
          name: lib.name,
        })),
      });
    }

    return { libraries: filteredLibraries, stats };
  }

  async getLibraryItems(libraryId, limit = null) {
    try {
      const allItems = [];
      let page = 0;
      let total = 0;
      // Use the instance's maxBooksToFetch if no limit is provided
      const effectiveLimit = limit !== null ? limit : this.maxBooksToFetch;
      const itemsPerPage = this.pageSize; // Use configurable page size

      while (true) {
        const response = await this._makeRequest(
          'GET',
          `/api/libraries/${libraryId}/items?limit=${itemsPerPage}&page=${page}`,
        );

        if (!response) {
          logger.debug('No response from library items API', {
            libraryId,
            page,
          });
          break;
        }

        // Extract items from response
        const items = response.results || response.libraryItems || [];
        if (!items || items.length === 0) {
          logger.debug('No more items in library', { libraryId, page });
          break;
        }

        // Get total count from first page
        if (page === 0) {
          total = response.total || items.length;
          logger.debug('Library items pagination info', {
            libraryId,
            total,
            itemsPerPage,
            firstPageCount: items.length,
            effectiveLimit: effectiveLimit,
          });
        }

        allItems.push(...items);
        logger.debug('Fetched library items page', {
          libraryId,
          page,
          itemsInPage: items.length,
          totalFetched: allItems.length,
        });

        // Check if we've reached the limit or end of data
        if (
          (effectiveLimit !== null && allItems.length >= effectiveLimit) ||
          items.length < itemsPerPage
        ) {
          break;
        }

        page++;
      }

      logger.debug('Completed library items fetch', {
        libraryId,
        totalItems: allItems.length,
        pages: page + 1,
      });

      return allItems;
    } catch (error) {
      // Check if this is a recoverable error (library not found)
      if (this._isRecoverableError(error)) {
        logger.debug('Recoverable error getting library items', {
          libraryId,
          error: error.message,
        });
        return [];
      } else {
        logger.error('Critical error getting library items', {
          libraryId,
          error: error.message,
          stack: error.stack,
        });
        throw error;
      }
    }
  }

  /**
   * Determine if an error is recoverable (can be safely ignored) vs critical (should propagate)
   * @param {Error} error - The error to check
   * @returns {boolean} - True if recoverable, false if critical
   */
  _isRecoverableError(error) {
    const message = error.message.toLowerCase();

    // HTTP 404 errors are usually recoverable (item not found, no progress data)
    if (message.includes('http 404') || message.includes('not found')) {
      return true;
    }

    // HTTP 403 errors for specific items might be recoverable (access denied to individual item)
    // but be conservative - only if the message suggests it's item-specific
    if (
      message.includes('http 403') &&
      (message.includes('item') || message.includes('book'))
    ) {
      return true;
    }

    // These errors are always critical
    const criticalPatterns = [
      'http 401', // Unauthorized - authentication failure
      'http 500', // Server error
      'http 502', // Bad gateway
      'http 503', // Service unavailable
      'network error', // Network connectivity issues
      'timeout', // Request timeouts
      'connection', // Connection issues
      'dns', // DNS resolution issues
    ];

    for (const pattern of criticalPatterns) {
      if (message.includes(pattern)) {
        return false;
      }
    }

    // If we can't categorize it, treat as critical to be safe
    return false;
  }

  async _makeRequest(method, endpoint, data = null, suppressErrors = []) {
    await this.semaphore.acquire();
    try {
      await this.rateLimiter.waitIfNeeded('audiobookshelf');

      try {
        const config = {
          method,
          url: endpoint,
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
        };

        if (data) {
          config.data = data;
        }

        const response = await this.axios.request(config);

        // Validate response (but allow suppressed error codes)
        if (
          !response ||
          ((response.status < 200 || response.status >= 300) &&
            !suppressErrors.includes(response.status))
        ) {
          throw new Error(
            `API request failed with status ${response?.status}: ${response?.statusText}`,
          );
        }

        // If this was a suppressed error status, return null
        if (
          response.status >= 300 &&
          suppressErrors.includes(response.status)
        ) {
          return null;
        }

        if (!response.data) {
          throw new Error('API response contains no data');
        }

        return response.data;
      } catch (error) {
        if (error.response) {
          const status = error.response.status;

          if (suppressErrors.includes(status)) {
            return null;
          }

          logger.error(`HTTP ${status} error for ${method} ${endpoint}`, {
            status,
            data: error.response.data,
          });
          throw new Error(
            `HTTP ${status}: ${error.response.data?.message || error.message}`,
          );
        } else if (error.request) {
          logger.error(`Network error for ${method} ${endpoint}`, {
            error: error.message,
          });
          throw new Error(`Network error: ${error.message}`);
        } else {
          logger.error(`Request error for ${method} ${endpoint}`, {
            error: error.message,
          });
          throw error;
        }
      }
    } finally {
      this.semaphore.release();
    }
  }
}
