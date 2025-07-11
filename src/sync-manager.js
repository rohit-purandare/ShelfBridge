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
    calculateCurrentPage,
    calculateCurrentSeconds,
    formatDuration
} from './utils.js';
import { DateTime } from 'luxon';
import logger from './logger.js';

export class SyncManager {
    constructor(user, globalConfig, dryRun = false) {
        this.user = user;
        this.userId = user.id;
        this.globalConfig = globalConfig;
        this.dryRun = dryRun;
        this.timezone = globalConfig.timezone || 'UTC';
        
        // Initialize clients
        this.audiobookshelf = new AudiobookshelfClient(
            user.abs_url, 
            user.abs_token, 
            globalConfig.workers || 3
        );
        this.hardcover = new HardcoverClient(user.hardcover_token);
        
        // Initialize cache
        this.cache = new BookCache();
        
        // Timing data
        this.timingData = {};
        
        logger.debug('SyncManager initialized', { 
            userId: this.userId,
            dryRun: this.dryRun,
            timezone: this.timezone
        });
    }

    _isZeroProgress(progressValue) {
        // Only consider undefined, null, or values below threshold as "zero progress"
        // Allow explicit 0 values to be synced (could be intentional resets)
        return progressValue === undefined || progressValue === null || 
               (typeof progressValue === 'number' && progressValue < (this.globalConfig.min_progress_threshold || 5.0));
    }

    async syncProgress() {
        const startTime = Date.now();
        logger.debug(`Starting sync for user: ${this.userId}`);
        
        const result = {
            books_processed: 0,
            books_synced: 0,
            books_completed: 0,
            books_auto_added: 0,
            books_skipped: 0,
            errors: [],
            timing: {},
            book_details: [] // Add detailed book results
        };

        try {
            // Get books from Audiobookshelf
            const absBooks = await this.audiobookshelf.getReadingProgress();
            if (!absBooks || absBooks.length === 0) {
                logger.debug('No books found in Audiobookshelf');
                return result;
            }

            // Get books from Hardcover
            const hardcoverBooks = await this.hardcover.getUserBooks();
            if (!hardcoverBooks || hardcoverBooks.length === 0) {
                logger.warn('No books found in Hardcover library');
            }

            // Create identifier lookup
            const identifierLookup = this._createIdentifierLookup(hardcoverBooks);

            logger.debug(`Processing ${absBooks.length} books from Audiobookshelf`);

            // Process each book
            for (const absBook of absBooks) {
                const bookStartTime = Date.now();
                const bookDetail = {
                    title: extractTitle(absBook) || 'Unknown Title',
                    status: 'pending',
                    actions: [],
                    progress: {
                        before: null,
                        after: null,
                        changed: false
                    },
                    identifiers: {},
                    errors: [],
                    timing: 0
                };

                try {
                    result.books_processed++;
                    
                    // Log book processing start (debug level)
                    logger.debug(`Processing book: ${bookDetail.title}`, {
                        bookIndex: result.books_processed,
                        totalBooks: absBooks.length,
                        title: bookDetail.title
                    });

                    // Extract identifiers
                    const identifiers = this._extractBookIdentifier(absBook);
                    bookDetail.identifiers = identifiers;
                    bookDetail.actions.push(`Found identifiers: ${Object.entries(identifiers).filter(([k,v]) => v).map(([k,v]) => `${k.toUpperCase()}=${v}`).join(', ') || 'none'}`);

                    // Check cache for this book
                    const cacheIdentifier = identifiers.asin || identifiers.isbn;
                    const cacheIdentifierType = identifiers.asin ? 'asin' : 'isbn';
                    let cachedInfo = null;
                    
                    if (cacheIdentifier) {
                        cachedInfo = this.cache.getCachedBookInfo(this.userId, cacheIdentifier, bookDetail.title, cacheIdentifierType);
                        if (cachedInfo.exists) {
                            bookDetail.actions.push(`Cache data:`);
                            
                            if (cachedInfo.edition_id) {
                                bookDetail.actions.push(`  - Edition: ${cachedInfo.edition_id}`);
                            }
                            if (cachedInfo.author) {
                                bookDetail.actions.push(`  - Author: ${cachedInfo.author}`);
                            }
                            if (cachedInfo.progress_percent !== null) {
                                bookDetail.actions.push(`  - Progress: ${cachedInfo.progress_percent}%`);
                            }
                            if (cachedInfo.last_sync) {
                                const lastSyncedDate = this._formatTimestampForDisplay(cachedInfo.last_sync);
                                bookDetail.actions.push(`  - Last synced: ${lastSyncedDate}`);
                            }
                            
                            // Convert timestamps to readable dates using timezone
                            if (cachedInfo.started_at) {
                                const startedDate = this._formatTimestampForDisplay(cachedInfo.started_at);
                                bookDetail.actions.push(`  - Started: ${startedDate}`);
                            }
                            if (cachedInfo.finished_at) {
                                const finishedDate = this._formatTimestampForDisplay(cachedInfo.finished_at);
                                bookDetail.actions.push(`  - Finished: ${finishedDate}`);
                            }
                        } else {
                            bookDetail.actions.push(`Cache: No cached data found`);
                        }
                    } else {
                        bookDetail.actions.push(`Cache: Cannot check (no identifier)`);
                    }

                    // Get current progress
                    const currentProgress = absBook.progress_percentage || 0;
                    bookDetail.progress.before = currentProgress;
                    bookDetail.actions.push(`Current progress: ${currentProgress.toFixed(1)}%`);

                    // Check if book should be skipped due to low progress
                    if (this._isZeroProgress(currentProgress)) {
                        logger.debug(`Skipping ${bookDetail.title} - progress below threshold`, {
                            progress: currentProgress,
                            threshold: this.globalConfig.min_progress_threshold || 5.0
                        });
                        bookDetail.status = 'skipped';
                        bookDetail.actions.push(`Skipped: Progress ${currentProgress}% below threshold ${this.globalConfig.min_progress_threshold || 5.0}%`);
                        result.books_skipped++;
                        continue;
                    }

                    // Check cache for progress changes
                    const identifier = identifiers.asin || identifiers.isbn;
                    const identifierType = identifiers.asin ? 'asin' : 'isbn';
                    
                    if (identifier && !this.globalConfig.force_sync) {
                        const hasChanged = this.cache.hasProgressChanged(
                            this.userId, 
                            identifier, 
                            bookDetail.title, 
                            currentProgress, 
                            identifierType
                        );
                        
                        if (!hasChanged) {
                            logger.debug(`Skipping ${bookDetail.title} - no progress change`, {
                                progress: currentProgress
                            });
                            bookDetail.status = 'skipped';
                            bookDetail.actions.push(`Skipped: No progress change (${currentProgress}%)`);
                            result.books_skipped++;
                            continue;
                        } else {
                            const cachedProgress = this.cache.getLastProgress(this.userId, identifier, bookDetail.title, identifierType);
                            bookDetail.actions.push(`Progress changed: ${cachedProgress}% → ${currentProgress}%`);
                            bookDetail.progress.changed = true;
                        }
                    }

                    // Try to find book in Hardcover
                    const hardcoverMatch = this._findBookInHardcover(absBook, identifierLookup);
                    
                    if (hardcoverMatch) {
                        bookDetail.actions.push(`Found in Hardcover library: ${hardcoverMatch.userBook.book.title}`);
                        const syncResult = await this._syncExistingBook(absBook, hardcoverMatch, identifierType, identifier);
                        
                        // Update book detail with sync result
                        bookDetail.status = syncResult.status;
                        bookDetail.progress.after = currentProgress;
                        
                        if (syncResult.status === 'completed') {
                            bookDetail.actions.push(`Marked as completed (${currentProgress.toFixed(1)}%)`);
                            result.books_completed++;
                        } else if (syncResult.status === 'synced') {
                            bookDetail.actions.push(`Progress updated to ${currentProgress.toFixed(1)}%`);
                            result.books_synced++;
                        } else if (syncResult.status === 'error') {
                            bookDetail.errors.push(syncResult.reason || 'Unknown error');
                            bookDetail.actions.push(`Error: ${syncResult.reason || 'Unknown error'}`);
                            result.errors.push(`${bookDetail.title}: ${syncResult.reason}`);
                        }
                        
                    } else {
                        bookDetail.actions.push('Not found in Hardcover library');
                        
                        // Try to auto-add if enabled
                        if (this.globalConfig.auto_add_books !== false) {
                            bookDetail.actions.push('Attempting to auto-add to Hardcover');
                            const autoAddResult = await this._tryAutoAddBook(absBook, identifiers);
                            
                            bookDetail.status = autoAddResult.status;
                            
                            if (autoAddResult.status === 'auto_added') {
                                bookDetail.actions.push(`Successfully auto-added to Hardcover`);
                                result.books_auto_added++;
                            } else if (autoAddResult.status === 'skipped') {
                                bookDetail.actions.push(`Auto-add skipped: ${autoAddResult.reason}`);
                                result.books_skipped++;
                            } else if (autoAddResult.status === 'error') {
                                bookDetail.errors.push(autoAddResult.reason || 'Auto-add failed');
                                bookDetail.actions.push(`Auto-add failed: ${autoAddResult.reason}`);
                                result.errors.push(`${bookDetail.title}: ${autoAddResult.reason}`);
                            }
                        } else {
                            bookDetail.status = 'skipped';
                            bookDetail.actions.push('Auto-add disabled - skipped');
                            result.books_skipped++;
                        }
                    }

                } catch (error) {
                    logger.error(`Error processing book ${bookDetail.title}`, {
                        error: error.message,
                        stack: error.stack
                    });
                    bookDetail.status = 'error';
                    bookDetail.errors.push(error.message);
                    bookDetail.actions.push(`Processing error: ${error.message}`);
                    result.errors.push(`${bookDetail.title}: ${error.message}`);
                } finally {
                    // Calculate timing and log book completion
                    bookDetail.timing = Date.now() - bookStartTime;
                    result.book_details.push(bookDetail);
                    
                    // Log detailed book result
                    logger.debug(`Book processed: ${bookDetail.title}`, {
                        status: bookDetail.status,
                        actions: bookDetail.actions,
                        progress: bookDetail.progress,
                        identifiers: bookDetail.identifiers,
                        errors: bookDetail.errors,
                        timing: `${bookDetail.timing}ms`
                    });
                }
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
                    duration: `${duration.toFixed(1)}s`
                },
                book_breakdown: this._generateBookBreakdown(result.book_details)
            });

            return result;

        } catch (error) {
            logger.error('Sync failed', { 
                error: error.message, 
                stack: error.stack,
                userId: this.userId 
            });
            result.errors.push(error.message);
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
     * Find a book in the Hardcover library using identifiers
     * @param {Object} absBook - Audiobookshelf book object
     * @param {Object} identifierLookup - Lookup table of identifiers to Hardcover books
     * @returns {Object|null} - Hardcover match object or null if not found
     */
    _findBookInHardcover(absBook, identifierLookup) {
        const identifiers = this._extractBookIdentifier(absBook);
        const title = extractTitle(absBook) || 'Unknown Title';
        
        logger.debug(`Searching for ${title} in Hardcover library`, {
            identifiers: identifiers
        });

        // Try ASIN first (for audiobooks)
        if (identifiers.asin && identifierLookup[identifiers.asin]) {
            const match = identifierLookup[identifiers.asin];
            logger.debug(`Found ASIN match for ${title}`, {
                asin: identifiers.asin,
                hardcoverTitle: match.userBook.book.title,
                userBookId: match.userBook.id,
                editionId: match.edition.id
            });
            return match;
        }

        // Fall back to ISBN
        if (identifiers.isbn && identifierLookup[identifiers.isbn]) {
            const match = identifierLookup[identifiers.isbn];
            logger.debug(`Found ISBN match for ${title}`, {
                isbn: identifiers.isbn,
                hardcoverTitle: match.userBook.book.title,
                userBookId: match.userBook.id,
                editionId: match.edition.id
            });
            return match;
        }

        logger.debug(`No match found for ${title} in Hardcover library`, {
            searchedIdentifiers: identifiers
        });
        return null;
    }

    /**
     * Extract book identifiers (ISBN and ASIN) from Audiobookshelf book object
     * @param {Object} absBook - Audiobookshelf book object
     * @returns {Object} - Object containing isbn and asin properties
     */
    _extractBookIdentifier(absBook) {
        const identifiers = {
            isbn: null,
            asin: null
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
                asin: identifiers.asin
            });

        } catch (error) {
            logger.error('Error extracting book identifiers', {
                error: error.message,
                title: extractTitle(absBook)
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
                        author: author
                    });
                    return author;
                }
            }

            // Fall back to Hardcover data if available
            if (hardcoverMatch && hardcoverMatch.userBook && hardcoverMatch.userBook.book) {
                const book = hardcoverMatch.userBook.book;
                if (book.contributions && book.contributions.length > 0) {
                    const authorContribution = book.contributions.find(c => c.author);
                    if (authorContribution && authorContribution.author) {
                        author = authorContribution.author.name;
                        logger.debug('Extracted author from Hardcover', {
                            title: book.title,
                            author: author
                        });
                        return author;
                    }
                }
            }

            logger.debug('No author found in book data', {
                title: absBook ? extractTitle(absBook) : 'Unknown'
            });

        } catch (error) {
            logger.error('Error extracting author from book data', {
                error: error.message,
                title: absBook ? extractTitle(absBook) : 'Unknown'
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
                error: error.message
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
                logger.warn('Invalid date format', { dateValue, type: typeof dateValue });
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
                output: formattedDate
            });
            
            return formattedDate;

        } catch (error) {
            logger.error('Error formatting date for Hardcover', {
                dateValue: dateValue,
                error: error.message
            });
            return null;
        }
    }

    async _syncBooksSequential(syncableBooks, identifierLookup, result, sessionData) {
        for (const absBook of syncableBooks) {
            try {
                const syncResult = await this._syncSingleBook(absBook, identifierLookup, sessionData);
                this._updateResult(result, syncResult);
            } catch (error) {
                logger.error(`Error syncing book ${absBook.title}:`, error.message);
                result.errors.push(`Error syncing ${absBook.title}: ${error.message}`);
            }
        }
    }

    async _syncBooksParallel(syncableBooks, identifierLookup, result, sessionData) {
        const workers = this.globalConfig.workers || 3;
        const chunks = this._chunkArray(syncableBooks, workers);

        for (const chunk of chunks) {
            const promises = chunk.map(async (absBook) => {
                try {
                    return await this._syncSingleBook(absBook, identifierLookup, sessionData);
                } catch (error) {
                    logger.error(`Error syncing book ${absBook.title || 'Unknown'}:`, error.message);
                    return { 
                        status: 'error', 
                        reason: error.message, 
                        title: absBook.title || 'Unknown Title' 
                    };
                }
            });

            const results = await Promise.all(promises);
            
            for (const syncResult of results) {
                this._updateResult(result, syncResult);
            }
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
        const title = extractTitle(absBook) || 'Unknown Title';
        const progressPercent = absBook.progress_percentage || 0;
        
        logger.debug(`Processing: ${title} (${progressPercent.toFixed(1)}%)`);

        // Add last listened timestamp from playback sessions
        let usedSessionData = false;
        if (sessionData && sessionData.sessions && sessionData.sessions.length > 0) {
            // Find sessions for this specific book
            const bookSessions = sessionData.sessions.filter(session => 
                session.libraryItemId === absBook.id
            );
            
            if (bookSessions.length > 0) {
                // Get the most recent session's updatedAt
                const latestSession = bookSessions.reduce((latest, session) => {
                    return (!latest || session.updatedAt > latest.updatedAt) ? session : latest;
                });
                
                if (latestSession && latestSession.updatedAt) {
                    // Convert to configured timezone
                    const lastListenedAtUTC = DateTime.fromMillis(latestSession.updatedAt, { zone: 'utc' });
                    const lastListenedAtLocal = lastListenedAtUTC.setZone(this.timezone);
                    absBook.last_listened_at = lastListenedAtLocal.toISO();
                    usedSessionData = true;
                    logger.debug(`[DEBUG] Found session updatedAt for ${title}: ${latestSession.updatedAt} (${lastListenedAtLocal.toFormat('yyyy-LL-dd HH:mm:ss ZZZZ')})`);
                }
            } else {
                logger.debug(`[DEBUG] No playback sessions found for ${title}`);
            }
        }
        
        // Convert last_listened_at from media progress to configured timezone (if no sessions found for this book)
        if (absBook.last_listened_at && !usedSessionData) {
            const lastListenedAtUTC = DateTime.fromMillis(absBook.last_listened_at, { zone: 'utc' });
            const lastListenedAtLocal = lastListenedAtUTC.setZone(this.timezone);
            absBook.last_listened_at = lastListenedAtLocal.toISO();
            logger.debug(`[DEBUG] Converted lastUpdate for ${title}: ${lastListenedAtLocal.toFormat('yyyy-LL-dd HH:mm:ss ZZZZ')}`);
        }
        
        // Convert startedAt from media progress to configured timezone
        if (absBook.started_at) {
            const startedAtUTC = DateTime.fromMillis(absBook.started_at, { zone: 'utc' });
            const startedAtLocal = startedAtUTC.setZone(this.timezone);
            absBook.started_at = startedAtLocal.toISO();
            logger.debug(`[DEBUG] startedAt for ${title}: ${startedAtLocal.toFormat('yyyy-LL-dd HH:mm:ss ZZZZ')}`);
        }
        // Convert finishedAt from media progress to configured timezone
        if (absBook.finished_at) {
            const finishedAtUTC = DateTime.fromMillis(absBook.finished_at, { zone: 'utc' });
            const finishedAtLocal = finishedAtUTC.setZone(this.timezone);
            absBook.finished_at = finishedAtLocal.toISO();
            logger.debug(`[DEBUG] finishedAt for ${title}: ${finishedAtLocal.toFormat('yyyy-LL-dd HH:mm:ss ZZZZ')}`);
        }

        // Extract identifiers
        const identifiers = this._extractBookIdentifier(absBook);
        logger.debug(`[DEBUG] Extracted identifiers for '${title}': ISBN='${identifiers.isbn}', ASIN='${identifiers.asin}'`);
        if (!identifiers.isbn && !identifiers.asin) {
            logger.info(`Skipping ${title}: No ISBN or ASIN found`);
            return { status: 'skipped', reason: 'No ISBN or ASIN', title };
        }

        // Try to find match in Hardcover
        let hardcoverMatch = null;
        let identifierType = null;

        // First try ASIN (for audiobooks)
        if (identifiers.asin && identifierLookup[identifiers.asin]) {
            hardcoverMatch = identifierLookup[identifiers.asin];
            identifierType = 'asin';
            logger.info(`Found ASIN match for ${title}: ${identifiers.asin}`);
        }
        // Fall back to ISBN
        else if (identifiers.isbn && identifierLookup[identifiers.isbn]) {
            hardcoverMatch = identifierLookup[identifiers.isbn];
            identifierType = 'isbn';
            logger.info(`Found ISBN match for ${title}: ${identifiers.isbn}`);
        }

        if (!hardcoverMatch) {
            // Try to auto-add the book
            return await this._tryAutoAddBook(absBook, identifiers);
        }

        // Check if progress has changed (unless force sync is enabled)
        const identifier = identifierType === 'asin' ? identifiers.asin : identifiers.isbn;
        if (!this.globalConfig.force_sync && !(this.cache.hasProgressChanged(this.userId, identifier, title, progressPercent, identifierType))) {
            logger.info(`Skipping ${title}: Progress unchanged`);
            return { status: 'skipped', reason: 'Progress unchanged', title };
        }

        // Sync the existing book
        return await this._syncExistingBook(absBook, hardcoverMatch, identifierType, identifier);
    }

    async _tryAutoAddBook(absBook, identifiers) {
        const title = extractTitle(absBook) || 'Unknown Title';
        logger.info(`Attempting to auto-add ${title} to Hardcover`, {
            identifiers: identifiers,
            title: title
        });

        try {
            // Search for the book by ISBN or ASIN
            let searchResults = [];
            
            if (identifiers.asin) {
                logger.debug(`Searching Hardcover by ASIN: ${identifiers.asin}`);
                searchResults = await this.hardcover.searchBooksByAsin(identifiers.asin);
                logger.debug(`ASIN search returned ${searchResults.length} results`);
            }
            
            if (searchResults.length === 0 && identifiers.isbn) {
                logger.debug(`Searching Hardcover by ISBN: ${identifiers.isbn}`);
                searchResults = await this.hardcover.searchBooksByIsbn(identifiers.isbn);
                logger.debug(`ISBN search returned ${searchResults.length} results`);
            }

            if (searchResults.length === 0) {
                logger.info(`Could not find ${title} in Hardcover database`, {
                    searchedIdentifiers: identifiers
                });
                return { status: 'skipped', reason: 'Book not found in Hardcover', title };
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
                format: edition.format
            });

            if (this.dryRun) {
                logger.debug(`[DRY RUN] Would add ${title} to library (book_id: ${bookId}, edition_id: ${editionId})`);
                return { status: 'auto_added', title, bookId, editionId };
            }

            // Prepare rollback callback in case API fails
            const rollbackCallbacks = [];
            let apiRollbackNeeded = false;

            logger.debug(`Adding ${title} to Hardcover library`, {
                bookId: bookId,
                editionId: editionId
            });

            const addResult = await this.hardcover.addBookToLibrary(bookId, 2, editionId);
            
            if (addResult) {
                logger.info(`Successfully added ${title} to library`, {
                    userBookId: addResult.id,
                    hardcoverTitle: edition.book.title
                });
                
                // Store cache data in transaction
                const identifier = identifiers.asin || identifiers.isbn;
                const identifierType = identifiers.asin ? 'asin' : 'isbn';
                const author = this._extractAuthorFromData(absBook, { userBook: null, edition });
                
                // Add API rollback callback
                apiRollbackNeeded = true;
                rollbackCallbacks.push(async () => {
                    logger.info(`Rolling back auto-add for ${title}`);
                    // Note: Hardcover doesn't have a remove from library API, so we log the issue
                    logger.warn(`Manual cleanup needed: Remove ${title} from Hardcover library`);
                });

                try {
                    logger.debug(`Caching auto-add data for ${title}`, {
                        identifier: identifier,
                        identifierType: identifierType,
                        editionId: editionId,
                        author: author
                    });

                    await this.cache.storeBookSyncData(
                        this.userId, 
                        identifier, 
                        title, 
                        editionId, 
                        identifierType, 
                        author,
                        0, // New book starts at 0% progress
                        null, // No last listened timestamp yet
                        null  // No started timestamp yet
                    );

                    return { status: 'auto_added', title, userBookId: addResult.id };
                } catch (cacheError) {
                    // Cache transaction failed, rollback API changes
                    logger.error(`Cache transaction failed for auto-add ${title}`, {
                        error: cacheError.message,
                        stack: cacheError.stack
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
                    editionId: editionId
                });
                return { status: 'error', reason: 'Failed to add to library', title };
            }

        } catch (error) {
            logger.error(`Error auto-adding ${title}`, {
                error: error.message,
                stack: error.stack,
                identifiers: identifiers
            });
            return { status: 'error', reason: error.message, title };
        }
    }

    async _syncExistingBook(absBook, hardcoverMatch, identifierType, identifier) {
        const title = extractTitle(absBook) || 'Unknown Title';
        const progressPercent = absBook.progress_percentage || 0;
        const { userBook, edition } = hardcoverMatch;

        logger.debug(`Syncing existing book: ${title}`, {
            currentProgress: progressPercent,
            hardcoverTitle: userBook.book.title,
            userBookId: userBook.id,
            editionId: edition?.id
        });

        try {
            // Select the best edition
            const selectedEdition = await this._selectEditionWithCache(absBook, hardcoverMatch, title);
            if (!selectedEdition) {
                logger.error(`No suitable edition found for ${title}`, {
                    availableEditions: userBook.book.editions?.length || 0
                });
                return { status: 'error', reason: 'No suitable edition found', title };
            }

            logger.debug(`Selected edition for ${title}`, {
                editionId: selectedEdition.id,
                format: selectedEdition.format,
                pages: selectedEdition.pages,
                audioSeconds: selectedEdition.audio_seconds
            });

            // Use Audiobookshelf's is_finished flag if present
            const isFinished = absBook.is_finished === true || absBook.is_finished === 1;
            if (isFinished || progressPercent >= 95) {
                logger.debug(`Book ${title} is completed`, {
                    isFinished: isFinished,
                    progress: progressPercent
                });
                return await this._handleCompletionStatus(userBook.id, selectedEdition, title, progressPercent, absBook, isFinished);
            }

            // Handle progress update
            logger.debug(`Updating progress for ${title}`, {
                progress: progressPercent
            });
            return await this._handleProgressStatus(userBook.id, selectedEdition, title, progressPercent, absBook);

        } catch (error) {
            logger.error(`Error syncing existing book ${title}`, {
                error: error.message,
                stack: error.stack,
                userBookId: userBook.id
            });
            return { status: 'error', reason: error.message, title };
        }
    }

    async _selectEditionWithCache(absBook, hardcoverMatch, title) {
        const { userBook, edition } = hardcoverMatch;
        
        // Check cache first
        const identifier = this._extractBookIdentifier(absBook);
        const identifierType = identifier.asin ? 'asin' : 'isbn';
        const identifierValue = identifier.asin || identifier.isbn;
        
        const cachedEditionId = this.cache.getEditionForBook(
            this.userId, 
            identifierValue, 
            title, 
            identifierType
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
                await this.cache.executeTransaction([
                    () => this.cache._storeEditionMappingOperation(
                        this.userId, 
                        identifierValue, 
                        title, 
                        edition.id, 
                        identifierType, 
                        author
                    )
                ], {
                    description: `Cache edition mapping for ${title}`,
                    timeout: 2000
                });
                
                return edition;
            } catch (error) {
                logger.error(`Failed to cache edition mapping for ${title}: ${error.message}`);
                // Still return the edition even if caching fails
                return edition;
            }
        }

        return null;
    }

    async _handleCompletionStatus(userBookId, edition, title, progressPercent, absBook, isFinished = false) {
        logger.info(`Marking ${title} as completed`, {
            progress: progressPercent,
            isFinished: isFinished,
            userBookId: userBookId,
            editionId: edition.id
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

            logger.debug(`Completion parameters for ${title}`, {
                totalValue: totalValue,
                useSeconds: useSeconds,
                format: edition.format
            });

            // Pass finished_at and started_at to Hardcover client if present
            const finishedAt = absBook.finished_at ? this._formatDateForHardcover(absBook.finished_at) : null;
            const startedAt = absBook.started_at ? this._formatDateForHardcover(absBook.started_at) : null;

            logger.debug(`Completion dates for ${title}`, {
                startedAt: startedAt,
                finishedAt: finishedAt,
                rawStartedAt: absBook.started_at,
                rawFinishedAt: absBook.finished_at
            });

            // Prepare rollback callback for API failure
            const rollbackCallbacks = [];
            let apiSuccess = false;

            const success = await this.hardcover.markBookCompleted(userBookId, edition.id, totalValue, useSeconds, finishedAt, startedAt);
            
            if (success) {
                logger.info(`Successfully marked ${title} as completed`, {
                    userBookId: userBookId,
                    totalValue: totalValue,
                    useSeconds: useSeconds
                });
                apiSuccess = true;

                // Add API rollback callback
                rollbackCallbacks.push(async () => {
                    logger.info(`Rolling back completion status for ${title}`);
                    // Try to revert the completion (this may not always be possible)
                    try {
                        await this.hardcover.updateBookStatus(userBookId, 2); // Set back to "reading"
                    } catch (rollbackError) {
                        logger.error(`Failed to rollback completion for ${title}`, {
                            error: rollbackError.message
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
                        progress: 100
                    });

                    await this.cache.storeBookCompletionData(
                        this.userId, 
                        identifierValue, 
                        title, 
                        identifierType,
                        absBook.last_listened_at,
                        absBook.started_at,
                        absBook.finished_at
                    );

                    return { status: 'completed', title };
                } catch (cacheError) {
                    // Cache transaction failed, rollback API changes
                    logger.error(`Cache transaction failed for completion ${title}`, {
                        error: cacheError.message,
                        stack: cacheError.stack
                    });
                    for (const callback of rollbackCallbacks) {
                        await callback();
                    }
                    throw cacheError;
                }
            } else {
                logger.error(`Failed to mark ${title} as completed`, {
                    userBookId: userBookId,
                    editionId: edition.id
                });
                return { status: 'error', reason: 'Failed to mark as completed', title };
            }
        } catch (error) {
            logger.error(`Error marking ${title} as completed`, {
                error: error.message,
                stack: error.stack,
                userBookId: userBookId
            });
            return { status: 'error', reason: error.message, title };
        }
    }

    async _handleProgressStatus(userBookId, edition, title, progressPercent, absBook) {
        logger.info(`Updating progress for ${title}`, {
            progress: progressPercent,
            userBookId: userBookId,
            editionId: edition.id
        });

        if (this.dryRun) {
            logger.debug(`[DRY RUN] Would update progress for ${title} to ${progressPercent.toFixed(1)}%`);
            return { status: 'synced', title };
        }

        try {
            // Calculate current progress value
            let currentProgress = 0;
            let useSeconds = false;

            if (edition.audio_seconds) {
                currentProgress = calculateCurrentSeconds(progressPercent, edition.audio_seconds);
                useSeconds = true;
            } else if (edition.pages) {
                currentProgress = calculateCurrentPage(progressPercent, edition.pages);
            }

            logger.debug(`Progress calculation for ${title}`, {
                progressPercent: progressPercent,
                currentProgress: currentProgress,
                useSeconds: useSeconds,
                totalValue: useSeconds ? edition.audio_seconds : edition.pages
            });

            // Prepare rollback callback for API failure
            const rollbackCallbacks = [];
            let previousProgress = null;

            // Get previous progress for rollback
            const identifier = this._extractBookIdentifier(absBook);
            const identifierType = identifier.asin ? 'asin' : 'isbn';
            const identifierValue = identifier.asin || identifier.isbn;
            
            previousProgress = this.cache.getLastProgress(this.userId, identifierValue, title, identifierType);

            logger.debug(`Previous progress for ${title}`, {
                previousProgress: previousProgress,
                newProgress: progressPercent
            });

            const result = await this.hardcover.updateReadingProgress(
                userBookId,
                currentProgress,
                progressPercent,
                edition.id,
                useSeconds,
                this._formatDateForHardcover(absBook.started_at) // Use formatted date instead of raw value
            );

            if (result && result.id) {
                logger.info(`Successfully updated progress for ${title}`, {
                    userBookId: userBookId,
                    progressPercent: progressPercent,
                    currentProgress: currentProgress,
                    resultId: result.id
                });

                // Add API rollback callback
                rollbackCallbacks.push(async () => {
                    logger.info(`Rolling back progress update for ${title}`);
                    if (previousProgress !== null) {
                        try {
                            const rollbackCurrentProgress = useSeconds ? 
                                calculateCurrentSeconds(previousProgress, edition.audio_seconds || 0) :
                                calculateCurrentPage(previousProgress, edition.pages || 0);
                            
                            await this.hardcover.updateReadingProgress(
                                userBookId,
                                rollbackCurrentProgress,
                                previousProgress,
                                edition.id,
                                useSeconds,
                                this._formatDateForHardcover(absBook.started_at)
                            );
                        } catch (rollbackError) {
                            logger.error(`Failed to rollback progress for ${title}`, {
                                error: rollbackError.message
                            });
                        }
                    }
                });

                try {
                    logger.debug(`Caching progress data for ${title}`, {
                        identifier: identifierValue,
                        identifierType: identifierType,
                        progress: progressPercent
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
                        absBook.started_at
                    );

                    return { status: 'synced', title };
                } catch (cacheError) {
                    // Cache transaction failed, rollback API changes
                    logger.error(`Cache transaction failed for progress ${title}`, {
                        error: cacheError.message,
                        stack: cacheError.stack
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
                    progressPercent: progressPercent
                });
                return { status: 'error', reason: 'Failed to update progress', title };
            }
        } catch (error) {
            logger.error(`Error updating progress for ${title}`, {
                error: error.message,
                stack: error.stack,
                userBookId: userBookId
            });
            return { status: 'error', reason: error.message, title };
        }
    }

    _updateResult(result, syncResult) {
        result.books_processed++;
        
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

    getCacheStats() {
        return this.cache.getCacheStats();
    }

    clearCache() {
        this.cache.clearCache();
    }

    exportToJson(filename) {
        this.cache.exportToJson(filename);
    }

    getBooksByAuthor(authorName) {
        return this.cache.getBooksByAuthor(this.userId, authorName);
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
     * Generate a breakdown of book statuses for logging
     */
    _generateBookBreakdown(bookDetails) {
        const breakdown = {
            by_status: {},
            by_action: {},
            errors: [],
            progress_changes: []
        };

        bookDetails.forEach(book => {
            // Count by status
            breakdown.by_status[book.status] = (breakdown.by_status[book.status] || 0) + 1;

            // Count by primary action
            const primaryAction = book.actions[book.actions.length - 1] || 'No action';
            breakdown.by_action[primaryAction] = (breakdown.by_action[primaryAction] || 0) + 1;

            // Collect errors
            if (book.errors.length > 0) {
                breakdown.errors.push({
                    title: book.title,
                    errors: book.errors
                });
            }

            // Collect progress changes
            if (book.progress.changed) {
                breakdown.progress_changes.push({
                    title: book.title,
                    before: book.progress.before,
                    after: book.progress.after
                });
            }
        });

        return breakdown;
    }
}