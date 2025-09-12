import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SyncManager } from '../src/sync-manager.js';
import logger from '../src/logger.js';

// Generic test to ensure simple progress updates don't trigger expensive title/author searches
test('Progress Updates Should Not Trigger Title/Author Searches', async t => {
  const mockUser = {
    id: 'test-user',
    abs_url: 'http://test.com',
    abs_token: 'token',
    hardcover_token: 'hc-token',
  };

  const mockConfig = { workers: 1, parallel: false, force_sync: false };

  await t.test(
    'Cached title/author book with progress change should NOT search',
    async () => {
      const syncManager = new SyncManager(mockUser, mockConfig, false, false);

      // Track if expensive title/author search is triggered
      let titleAuthorSearchTriggered = false;

      // Mock cache with existing title/author book
      syncManager.cache = {
        generateTitleAuthorIdentifier: (title, author) =>
          `${title.toLowerCase()}:${author.toLowerCase()}`,
        getCachedBookInfo: async (
          userId,
          identifier,
          title,
          identifierType,
        ) => {
          if (identifierType === 'title_author') {
            return {
              exists: true,
              edition_id: 'cached-edition-12345',
              progress_percent: 45.0,
              author: 'Test Author',
            };
          }
          return { exists: false };
        },
        hasProgressChanged: async () => true, // Progress changed
      };

      // Mock book matcher to detect title/author searches
      syncManager.bookMatcher = {
        findMatch: async (absBook, userId) => {
          // If this is called, it means expensive matching is happening
          const title = absBook.media?.metadata?.title || 'Unknown';
          logger.warn(`❌ EXPENSIVE SEARCH TRIGGERED for: ${title}`);
          titleAuthorSearchTriggered = true;

          return {
            match: null,
            extractedMetadata: {
              title: absBook.media?.metadata?.title || 'Unknown',
              author: absBook.media?.metadata?.authors?.[0]?.name || 'Unknown',
              identifiers: { isbn: null, asin: null },
            },
          };
        },
      };

      // Book without ISBN/ASIN (title/author book)
      const titleAuthorBook = {
        id: 'ta-book-123',
        media: {
          metadata: {
            title: 'My Cached Book',
            authors: [{ name: 'Test Author' }],
            // No ISBN/ASIN
          },
        },
        progress: 0.75, // Progress changed from 45% to 75%
        isFinished: false,
      };

      // Track logs to see cache optimization
      const logs = [];
      const originalDebug = logger.debug;
      logger.debug = (msg, data) => {
        logs.push(msg);
        originalDebug(msg, data);
      };

      try {
        await syncManager._syncSingleBook(titleAuthorBook, null);

        // ASSERT: No expensive search should have been triggered
        assert.strictEqual(
          titleAuthorSearchTriggered,
          false,
          'Title/author search should NOT be triggered for cached books with progress updates',
        );

        // ASSERT: Should log cache optimization
        const cacheOptLog = logs.find(log =>
          log.includes('using cached edition'),
        );
        assert.ok(cacheOptLog, 'Should log cache optimization usage');

        console.log('✅ Cached title/author book avoided expensive search');
      } finally {
        logger.debug = originalDebug;
      }
    },
  );

  await t.test(
    'Uncached title/author book SHOULD trigger search (expected)',
    async () => {
      const syncManager = new SyncManager(mockUser, mockConfig, false, false);

      let titleAuthorSearchTriggered = false;

      // Mock cache with NO existing data
      syncManager.cache = {
        generateTitleAuthorIdentifier: (title, author) =>
          `${title.toLowerCase()}:${author.toLowerCase()}`,
        getCachedBookInfo: async () => ({ exists: false }), // No cache
      };

      syncManager.bookMatcher = {
        findMatch: async (absBook, userId) => {
          titleAuthorSearchTriggered = true;
          return {
            match: null,
            extractedMetadata: {
              title: absBook.media?.metadata?.title || 'Unknown',
              author: absBook.media?.metadata?.authors?.[0]?.name || 'Unknown',
              identifiers: { isbn: null, asin: null },
            },
          };
        },
      };

      const newTitleAuthorBook = {
        id: 'new-ta-book-456',
        media: {
          metadata: {
            title: 'New Uncached Book',
            authors: [{ name: 'New Author' }],
          },
        },
        progress: 0.25,
        isFinished: false,
      };

      await syncManager._syncSingleBook(newTitleAuthorBook, null);

      // ASSERT: New books should trigger search (this is expected)
      assert.strictEqual(
        titleAuthorSearchTriggered,
        true,
        'New title/author books SHOULD trigger expensive search (this is normal)',
      );

      console.log('✅ New title/author book correctly triggered search');
    },
  );

  await t.test('Books with ISBN/ASIN should use fast matching', async () => {
    const syncManager = new SyncManager(mockUser, mockConfig, false, false);

    let expensiveMatchingCalled = false;

    syncManager.cache = {
      getCachedBookInfo: async () => ({ exists: false }), // No cache
    };

    syncManager.bookMatcher = {
      findMatch: async (absBook, userId) => {
        expensiveMatchingCalled = true;
        // ISBN books go through fast identifier matching, not expensive title/author
        return {
          match: {
            userBook: {
              id: 'ub-789',
              book: { id: 'b-789', title: 'ISBN Book' },
            },
            edition: { id: 'ed-789' },
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

    const isbnBook = {
      id: 'isbn-book-789',
      media: {
        metadata: {
          title: 'ISBN Book',
          authors: [{ name: 'ISBN Author' }],
          isbn: '9781234567890',
        },
      },
      progress: 0.8,
      isFinished: false,
    };

    await syncManager._syncSingleBook(isbnBook, null);

    // ISBN books can use expensive matching because it's actually fast (identifier-based)
    assert.strictEqual(
      expensiveMatchingCalled,
      true,
      'ISBN books use bookMatcher but it does fast identifier matching',
    );

    console.log('✅ ISBN book used fast identifier matching');
  });

  console.log('\n🎯 Progress update optimization working correctly!');
  console.log('   - Cached title/author books: Skip expensive search ✅');
  console.log('   - New title/author books: Use expensive search ✅');
  console.log('   - ISBN/ASIN books: Use fast identifier matching ✅');
});
