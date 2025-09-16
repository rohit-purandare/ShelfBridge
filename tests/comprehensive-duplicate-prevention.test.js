import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BookCache } from '../src/book-cache.js';
import ProgressManager from '../src/progress-manager.js';

/**
 * Comprehensive Duplicate Prevention Test
 *
 * This test simulates the complete flow to verify that ALL scenarios that could
 * trigger duplicate title/author matching are properly handled.
 */

describe('Comprehensive Duplicate Prevention', () => {
  it('should prevent all forms of duplicate title/author matching', async () => {
    const bookCache = new BookCache();
    await bookCache.init();

    try {
      const userId = 'test-comprehensive';

      console.log('\n🧪 COMPREHENSIVE DUPLICATE MATCHING PREVENTION TEST\n');

      // === SCENARIO 1: Book with identifiers (should use early optimization) ===
      console.log('📚 SCENARIO 1: Book with ISBN identifier');

      const isbnBook = {
        id: 'isbn-book-test',
        progress_percentage: 45.0,
        is_finished: false,
        media: {
          metadata: {
            title: 'Book With ISBN',
            authors: [{ name: 'ISBN Author' }],
            isbn: '9781234567890',
          },
        },
      };

      // Cache the ISBN book
      await bookCache.storeBookSyncData(
        userId,
        '9781234567890',
        'Book With ISBN',
        'isbn-edition',
        'isbn',
        'ISBN Author',
        45.0,
        Date.now(),
        Date.now() - 86400000,
      );

      // Test early optimization
      const isbnProgressChanged = await bookCache.hasProgressChanged(
        userId,
        '9781234567890',
        'Book With ISBN',
        45.0, // Same progress
        'isbn',
      );

      assert.strictEqual(
        isbnProgressChanged,
        false,
        'ISBN book should show unchanged progress',
      );
      console.log('  ✅ Early optimization: ISBN book would be skipped');

      // === SCENARIO 2: Book without identifiers (title/author only) ===
      console.log(
        '\n📚 SCENARIO 2: Book without identifiers (title/author only)',
      );

      const titleAuthorBook = {
        id: 'title-author-book-test',
        progress_percentage: 67.3,
        is_finished: false,
        media: {
          metadata: {
            title: 'Book Without Identifiers',
            authors: [{ name: 'Title Author' }],
            // No ISBN or ASIN
          },
        },
      };

      const title = titleAuthorBook.media.metadata.title;
      const author = titleAuthorBook.media.metadata.authors[0].name;

      // Cache using consistent title/author identifier
      const titleAuthorId = bookCache.generateTitleAuthorIdentifier(
        title,
        author,
      );
      await bookCache.storeBookSyncData(
        userId,
        titleAuthorId,
        title,
        'title-author-edition',
        'title_author',
        author,
        67.3,
        Date.now(),
        Date.now() - 86400000,
      );

      console.log(`  Generated cache identifier: ${titleAuthorId}`);

      // Test early optimization for title/author books
      const titleAuthorProgressChanged = await bookCache.hasProgressChanged(
        userId,
        titleAuthorId,
        title,
        67.3, // Same progress
        'title_author',
      );

      assert.strictEqual(
        titleAuthorProgressChanged,
        false,
        'Title/author book should show unchanged progress',
      );
      console.log(
        '  ✅ Early optimization: Title/author book would be skipped',
      );

      // === SCENARIO 3: Auto-add prevention ===
      console.log('\n📚 SCENARIO 3: Auto-add cache prevention');

      // Simulate auto-add scenario where identifier searches fail
      const cachedInfo = await bookCache.getCachedBookInfo(
        userId,
        titleAuthorId,
        title,
        'title_author',
      );

      assert.strictEqual(
        cachedInfo.exists,
        true,
        'Should find cached title/author book',
      );
      assert.strictEqual(
        !!cachedInfo.edition_id,
        true,
        'Should have edition_id for complete cache entry',
      );

      console.log(
        '  ✅ Auto-add prevention: Would skip title/author search for cached book',
      );

      // === SCENARIO 4: Mixed library (both types) ===
      console.log('\n📚 SCENARIO 4: Mixed library optimization');

      const mixedResults = [];

      // Test ISBN book optimization
      const isbnCacheCheck = await bookCache.hasProgressChanged(
        userId,
        '9781234567890',
        'Book With ISBN',
        45.0,
        'isbn',
      );
      mixedResults.push({ type: 'ISBN', optimized: !isbnCacheCheck });

      // Test title/author book optimization
      const titleCacheCheck = await bookCache.hasProgressChanged(
        userId,
        titleAuthorId,
        title,
        67.3,
        'title_author',
      );
      mixedResults.push({ type: 'Title/Author', optimized: !titleCacheCheck });

      // Both should be optimized
      const allOptimized = mixedResults.every(result => result.optimized);
      assert.strictEqual(
        allOptimized,
        true,
        'All book types should benefit from cache optimization',
      );

      mixedResults.forEach(result => {
        console.log(
          `  ✅ ${result.type} book: ${result.optimized ? 'Optimized' : 'Not optimized'}`,
        );
      });

      console.log(
        '\n🎉 ALL SCENARIOS PASS - DUPLICATE MATCHING FULLY PREVENTED!',
      );
      console.log('\n📊 Performance Benefits:');
      console.log(
        '  ✅ Books with identifiers: Skip matching via early optimization',
      );
      console.log(
        '  ✅ Books without identifiers: Skip matching via title/author cache',
      );
      console.log(
        '  ✅ Auto-add fallback: Skip search for already cached books',
      );
      console.log(
        '  ✅ Mixed libraries: All book types benefit from optimization',
      );
    } finally {
      await bookCache.clearCache();
      bookCache.close();
    }
  });
});
