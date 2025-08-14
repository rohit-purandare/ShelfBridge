/**
 * Cache Integration Tests for Two-Stage Matching
 * 
 * Tests to ensure the BookCache properly handles two-stage matching results,
 * edition mappings, and cache retrieval for the new matching system.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { BookCache } from '../src/book-cache.js';
import fs from 'fs';
import path from 'path';

describe('Cache Two-Stage Integration', () => {
  let cache;
  let tempCachePath;

  beforeEach(async () => {
    // Create temporary cache file
    tempCachePath = path.join(__dirname, 'temp-cache-test.db');
    cache = new BookCache(tempCachePath);
    await cache.initialize();
  });

  afterEach(async () => {
    if (cache) {
      await cache.close();
    }
    
    // Clean up temporary file
    try {
      if (fs.existsSync(tempCachePath)) {
        fs.unlinkSync(tempCachePath);
      }
    } catch (error) {
      console.warn('Could not clean up temp cache file:', error.message);
    }
  });

  describe('Edition Mapping Storage', () => {
    it('should store two-stage match edition mappings correctly', async () => {
      const userId = 'test-user-two-stage';
      const titleAuthorId = 'laws-of-skies-gregoire-courtois';
      const title = 'The Laws of the Skies';
      const editionId = 'edition_30463295';
      const bookId = 'book_511122';
      const author = 'Gregoire Courtois';

      const result = await cache.storeEditionMapping(
        userId,
        titleAuthorId,
        title,
        editionId,
        bookId,
        author
      );

      expect(result).toBe(true);

      // Verify storage
      const cachedInfo = await cache.getCachedBookInfo(
        userId,
        titleAuthorId,
        title,
        'title_author'
      );

      expect(cachedInfo).not.toBeNull();
      expect(cachedInfo.edition_id).toBe(editionId);
      expect(cachedInfo.book_id).toBe(bookId);
      expect(cachedInfo.title).toBe(title);
      expect(cachedInfo.author).toBe(author);
    });

    it('should handle audiobook edition mappings', async () => {
      const audiobookMapping = {
        userId: 'audiobook-user',
        titleAuthorId: 'audiobook-test-id',
        title: 'Test Audiobook',
        editionId: 'audiobook_edition_123',
        bookId: 'audiobook_book_456',
        author: 'Audiobook Author'
      };

      await cache.storeEditionMapping(
        audiobookMapping.userId,
        audiobookMapping.titleAuthorId,
        audiobookMapping.title,
        audiobookMapping.editionId,
        audiobookMapping.bookId,
        audiobookMapping.author
      );

      const retrieved = await cache.getCachedBookInfo(
        audiobookMapping.userId,
        audiobookMapping.titleAuthorId,
        audiobookMapping.title,
        'title_author'
      );

      expect(retrieved.edition_id).toBe(audiobookMapping.editionId);
      expect(retrieved.book_id).toBe(audiobookMapping.bookId);
    });

    it('should handle ebook edition mappings', async () => {
      const ebookMapping = {
        userId: 'ebook-user',
        titleAuthorId: 'ebook-test-id',
        title: 'Test Ebook',
        editionId: 'ebook_edition_789',
        bookId: 'ebook_book_012',
        author: 'Ebook Author'
      };

      await cache.storeEditionMapping(
        ebookMapping.userId,
        ebookMapping.titleAuthorId,
        ebookMapping.title,
        ebookMapping.editionId,
        ebookMapping.bookId,
        ebookMapping.author
      );

      const retrieved = await cache.getCachedBookInfo(
        ebookMapping.userId,
        ebookMapping.titleAuthorId,
        ebookMapping.title,
        'title_author'
      );

      expect(retrieved.edition_id).toBe(ebookMapping.editionId);
      expect(retrieved.book_id).toBe(ebookMapping.bookId);
    });

    it('should update existing edition mappings', async () => {
      const userId = 'update-test-user';
      const titleAuthorId = 'update-test-id';
      const title = 'Update Test Book';
      const author = 'Update Author';

      // Store initial mapping
      await cache.storeEditionMapping(
        userId,
        titleAuthorId,
        title,
        'old_edition_123',
        'book_456',
        author
      );

      // Update with new edition
      await cache.storeEditionMapping(
        userId,
        titleAuthorId,
        title,
        'new_edition_789',
        'book_456',
        author
      );

      const retrieved = await cache.getCachedBookInfo(
        userId,
        titleAuthorId,
        title,
        'title_author'
      );

      expect(retrieved.edition_id).toBe('new_edition_789');
      expect(retrieved.book_id).toBe('book_456');
    });

    it('should handle different users with same book', async () => {
      const commonBook = {
        titleAuthorId: 'common-book-id',
        title: 'Common Book',
        author: 'Shared Author'
      };

      // Store for user 1
      await cache.storeEditionMapping(
        'user-1',
        commonBook.titleAuthorId,
        commonBook.title,
        'edition_user1',
        'book_common',
        commonBook.author
      );

      // Store for user 2 (different edition of same book)
      await cache.storeEditionMapping(
        'user-2',
        commonBook.titleAuthorId,
        commonBook.title,
        'edition_user2',
        'book_common',
        commonBook.author
      );

      const user1Cache = await cache.getCachedBookInfo(
        'user-1',
        commonBook.titleAuthorId,
        commonBook.title,
        'title_author'
      );

      const user2Cache = await cache.getCachedBookInfo(
        'user-2',
        commonBook.titleAuthorId,
        commonBook.title,
        'title_author'
      );

      expect(user1Cache.edition_id).toBe('edition_user1');
      expect(user2Cache.edition_id).toBe('edition_user2');
      expect(user1Cache.book_id).toBe(user2Cache.book_id); // Same book
    });
  });

  describe('Cache Retrieval', () => {
    beforeEach(async () => {
      // Populate cache with test data
      await cache.storeEditionMapping(
        'test-user',
        'cached-book-id',
        'Cached Book',
        'cached_edition_123',
        'cached_book_456',
        'Cached Author'
      );
    });

    it('should retrieve cached edition mappings correctly', async () => {
      const cached = await cache.getCachedBookInfo(
        'test-user',
        'cached-book-id',
        'Cached Book',
        'title_author'
      );

      expect(cached).not.toBeNull();
      expect(cached.edition_id).toBe('cached_edition_123');
      expect(cached.book_id).toBe('cached_book_456');
      expect(cached.title).toBe('Cached Book');
      expect(cached.author).toBe('Cached Author');
    });

    it('should return null for non-existent cache entries', async () => {
      const nonExistent = await cache.getCachedBookInfo(
        'test-user',
        'non-existent-id',
        'Non-existent Book',
        'title_author'
      );

      expect(nonExistent).toBeNull();
    });

    it('should return null for different user requesting same book', async () => {
      const differentUser = await cache.getCachedBookInfo(
        'different-user',
        'cached-book-id',
        'Cached Book',
        'title_author'
      );

      expect(differentUser).toBeNull();
    });

    it('should handle case-sensitive cache lookups', async () => {
      const caseTest = await cache.getCachedBookInfo(
        'test-user',
        'cached-book-id',
        'CACHED BOOK', // Different case
        'title_author'
      );

      expect(caseTest).toBeNull(); // Should not match due to case sensitivity
    });
  });

  describe('Cache Performance with Two-Stage Data', () => {
    it('should handle bulk edition mapping storage efficiently', async () => {
      const bulkMappings = [];
      const startTime = performance.now();

      // Create 100 test mappings
      for (let i = 0; i < 100; i++) {
        bulkMappings.push({
          userId: `bulk-user-${i % 10}`, // 10 different users
          titleAuthorId: `bulk-book-${i}`,
          title: `Bulk Book ${i}`,
          editionId: `bulk_edition_${i}`,
          bookId: `bulk_book_${i}`,
          author: `Bulk Author ${i % 20}` // 20 different authors
        });
      }

      // Store all mappings
      for (const mapping of bulkMappings) {
        await cache.storeEditionMapping(
          mapping.userId,
          mapping.titleAuthorId,
          mapping.title,
          mapping.editionId,
          mapping.bookId,
          mapping.author
        );
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(totalTime).toBeLessThan(5000); // 5 seconds

      // Verify some mappings were stored correctly
      const sample = await cache.getCachedBookInfo(
        'bulk-user-0',
        'bulk-book-0',
        'Bulk Book 0',
        'title_author'
      );

      expect(sample).not.toBeNull();
      expect(sample.edition_id).toBe('bulk_edition_0');
    });

    it('should handle bulk cache retrieval efficiently', async () => {
      // Store 50 test mappings
      for (let i = 0; i < 50; i++) {
        await cache.storeEditionMapping(
          'perf-user',
          `perf-book-${i}`,
          `Performance Book ${i}`,
          `perf_edition_${i}`,
          `perf_book_${i}`,
          'Performance Author'
        );
      }

      const startTime = performance.now();

      // Retrieve all mappings
      const retrievalPromises = [];
      for (let i = 0; i < 50; i++) {
        retrievalPromises.push(
          cache.getCachedBookInfo(
            'perf-user',
            `perf-book-${i}`,
            `Performance Book ${i}`,
            'title_author'
          )
        );
      }

      const results = await Promise.all(retrievalPromises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(totalTime).toBeLessThan(2000); // 2 seconds
      expect(results).toHaveLength(50);
      expect(results.every(result => result !== null)).toBe(true);
    });
  });

  describe('Cache Data Integrity', () => {
    it('should maintain data integrity with concurrent operations', async () => {
      const userId = 'concurrent-user';
      const titleAuthorId = 'concurrent-book';
      const title = 'Concurrent Test Book';
      const author = 'Concurrent Author';

      // Simulate concurrent store operations
      const storePromises = [
        cache.storeEditionMapping(userId, titleAuthorId, title, 'edition_1', 'book_1', author),
        cache.storeEditionMapping(userId, titleAuthorId, title, 'edition_2', 'book_1', author),
        cache.storeEditionMapping(userId, titleAuthorId, title, 'edition_3', 'book_1', author)
      ];

      await Promise.all(storePromises);

      // Should have one of the editions (last write wins)
      const final = await cache.getCachedBookInfo(
        userId,
        titleAuthorId,
        title,
        'title_author'
      );

      expect(final).not.toBeNull();
      expect(['edition_1', 'edition_2', 'edition_3']).toContain(final.edition_id);
      expect(final.book_id).toBe('book_1');
    });

    it('should handle special characters in book data', async () => {
      const specialData = {
        userId: 'special-user',
        titleAuthorId: 'special-id',
        title: 'Book with "Quotes" & Special Chars: 测试',
        editionId: 'special_edition_123',
        bookId: 'special_book_456',
        author: 'Author with àccénts & símböls'
      };

      await cache.storeEditionMapping(
        specialData.userId,
        specialData.titleAuthorId,
        specialData.title,
        specialData.editionId,
        specialData.bookId,
        specialData.author
      );

      const retrieved = await cache.getCachedBookInfo(
        specialData.userId,
        specialData.titleAuthorId,
        specialData.title,
        'title_author'
      );

      expect(retrieved).not.toBeNull();
      expect(retrieved.title).toBe(specialData.title);
      expect(retrieved.author).toBe(specialData.author);
      expect(retrieved.edition_id).toBe(specialData.editionId);
    });

    it('should handle null and undefined values gracefully', async () => {
      const userId = 'null-test-user';
      const titleAuthorId = 'null-test-id';

      // Test with null values
      const nullResult = await cache.storeEditionMapping(
        userId,
        titleAuthorId,
        null,
        'null_edition',
        'null_book',
        null
      );

      expect(nullResult).toBe(false); // Should fail gracefully

      // Test with undefined values
      const undefinedResult = await cache.storeEditionMapping(
        userId,
        titleAuthorId,
        undefined,
        'undefined_edition',
        'undefined_book',
        undefined
      );

      expect(undefinedResult).toBe(false); // Should fail gracefully
    });

    it('should handle very long book titles and author names', async () => {
      const longTitle = 'A'.repeat(1000); // Very long title
      const longAuthor = 'B'.repeat(500); // Very long author name

      const result = await cache.storeEditionMapping(
        'long-data-user',
        'long-data-id',
        longTitle,
        'long_edition',
        'long_book',
        longAuthor
      );

      expect(result).toBe(true);

      const retrieved = await cache.getCachedBookInfo(
        'long-data-user',
        'long-data-id',
        longTitle,
        'title_author'
      );

      expect(retrieved).not.toBeNull();
      expect(retrieved.title).toBe(longTitle);
      expect(retrieved.author).toBe(longAuthor);
    });
  });

  describe('Cache Migration and Compatibility', () => {
    it('should handle existing cache entries alongside two-stage entries', async () => {
      // Store a legacy-style entry (simulated)
      const legacyUserId = 'legacy-user';
      const legacyTitleAuthorId = 'legacy-id';
      const legacyTitle = 'Legacy Book';
      const legacyAuthor = 'Legacy Author';

      await cache.storeEditionMapping(
        legacyUserId,
        legacyTitleAuthorId,
        legacyTitle,
        'legacy_edition',
        'legacy_book',
        legacyAuthor
      );

      // Store a two-stage entry
      await cache.storeEditionMapping(
        'two-stage-user',
        'two-stage-id',
        'Two Stage Book',
        'two_stage_edition',
        'two_stage_book',
        'Two Stage Author'
      );

      // Both should be retrievable
      const legacyRetrieved = await cache.getCachedBookInfo(
        legacyUserId,
        legacyTitleAuthorId,
        legacyTitle,
        'title_author'
      );

      const twoStageRetrieved = await cache.getCachedBookInfo(
        'two-stage-user',
        'two-stage-id',
        'Two Stage Book',
        'title_author'
      );

      expect(legacyRetrieved).not.toBeNull();
      expect(twoStageRetrieved).not.toBeNull();
      expect(legacyRetrieved.edition_id).toBe('legacy_edition');
      expect(twoStageRetrieved.edition_id).toBe('two_stage_edition');
    });
  });
});
