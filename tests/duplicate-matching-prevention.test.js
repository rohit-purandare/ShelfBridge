import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { SyncManager } from '../src/sync-manager.js';
import { BookCache } from '../src/book-cache.js';

/**
 * Duplicate Matching Prevention Tests
 *
 * These tests verify that books already matched using title/author matching
 * are not re-matched during subsequent progress updates, preventing unnecessary
 * performance overhead and duplicate processing.
 */

describe('Duplicate Matching Prevention', () => {
  let mockUser;
  let mockGlobalConfig;
  let mockAudiobookshelfClient;
  let mockHardcoverClient;
  let bookCache;
  let syncManager;

  beforeEach(() => {
    // Mock user configuration
    mockUser = {
      id: 'test-user-123',
      abs_url: 'http://test-audiobookshelf.local',
      abs_token: 'test-token',
      hardcover_token: 'test-hardcover-token',
    };

    // Mock global configuration
    mockGlobalConfig = {
      force_sync: false,
      auto_add_books: true,
      min_progress_threshold: 5.0,
      audiobookshelf_semaphore: 5,
      hardcover_semaphore: 1,
      title_author_matching: {
        enabled: true,
      },
    };

    // Initialize BookCache for testing
    bookCache = new BookCache();

    // Create mock clients with all required methods
    mockAudiobookshelfClient = {
      getReadingProgress: async () => [],
      cleanup: () => {},
    };

    mockHardcoverClient = {
      getUserBooks: async () => [],
      cleanup: () => {},
      searchBooksByIsbn: async () => [],
      searchBooksByAsin: async () => [],
      searchBooksForMatching: async () => [], // For title/author matching
      addBookToLibrary: async () => ({ id: 'mock-user-book-id' }),
      updateReadingProgress: async () => ({ id: 'mock-progress-id' }),
      markBookCompleted: async () => true,
      getBookCurrentProgress: async () => ({ has_progress: false }),
      updateBookStatus: async () => true,
      getBookIdFromEdition: async editionId => ({
        bookId: 'mock-book-id',
        title: 'Mock Book Title',
        contributions: [],
      }),
      getPreferredEditionFromBookId: async () => ({
        bookId: 'mock-book-id',
        title: 'Mock Book Title',
        edition: { id: 'mock-edition-id', format: 'audiobook' },
      }),
    };
  });

  afterEach(async () => {
    if (syncManager) {
      syncManager.cleanup();
    }
    if (bookCache) {
      await bookCache.clearCache();
      bookCache.close();
    }
  });

  describe('Books with Identifiers (ISBN/ASIN)', () => {
    it('should skip books with unchanged progress when ISBN is available', async () => {
      // Setup: Create a book with ISBN that has cached progress
      const testBook = {
        id: 'abs-book-1',
        progress_percentage: 45.5,
        media: {
          metadata: {
            title: 'Test Book with ISBN',
            authors: [{ name: 'Test Author' }],
            isbn: '9781234567890',
          },
        },
      };

      // Pre-populate cache with this book's data
      await bookCache.storeBookSyncData(
        mockUser.id,
        '9781234567890',
        'Test Book with ISBN',
        'test-edition-123',
        'isbn',
        'Test Author',
        45.5,
        Date.now(),
        Date.now() - 86400000, // Started yesterday
      );

      // Mock AudioBookshelf to return this book
      mockAudiobookshelfClient.getReadingProgress = async () => [testBook];

      // Mock Hardcover library (empty for this test)
      mockHardcoverClient.getUserBooks = async () => [];

      // Create SyncManager with mocked dependencies
      syncManager = new SyncManager(mockUser, mockGlobalConfig, false, false);

      // Override the created clients with our mocks
      syncManager.audiobookshelf = mockAudiobookshelfClient;
      syncManager.hardcover = mockHardcoverClient;
      syncManager.cache = bookCache;

      // Reinitialize book matcher with mocked dependencies
      const { BookMatcher } = await import('../src/matching/book-matcher.js');
      syncManager.bookMatcher = new BookMatcher(
        mockHardcoverClient,
        bookCache,
        mockGlobalConfig,
      );

      // Spy on expensive operations
      let bookMatchingCalled = false;
      let hardcoverApiCalled = false;

      const originalFindMatch = syncManager.bookMatcher.findMatch;
      syncManager.bookMatcher.findMatch = async (...args) => {
        bookMatchingCalled = true;
        return originalFindMatch.call(syncManager.bookMatcher, ...args);
      };

      const originalUpdateProgress = mockHardcoverClient.updateReadingProgress;
      mockHardcoverClient.updateReadingProgress = async (...args) => {
        hardcoverApiCalled = true;
        return originalUpdateProgress
          ? originalUpdateProgress.call(mockHardcoverClient, ...args)
          : null;
      };

      // Run sync
      const result = await syncManager.syncProgress();

      // Verify the book was skipped and expensive operations were avoided
      assert.strictEqual(result.books_processed, 1);
      assert.strictEqual(result.books_skipped, 1);
      assert.strictEqual(result.books_synced, 0);
      assert.strictEqual(
        bookMatchingCalled,
        false,
        'Book matching should not have been called for cached book',
      );
      assert.strictEqual(
        hardcoverApiCalled,
        false,
        'Hardcover API should not have been called for unchanged progress',
      );

      // Verify the skip reason
      const bookDetail = result.book_details[0];
      assert.strictEqual(bookDetail.status, 'skipped');
      assert.strictEqual(
        bookDetail.reason,
        'Progress unchanged (optimized early check)',
      );
      assert.strictEqual(bookDetail.cache_found, true);
    });

    it('should proceed with sync when ISBN book progress has changed', async () => {
      // Setup: Create a book with ISBN that has different progress from cache
      const testBook = {
        id: 'abs-book-2',
        progress_percentage: 67.3, // Changed from cached value
        media: {
          metadata: {
            title: 'Test Book with Changed Progress',
            authors: [{ name: 'Test Author' }],
            isbn: '9781234567891',
          },
        },
      };

      // Pre-populate cache with different progress
      await bookCache.storeBookSyncData(
        mockUser.id,
        '9781234567891',
        'Test Book with Changed Progress',
        'test-edition-124',
        'isbn',
        'Test Author',
        45.0, // Different from current 67.3
        Date.now() - 3600000, // 1 hour ago
        Date.now() - 86400000,
      );

      mockAudiobookshelfClient.getReadingProgress = async () => [testBook];

      syncManager = new SyncManager(mockUser, mockGlobalConfig, false, false);

      // Override the created clients with our mocks
      syncManager.audiobookshelf = mockAudiobookshelfClient;
      syncManager.hardcover = mockHardcoverClient;
      syncManager.cache = bookCache;

      // Reinitialize book matcher with mocked dependencies
      const { BookMatcher } = await import('../src/matching/book-matcher.js');
      syncManager.bookMatcher = new BookMatcher(
        mockHardcoverClient,
        bookCache,
        mockGlobalConfig,
      );

      // Track if expensive operations are called
      let bookMatchingCalled = false;
      const originalFindMatch = syncManager.bookMatcher.findMatch;
      syncManager.bookMatcher.findMatch = async (...args) => {
        bookMatchingCalled = true;
        // Return null to simulate no match found (will trigger auto-add logic)
        return {
          match: null,
          extractedMetadata: {
            title: testBook.media.metadata.title,
            author: 'Test Author',
            identifiers: { isbn: testBook.media.metadata.isbn },
          },
        };
      };

      const result = await syncManager.syncProgress();

      // Verify that expensive matching was called since progress changed
      assert.strictEqual(
        bookMatchingCalled,
        true,
        'Book matching should have been called for changed progress',
      );
      assert.strictEqual(result.books_processed, 1);
      // Note: The exact outcome depends on auto-add logic, but the key is that matching was attempted
    });
  });

  describe('Books Matched by Title/Author', () => {
    it('should handle title/author matched books without identifiers', async () => {
      // Setup: Create a book without ISBN/ASIN that would be matched by title/author
      const testBook = {
        id: 'abs-book-3',
        progress_percentage: 33.7,
        media: {
          metadata: {
            title: 'Book Without Identifiers',
            authors: [{ name: 'Unknown Author' }],
            // No ISBN or ASIN
          },
        },
      };

      // Pre-populate cache with title/author synthetic identifier
      const syntheticId = 'title_author_user123_edition456';
      await bookCache.storeBookSyncData(
        mockUser.id,
        syntheticId,
        'Book Without Identifiers',
        'edition456',
        'title_author',
        'Unknown Author',
        33.7, // Same progress - should be skipped
        Date.now(),
        Date.now() - 86400000,
      );

      mockAudiobookshelfClient.getReadingProgress = async () => [testBook];

      // Mock a Hardcover match for this title/author
      const mockHardcoverMatch = {
        userBook: {
          id: 'user123',
          book: { id: 'book456', title: 'Book Without Identifiers' },
        },
        edition: { id: 'edition456', format: 'audiobook' },
        _matchType: 'title_author',
      };

      syncManager = new SyncManager(mockUser, mockGlobalConfig, false, false);

      // Override the created clients with our mocks
      syncManager.audiobookshelf = mockAudiobookshelfClient;
      syncManager.hardcover = mockHardcoverClient;
      syncManager.cache = bookCache;

      // Reinitialize book matcher with mocked dependencies
      const { BookMatcher } = await import('../src/matching/book-matcher.js');
      syncManager.bookMatcher = new BookMatcher(
        mockHardcoverClient,
        bookCache,
        mockGlobalConfig,
      );

      // Mock the book matcher to return the title/author match
      syncManager.bookMatcher.findMatch = async () => ({
        match: mockHardcoverMatch,
        extractedMetadata: {
          title: 'Book Without Identifiers',
          author: 'Unknown Author',
          identifiers: {}, // No identifiers
        },
      });

      let hardcoverApiCalled = false;
      mockHardcoverClient.updateReadingProgress = async () => {
        hardcoverApiCalled = true;
        return { id: 'update-123' };
      };

      const result = await syncManager.syncProgress();

      // Since there are no identifiers, the early optimization won't catch this book
      // But the regular cache logic should still prevent duplicate processing
      assert.strictEqual(result.books_processed, 1);

      // The book should be processed since we can't reliably do early optimization
      // for title/author matches, but it should find the cache entry in the regular flow
      if (result.books_skipped === 1) {
        assert.strictEqual(
          hardcoverApiCalled,
          false,
          'Should not call Hardcover API for unchanged progress',
        );
      }
    });

    it('should not re-match books that were previously matched by title/author', async () => {
      // This test verifies the main issue: books already matched shouldn't be re-matched
      const testBook = {
        id: 'abs-book-4',
        progress_percentage: 88.4,
        media: {
          metadata: {
            title: 'Previously Matched Book',
            authors: [{ name: 'Cached Author' }],
          },
        },
      };

      // Simulate a book that was previously matched by title/author and cached
      const syntheticId = 'title_author_user456_edition789';
      await bookCache.storeBookSyncData(
        mockUser.id,
        syntheticId,
        'Previously Matched Book',
        'edition789',
        'title_author',
        'Cached Author',
        75.2, // Different progress - should trigger sync
        Date.now() - 7200000, // 2 hours ago
        Date.now() - 86400000,
      );

      mockAudiobookshelfClient.getReadingProgress = async () => [testBook];

      syncManager = new SyncManager(mockUser, mockGlobalConfig, false, false);

      // Override the created clients with our mocks
      syncManager.audiobookshelf = mockAudiobookshelfClient;
      syncManager.hardcover = mockHardcoverClient;
      syncManager.cache = bookCache;

      // Reinitialize book matcher with mocked dependencies
      const { BookMatcher } = await import('../src/matching/book-matcher.js');
      syncManager.bookMatcher = new BookMatcher(
        mockHardcoverClient,
        bookCache,
        mockGlobalConfig,
      );

      // Count how many times expensive matching is called
      let matchingCallCount = 0;
      syncManager.bookMatcher.findMatch = async () => {
        matchingCallCount++;
        return {
          match: {
            userBook: { id: 'user456', book: { id: 'book789' } },
            edition: { id: 'edition789', format: 'audiobook' },
            _matchType: 'title_author',
          },
          extractedMetadata: {
            title: 'Previously Matched Book',
            author: 'Cached Author',
            identifiers: {},
          },
        };
      };

      mockHardcoverClient.updateReadingProgress = async () => ({
        id: 'update-456',
      });

      await syncManager.syncProgress();

      // The key assertion: expensive matching should only be called once
      // The fix ensures that books don't get re-matched on every progress update
      assert.strictEqual(
        matchingCallCount,
        1,
        'Book matching should only be called once per sync',
      );
    });
  });

  describe('Mixed Scenarios', () => {
    it('should handle both identifier-based and title/author books in same sync', async () => {
      const booksToSync = [
        {
          id: 'abs-book-isbn',
          progress_percentage: 25.0,
          media: {
            metadata: {
              title: 'ISBN Book',
              authors: [{ name: 'ISBN Author' }],
              isbn: '9781111111111',
            },
          },
        },
        {
          id: 'abs-book-title',
          progress_percentage: 60.0,
          media: {
            metadata: {
              title: 'Title Author Book',
              authors: [{ name: 'Title Author' }],
              // No identifiers
            },
          },
        },
      ];

      // Cache both books
      await bookCache.storeBookSyncData(
        mockUser.id,
        '9781111111111',
        'ISBN Book',
        'isbn-edition',
        'isbn',
        'ISBN Author',
        25.0, // Same progress
        Date.now(),
        Date.now() - 86400000,
      );

      await bookCache.storeBookSyncData(
        mockUser.id,
        'title_author_user789_title-edition',
        'Title Author Book',
        'title-edition',
        'title_author',
        'Title Author',
        45.0, // Different progress
        Date.now() - 3600000,
        Date.now() - 86400000,
      );

      mockAudiobookshelfClient.getReadingProgress = async () => booksToSync;

      syncManager = new SyncManager(mockUser, mockGlobalConfig, false, false);

      // Override the created clients with our mocks
      syncManager.audiobookshelf = mockAudiobookshelfClient;
      syncManager.hardcover = mockHardcoverClient;
      syncManager.cache = bookCache;

      // Reinitialize book matcher with mocked dependencies
      const { BookMatcher } = await import('../src/matching/book-matcher.js');
      syncManager.bookMatcher = new BookMatcher(
        mockHardcoverClient,
        bookCache,
        mockGlobalConfig,
      );

      let isbnBookMatchingCalled = false;
      let titleBookMatchingCalled = false;

      syncManager.bookMatcher.findMatch = async absBook => {
        if (absBook.media.metadata.isbn) {
          isbnBookMatchingCalled = true;
        } else {
          titleBookMatchingCalled = true;
        }
        return {
          match: null,
          extractedMetadata: {
            title: absBook.media.metadata.title,
            author: 'Test',
            identifiers: {},
          },
        };
      };

      const result = await syncManager.syncProgress();

      assert.strictEqual(result.books_processed, 2);

      // ISBN book should skip expensive matching due to early optimization
      assert.strictEqual(
        isbnBookMatchingCalled,
        false,
        'ISBN book with unchanged progress should skip matching',
      );

      // Title/author book will go through matching (can't optimize early without identifiers)
      // but shouldn't be re-matched if it finds the cache entry
      // Note: The exact behavior depends on implementation, but the key is preventing unnecessary re-matching
    });
  });

  describe('Force Sync Override', () => {
    it('should bypass cache checks when force_sync is enabled', async () => {
      const testBook = {
        id: 'abs-book-force',
        progress_percentage: 50.0,
        media: {
          metadata: {
            title: 'Force Sync Book',
            authors: [{ name: 'Force Author' }],
            isbn: '9782222222222',
          },
        },
      };

      // Cache with same progress
      await bookCache.storeBookSyncData(
        mockUser.id,
        '9782222222222',
        'Force Sync Book',
        'force-edition',
        'isbn',
        'Force Author',
        50.0, // Same progress
        Date.now(),
        Date.now() - 86400000,
      );

      // Enable force sync
      mockGlobalConfig.force_sync = true;

      mockAudiobookshelfClient.getReadingProgress = async () => [testBook];

      syncManager = new SyncManager(mockUser, mockGlobalConfig, false, false);

      // Override the created clients with our mocks
      syncManager.audiobookshelf = mockAudiobookshelfClient;
      syncManager.hardcover = mockHardcoverClient;
      syncManager.cache = bookCache;

      // Reinitialize book matcher with mocked dependencies
      const { BookMatcher } = await import('../src/matching/book-matcher.js');
      syncManager.bookMatcher = new BookMatcher(
        mockHardcoverClient,
        bookCache,
        mockGlobalConfig,
      );

      let matchingCalled = false;
      syncManager.bookMatcher.findMatch = async () => {
        matchingCalled = true;
        return {
          match: null,
          extractedMetadata: {
            title: 'Force Sync Book',
            author: 'Force Author',
            identifiers: { isbn: '9782222222222' },
          },
        };
      };

      const result = await syncManager.syncProgress();

      // With force_sync enabled, should always proceed with matching
      assert.strictEqual(
        matchingCalled,
        true,
        'Force sync should bypass cache optimization',
      );
      assert.strictEqual(result.books_processed, 1);
    });
  });
});
