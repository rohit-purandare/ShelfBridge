import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export class BookCache {
    constructor(cacheFile = 'data/.book_cache.db') {
        this.cacheFile = cacheFile;
        this.db = null;
        console.log(`BookCache: Database file path: ${this.cacheFile}`);
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
                console.log(`Created cache directory: ${cacheDir}`);
            }

            console.log(`Attempting to create database at: ${this.cacheFile}`);
            this.db = new Database(this.cacheFile);
            console.log(`Database created successfully at: ${this.cacheFile}`);

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
                    UNIQUE(user_id, identifier, title)
                )
            `);

            // Add user_id column if missing (for migration)
            try {
                this.db.exec('ALTER TABLE books ADD COLUMN user_id TEXT NOT NULL DEFAULT ""');
            } catch (err) {
                // Column already exists, ignore error
            }

            // Create indexes for better performance
            const indexes = [
                'CREATE INDEX IF NOT EXISTS idx_user_id ON books(user_id)',
                'CREATE INDEX IF NOT EXISTS idx_identifier ON books(identifier)',
                'CREATE INDEX IF NOT EXISTS idx_identifier_type ON books(identifier_type)',
                'CREATE INDEX IF NOT EXISTS idx_title ON books(title)',
                'CREATE INDEX IF NOT EXISTS idx_edition_id ON books(edition_id)',
                'CREATE INDEX IF NOT EXISTS idx_author ON books(author)'
            ];

            for (const index of indexes) {
                try {
                    this.db.exec(index);
                } catch (err) {
                    console.error(`Error creating index: ${err.message}`);
                }
            }

            console.log(`Database schema initialized successfully at ${this.cacheFile}`);
        } catch (error) {
            console.error(`Database initialization failed: ${error.message}`);
            throw error;
        }
    }

    getEditionForBook(userId, identifier, title, identifierType = 'isbn') {
        this.init();
        
        try {
            const stmt = this.db.prepare(`
                SELECT edition_id FROM books 
                WHERE user_id = ? AND identifier = ? AND identifier_type = ? AND title = ?
            `);
            
            const result = stmt.get(userId, identifier, identifierType, title.toLowerCase().trim());
            
            if (result && result.edition_id) {
                console.debug(`Cache hit for ${title}: edition ${result.edition_id} (using ${identifierType.toUpperCase()})`);
                return result.edition_id;
            } else {
                return null;
            }
        } catch (err) {
            console.error(`Error getting edition for ${title}: ${err.message}`);
            return null;
        }
    }

    storeEditionMapping(userId, identifier, title, editionId, identifierType = 'isbn', author = null) {
        this.init();
        
        try {
            const normalizedTitle = title.toLowerCase().trim();
            const currentTime = new Date().toISOString();

            // Check if the row exists
            const checkStmt = this.db.prepare(`
                SELECT 1 FROM books 
                WHERE user_id = ? AND identifier = ? AND identifier_type = ? AND title = ?
            `);
            
            const exists = checkStmt.get(userId, identifier, identifierType, normalizedTitle);

            if (exists) {
                // Only update edition_id, author, updated_at
                const updateStmt = this.db.prepare(`
                    UPDATE books 
                    SET edition_id = ?, author = ?, updated_at = ?
                    WHERE user_id = ? AND identifier = ? AND identifier_type = ? AND title = ?
                `);
                
                updateStmt.run(editionId, author, currentTime, userId, identifier, identifierType, normalizedTitle);
                console.debug(`Cached edition mapping for ${title}: ${identifier} (${identifierType.toUpperCase()}) -> ${editionId} (author: ${author})`);
            } else {
                // Insert a new row, progress_percent will be default (0.0)
                const insertStmt = this.db.prepare(`
                    INSERT INTO books (user_id, identifier, identifier_type, title, author, edition_id, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `);
                
                insertStmt.run(userId, identifier, identifierType, normalizedTitle, author, editionId, currentTime);
                console.debug(`Cached edition mapping for ${title}: ${identifier} (${identifierType.toUpperCase()}) -> ${editionId} (author: ${author})`);
            }
        } catch (err) {
            console.error(`Error storing edition mapping for ${title}: ${err.message}`);
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
            console.log(`[CACHE READ] user_id=${userId}, identifier=${identifier}, identifier_type=${identifierType}, normalized_title='${normalizedTitle}'`);
            
            const result = stmt.get(userId, identifier, identifierType, normalizedTitle);
            
            if (result && result.progress_percent !== null) {
                console.debug(`Cache hit for ${title}: progress ${result.progress_percent}%`);
                return result.progress_percent;
            } else {
                console.debug(`Cache miss for ${title}`);
                return null;
            }
        } catch (err) {
            console.error(`Error getting last progress for ${title}: ${err.message}`);
            return null;
        }
    }

    storeProgress(userId, identifier, title, progressPercent, identifierType = 'isbn') {
        this.init();
        
        try {
            const normalizedTitle = title.toLowerCase().trim();
            const currentTime = new Date().toISOString();

            // Check if the row exists
            const checkStmt = this.db.prepare(`
                SELECT 1 FROM books 
                WHERE user_id = ? AND identifier = ? AND identifier_type = ? AND title = ?
            `);
            
            const exists = checkStmt.get(userId, identifier, identifierType, normalizedTitle);

            if (exists) {
                // Update existing row
                const updateStmt = this.db.prepare(`
                    UPDATE books 
                    SET progress_percent = ?, last_sync = ?, updated_at = ?
                    WHERE user_id = ? AND identifier = ? AND identifier_type = ? AND title = ?
                `);
                
                updateStmt.run(progressPercent, currentTime, currentTime, userId, identifier, identifierType, normalizedTitle);
                console.debug(`Updated progress for ${title}: ${progressPercent}%`);
            } else {
                // Insert new row
                const insertStmt = this.db.prepare(`
                    INSERT INTO books (user_id, identifier, identifier_type, title, progress_percent, last_sync, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `);
                
                insertStmt.run(userId, identifier, identifierType, normalizedTitle, progressPercent, currentTime, currentTime);
                console.debug(`Stored progress for ${title}: ${progressPercent}%`);
            }
        } catch (err) {
            console.error(`Error storing progress for ${title}: ${err.message}`);
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
                return true; // No cached progress, consider it changed
            }
            
            const cachedProgress = result.progress_percent;
            const hasChanged = Math.abs(cachedProgress - currentProgress) > 0.01; // 0.01% tolerance
            
            if (hasChanged) {
                console.debug(`Progress changed for ${title}: ${cachedProgress}% -> ${currentProgress}%`);
            }
            
            return hasChanged;
        } catch (err) {
            console.error(`Error checking progress change for ${title}: ${err.message}`);
            return true; // Assume changed on error
        }
    }

    clearCache() {
        this.init(); // Ensure database is initialized
        
        try {
            this.db.exec('DELETE FROM books');
            console.log('Cache cleared successfully');
        } catch (err) {
            console.error(`Error clearing cache: ${err.message}`);
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
                console.error(`Error getting cache file size: ${err.message}`);
            }
            
            return {
                total_books: totalResult.count,
                recent_books: recentResult.count,
                cache_size_mb: Math.round(cacheSize * 100) / 100
            };
        } catch (err) {
            console.error(`Error getting cache stats: ${err.message}`);
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
            console.log(`Cache exported to ${filename} (${books.length} books)`);
        } catch (err) {
            console.error(`Error exporting cache: ${err.message}`);
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
            console.error(`Error getting books by author: ${err.message}`);
            return [];
        }
    }

    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            console.log('Database connection closed');
        }
    }
} 