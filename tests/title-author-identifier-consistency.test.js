import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BookCache } from '../src/book-cache.js';

/**
 * Title/Author Identifier Consistency Test
 *
 * This test verifies that title/author identifiers are generated consistently
 * across all parts of the system, ensuring cache lookups work correctly.
 */

describe('Title/Author Identifier Consistency', () => {
  it('should generate consistent identifiers for title/author matching', async () => {
    const bookCache = new BookCache();
    await bookCache.init();

    try {
      const title = 'The Great Adventure';
      const author = 'Jane Smith';

      // Generate identifier using BookCache method (used by TitleAuthorMatcher)
      const cacheIdentifier = bookCache.generateTitleAuthorIdentifier(title, author);

      // The identifier should follow the pattern: title_author:normalized_title|normalized_author
      const expectedPattern = /^title_author:[a-z0-9_]+\|[a-z0-9_]+$/;
      assert.match(cacheIdentifier, expectedPattern, 'Should follow consistent identifier pattern');

      console.log(`✓ Generated consistent identifier: ${cacheIdentifier}`);

      // Test with various title/author combinations
      const testCases = [
        { title: 'Book Title', author: 'Author Name', expected: 'title_author:book_title|author_name' },
        { title: 'Book: With Punctuation!', author: 'Author-Name', expected: 'title_author:book:_with_punctuation!|author-name' },
        { title: 'Book   With  Spaces', author: 'Author  With  Spaces', expected: 'title_author:book_with_spaces|author_with_spaces' },
      ];

      for (const testCase of testCases) {
        const generated = bookCache.generateTitleAuthorIdentifier(testCase.title, testCase.author);
        assert.strictEqual(generated, testCase.expected, `Should normalize "${testCase.title}" by "${testCase.author}" correctly`);
        console.log(`✓ "${testCase.title}" → ${generated}`);
      }

      console.log('✅ All title/author identifier generation tests passed');

    } finally {
      bookCache.close();
    }
  });

  it('should demonstrate cache lookup consistency', async () => {
    const bookCache = new BookCache();
    await bookCache.init();

    try {
      const userId = 'test-user-consistency';
      const title = 'Consistent Cache Test';
      const author = 'Cache Author';
      const progress = 42.5;

      // Generate identifier using the consistent method
      const identifier = bookCache.generateTitleAuthorIdentifier(title, author);
      console.log(`Using identifier: ${identifier}`);

      // Store book progress
      await bookCache.storeBookSyncData(
        userId,
        identifier,
        title,
        'test-edition',
        'title_author',
        author,
        progress,
        Date.now(),
        Date.now() - 86400000
      );

      // Verify we can find it using the same identifier generation
      const cachedInfo = await bookCache.getCachedBookInfo(
        userId,
        identifier,
        title,
        'title_author'
      );

      assert.strictEqual(cachedInfo.exists, true, 'Should find cached book with consistent identifier');

      // Verify progress change detection works
      const progressUnchanged = await bookCache.hasProgressChanged(
        userId,
        identifier,
        title,
        progress, // Same progress
        'title_author'
      );

      assert.strictEqual(progressUnchanged, false, 'Should detect unchanged progress correctly');

      const progressChanged = await bookCache.hasProgressChanged(
        userId,
        identifier,
        title,
        progress + 10, // Different progress
        'title_author'
      );

      assert.strictEqual(progressChanged, true, 'Should detect changed progress correctly');

      console.log('✅ Cache lookup consistency verified');

    } finally {
      await bookCache.clearCache();
      bookCache.close();
    }
  });
});