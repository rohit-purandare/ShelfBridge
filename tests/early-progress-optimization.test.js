import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { BookCache } from '../src/book-cache.js';

/**
 * Early Progress Optimization Tests
 *
 * These tests focus specifically on the early progress check optimization
 * that prevents unnecessary book matching when progress hasn't changed.
 */

describe('Early Progress Optimization', () => {
  let bookCache;
  let testUserId;

  beforeEach(async () => {
    bookCache = new BookCache();
    await bookCache.init();
    testUserId = 'test-user-optimization';
  });

  afterEach(async () => {
    if (bookCache) {
      await bookCache.clearCache();
      bookCache.close();
    }
  });

  describe('hasProgressChanged Method', () => {
    it('should return false when progress has not changed for ISBN book', async () => {
      const isbn = '9781234567890';
      const title = 'Test ISBN Book';
      const author = 'Test Author';
      const progress = 45.5;

      // Store initial progress
      await bookCache.storeBookSyncData(
        testUserId,
        isbn,
        title,
        'edition-123',
        'isbn',
        author,
        progress,
        Date.now(),
        Date.now() - 86400000,
      );

      // Check if progress has changed (same progress)
      const hasChanged = await bookCache.hasProgressChanged(
        testUserId,
        isbn,
        title,
        progress,
        'isbn',
      );

      assert.strictEqual(
        hasChanged,
        false,
        'Should return false when progress unchanged',
      );
    });

    it('should return true when progress has changed for ISBN book', async () => {
      const isbn = '9781234567890';
      const title = 'Test ISBN Book';
      const author = 'Test Author';
      const initialProgress = 45.5;
      const newProgress = 67.3;

      // Store initial progress
      await bookCache.storeBookSyncData(
        testUserId,
        isbn,
        title,
        'edition-123',
        'isbn',
        author,
        initialProgress,
        Date.now() - 3600000, // 1 hour ago
        Date.now() - 86400000,
      );

      // Check if progress has changed (different progress)
      const hasChanged = await bookCache.hasProgressChanged(
        testUserId,
        isbn,
        title,
        newProgress,
        'isbn',
      );

      assert.strictEqual(
        hasChanged,
        true,
        'Should return true when progress changed',
      );
    });

    it('should work with ASIN identifiers', async () => {
      const asin = 'B123456789';
      const title = 'Test ASIN Book';
      const author = 'Test Author';
      const progress = 33.3;

      // Store initial progress
      await bookCache.storeBookSyncData(
        testUserId,
        asin,
        title,
        'edition-456',
        'asin',
        author,
        progress,
        Date.now(),
        Date.now() - 86400000,
      );

      // Check if progress has changed (same progress)
      const hasChanged = await bookCache.hasProgressChanged(
        testUserId,
        asin,
        title,
        progress,
        'asin',
      );

      assert.strictEqual(
        hasChanged,
        false,
        'Should work with ASIN identifiers',
      );
    });

    it('should work with title/author synthetic identifiers', async () => {
      const titleAuthorId = 'title_author_user123_edition789';
      const title = 'Title Author Book';
      const author = 'Title Author';
      const progress = 88.8;

      // Store initial progress
      await bookCache.storeBookSyncData(
        testUserId,
        titleAuthorId,
        title,
        'edition-789',
        'title_author',
        author,
        progress,
        Date.now(),
        Date.now() - 86400000,
      );

      // Check if progress has changed (same progress)
      const hasChanged = await bookCache.hasProgressChanged(
        testUserId,
        titleAuthorId,
        title,
        progress,
        'title_author',
      );

      assert.strictEqual(
        hasChanged,
        false,
        'Should work with title/author synthetic identifiers',
      );
    });
  });

  describe('Multi-key Cache Lookup', () => {
    it('should find cached book using different identifier types', async () => {
      const isbn = '9781111111111';
      const title = 'Multi-key Test Book';
      const author = 'Multi Author';
      const progress = 55.0;

      // Store book with ISBN
      await bookCache.storeBookSyncData(
        testUserId,
        isbn,
        title,
        'edition-multi',
        'isbn',
        author,
        progress,
        Date.now(),
        Date.now() - 86400000,
      );

      // Should find by ISBN
      const cachedByIsbn = await bookCache.getCachedBookInfo(
        testUserId,
        isbn,
        title,
        'isbn',
      );
      assert.strictEqual(cachedByIsbn.exists, true, 'Should find by ISBN');

      // Now test if book also had ASIN, it should still find the same cache entry
      const asin = 'B111111111';

      // Add ASIN entry for the same book (simulating book that gained ASIN metadata)
      await bookCache.storeBookSyncData(
        testUserId,
        asin,
        title,
        'edition-multi',
        'asin',
        author,
        progress,
        Date.now(),
        Date.now() - 86400000,
      );

      const cachedByAsin = await bookCache.getCachedBookInfo(
        testUserId,
        asin,
        title,
        'asin',
      );
      assert.strictEqual(cachedByAsin.exists, true, 'Should find by ASIN');
    });

    it('should handle books that transition from title/author to identifier matching', async () => {
      const title = 'Transition Test Book';
      const author = 'Transition Author';
      const progress1 = 25.0;
      const progress2 = 45.0;

      // First, book is matched by title/author (no identifiers)
      const titleAuthorId = 'title_author_user456_edition999';
      await bookCache.storeBookSyncData(
        testUserId,
        titleAuthorId,
        title,
        'edition-999',
        'title_author',
        author,
        progress1,
        Date.now() - 86400000, // Yesterday
        Date.now() - 172800000, // 2 days ago
      );

      // Later, book gains ISBN metadata
      const isbn = '9782222222222';
      await bookCache.storeBookSyncData(
        testUserId,
        isbn,
        title,
        'edition-999', // Same edition
        'isbn',
        author,
        progress2,
        Date.now(),
        Date.now() - 86400000,
      );

      // Should find both cache entries
      const cachedByTitle = await bookCache.getCachedBookInfo(
        testUserId,
        titleAuthorId,
        title,
        'title_author',
      );
      assert.strictEqual(
        cachedByTitle.exists,
        true,
        'Should find original title/author cache',
      );

      const cachedByIsbn = await bookCache.getCachedBookInfo(
        testUserId,
        isbn,
        title,
        'isbn',
      );
      assert.strictEqual(
        cachedByIsbn.exists,
        true,
        'Should find new ISBN cache',
      );

      // Progress check should work with both identifiers
      const titleProgressChanged = await bookCache.hasProgressChanged(
        testUserId,
        titleAuthorId,
        title,
        progress1,
        'title_author',
      );
      assert.strictEqual(
        titleProgressChanged,
        false,
        'Title/author progress unchanged',
      );

      const isbnProgressChanged = await bookCache.hasProgressChanged(
        testUserId,
        isbn,
        title,
        progress2,
        'isbn',
      );
      assert.strictEqual(isbnProgressChanged, false, 'ISBN progress unchanged');
    });
  });

  describe('Cache Performance', () => {
    it('should efficiently handle multiple cache lookups', async () => {
      const startTime = Date.now();

      // Create multiple books with different identifier types
      const testBooks = [
        {
          id: '9781111111111',
          type: 'isbn',
          title: 'ISBN Book 1',
          progress: 10.0,
        },
        {
          id: '9781111111112',
          type: 'isbn',
          title: 'ISBN Book 2',
          progress: 20.0,
        },
        {
          id: 'B111111111',
          type: 'asin',
          title: 'ASIN Book 1',
          progress: 30.0,
        },
        {
          id: 'B111111112',
          type: 'asin',
          title: 'ASIN Book 2',
          progress: 40.0,
        },
        {
          id: 'title_author_user1_ed1',
          type: 'title_author',
          title: 'Title Book 1',
          progress: 50.0,
        },
        {
          id: 'title_author_user2_ed2',
          type: 'title_author',
          title: 'Title Book 2',
          progress: 60.0,
        },
      ];

      // Store all books
      for (const book of testBooks) {
        await bookCache.storeBookSyncData(
          testUserId,
          book.id,
          book.title,
          'edition-test',
          book.type,
          'Test Author',
          book.progress,
          Date.now(),
          Date.now() - 86400000,
        );
      }

      // Perform multiple lookups to test cache performance
      for (const book of testBooks) {
        const hasChanged = await bookCache.hasProgressChanged(
          testUserId,
          book.id,
          book.title,
          book.progress,
          book.type,
        );
        assert.strictEqual(
          hasChanged,
          false,
          `${book.title} should be unchanged`,
        );
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Performance should be reasonable (under 1 second for 6 books x 2 operations each)
      assert.ok(
        duration < 1000,
        `Cache operations should be fast, took ${duration}ms`,
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle missing cache entries gracefully', async () => {
      const nonExistentId = 'non-existent-isbn';
      const title = 'Non-existent Book';
      const progress = 50.0;

      // Check progress for book that doesn't exist in cache
      const hasChanged = await bookCache.hasProgressChanged(
        testUserId,
        nonExistentId,
        title,
        progress,
        'isbn',
      );

      // Should return true (needs sync) when no cache entry exists
      assert.strictEqual(
        hasChanged,
        true,
        'Should return true for non-existent cache entries',
      );
    });

    it('should handle invalid identifier types', async () => {
      const isbn = '9783333333333';
      const title = 'Invalid Type Test';
      const progress = 75.0;

      // Store with valid type
      await bookCache.storeBookSyncData(
        testUserId,
        isbn,
        title,
        'edition-invalid',
        'isbn',
        'Test Author',
        progress,
        Date.now(),
        Date.now() - 86400000,
      );

      // Try to lookup with invalid type - should not find it
      const hasChanged = await bookCache.hasProgressChanged(
        testUserId,
        isbn,
        title,
        progress,
        'invalid_type',
      );

      assert.strictEqual(
        hasChanged,
        true,
        'Should return true for invalid identifier types',
      );
    });
  });
});
