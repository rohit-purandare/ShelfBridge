import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import logger from './logger.js';

export class BookCache {
    constructor(cacheFile = 'data/.book_cache.db') {
        this.cacheFile = cacheFile;
        this.db = null;
        this.transactionCallbacks = new Map(); // For rollback support
    }

    init() {
        if (!this.db) {
            this._initDatabase();
        }
    }

    _initDatabase() {
        try {
            // Ensure cache directory exists
            const cacheDir = path.dirname(this.cacheFile);
            if (cacheDir && !fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true });
                logger.debug(`Created cache directory: ${cacheDir}`);
            }

            logger.debug(`Initializing database at: ${this.cacheFile}`);
            this.db = new Database(this.cacheFile);

            // Enable WAL mode for better concurrency
            this.db.pragma('journal_mode = WAL');
            this.db.pragma('synchronous = NORMAL');
            this.db.pragma('cache_size = 1000');
            this.db.pragma('temp_store = memory');

            // Create books table with user_id
            this.db.exec(`
                CREATE TABLE IF NOT EXISTS books (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    identifier TEXT NOT NULL,
                    identifier_type TEXT NOT NULL,
                    title TEXT NOT NULL,
                    edition_id INTEGER,
                    author TEXT,
                    last_progress REAL DEFAULT 0.0,
                    progress_percent REAL DEFAULT 0.0,
                    last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_listened_at TIMESTAMP,
                    started_at TIMESTAMP,
                    finished_at TIMESTAMP,
                    UNIQUE(user_id, identifier, title)
                )
            `);

            // Add user_id column if missing (for migration)
            try {
                this.db.exec('ALTER TABLE books ADD COLUMN user_id TEXT NOT NULL DEFAULT ""');
            } catch (err) {
                // Column already exists, ignore error
            }

            // Add timestamp columns if missing (for migration)
            try {
                this.db.exec('ALTER TABLE books ADD COLUMN last_listened_at TIMESTAMP');
            } catch (err) {
                // Column already exists, ignore error
            }

            try {
                this.db.exec('ALTER TABLE books ADD COLUMN started_at TIMESTAMP');
            } catch (err) {
                // Column already exists, ignore error
            }

            try {
                this.db.exec('ALTER TABLE books ADD COLUMN finished_at TIMESTAMP');
            } catch (err) {
                // Column already exists, ignore error
            }

            // Add identifier_type column if missing (for migration)
            try {
                this.db.exec('ALTER TABLE books ADD COLUMN identifier_type TEXT NOT NULL DEFAULT "isbn"');
            } catch (err) {
                // Column already exists, ignore error
            }

            // Create indexes for better performance
            try {
                this.db.exec('CREATE INDEX IF NOT EXISTS idx_books_user_identifier ON books(user_id, identifier, identifier_type)');
                this.db.exec('CREATE INDEX IF NOT EXISTS idx_books_user_title ON books(user_id, title)');
                this.db.exec('CREATE INDEX IF NOT EXISTS idx_books_updated_at ON books(updated_at)');
            } catch (err) {
                logger.debug('Could not create indexes:', err.message);
            }

            logger.debug('Database initialized successfully');
        } catch (err) {
            logger.error(`Database initialization failed: ${err.message}`);
            throw err;
        }
    }

    /**
     * Execute multiple cache operations in a transaction
     * @param {Array<Function>} operations - Array of functions to execute
     * @param {Object} options - Transaction options
     * @returns {Promise<any>} - Result of the transaction
     */
    async executeTransaction(operations, options = {}) {
        this.init();
        
        const { 
            rollbackCallbacks = [], 
            description = 'Cache transaction',
            timeout = 5000 
        } = options;

        const transactionId = Date.now().toString();
        logger.debug(`Starting transaction: ${description} (ID: ${transactionId})`);

        // Store rollback callbacks for this transaction
        if (rollbackCallbacks.length > 0) {
            this.transactionCallbacks.set(transactionId, rollbackCallbacks);
        }

        try {
            // Create the transaction function
            const transaction = this.db.transaction(() => {
                const results = [];
                
                for (let i = 0; i < operations.length; i++) {
                    const operation = operations[i];
                    
                    try {
                        const result = operation();
                        results.push(result);
                    } catch (error) {
                        logger.error(`Transaction operation ${i} failed: ${error.message}`);
                        throw error;
                    }
                }
                
                return results;
            });

            // Execute the transaction with timeout
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Transaction timeout')), timeout);
            });

            const transactionPromise = Promise.resolve(transaction());
            const results = await Promise.race([transactionPromise, timeoutPromise]);

            logger.debug(`Transaction completed successfully: ${description} (ID: ${transactionId})`);
            
            // Clean up rollback callbacks
            this.transactionCallbacks.delete(transactionId);
            
            return results;

        } catch (error) {
            logger.error(`Transaction failed: ${description} (ID: ${transactionId}) - ${error.message}`);
            
            // Execute rollback callbacks if available
            await this._executeRollbackCallbacks(transactionId);
            
            throw error;
        }
    }

    /**
     * Execute rollback callbacks for a failed transaction
     * @param {string} transactionId - Transaction ID
     */
    async _executeRollbackCallbacks(transactionId) {
        const callbacks = this.transactionCallbacks.get(transactionId);
        if (!callbacks || callbacks.length === 0) {
            return;
        }

        logger.debug(`Executing ${callbacks.length} rollback callbacks for transaction ${transactionId}`);

        for (const callback of callbacks) {
            try {
                await callback();
            } catch (error) {
                logger.error(`Rollback callback failed: ${error.message}`);
            }
        }

        this.transactionCallbacks.delete(transactionId);
    }

    /**
     * Store book sync data (edition mapping + progress) in a transaction
     * @param {string} userId - User ID
     * @param {string} identifier - Book identifier (ISBN/ASIN)
     * @param {string} title - Book title
     * @param {number} editionId - Hardcover edition ID
     * @param {string} identifierType - Type of identifier (isbn/asin)
     * @param {string} author - Book author
     * @param {number} progressPercent - Progress percentage
     * @param {string} lastListenedAt - Last listened timestamp
     * @param {string} startedAt - Started reading timestamp
     */
    async storeBookSyncData(userId, identifier, title, editionId, identifierType, author, progressPercent, lastListenedAt = null, startedAt = null) {
        const operations = [
            () => this._storeEditionMappingOperation(userId, identifier, title, editionId, identifierType, author),
            () => this._storeProgressOperation(userId, identifier, title, progressPercent, identifierType, lastListenedAt, startedAt)
        ];

        return await this.executeTransaction(operations, {
            description: `Store sync data for ${title}`,
            timeout: 3000
        });
    }

    /**
     * Store book completion data in a transaction
     * @param {string} userId - User ID
     * @param {string} identifier - Book identifier
     * @param {string} title - Book title
     * @param {string} identifierType - Type of identifier
     * @param {string} lastListenedAt - Last listened timestamp
     * @param {string} startedAt - Started reading timestamp
     * @param {string} finishedAt - Finished reading timestamp
     */
    async storeBookCompletionData(userId, identifier, title, identifierType, lastListenedAt = null, startedAt = null, finishedAt = null) {
        const operations = [
            () => this._storeProgressOperation(userId, identifier, title, 100, identifierType, lastListenedAt, startedAt),
            () => this._storeCompletionTimestamp(userId, identifier, title, identifierType, finishedAt)
        ];

        return await this.executeTransaction(operations, {
            description: `Store completion data for ${title}`,
            timeout: 3000
        });
    }

    /**
     * Internal operation for storing edition mapping
     */
    _storeEditionMappingOperation(userId, identifier, title, editionId, identifierType, author) {
        const normalizedTitle = title.toLowerCase().trim();
        const currentTime = new Date().toISOString();

        const upsertStmt = this.db.prepare(`
            INSERT INTO books (user_id, identifier, identifier_type, title, author, edition_id, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, identifier, title) 
            DO UPDATE SET 
                identifier_type = excluded.identifier_type,
                edition_id = excluded.edition_id,
                author = excluded.author,
                updated_at = excluded.updated_at
        `);
        
        const result = upsertStmt.run(userId, identifier, identifierType, normalizedTitle, author, editionId, currentTime);
        logger.debug(`Stored edition mapping for ${title}: ${identifier} (${identifierType.toUpperCase()}) -> ${editionId}`);
        return result;
    }

    /**
     * Internal operation for storing progress
     */
    _storeProgressOperation(userId, identifier, title, progressPercent, identifierType, lastListenedAt, startedAt) {
        const normalizedTitle = title.toLowerCase().trim();
        const currentTime = new Date().toISOString();

        const upsertStmt = this.db.prepare(`
            INSERT INTO books (user_id, identifier, identifier_type, title, progress_percent, last_sync, updated_at, last_listened_at, started_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, identifier, title) 
            DO UPDATE SET 
                identifier_type = excluded.identifier_type,
                progress_percent = excluded.progress_percent,
                last_sync = excluded.last_sync,
                updated_at = excluded.updated_at,
                last_listened_at = excluded.last_listened_at,
                started_at = excluded.started_at
        `);
        
        const result = upsertStmt.run(userId, identifier, identifierType, normalizedTitle, progressPercent, currentTime, currentTime, lastListenedAt, startedAt);
        logger.debug(`Stored progress for ${title}: ${progressPercent}%`);
        return result;
    }

    /**
     * Internal operation for storing completion timestamp
     */
    _storeCompletionTimestamp(userId, identifier, title, identifierType, finishedAt) {
        if (!finishedAt) return null;

        const normalizedTitle = title.toLowerCase().trim();
        const currentTime = new Date().toISOString();

        const updateStmt = this.db.prepare(`
            UPDATE books 
            SET finished_at = ?, updated_at = ?
            WHERE user_id = ? AND identifier = ? AND identifier_type = ? AND title = ?
        `);
        
        const result = updateStmt.run(finishedAt, currentTime, userId, identifier, identifierType, normalizedTitle);
        logger.debug(`Stored completion timestamp for ${title}: ${finishedAt}`);
        return result;
    }

    // Keep existing methods for backward compatibility
    getEditionForBook(userId, identifier, title, identifierType = 'isbn') {
        this.init();
        
        try {
            const stmt = this.db.prepare(`
                SELECT edition_id FROM books 
                WHERE user_id = ? AND identifier = ? AND identifier_type = ? AND title = ?
            `);
            
            const normalizedTitle = title.toLowerCase().trim();
            const result = stmt.get(userId, identifier, identifierType, normalizedTitle);
            
            if (result && result.edition_id) {
                logger.debug(`Cache hit for ${title}: edition ${result.edition_id} (using ${identifierType.toUpperCase()})`);
                return result.edition_id;
            } else {
                logger.debug(`Cache miss for ${title}: no edition found`);
                return null;
            }
        } catch (err) {
            logger.error(`Error getting edition for ${title}: ${err.message}`);
            return null;
        }
    }

    storeEditionMapping(userId, identifier, title, editionId, identifierType = 'isbn', author = null) {
        this.init();
        
        try {
            return this._storeEditionMappingOperation(userId, identifier, title, editionId, identifierType, author);
        } catch (err) {
            logger.error(`Error storing edition mapping for ${title}: ${err.message}`);
        }
    }

    getLastProgress(userId, identifier, title, identifierType = 'isbn') {
        this.init();
        
        try {
            const stmt = this.db.prepare(`
                SELECT progress_percent FROM books 
                WHERE user_id = ? AND identifier = ? AND identifier_type = ? AND title = ?
            `);
            
            const normalizedTitle = title.toLowerCase().trim();
            logger.debug(`[CACHE READ] user_id=${userId}, identifier=${identifier}, identifier_type=${identifierType}, normalized_title='${normalizedTitle}'`);
            
            const result = stmt.get(userId, identifier, identifierType, normalizedTitle);
            
            if (result && result.progress_percent !== null) {
                logger.debug(`Cache hit for ${title}: progress ${result.progress_percent}%`);
                return result.progress_percent;
            } else {
                logger.debug(`Cache miss for ${title}: no progress found`);
                return null;
            }
        } catch (err) {
            logger.error(`Error getting last progress for ${title}: ${err.message}`);
            return null;
        }
    }

    storeProgress(userId, identifier, title, progressPercent, identifierType = 'isbn', lastListenedAt = null, startedAt = null) {
        this.init();
        
        try {
            return this._storeProgressOperation(userId, identifier, title, progressPercent, identifierType, lastListenedAt, startedAt);
        } catch (err) {
            logger.error(`Error storing progress for ${title}: ${err.message}`);
        }
    }

    hasProgressChanged(userId, identifier, title, currentProgress, identifierType = 'isbn') {
        this.init();
        
        try {
            const stmt = this.db.prepare(`
                SELECT progress_percent FROM books 
                WHERE user_id = ? AND identifier = ? AND identifier_type = ? AND title = ?
            `);
            
            const normalizedTitle = title.toLowerCase().trim();
            const result = stmt.get(userId, identifier, identifierType, normalizedTitle);
            
            if (!result || result.progress_percent === null) {
                logger.debug(`Progress changed for ${title}: no cached progress found`);
                return true; // No cached progress, consider it changed
            }
            
            const cachedProgress = result.progress_percent;
            const hasChanged = Math.abs(cachedProgress - currentProgress) > 0.01; // 0.01% tolerance
            
            if (hasChanged) {
                logger.debug(`Progress changed for ${title}: ${cachedProgress}% -> ${currentProgress}%`);
            } else {
                logger.debug(`Progress unchanged for ${title}: ${currentProgress}%`);
            }
            
            return hasChanged;
        } catch (err) {
            logger.error(`Error checking progress change for ${title}: ${err.message}`);
            return true; // Assume changed on error
        }
    }

    clearCache() {
        this.init(); // Ensure database is initialized
        
        try {
            this.db.exec('DELETE FROM books');
            logger.info('Cache cleared successfully');
        } catch (err) {
            logger.error(`Error clearing cache: ${err.message}`);
        }
    }

    getCacheStats() {
        this.init(); // Ensure database is initialized
        
        try {
            const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM books');
            const totalResult = totalStmt.get();
            
            const recentStmt = this.db.prepare(`
                SELECT COUNT(*) as count FROM books 
                WHERE updated_at > datetime('now', '-7 days')
            `);
            const recentResult = recentStmt.get();
            
            // Get file size
            let cacheSize = 0;
            try {
                const stats = fs.statSync(this.cacheFile);
                cacheSize = stats.size / (1024 * 1024); // Convert to MB
            } catch (err) {
                logger.error(`Error getting cache file size: ${err.message}`);
            }
            
            return {
                total_books: totalResult.count,
                recent_books: recentResult.count,
                cache_size_mb: Math.round(cacheSize * 100) / 100
            };
        } catch (err) {
            logger.error(`Error getting cache stats: ${err.message}`);
            return { total_books: 0, recent_books: 0, cache_size_mb: 0 };
        }
    }

    exportToJson(filename = 'book_cache_export.json') {
        this.init(); // Ensure database is initialized
        
        try {
            const stmt = this.db.prepare('SELECT * FROM books ORDER BY updated_at DESC');
            const books = stmt.all();
            
            const exportData = {
                export_date: new Date().toISOString(),
                total_books: books.length,
                books: books
            };
            
            fs.writeFileSync(filename, JSON.stringify(exportData, null, 2));
            logger.info(`Cache exported to ${filename} (${books.length} books)`);
        } catch (err) {
            logger.error(`Error exporting cache: ${err.message}`);
        }
    }

    getBooksByAuthor(userId, authorName) {
        if (!this.db) {
            return [];
        }
        
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM books 
                WHERE user_id = ? AND author LIKE ?
                ORDER BY title
            `);
            
            const books = stmt.all(userId, `%${authorName}%`);
            return books;
        } catch (err) {
            logger.error(`Error getting books by author: ${err.message}`);
            return [];
        }
    }

    getCachedBookInfo(userId, identifier, title, identifierType = 'isbn') {
        this.init();
        
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM books 
                WHERE user_id = ? AND identifier = ? AND identifier_type = ? AND title = ?
            `);
            
            const normalizedTitle = title.toLowerCase().trim();
            const result = stmt.get(userId, identifier, identifierType, normalizedTitle);
            
            if (result) {
                return {
                    exists: true,
                    edition_id: result.edition_id,
                    author: result.author,
                    progress_percent: result.progress_percent,
                    last_progress: result.last_progress,
                    last_sync: result.last_sync,
                    updated_at: result.updated_at,
                    last_listened_at: result.last_listened_at,
                    started_at: result.started_at,
                    finished_at: result.finished_at,
                    identifier_type: result.identifier_type
                };
            } else {
                return {
                    exists: false,
                    edition_id: null,
                    author: null,
                    progress_percent: null,
                    last_progress: null,
                    last_sync: null,
                    updated_at: null,
                    last_listened_at: null,
                    started_at: null,
                    finished_at: null,
                    identifier_type: null
                };
            }
        } catch (err) {
            logger.error(`Error getting cached book info for ${title}: ${err.message}`);
            return {
                exists: false,
                edition_id: null,
                author: null,
                progress_percent: null,
                last_progress: null,
                last_sync: null,
                updated_at: null,
                last_listened_at: null,
                started_at: null,
                finished_at: null,
                identifier_type: null
            };
        }
    }

    close() {
        if (this.db) {
            try {
                this.db.close();
                logger.info('Database connection closed successfully');
            } catch (error) {
                logger.error('Error closing database connection:', error.message);
            } finally {
                this.db = null;
            }
        }
    }

    // Destructor to ensure cleanup
    destroy() {
        this.close();
    }
} 