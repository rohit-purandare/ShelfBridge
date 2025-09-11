import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SyncManager } from '../src/sync-manager.js';
import { BookCache } from '../src/book-cache.js';
import logger from '../src/logger.js';

// Mock dependencies
const mockUser = {
  id: 'test-user',
  abs_url: 'http://test-abs.com',
  abs_token: 'test-token',
  hardcover_token: 'test-hc-token',
};

const mockGlobalConfig = {
  workers: 2,
  parallel: true,
  force_sync: false,
};

// Create mock book data that would cause double-processing
const createMockBook = (id, title, author, ino = null) => ({
  id: id,
  ino: ino,
  mediaType: 'book',
  media: {
    metadata: {
      title: title,
      authors: [{ name: author }],
    },
  },
  progress: 1.0,
  isFinished: true,
  started_at: '2024-01-01T10:00:00Z',
  finished_at: '2024-01-01T12:00:00Z',
});

test('Double-Processing Prevention', async (t) => {
  await t.test('Book Deduplication', async (t) => {
    const syncManager = new SyncManager(mockUser, mockGlobalConfig, false, false);
    
    // Create books with different types of duplicates
    const books = [
      createMockBook('book1', 'Test Book', 'Test Author'),
      createMockBook('book1', 'Test Book', 'Test Author'), // Same ID
      createMockBook('book2', 'Another Book', 'Test Author', 12345),
      createMockBook('book3', 'Different Book', 'Test Author', 12345), // Same inode
      createMockBook('book4', 'Test Book', 'Test Author'), // Same metadata
    ];

    await t.test('should remove duplicate books by ID', () => {
      const result = syncManager._deduplicateBooks(books);
      
      assert.strictEqual(result.duplicatesFound, 3, 'Should find 3 duplicates');
      assert.strictEqual(result.books.length, 2, 'Should keep 2 unique books');
      
      // Should keep first occurrence of each unique book
      const titles = result.books.map(b => b.media.metadata.title);
      assert.ok(titles.includes('Test Book'), 'Should keep Test Book');
      assert.ok(titles.includes('Another Book'), 'Should keep Another Book');
    });

    await t.test('should handle empty book list', () => {
      const result = syncManager._deduplicateBooks([]);
      assert.strictEqual(result.books.length, 0);
      assert.strictEqual(result.duplicatesFound, 0);
    });

    await t.test('should handle books with missing metadata', () => {
      const booksWithMissingData = [
        { id: 'book1' }, // Minimal book
        createMockBook('book2', 'Valid Book', 'Valid Author'),
      ];
      
      const result = syncManager._deduplicateBooks(booksWithMissingData);
      assert.strictEqual(result.books.length, 2, 'Should keep both books');
      assert.strictEqual(result.duplicatesFound, 0, 'Should find no duplicates');
    });
  });

  await t.test('Race Condition Prevention', async (t) => {
    const syncManager = new SyncManager(mockUser, mockGlobalConfig, false, false);
    
    // Mock the cache and other dependencies
    syncManager.cache = {
      generateTitleAuthorIdentifier: () => 'test:testauthor',
      getCachedBookInfo: () => Promise.resolve({ exists: false }),
    };
    
    syncManager.bookMatcher = {
      findMatch: () => Promise.resolve(null),
    };

    const mockBook = createMockBook('test-book-1', 'Test Book', 'Test Author');
    
    await t.test('should prevent concurrent processing of same book', async () => {
      // Simulate concurrent calls to _syncSingleBook
      const promise1 = syncManager._syncSingleBook(mockBook, null);
      const promise2 = syncManager._syncSingleBook(mockBook, null);
      
      const [result1, result2] = await Promise.all([promise1, promise2]);
      
      // One should process normally, the other should be skipped
      const processedResults = [result1, result2].filter(r => r.status !== 'skipped');
      const skippedResults = [result1, result2].filter(r => r.status === 'skipped');
      
      assert.strictEqual(processedResults.length, 1, 'Only one should process');
      assert.strictEqual(skippedResults.length, 1, 'One should be skipped');
      assert.strictEqual(
        skippedResults[0].reason, 
        'Already being processed (race condition prevented)',
        'Should have correct skip reason'
      );
    });

    await t.test('should allow processing different books concurrently', async () => {
      const book1 = createMockBook('book-1', 'Book One', 'Author One');
      const book2 = createMockBook('book-2', 'Book Two', 'Author Two');
      
      const promise1 = syncManager._syncSingleBook(book1, null);
      const promise2 = syncManager._syncSingleBook(book2, null);
      
      const [result1, result2] = await Promise.all([promise1, promise2]);
      
      // Both should be processed (neither should be skipped for race conditions)
      assert.notStrictEqual(result1.status, 'skipped', 'Book 1 should not be skipped');
      assert.notStrictEqual(result2.status, 'skipped', 'Book 2 should not be skipped');
    });

    await t.test('should clean up tracking after processing', async () => {
      const book = createMockBook('cleanup-test', 'Cleanup Test', 'Test Author');
      
      // Process the book
      await syncManager._syncSingleBook(book, null);
      
      // Book should no longer be tracked as being processed
      const bookKey = book.id;
      assert.ok(!syncManager.booksBeingProcessed.has(bookKey), 'Book should be removed from tracking');
    });
  });

  await t.test('Integration with Sync Process', async (t) => {
    const syncManager = new SyncManager(mockUser, mockGlobalConfig, true, false); // Dry run mode
    
    // Mock all external dependencies
    syncManager.cache = {
      init: () => Promise.resolve(),
      storeLibraryStats: () => Promise.resolve(),
      getLibraryStats: () => Promise.resolve(null),
    };
    
    syncManager.audiobookshelf = {
      getUserLibraryBooks: () => Promise.resolve([]),
    };
    
    syncManager.hardcover = {
      getUserBooks: () => Promise.resolve([]),
    };
    
    syncManager.bookMatcher = {
      setUserLibrary: () => {},
    };

    await t.test('should integrate deduplication into sync process', async () => {
      const duplicateBooks = [
        createMockBook('dup1', 'Duplicate Book', 'Test Author'),
        createMockBook('dup1', 'Duplicate Book', 'Test Author'), // Same ID
        createMockBook('dup2', 'Unique Book', 'Test Author'),
      ];
      
      // Mock the audiobookshelf client to return duplicate books
      syncManager.audiobookshelf.getUserLibraryBooks = () => Promise.resolve(duplicateBooks);
      
      const result = await syncManager.sync();
      
      // Should process only unique books
      assert.strictEqual(result.books_processed, 2, 'Should process only unique books');
      assert.ok(result.books_processed < duplicateBooks.length, 'Should process fewer than total books');
    });
  });

  await t.test('Logging and Monitoring', async (t) => {
    const syncManager = new SyncManager(mockUser, mockGlobalConfig, false, false);
    
    // Track log messages
    const logMessages = [];
    const originalWarn = logger.warn;
    const originalDebug = logger.debug;
    
    logger.warn = (message, data) => {
      logMessages.push({ level: 'warn', message, data });
      originalWarn(message, data);
    };
    
    logger.debug = (message, data) => {
      logMessages.push({ level: 'debug', message, data });
      originalDebug(message, data);
    };

    await t.test('should log duplicate detection', () => {
      const books = [
        createMockBook('book1', 'Test Book', 'Test Author'),
        createMockBook('book1', 'Test Book', 'Test Author'), // Duplicate
      ];
      
      logMessages.length = 0; // Clear previous messages
      const result = syncManager._deduplicateBooks(books);
      
      assert.strictEqual(result.duplicatesFound, 1);
      
      const debugMessages = logMessages.filter(m => m.level === 'debug');
      const duplicateMessage = debugMessages.find(m => m.message === 'Duplicate book detected');
      
      assert.ok(duplicateMessage, 'Should log duplicate detection');
      assert.strictEqual(duplicateMessage.data.title, 'Test Book');
      assert.strictEqual(duplicateMessage.data.duplicateKey, 'book1');
    });

    await t.test('should log race condition prevention', async () => {
      syncManager.cache = {
        generateTitleAuthorIdentifier: () => 'test:testauthor',
        getCachedBookInfo: () => Promise.resolve({ exists: false }),
      };
      
      syncManager.bookMatcher = {
        findMatch: () => Promise.resolve(null),
      };

      const book = createMockBook('race-test', 'Race Test Book', 'Test Author');
      
      logMessages.length = 0; // Clear previous messages
      
      // Start two concurrent processes
      const promise1 = syncManager._syncSingleBook(book, null);
      const promise2 = syncManager._syncSingleBook(book, null);
      
      await Promise.all([promise1, promise2]);
      
      const debugMessages = logMessages.filter(m => m.level === 'debug');
      const raceMessage = debugMessages.find(m => 
        m.message.includes('already being processed by another task')
      );
      
      assert.ok(raceMessage, 'Should log race condition prevention');
    });

    // Restore original logger functions
    logger.warn = originalWarn;
    logger.debug = originalDebug;
  });
});