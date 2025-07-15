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
    calculateCurrentSeconds
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

    /**
     * Generate a stable identifier for books without ASIN/ISBN
     * @param {string} title - Book title
     * @returns {string} A stable identifier based on the title
     */
    _generateTitleBasedIdentifier(title) {
        if (!title) return 'unknown-book';
        
        // Create a stable hash-like identifier from the title
        // Remove numbers, punctuation, normalize spaces, and make lowercase
        const normalized = title
            .toLowerCase()
            .replace(/^[\d\s\-\.]+/, '') // Remove leading numbers like "01 ", "06 "
            .replace(/[^\w\s]/g, '') // Remove punctuation
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .trim();
        
        return `title-${normalized}` || 'title-unknown';
    }

    async syncProgress() {
        const startTime = Date.now();
        const syncMode = this.globalConfig.sync_mode || 'all_books';
        logger.info(`🚀 Starting sync for user: ${this.userId}`);
        logger.info(`Configuration: dryRun=${this.dryRun}, timezone=${this.timezone}, syncMode=${syncMode}`);
        
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
            // TESTING OPTIMIZATION: Skip fetching all Hardcover books for now
            // This avoids the 30+ second timeout when fetching 6000+ editions
            logger.warn('⚠️  TESTING MODE: Skipping Hardcover library fetch to avoid timeouts');
            logger.info('📚 Will use direct search instead of identifier lookup');
            const hardcoverBooks = [];
            const identifierLookup = {};

            // Batch processing setup - fetch books in batches from the start
            const BATCH_SIZE = 5;
            
            logger.info(`🔄 Processing ALL books in batches of ${BATCH_SIZE} (fetching each batch separately)`);

            // Process books in batches by fetching them directly with offset/limit
            let totalBooksProcessed = 0;
            let batchNumber = 1;
            
            // Continue processing until no more books are found
            for (let offset = 0; ; offset += BATCH_SIZE) {
                
                logger.info(`\n${'='.repeat(100)}`);
                logger.info(`📦 BATCH ${batchNumber}: Fetching ${BATCH_SIZE} books (offset: ${offset})`);
                logger.info(`${'='.repeat(100)}`);
                
                // Fetch this batch of books directly from Audiobookshelf
                const syncMode = this.globalConfig.sync_mode || 'all_books';
                const currentBatch = await this.audiobookshelf.getReadingProgress(BATCH_SIZE, offset, syncMode);
                
                if (!currentBatch || currentBatch.length === 0) {
                    logger.info('No more books found, ending batch processing');
                    break;
                }
                
                logger.info(`✅ Fetched ${currentBatch.length} books for this batch`);
                
                logger.info(`\n${'='.repeat(100)}`);
                logger.info(`📦 BATCH ${batchNumber}: Processing ${currentBatch.length} books (offset: ${offset})`);
                logger.info(`${'='.repeat(100)}`);

                // Process each book in this batch
                for (const absBook of currentBatch) {
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
                    
                    // Log detailed book information
                    logger.info(`\n${'='.repeat(80)}`);
                    logger.info(`📖 PROCESSING BOOK ${result.books_processed}: ${bookDetail.title}`);
                    logger.info(`${'='.repeat(80)}`);
                    
                    // Log raw book data for debugging
                    logger.debug('Raw Audiobookshelf book data:', {
                        id: absBook.id,
                        title: absBook.media?.metadata?.title,
                        author: absBook.media?.metadata?.authors,
                        isbn: absBook.media?.metadata?.isbn,
                        asin: absBook.media?.metadata?.asin,
                        progress: absBook.progress,
                        progressPercent: absBook.progress_percentage,
                        isFinished: absBook.is_finished,
                        lastListened: absBook.last_listened_at,
                        startedAt: absBook.started_at,
                        finishedAt: absBook.finished_at
                    });

                    // Extract identifiers
                    logger.info('🔍 Extracting identifiers...');
                    const identifiers = this._extractBookIdentifier(absBook);
                    bookDetail.identifiers = identifiers;
                    logger.info(`✅ Identifiers found: ISBN=${identifiers.isbn || 'none'}, ASIN=${identifiers.asin || 'none'}`);
                    bookDetail.actions.push(`Found identifiers: ${Object.entries(identifiers).filter(([_k,v]) => v).map(([k,v]) => `${k.toUpperCase()}=${v}`).join(', ') || 'none'}`);

                    // Check cache for this book
                    logger.info('💾 Checking cache...');
                    const cacheIdentifier = identifiers.asin || identifiers.isbn || this._generateTitleBasedIdentifier(bookDetail.title);
                    const cacheIdentifierType = identifiers.asin ? 'asin' : (identifiers.isbn ? 'isbn' : 'title');
                    let cachedInfo = null;
                    
                    if (cacheIdentifier) {
                        cachedInfo = await this.cache.getCachedBookInfo(this.userId, cacheIdentifier, bookDetail.title, cacheIdentifierType);
                        logger.info(`Cache lookup using ${cacheIdentifierType}: ${cacheIdentifier}`);
                        
                        if (cachedInfo.exists) {
                            logger.info('✅ Found cached data:');
                            bookDetail.actions.push(`Cache data:`);
                            
                            if (cachedInfo.edition_id) {
                                logger.info(`  - Edition ID: ${cachedInfo.edition_id}`);
                                bookDetail.actions.push(`  - Edition: ${cachedInfo.edition_id}`);
                            }
                            if (cachedInfo.author) {
                                logger.info(`  - Author: ${cachedInfo.author}`);
                                bookDetail.actions.push(`  - Author: ${cachedInfo.author}`);
                            }
                            if (cachedInfo.progress_percent !== null) {
                                logger.info(`  - Cached progress: ${cachedInfo.progress_percent}%`);
                                bookDetail.actions.push(`  - Progress: ${cachedInfo.progress_percent}%`);
                            }
                            if (cachedInfo.last_sync) {
                                const lastSyncedDate = this._formatTimestampForDisplay(cachedInfo.last_sync);
                                logger.info(`  - Last synced: ${lastSyncedDate}`);
                                bookDetail.actions.push(`  - Last synced: ${lastSyncedDate}`);
                            }
                            
                            // Convert timestamps to readable dates using timezone
                            if (cachedInfo.started_at) {
                                const startedDate = this._formatTimestampForDisplay(cachedInfo.started_at);
                                logger.info(`  - Started at: ${startedDate}`);
                                bookDetail.actions.push(`  - Started: ${startedDate}`);
                            }
                            if (cachedInfo.finished_at) {
                                const finishedDate = this._formatTimestampForDisplay(cachedInfo.finished_at);
                                logger.info(`  - Finished at: ${finishedDate}`);
                                bookDetail.actions.push(`  - Finished: ${finishedDate}`);
                            }
                        } else {
                            logger.info('❌ No cached data found');
                            bookDetail.actions.push(`Cache: No cached data found`);
                        }
                    } else {
                        logger.warn('⚠️  Cannot check cache - no identifier available');
                        bookDetail.actions.push(`Cache: Cannot check (no identifier)`);
                    }

                    // Get current progress
                    const currentProgress = absBook.progress_percentage || 0;
                    bookDetail.progress.before = currentProgress;
                    logger.info(`📊 Current progress: ${currentProgress.toFixed(1)}%`);
                    bookDetail.actions.push(`Current progress: ${currentProgress.toFixed(1)}%`);

                    // Check if book should be skipped due to low progress
                    logger.info(`🔍 Checking progress threshold...`);
                    logger.info(`  - Current progress: ${currentProgress}%`);
                    logger.info(`  - Min threshold: ${this.globalConfig.min_progress_threshold || 5.0}%`);
                    
                    if (this._isZeroProgress(currentProgress)) {
                        logger.warn(`⚠️  Skipping book - progress below threshold`, {
                            progress: currentProgress,
                            threshold: this.globalConfig.min_progress_threshold || 5.0
                        });
                        bookDetail.status = 'skipped';
                        bookDetail.actions.push(`Skipped: Progress ${currentProgress}% below threshold ${this.globalConfig.min_progress_threshold || 5.0}%`);
                        result.books_skipped++;
                        continue;
                    }
                    logger.info(`✅ Progress above threshold - continuing with sync`);
                    

                    // Check cache for progress changes
                    const identifier = identifiers.asin || identifiers.isbn || this._generateTitleBasedIdentifier(bookDetail.title);
                    const identifierType = identifiers.asin ? 'asin' : (identifiers.isbn ? 'isbn' : 'title');
                    
                    if (!this.globalConfig.force_sync) {
                        let hasChanged = false;
                        
                        if (identifier) {
                            // Use identifier-based caching (preferred)
                            hasChanged = await this.cache.hasProgressChanged(
                                this.userId, 
                                identifier, 
                                bookDetail.title, 
                                currentProgress, 
                                identifierType
                            );
                        } else {
                            // Fallback to title-based caching for books without identifiers
                            logger.debug(`No identifier found for ${bookDetail.title}, using title-based progress tracking`);
                            hasChanged = await this.cache.hasProgressChanged(
                                this.userId, 
                                bookDetail.title, // Use title as identifier
                                bookDetail.title, 
                                currentProgress, 
                                'title' // Use 'title' as identifier type
                            );
                        }
                        
                        if (!hasChanged) {
                            logger.debug(`Skipping ${bookDetail.title} - no progress change`, {
                                progress: currentProgress,
                                identifierUsed: identifier || 'title'
                            });
                            bookDetail.status = 'skipped';
                            bookDetail.actions.push(`Skipped: No progress change (${currentProgress}%)`);
                            result.books_skipped++;
                            continue;
                        } else {
                            const fallbackIdentifier = identifier || bookDetail.title;
                            const fallbackIdentifierType = identifier ? identifierType : 'title';
                            const cachedProgress = await this.cache.getLastProgress(this.userId, fallbackIdentifier, bookDetail.title, fallbackIdentifierType);
                            bookDetail.actions.push(`Progress changed: ${cachedProgress}% → ${currentProgress}%`);
                            bookDetail.progress.changed = true;
                        }
                    }

                    // Try to find book in Hardcover
                    logger.info(`\n🔍 SEARCHING FOR BOOK IN HARDCOVER LIBRARY...`);
                    const hardcoverMatch = this._findBookInHardcover(absBook, identifierLookup);
                    
                    if (hardcoverMatch) {
                        logger.info(`✅ BOOK FOUND IN HARDCOVER!`);
                        logger.info(`  - Hardcover title: ${hardcoverMatch.userBook.book.title}`);
                        logger.info(`  - User book ID: ${hardcoverMatch.userBook.id}`);
                        logger.info(`  - Edition ID: ${hardcoverMatch.edition?.id}`);
                        
                        bookDetail.actions.push(`Found in Hardcover library: ${hardcoverMatch.userBook.book.title}`);
                        
                        logger.info(`\n📤 SYNCING EXISTING BOOK...`);
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
                        logger.warn(`❌ BOOK NOT FOUND IN HARDCOVER LIBRARY`);
                        bookDetail.actions.push('Not found in Hardcover library');
                        
                        // Check if we should try to auto-add this book
                        logger.info(`\n🤔 CHECKING AUTO-ADD CONDITIONS...`);
                        const hasSignificantProgress = !this._isZeroProgress(currentProgress);
                        const shouldAutoAdd = this.globalConfig.auto_add_books === true || hasSignificantProgress;
                        
                        logger.info(`  - Auto-add enabled: ${this.globalConfig.auto_add_books}`);
                        logger.info(`  - Has significant progress: ${hasSignificantProgress} (${currentProgress}%)`);
                        logger.info(`  - Should auto-add: ${shouldAutoAdd}`);
                        
                        if (shouldAutoAdd) {
                            // Determine reason for auto-add attempt
                            if (this.globalConfig.auto_add_books === true && hasSignificantProgress) {
                                logger.info(`📚 Auto-add reason: Setting enabled + book has progress`);
                                bookDetail.actions.push('Attempting to auto-add to Hardcover (enabled + has progress)');
                            } else if (this.globalConfig.auto_add_books === true) {
                                logger.info(`📚 Auto-add reason: Setting enabled`);
                                bookDetail.actions.push('Attempting to auto-add to Hardcover (auto-add enabled)');
                            } else {
                                logger.info(`📚 Auto-add reason: Book has ${currentProgress.toFixed(1)}% progress`);
                                bookDetail.actions.push(`Attempting to auto-add to Hardcover (has ${currentProgress.toFixed(1)}% progress)`);
                            }
                            
                            logger.info(`\n🚀 ATTEMPTING TO AUTO-ADD BOOK TO HARDCOVER...`);
                            const autoAddResult = await this._tryAutoAddBook(absBook, identifiers);
                            
                            bookDetail.status = autoAddResult.status;
                            
                            if (autoAddResult.status === 'auto_added') {
                                if (this.dryRun) {
                                    bookDetail.actions.push(`[DRY RUN] Would auto-add to Hardcover`);
                                } else {
                                    bookDetail.actions.push(`Successfully auto-added to Hardcover`);
                                }
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
                            bookDetail.actions.push(`Auto-add disabled and no significant progress (${currentProgress.toFixed(1)}%) - skipped`);
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
                
                totalBooksProcessed += currentBatch.length;
                logger.info(`\n📊 Batch ${batchNumber} complete: ${currentBatch.length} books processed`);
                logger.info(`📈 Total progress: ${totalBooksProcessed} books processed so far`);
                
                batchNumber++;
            }

            logger.info(`\n🎉 BATCH PROCESSING COMPLETE!`);
            logger.info(`📊 Final stats: ${totalBooksProcessed} books processed across ${batchNumber - 1} batches`);

            // Log final summary with book details
            const duration = (Date.now() - startTime) / 1000;
            result.timing.total = duration;
            
            logger.info(`\n${'='.repeat(80)}`);
            logger.info('📊 SYNC SUMMARY');
            logger.info(`${'='.repeat(80)}`);
            logger.info(`✅ Sync completed in ${duration.toFixed(1)}s`);
            logger.info(`📚 Books processed: ${result.books_processed}`);
            logger.info(`🔄 Books synced: ${result.books_synced}`);
            logger.info(`✅ Books completed: ${result.books_completed}`);
            logger.info(`➕ Books auto-added: ${result.books_auto_added}`);
            logger.info(`⏭️  Books skipped: ${result.books_skipped}`);
            logger.info(`❌ Errors: ${result.errors.length}`);
            
            if (result.errors.length > 0) {
                logger.error('Errors encountered:');
                result.errors.forEach((error, idx) => {
                    logger.error(`  ${idx + 1}. ${error}`);
                });
            }
            
            // Log detailed book results
            if (result.book_details.length > 0) {
                logger.info(`\n📖 DETAILED BOOK RESULTS:`);
                result.book_details.forEach((book, idx) => {
                    logger.info(`\n${idx + 1}. "${book.title}"`);
                    logger.info(`   Status: ${book.status}`);
                    if (book.progress.changed) {
                        logger.info(`   Progress: ${book.progress.before}% → ${book.progress.after}%`);
                    }
                    if (book.actions.length > 0) {
                        logger.info(`   Actions:`);
                        book.actions.forEach(action => {
                            logger.info(`     - ${action}`);
                        });
                    }
                });
            }
            
            // End batch processing
            }

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
        let totalEditions = 0;
        let isbnCount = 0;
        let asinCount = 0;
        
        logger.info(`📚 Building identifier lookup from ${hardcoverBooks.length} Hardcover books...`);
        
        for (const userBook of hardcoverBooks) {
            const book = userBook.book;
            if (!book || !book.editions) continue;

            logger.debug(`  - Processing "${book.title}" with ${book.editions.length} editions`);
            
            for (const edition of book.editions) {
                totalEditions++;
                
                // Add ISBN-10
                if (edition.isbn_10) {
                    const normalizedIsbn = normalizeIsbn(edition.isbn_10);
                    if (normalizedIsbn) {
                        lookup[normalizedIsbn] = { userBook, edition };
                        isbnCount++;
                        logger.debug(`    + Added ISBN-10: ${normalizedIsbn}`);
                    }
                }

                // Add ISBN-13
                if (edition.isbn_13) {
                    const normalizedIsbn = normalizeIsbn(edition.isbn_13);
                    if (normalizedIsbn) {
                        lookup[normalizedIsbn] = { userBook, edition };
                        isbnCount++;
                        logger.debug(`    + Added ISBN-13: ${normalizedIsbn}`);
                    }
                }

                // Add ASIN
                if (edition.asin) {
                    const normalizedAsin = normalizeAsin(edition.asin);
                    if (normalizedAsin) {
                        lookup[normalizedAsin] = { userBook, edition };
                        asinCount++;
                        logger.debug(`    + Added ASIN: ${normalizedAsin}`);
                    }
                }
            }
        }

        logger.info(`✅ Identifier lookup complete:`, {
            totalBooks: hardcoverBooks.length,
            totalEditions: totalEditions,
            totalIdentifiers: Object.keys(lookup).length,
            isbnCount: isbnCount,
            asinCount: asinCount
        });

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
        
        logger.info(`🔍 Searching for "${title}" in Hardcover library`, {
            identifiers: identifiers
        });

        // Log all available identifiers in the lookup table
        logger.debug(`📚 Available identifiers in lookup table: ${Object.keys(identifierLookup).length}`);
        
        // Try ASIN first (for audiobooks)
        if (identifiers.asin) {
            logger.info(`  - Checking ASIN: ${identifiers.asin}`);
            if (identifierLookup[identifiers.asin]) {
                const match = identifierLookup[identifiers.asin];
                logger.info(`  ✅ FOUND ASIN MATCH!`, {
                    asin: identifiers.asin,
                    hardcoverTitle: match.userBook.book.title,
                    userBookId: match.userBook.id,
                    editionId: match.edition.id
                });
                return match;
            } else {
                logger.info(`  ❌ No match for ASIN ${identifiers.asin}`);
            }
        } else {
            logger.info(`  - No ASIN available for this book`);
        }

        // Fall back to ISBN
        if (identifiers.isbn) {
            logger.info(`  - Checking ISBN: ${identifiers.isbn}`);
            if (identifierLookup[identifiers.isbn]) {
                const match = identifierLookup[identifiers.isbn];
                logger.info(`  ✅ FOUND ISBN MATCH!`, {
                    isbn: identifiers.isbn,
                    hardcoverTitle: match.userBook.book.title,
                    userBookId: match.userBook.id,
                    editionId: match.edition.id
                });
                return match;
            } else {
                logger.info(`  ❌ No match for ISBN ${identifiers.isbn}`);
            }
        } else {
            logger.info(`  - No ISBN available for this book`);
        }

        logger.warn(`❌ No match found for "${title}" in Hardcover library`, {
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
        if (!this.globalConfig.force_sync && !(await this.cache.hasProgressChanged(this.userId, identifier, title, progressPercent, identifierType))) {
            logger.info(`Skipping ${title}: Progress unchanged`);
            return { status: 'skipped', reason: 'Progress unchanged', title };
        }

        // Sync the existing book
        return await this._syncExistingBook(absBook, hardcoverMatch, identifierType, identifier);
    }

    async _tryAutoAddBook(absBook, identifiers) {
        const title = extractTitle(absBook) || 'Unknown Title';
        logger.info(`\n🔎 AUTO-ADD: Attempting to auto-add "${title}" to Hardcover`, {
            identifiers: identifiers,
            title: title
        });

        try {
            // Use enhanced search with alternative identifiers
            const authorName = this._extractAuthorFromData(absBook);
            logger.info(`📖 Book title: "${title}"`);
            logger.info(`👤 Author: ${authorName || 'Unknown'}`);
            
            // Try enhanced search that includes alternative identifiers
            const searchResults = await this.hardcover.searchWithAlternativeIdentifiers(
                identifiers.asin, 
                title, 
                authorName
            );
            
            if (searchResults.length > 0) {
                logger.info(`✅ Enhanced search found ${searchResults.length} matches:`);
                searchResults.slice(0, 3).forEach((result, idx) => {
                    const authors = result.book.contributions?.map(c => c.author?.name).filter(Boolean).join(', ') || 'Unknown';
                    const format = result.reading_format?.format || result.physical_format || 'Unknown';
                    logger.info(`  ${idx + 1}. "${result.book.title}" by ${authors} - Edition ID: ${result.id}, Format: ${format}`);
                });
            }

            if (searchResults.length === 0) {
                logger.warn(`❌ Could not find "${title}" in Hardcover database using any search method`, {
                    searchedIdentifiers: identifiers,
                    searchedTitle: title,
                    searchedAuthor: this._extractAuthorFromData(absBook)
                });
                return { status: 'skipped', reason: 'Book not found in Hardcover', title };
            }

            // Add the first result to library
            const edition = searchResults[0];
            const bookId = edition.book.id;
            const editionId = edition.id;

            // Determine which search method found the book
            let searchMethod = 'Unknown';
            if (identifiers.asin && edition.asin === identifiers.asin) {
                searchMethod = 'ASIN';
            } else if (identifiers.isbn && (edition.isbn_10 === identifiers.isbn || edition.isbn_13 === identifiers.isbn)) {
                searchMethod = 'ISBN';
            } else {
                searchMethod = 'Title + Author';
            }

            const selectedFormat = edition.reading_format?.format || edition.physical_format || 'Unknown';
            logger.info(`\n📚 SELECTED EDITION FOR AUTO-ADD:`, {
                title: title,
                hardcoverTitle: edition.book.title,
                bookId: bookId,
                editionId: editionId,
                format: selectedFormat,
                foundBy: searchMethod
            });

            const authors = edition.book.contributions?.map(c => c.author?.name).filter(Boolean).join(', ') || 'Unknown';
            logger.info(`👤 Authors: ${authors}`);
            logger.info(`🔍 Found using: ${searchMethod} search`);

            if (this.dryRun) {
                logger.info(`🏃 [DRY RUN] Would add "${title}" to library (book_id: ${bookId}, edition_id: ${editionId})`);
                return { status: 'auto_added', title, bookId, editionId };
            }

            // Prepare rollback callback in case API fails
            const rollbackCallbacks = [];
            const _apiRollbackNeeded = false;

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
                const identifier = identifiers.asin || identifiers.isbn || this._generateTitleBasedIdentifier(title);
                const identifierType = identifiers.asin ? 'asin' : (identifiers.isbn ? 'isbn' : 'title');
                const author = this._extractAuthorFromData(absBook, { userBook: null, edition });
                
                // Add API rollback callback
                const _apiRollbackNeeded = true;
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
                        absBook.started_at
                    );

                    // If there's meaningful progress, immediately sync it to Hardcover
                    if (currentProgress > 0 && !this._isZeroProgress(currentProgress)) {
                        logger.info(`Auto-added book has ${currentProgress}% progress, syncing immediately`, {
                            title: title,
                            progress: currentProgress
                        });
                        
                        try {
                            // Create hardcover match object for progress sync
                            const _hardcoverMatch = { 
                                userBook: { id: addResult.id, book: edition.book }, 
                                edition: edition 
                            };
                            
                            // Check if book should be marked as completed
                            const isFinished = absBook.is_finished === true || absBook.is_finished === 1;
                            if (isFinished) {
                                await this._handleCompletionStatus(addResult.id, edition, title, currentProgress, absBook, isFinished);
                                logger.info(`Auto-added book marked as completed`, { title: title });
                            } else if (currentProgress >= 95) {
                                await this._handleCompletionStatus(addResult.id, edition, title, currentProgress, absBook, false);
                                logger.info(`Auto-added book marked as completed (high progress)`, { title: title });
                            } else {
                                await this._handleProgressStatus(addResult.id, edition, title, currentProgress, absBook);
                                logger.info(`Auto-added book progress synced`, { title: title, progress: currentProgress });
                            }
                        } catch (progressSyncError) {
                            // Don't fail the entire auto-add if progress sync fails
                            logger.warn(`Failed to sync progress for auto-added book ${title}`, {
                                error: progressSyncError.message,
                                progress: currentProgress
                            });
                        }
                    }

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

    async _syncExistingBook(absBook, hardcoverMatch, _identifierType, _identifier) {
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

            // Check for progress regression protection if enabled
            const shouldProtectAgainstRegression = this.globalConfig.prevent_progress_regression !== false;
            if (shouldProtectAgainstRegression) {
                const regressionCheck = await this._checkProgressRegression(userBook.id, progressPercent, title);
                if (regressionCheck.shouldBlock) {
                    logger.warn(`Blocking potential progress regression for ${title}: ${regressionCheck.reason}`);
                    return { 
                        status: 'skipped', 
                        reason: `Progress regression protection: ${regressionCheck.reason}`, 
                        title 
                    };
                }
                if (regressionCheck.shouldWarn) {
                    logger.warn(`Progress regression detected for ${title}: ${regressionCheck.reason}`);
                }
            }

            // Use Audiobookshelf's is_finished flag if present, prioritize it over percentage
            const isFinished = absBook.is_finished === true || absBook.is_finished === 1;
            
            // Prioritize is_finished flag, then fall back to progress percentage
            if (isFinished) {
                logger.debug(`Book ${title} is marked as finished in Audiobookshelf`, {
                    isFinished: isFinished,
                    progress: progressPercent
                });
                return await this._handleCompletionStatus(userBook.id, selectedEdition, title, progressPercent, absBook, isFinished);
            } else if (progressPercent >= 95) {
                logger.debug(`Book ${title} is completed based on high progress`, {
                    isFinished: isFinished,
                    progress: progressPercent
                });
                return await this._handleCompletionStatus(userBook.id, selectedEdition, title, progressPercent, absBook, false);
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
            reason: ''
        };

        try {
            // Get current progress from Hardcover
            const progressInfo = await this.hardcover.getBookCurrentProgress(userBookId);
            
            if (!progressInfo || !progressInfo.has_progress || !progressInfo.latest_read) {
                return result; // No existing progress to compare
            }

            const latestRead = progressInfo.latest_read;

            // If book was completed (has finished_at), block any progress updates
            if (latestRead.finished_at) {
                // Get reread threshold from config
                const rereadThreshold = this.globalConfig.reread_detection?.reread_threshold || 30;
                
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
                    previousProgressPercent = (latestRead.progress_seconds / latestRead.edition.audio_seconds) * 100;
                } else if (latestRead.progress_pages && latestRead.edition.pages) {
                    previousProgressPercent = (latestRead.progress_pages / latestRead.edition.pages) * 100;
                }
            }

            // Get thresholds from config
            const HIGH_PROGRESS_THRESHOLD = this.globalConfig.reread_detection?.high_progress_threshold || 85;
            const REGRESSION_BLOCK_THRESHOLD = this.globalConfig.reread_detection?.regression_block_threshold || 50;
            const REGRESSION_WARN_THRESHOLD = this.globalConfig.reread_detection?.regression_warn_threshold || 15;

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
                userBookId
            });
        }

        return result;
    }

    async _selectEditionWithCache(absBook, hardcoverMatch, title) {
        const { userBook, edition } = hardcoverMatch;
        
        // Check cache first
        const identifier = this._extractBookIdentifier(absBook);
        const identifierType = identifier.asin ? 'asin' : (identifier.isbn ? 'isbn' : 'title');
        const identifierValue = identifier.asin || identifier.isbn || this._generateTitleBasedIdentifier(title);
        
        const cachedEditionId = await this.cache.getEditionForBook(
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
            const _apiSuccess = false;

            const success = await this.hardcover.markBookCompleted(userBookId, edition.id, totalValue, useSeconds, finishedAt, startedAt);
            
            if (success) {
                logger.info(`Successfully marked ${title} as completed`, {
                    userBookId: userBookId,
                    totalValue: totalValue,
                    useSeconds: useSeconds
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
                            error: rollbackError.message
                        });
                    }
                });

                // Store completion data in transaction
                const identifier = this._extractBookIdentifier(absBook);
                const identifierType = identifier.asin ? 'asin' : (identifier.isbn ? 'isbn' : 'title');
                const identifierValue = identifier.asin || identifier.isbn || this._generateTitleBasedIdentifier(title);

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
            const identifierType = identifier.asin ? 'asin' : (identifier.isbn ? 'isbn' : 'title');
            const identifierValue = identifier.asin || identifier.isbn || this._generateTitleBasedIdentifier(title);
            
            previousProgress = await this.cache.getLastProgress(this.userId, identifierValue, title, identifierType);

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
                this._formatDateForHardcover(absBook.started_at), // Use formatted date instead of raw value
                this.globalConfig.reread_detection // Pass reread configuration
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
                                this._formatDateForHardcover(absBook.started_at),
                                this.globalConfig.reread_detection
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
            if (this.cache) {
                this.cache.close();
                logger.debug('SyncManager: Database connection closed');
            }
        } catch (error) {
            logger.error('Error during SyncManager cleanup', {
                error: error.message,
                stack: error.stack
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