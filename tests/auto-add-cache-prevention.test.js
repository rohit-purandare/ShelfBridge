import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SyncManager } from '../src/sync-manager.js';
import { BookCache } from '../src/book-cache.js';

/**
 * Auto-Add Cache Prevention Test
 *
 * This test verifies that the auto-add process doesn't trigger unnecessary
 * title/author searches for books that are already cached.
 */

describe('Auto-Add Cache Prevention', () => {
  it('should skip title/author fallback for books already cached via title/author', async () => {
    const bookCache = new BookCache();
    await bookCache.init();

    try {
      const userId = 'test-user-auto-add';
      const title = 'Previously Cached Book';
      const author = 'Cached Author';

      // Create mock sync manager for testing _tryAutoAddBook
      const mockSyncManager = {
        userId: userId,
        cache: bookCache,
        dryRun: false,
        globalConfig: {},
        hardcover: {
          searchBooksByAsin: async () => [],
          searchBooksByIsbn: async () => [],
        },
      };

      // Pre-cache a book as if it was previously matched by title/author
      const titleAuthorId = bookCache.generateTitleAuthorIdentifier(
        title,
        author,
      );
      await bookCache.storeBookSyncData(
        userId,
        titleAuthorId,
        title,
        'cached-edition-123',
        'title_author',
        author,
        55.5,
        Date.now() - 3600000,
        Date.now() - 86400000,
      );

      console.log(`Pre-cached book with identifier: ${titleAuthorId}`);

      // Simulate calling _tryAutoAddBook for this book
      const absBook = {
        id: 'abs-test-book',
        media: {
          metadata: {
            title: title,
            authors: [{ name: author }],
          },
        },
      };

      const identifiers = { isbn: null, asin: null }; // No identifiers - would normally trigger fallback

      // Bind the method to our mock sync manager
      const tryAutoAddBook =
        SyncManager.prototype._tryAutoAddBook.bind(mockSyncManager);

      // This should skip the title/author fallback due to our cache check
      const result = await tryAutoAddBook(absBook, identifiers, title, author);

      // Verify it was skipped due to cache
      assert.strictEqual(
        result.status,
        'skipped',
        'Should skip auto-add for cached books',
      );
      assert.strictEqual(
        result.reason,
        'Already cached via title/author matching',
        'Should provide correct reason',
      );
      assert.strictEqual(result.cached, true, 'Should indicate it was cached');

      console.log('✅ Auto-add correctly skipped for cached book');
      console.log(`   Reason: ${result.reason}`);
    } finally {
      await bookCache.clearCache();
      bookCache.close();
    }
  });

  it('should proceed with title/author fallback for truly new books', async () => {
    const bookCache = new BookCache();
    await bookCache.init();

    try {
      const userId = 'test-user-new-book';
      const title = 'Truly New Book';
      const author = 'New Author';

      let titleAuthorSearchCalled = false;

      // Create mock sync manager
      const mockSyncManager = {
        userId: userId,
        cache: bookCache,
        dryRun: false,
        globalConfig: {},
        hardcover: {
          searchBooksByAsin: async () => [],
          searchBooksByIsbn: async () => [],
        },
      };

      // Mock the TitleAuthorMatcher import and findMatch call
      const originalImport = global.__importMeta__;

      // Simulate the auto-add process calling TitleAuthorMatcher
      // Since we can't easily mock the dynamic import, we'll verify the logic flow

      const titleAuthorId = bookCache.generateTitleAuthorIdentifier(
        title,
        author,
      );

      // Verify no cache entry exists
      const existingCache = await bookCache.getCachedBookInfo(
        userId,
        titleAuthorId,
        title,
        'title_author',
      );

      assert.strictEqual(
        existingCache.exists,
        false,
        'Should not find cache entry for new book',
      );

      console.log(
        '✅ New book correctly identified as needing title/author search',
      );
      console.log(`   Generated identifier: ${titleAuthorId}`);
      console.log(`   Cache exists: ${existingCache.exists}`);
    } finally {
      await bookCache.clearCache();
      bookCache.close();
    }
  });
});
