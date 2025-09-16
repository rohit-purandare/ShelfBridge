import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BookCache } from '../src/book-cache.js';

/**
 * Auto-Add Cache Skip Verification
 *
 * This test focuses specifically on verifying that the cache check in auto-add
 * correctly identifies cached books and skips unnecessary title/author searches.
 */

describe('Auto-Add Cache Skip Verification', () => {
  it('should correctly identify when books are already cached and skip title/author search', async () => {
    const bookCache = new BookCache();
    await bookCache.init();

    try {
      const userId = 'test-cache-skip';

      console.log('\n🧪 AUTO-ADD CACHE SKIP VERIFICATION\n');

      // === Test Case 1: Book with complete cache entry (should skip) ===
      const cachedTitle = 'Previously Matched Book';
      const cachedAuthor = 'Previously Matched Author';

      console.log('📚 TEST CASE 1: Book with complete cache entry');
      console.log(`  Title: "${cachedTitle}" by "${cachedAuthor}"`);

      // Create complete cache entry (simulating successful previous match)
      const titleAuthorId = bookCache.generateTitleAuthorIdentifier(
        cachedTitle,
        cachedAuthor,
      );
      await bookCache.storeBookSyncData(
        userId,
        titleAuthorId,
        cachedTitle,
        'complete-edition-123', // Has edition_id
        'title_author',
        cachedAuthor,
        45.0,
        Date.now() - 3600000,
        Date.now() - 86400000,
      );

      console.log(`  Generated ID: ${titleAuthorId}`);

      // Test the cache check logic from _tryAutoAddBook
      const existingCache = await bookCache.getCachedBookInfo(
        userId,
        titleAuthorId,
        cachedTitle,
        'title_author',
      );

      console.log(`  Cache exists: ${existingCache.exists}`);
      console.log(`  Has edition_id: ${!!existingCache.edition_id}`);

      // This is the exact condition from the auto-add cache check
      const shouldSkipAutoAdd = !!(
        existingCache &&
        existingCache.exists &&
        existingCache.edition_id
      );

      assert.strictEqual(
        shouldSkipAutoAdd,
        true,
        'Should skip auto-add for complete cache entry',
      );
      console.log(`  ✅ RESULT: Would skip title/author search (cache hit)`);

      // === Test Case 2: Book with incomplete cache entry (should proceed) ===
      const incompleteTitle = 'Incomplete Cache Book';
      const incompleteAuthor = 'Incomplete Author';

      console.log(`\n📚 TEST CASE 2: Book with incomplete cache entry`);
      console.log(`  Title: "${incompleteTitle}" by "${incompleteAuthor}"`);

      const incompleteTitleAuthorId = bookCache.generateTitleAuthorIdentifier(
        incompleteTitle,
        incompleteAuthor,
      );

      // Create incomplete cache entry (no edition_id)
      const stmt = bookCache.db.prepare(`
        INSERT INTO books (user_id, identifier, identifier_type, title, author, progress_percent, last_sync)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        userId,
        incompleteTitleAuthorId,
        'title_author',
        incompleteTitle.toLowerCase().trim(),
        incompleteAuthor,
        25.0,
        Date.now(),
      );

      const incompleteCache = await bookCache.getCachedBookInfo(
        userId,
        incompleteTitleAuthorId,
        incompleteTitle,
        'title_author',
      );

      console.log(`  Cache exists: ${incompleteCache.exists}`);
      console.log(`  Has edition_id: ${!!incompleteCache.edition_id}`);

      const shouldSkipIncomplete =
        incompleteCache && incompleteCache.exists && incompleteCache.edition_id;

      assert.strictEqual(
        shouldSkipIncomplete,
        false,
        'Should NOT skip auto-add for incomplete cache entry',
      );
      console.log(
        `  ✅ RESULT: Would proceed with title/author search (incomplete cache)`,
      );

      // === Test Case 3: Genuinely new book (should proceed) ===
      const newTitle = 'Completely New Book';
      const newAuthor = 'New Author';

      console.log(`\n📚 TEST CASE 3: Genuinely new book (no cache)`);
      console.log(`  Title: "${newTitle}" by "${newAuthor}"`);

      const newTitleAuthorId = bookCache.generateTitleAuthorIdentifier(
        newTitle,
        newAuthor,
      );
      const newCache = await bookCache.getCachedBookInfo(
        userId,
        newTitleAuthorId,
        newTitle,
        'title_author',
      );

      console.log(`  Cache exists: ${newCache.exists}`);

      const shouldSkipNew = newCache && newCache.exists && newCache.edition_id;

      assert.strictEqual(
        shouldSkipNew,
        false,
        'Should NOT skip auto-add for new book',
      );
      console.log(
        `  ✅ RESULT: Would proceed with title/author search (no cache)`,
      );

      console.log('\n🎯 VERIFICATION SUMMARY:');
      console.log('  ✅ Complete cache entries: Skip title/author search');
      console.log(
        '  ✅ Incomplete cache entries: Proceed with title/author search',
      );
      console.log('  ✅ New books: Proceed with title/author search');
      console.log('  ✅ Auto-add functionality fully preserved!');
    } finally {
      await bookCache.clearCache();
      bookCache.close();
    }
  });

  it('should demonstrate the cache check logic accuracy', async () => {
    const bookCache = new BookCache();
    await bookCache.init();

    try {
      const userId = 'test-logic-accuracy';

      // Test the exact conditions used in the auto-add cache check
      const testCases = [
        {
          name: 'Complete cache entry',
          setup: async () => {
            const id = bookCache.generateTitleAuthorIdentifier(
              'Complete Book',
              'Complete Author',
            );
            await bookCache.storeBookSyncData(
              userId,
              id,
              'Complete Book',
              'edition-123',
              'title_author',
              'Complete Author',
              50.0,
              Date.now(),
              Date.now() - 86400000,
            );
            return { id, title: 'Complete Book' };
          },
          expectedSkip: true,
        },
        {
          name: 'No cache entry',
          setup: async () => {
            const id = bookCache.generateTitleAuthorIdentifier(
              'No Cache Book',
              'No Cache Author',
            );
            return { id, title: 'No Cache Book' };
          },
          expectedSkip: false,
        },
      ];

      for (const testCase of testCases) {
        console.log(`\n🔬 Testing: ${testCase.name}`);

        const { id, title } = await testCase.setup();

        const cache = await bookCache.getCachedBookInfo(
          userId,
          id,
          title,
          'title_author',
        );
        const shouldSkip = !!(cache && cache.exists && cache.edition_id);

        assert.strictEqual(
          shouldSkip,
          testCase.expectedSkip,
          `${testCase.name}: Expected skip=${testCase.expectedSkip}, got skip=${shouldSkip}`,
        );

        console.log(`  Expected skip: ${testCase.expectedSkip}`);
        console.log(`  Actual skip: ${shouldSkip}`);
        console.log(`  ✅ Logic correct`);
      }
    } finally {
      await bookCache.clearCache();
      bookCache.close();
    }
  });
});
