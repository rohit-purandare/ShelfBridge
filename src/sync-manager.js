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

export class SyncManager {
    constructor(user, globalConfig, dryRun = false) {
        this.user = user;
        this.userId = user.id;
        this.globalConfig = globalConfig;
        this.dryRun = dryRun;
        
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
        
        console.log(`SyncManager initialized for user: ${this.userId}`);
    }

    _isZeroProgress(progressValue) {
        return !progressValue || progressValue === 0 || progressValue < (this.globalConfig.min_progress_threshold || 5.0);
    }

    async syncProgress() {
        const startTime = Date.now();
        console.log(`Starting sync for user: ${this.userId}`);
        
        const result = {
            books_processed: 0,
            books_synced: 0,
            books_completed: 0,
            books_auto_added: 0,
            books_skipped: 0,
            errors: [],
            timing: {}
        };

        try {
            // Get books from Audiobookshelf
            const absBooks = await this.audiobookshelf.getReadingProgress();
            if (!absBooks || absBooks.length === 0) {
                console.log('No books found in Audiobookshelf');
                return result;
            }

            // Get books from Hardcover
            const hardcoverBooks = await this.hardcover.getUserBooks();
            if (!hardcoverBooks || hardcoverBooks.length === 0) {
                console.log('No books found in Hardcover library');
                return result;
            }

            // Create lookup maps for efficient matching
            const identifierLookup = this._createIdentifierLookup(hardcoverBooks);
            const isbnLookup = this._createIsbnLookup(hardcoverBooks);

            // Filter books that need syncing
            const syncableBooks = absBooks.filter(book => {
                const progress = book.progress_percentage || 0;
                return !this._isZeroProgress(progress);
            });

            console.log(`Found ${syncableBooks.length} books with progress to sync`);

            // Sync books
            if (this.globalConfig.parallel) {
                await this._syncBooksParallel(syncableBooks, identifierLookup, result);
            } else {
                await this._syncBooksSequential(syncableBooks, identifierLookup, result);
            }

            // Update timing data
            result.timing = this.getTimingData();
            result.timing.total_duration = Date.now() - startTime;

            console.log(`Sync completed for user: ${this.userId}`);
            return result;

        } catch (error) {
            console.error(`Sync failed for user ${this.userId}:`, error.message);
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

    _createIsbnLookup(hardcoverBooks) {
        const lookup = {};
        
        for (const userBook of hardcoverBooks) {
            const book = userBook.book;
            if (!book || !book.editions) continue;

            for (const edition of book.editions) {
                if (edition.isbn_10) {
                    const normalizedIsbn = normalizeIsbn(edition.isbn_10);
                    if (normalizedIsbn) {
                        lookup[normalizedIsbn] = { userBook, edition };
                    }
                }
                if (edition.isbn_13) {
                    const normalizedIsbn = normalizeIsbn(edition.isbn_13);
                    if (normalizedIsbn) {
                        lookup[normalizedIsbn] = { userBook, edition };
                    }
                }
            }
        }

        return lookup;
    }

    async _syncBooksSequential(syncableBooks, identifierLookup, result) {
        for (const absBook of syncableBooks) {
            try {
                const syncResult = await this._syncSingleBook(absBook, identifierLookup);
                this._updateResult(result, syncResult);
            } catch (error) {
                console.error(`Error syncing book ${absBook.title}:`, error.message);
                result.errors.push(`Error syncing ${absBook.title}: ${error.message}`);
            }
        }
    }

    async _syncBooksParallel(syncableBooks, identifierLookup, result) {
        const workers = this.globalConfig.workers || 3;
        const chunks = this._chunkArray(syncableBooks, workers);

        for (const chunk of chunks) {
            const promises = chunk.map(absBook => 
                this._syncSingleBook(absBook, identifierLookup).catch(error => {
                    console.error(`Error syncing book ${absBook.title}:`, error.message);
                    return { error: error.message, book: absBook.title };
                })
            );

            const results = await Promise.all(promises);
            
            for (const syncResult of results) {
                if (syncResult.error) {
                    result.errors.push(`Error syncing ${syncResult.book}: ${syncResult.error}`);
                } else {
                    this._updateResult(result, syncResult);
                }
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

    async _syncSingleBook(absBook, identifierLookup) {
        const title = extractTitle(absBook) || 'Unknown Title';
        const progressPercent = absBook.progress_percentage || 0;
        
        console.log(`Processing: ${title} (${progressPercent.toFixed(1)}%)`);

        // Extract identifiers
        const identifiers = this._extractBookIdentifier(absBook);
        console.log(`[DEBUG] Extracted identifiers for '${title}': ISBN='${identifiers.isbn}', ASIN='${identifiers.asin}'`);
        if (!identifiers.isbn && !identifiers.asin) {
            console.log(`Skipping ${title}: No ISBN or ASIN found`);
            return { status: 'skipped', reason: 'No ISBN or ASIN', title };
        }

        // Try to find match in Hardcover
        let hardcoverMatch = null;
        let identifierType = null;

        // First try ASIN (for audiobooks)
        if (identifiers.asin && identifierLookup[identifiers.asin]) {
            hardcoverMatch = identifierLookup[identifiers.asin];
            identifierType = 'asin';
            console.log(`Found ASIN match for ${title}: ${identifiers.asin}`);
        }
        // Fall back to ISBN
        else if (identifiers.isbn && identifierLookup[identifiers.isbn]) {
            hardcoverMatch = identifierLookup[identifiers.isbn];
            identifierType = 'isbn';
            console.log(`Found ISBN match for ${title}: ${identifiers.isbn}`);
        }

        if (!hardcoverMatch) {
            // Try to auto-add the book
            return await this._tryAutoAddBook(absBook, identifiers);
        }

        // Check if progress has changed
        const identifier = identifierType === 'asin' ? identifiers.asin : identifiers.isbn;
        if (!(this.cache.hasProgressChanged(this.userId, identifier, title, progressPercent, identifierType))) {
            console.log(`Skipping ${title}: Progress unchanged`);
            return { status: 'skipped', reason: 'Progress unchanged', title };
        }

        // Sync the existing book
        return await this._syncExistingBook(absBook, hardcoverMatch, identifierType, identifier);
    }

    async _tryAutoAddBook(absBook, identifiers) {
        const title = extractTitle(absBook) || 'Unknown Title';
        console.log(`Attempting to auto-add ${title} to Hardcover`);

        try {
            // Search for the book by ISBN or ASIN
            let searchResults = [];
            
            if (identifiers.asin) {
                searchResults = await this.hardcover.searchBooksByAsin(identifiers.asin);
            }
            
            if (searchResults.length === 0 && identifiers.isbn) {
                searchResults = await this.hardcover.searchBooksByIsbn(identifiers.isbn);
            }

            if (searchResults.length === 0) {
                console.log(`Could not find ${title} in Hardcover database`);
                return { status: 'skipped', reason: 'Book not found in Hardcover', title };
            }

            // Add the first result to library
            const edition = searchResults[0];
            const bookId = edition.book.id;
            const editionId = edition.id;

            if (this.dryRun) {
                console.log(`[DRY RUN] Would add ${title} to library (book_id: ${bookId}, edition_id: ${editionId})`);
                return { status: 'auto_added', title, bookId, editionId };
            }

            const addResult = await this.hardcover.addBookToLibrary(bookId, 2, editionId);
            
            if (addResult) {
                console.log(`Successfully added ${title} to library`);
                
                // Cache the edition mapping
                const identifier = identifiers.asin || identifiers.isbn;
                const identifierType = identifiers.asin ? 'asin' : 'isbn';
                const author = this._extractAuthorFromData(absBook, { userBook: null, edition });
                
                this.cache.storeEditionMapping(
                    this.userId, 
                    identifier, 
                    title, 
                    editionId, 
                    identifierType, 
                    author
                );

                return { status: 'auto_added', title, userBookId: addResult.id };
            } else {
                console.error(`Failed to add ${title} to library`);
                return { status: 'error', reason: 'Failed to add to library', title };
            }

        } catch (error) {
            console.error(`Error auto-adding ${title}:`, error.message);
            return { status: 'error', reason: error.message, title };
        }
    }

    async _syncExistingBook(absBook, hardcoverMatch, identifierType, identifier) {
        const title = extractTitle(absBook) || 'Unknown Title';
        const progressPercent = absBook.progress_percentage || 0;
        const { userBook, edition } = hardcoverMatch;

        try {
            // Select the best edition
            const selectedEdition = await this._selectEditionWithCache(absBook, hardcoverMatch, title);
            if (!selectedEdition) {
                return { status: 'error', reason: 'No suitable edition found', title };
            }

            // Use Audiobookshelf's is_finished flag if present
            const isFinished = absBook.is_finished === true || absBook.is_finished === 1;
            if (isFinished || progressPercent >= 95) {
                return await this._handleCompletionStatus(userBook.id, selectedEdition, title, progressPercent, absBook, isFinished);
            }

            // Handle progress update
            return await this._handleProgressStatus(userBook.id, selectedEdition, title, progressPercent, absBook);

        } catch (error) {
            console.error(`Error syncing existing book ${title}:`, error.message);
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

        // Use the matched edition and cache it
        if (edition) {
            const author = this._extractAuthorFromData(absBook, hardcoverMatch);
            this.cache.storeEditionMapping(
                this.userId, 
                identifierValue, 
                title, 
                edition.id, 
                identifierType, 
                author
            );
            return edition;
        }

        return null;
    }

    async _handleCompletionStatus(userBookId, edition, title, progressPercent, absBook, isFinished = false) {
        console.log(`Marking ${title} as completed (${progressPercent.toFixed(1)}%)`);

        if (this.dryRun) {
            console.log(`[DRY RUN] Would mark ${title} as completed`);
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
            const success = await this.hardcover.markBookCompleted(userBookId, edition.id, totalValue, useSeconds);
            if (success) {
                console.log(`Successfully marked ${title} as completed`);
                // Cache the progress
                const identifier = this._extractBookIdentifier(absBook);
                const identifierType = identifier.asin ? 'asin' : 'isbn';
                const identifierValue = identifier.asin || identifier.isbn;
                this.cache.storeProgress(this.userId, identifierValue, title, 100, identifierType);
                return { status: 'completed', title };
            } else {
                console.error(`Failed to mark ${title} as completed`);
                return { status: 'error', reason: 'Failed to mark as completed', title };
            }
        } catch (error) {
            console.error(`Error marking ${title} as completed:`, error.message);
            return { status: 'error', reason: error.message, title };
        }
    }

    async _handleProgressStatus(userBookId, edition, title, progressPercent, absBook) {
        console.log(`Updating progress for ${title}: ${progressPercent.toFixed(1)}%`);

        if (this.dryRun) {
            console.log(`[DRY RUN] Would update progress for ${title} to ${progressPercent.toFixed(1)}%`);
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

            const result = await this.hardcover.updateReadingProgress(
                userBookId,
                currentProgress,
                progressPercent,
                edition.id,
                useSeconds
            );

            if (result && result.id) {
                console.log(`Successfully updated progress for ${title}`);
                // Cache the progress
                const identifier = this._extractBookIdentifier(absBook);
                const identifierType = identifier.asin ? 'asin' : 'isbn';
                const identifierValue = identifier.asin || identifier.isbn;
                this.cache.storeProgress(this.userId, identifierValue, title, progressPercent, identifierType);
                return { status: 'synced', title };
            } else {
                console.error(`Failed to update progress for ${title}`);
                return { status: 'error', reason: 'Failed to update progress', title };
            }
        } catch (error) {
            console.error(`Error updating progress for ${title}:`, error.message);
            return { status: 'error', reason: error.message, title };
        }
    }

    _extractBookIdentifier(absBook) {
        const isbn = extractIsbn(absBook);
        const asin = extractAsin(absBook);
        
        return {
            isbn: isbn ? normalizeIsbn(isbn) : null,
            asin: asin ? normalizeAsin(asin) : null
        };
    }

    _extractAuthorFromData(absBook, hardcoverMatch) {
        // Try to get author from Audiobookshelf data first
        const absAuthor = extractAuthor(absBook);
        if (absAuthor) {
            console.log(`[DEBUG] Extracted author from Audiobookshelf: '${absAuthor}'`);
            return absAuthor;
        }
        
        // Try to get author from Hardcover data as fallback
        if (hardcoverMatch && hardcoverMatch.edition && hardcoverMatch.edition.book) {
            const contributions = hardcoverMatch.edition.book.contributions;
            if (contributions && contributions.length > 0) {
                const hardcoverAuthor = contributions[0].author.name;
                console.log(`[DEBUG] Extracted author from Hardcover: '${hardcoverAuthor}'`);
                return hardcoverAuthor;
            }
        }
        
        console.log(`[DEBUG] No author found for book`);
        return null;
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
        console.log('=== Timing Summary ===');
        for (const [key, value] of Object.entries(this.timingData)) {
            console.log(`${key}: ${value}ms`);
        }
    }
}