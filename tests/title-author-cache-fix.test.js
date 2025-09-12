import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SyncManager } from '../src/sync-manager.js';
import logger from '../src/logger.js';

// Test the fix for title/author cache bypass issue
test('Title/Author Cache Fix', async t => {
  const mockUser = {
    id: 'test-user',
    abs_url: 'http://test-abs.com',
    abs_token: 'test-token',
    hardcover_token: 'test-hc-token',
  };

  const mockGlobalConfig = {
    workers: 1,
    parallel: false,
    force_sync: false,
  };

  await t.test(
    'Should use cached edition_id for title/author books with progress changes',
    async () => {
      const syncManager = new SyncManager(
        mockUser,
        mockGlobalConfig,
        false,
        false,
      );

      // Track expensive matching calls
      let expensiveMatchingCalled = false;

      // Mock the cache with existing title/author data
      syncManager.cache = {
        generateTitleAuthorIdentifier: () => 'testbook:testauthor',
        getCachedBookInfo: async () => ({
          exists: true,
          edition_id: 'cached-edition-123',
          progress_percent: 50.0, // Old progress
          author: 'Test Author',
          last_sync: '2024-01-01T00:00:00Z',
        }),
        hasProgressChanged: async () => true, // Progress has changed
      };

      // Mock bookMatcher to detect if expensive matching is called
      syncManager.bookMatcher = {
        findMatch: async () => {
          expensiveMatchingCalled = true;
          return {
            match: {
              userBook: {
                id: 'user-book-123',
                book: { id: 'book-123', title: 'Test Book' },
              },
              edition: { id: 'search-edition-456' },
              _isSearchResult: true,
              _matchType: 'title_author_search',
            },
            extractedMetadata: {
              title: 'Test Book',
              author: 'Test Author',
              identifiers: { isbn: null, asin: null },
            },
          };
        },
      };

      // Mock book without identifiers (will trigger title/author path)
      const mockBook = {
        id: 'test-book-1',
        media: {
          metadata: {
            title: 'Test Book',
            authors: [{ name: 'Test Author' }],
            // No ISBN/ASIN
          },
        },
        progress: 0.75, // Changed progress (75%)
        isFinished: false,
      };

      // Track debug logs to verify cache usage
      const debugLogs = [];
      const originalDebug = logger.debug;
      logger.debug = (message, data) => {
        debugLogs.push({ message, data });
        originalDebug(message, data);
      };

      try {
        const result = await syncManager._syncSingleBook(mockBook, null);

        // Verify expensive matching was NOT called
        assert.strictEqual(
          expensiveMatchingCalled,
          false,
          'Expensive matching should not be called for cached title/author books',
        );

        // Verify cache optimization log
        const cacheOptimizationLog = debugLogs.find(log =>
          log.message.includes('using cached edition'),
        );
        assert.ok(
          cacheOptimizationLog,
          'Should log cache optimization for title/author book',
        );

        // Result should indicate processing occurred (not skipped)
        assert.notStrictEqual(
          result.status,
          'skipped',
          'Book with progress changes should be processed, not skipped',
        );
      } finally {
        logger.debug = originalDebug;
      }
    },
  );

  await t.test(
    'Should still use expensive matching for books without cache',
    async () => {
      const syncManager = new SyncManager(
        mockUser,
        mockGlobalConfig,
        false,
        false,
      );

      let expensiveMatchingCalled = false;

      // Mock cache with no existing data
      syncManager.cache = {
        generateTitleAuthorIdentifier: () => 'newbook:newauthor',
        getCachedBookInfo: async () => ({
          exists: false, // No cache
        }),
      };

      // Mock bookMatcher
      syncManager.bookMatcher = {
        findMatch: async () => {
          expensiveMatchingCalled = true;
          return {
            match: null,
            extractedMetadata: {
              title: 'New Book',
              author: 'New Author',
              identifiers: { isbn: null, asin: null },
            },
          };
        },
      };

      const mockBook = {
        id: 'new-book-1',
        media: {
          metadata: {
            title: 'New Book',
            authors: [{ name: 'New Author' }],
          },
        },
        progress: 0.25,
        isFinished: false,
      };

      await syncManager._syncSingleBook(mockBook, null);

      // Verify expensive matching WAS called for non-cached book
      assert.strictEqual(
        expensiveMatchingCalled,
        true,
        'Expensive matching should be called for non-cached books',
      );
    },
  );

  await t.test(
    'Should still use expensive matching for ISBN/ASIN books with changes',
    async () => {
      const syncManager = new SyncManager(
        mockUser,
        mockGlobalConfig,
        false,
        false,
      );

      let expensiveMatchingCalled = false;

      // Mock cache with ISBN book data
      syncManager.cache = {
        getCachedBookInfo: async () => ({
          exists: true,
          edition_id: 'isbn-edition-789',
          progress_percent: 30.0,
        }),
        hasProgressChanged: async () => true,
      };

      syncManager.bookMatcher = {
        findMatch: async () => {
          expensiveMatchingCalled = true;
          return {
            match: {
              userBook: {
                id: 'isbn-user-book',
                book: { id: 'isbn-book', title: 'ISBN Book' },
              },
              edition: { id: 'isbn-edition-789' },
              _isSearchResult: false,
              _matchType: 'isbn',
            },
            extractedMetadata: {
              title: 'ISBN Book',
              author: 'ISBN Author',
              identifiers: { isbn: '9781234567890', asin: null },
            },
          };
        },
      };

      // Book WITH ISBN (should still use expensive matching for consistency)
      const mockBook = {
        id: 'isbn-book-1',
        media: {
          metadata: {
            title: 'ISBN Book',
            authors: [{ name: 'ISBN Author' }],
            isbn: '9781234567890',
          },
        },
        progress: 0.6,
        isFinished: false,
      };

      await syncManager._syncSingleBook(mockBook, null);

      // ISBN/ASIN books should still use expensive matching (they're fast anyway)
      assert.strictEqual(
        expensiveMatchingCalled,
        true,
        'Expensive matching should still be used for ISBN/ASIN books for consistency',
      );
    },
  );

  console.log('✅ Title/Author cache fix verified successfully!');
});
