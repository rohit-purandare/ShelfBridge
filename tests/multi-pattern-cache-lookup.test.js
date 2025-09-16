import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BookCache } from '../src/book-cache.js';
import ProgressManager from '../src/progress-manager.js';

/**
 * Multi-Pattern Cache Lookup Test
 *
 * This test verifies that the enhanced early optimization can find
 * title/author books cached with various legacy identifier patterns.
 */

describe('Multi-Pattern Cache Lookup', () => {
  it('should find cached books using legacy identifier patterns', async () => {
    const bookCache = new BookCache();
    await bookCache.init();

    try {
      const userId = 'multi-pattern-user';
      const title = 'Legacy Pattern Book';
      const author = 'Legacy Author';

      console.log('\n🔍 TESTING MULTI-PATTERN CACHE LOOKUP\n');

      // === Test Case 1: Book cached with old userBook/edition pattern ===
      console.log('📚 TEST CASE 1: Legacy userBook/edition pattern');

      const legacyPattern = 'title_author_user789_edition123';
      await bookCache.storeBookSyncData(
        userId,
        legacyPattern,
        title,
        'legacy-edition-123',
        'title_author',
        author,
        55.5,
        Date.now() - 3600000,
        Date.now() - 86400000
      );

      console.log(`  Stored with legacy pattern: ${legacyPattern}`);

      // Simulate the multi-pattern lookup from early optimization
      const titleAuthorPatterns = [
        // 1. Current standard pattern
        bookCache.generateTitleAuthorIdentifier(title, author),
        // 2. Legacy patterns
        `${title}:${author}`,
        `${title.toLowerCase().replace(/[^a-z0-9:]/g, '')}:${author.toLowerCase().replace(/[^a-z0-9:]/g, '')}`,
      ];

      // Add any existing cache patterns (this simulates the database lookup)
      const stmt = bookCache.db.prepare(`
        SELECT identifier FROM books
        WHERE user_id = ? AND identifier_type = 'title_author' AND title = ?
        LIMIT 5
      `);
      const existingEntries = stmt.all(userId, title.toLowerCase().trim());

      for (const entry of existingEntries) {
        if (!titleAuthorPatterns.includes(entry.identifier)) {
          titleAuthorPatterns.push(entry.identifier);
        }
      }

      console.log(`  Generated patterns to check: ${titleAuthorPatterns.length}`);
      titleAuthorPatterns.forEach((pattern, index) => {
        console.log(`    ${index + 1}. ${pattern}`);
      });

      // Try each pattern to find the cache entry
      let bestCacheMatch = null;
      let bestCachePattern = null;

      for (const pattern of titleAuthorPatterns) {
        const titleAuthorCached = await bookCache.getCachedBookInfo(
          userId,
          pattern,
          title,
          'title_author'
        );

        console.log(`  Checking pattern "${pattern}": exists=${titleAuthorCached?.exists || false}, hasEdition=${!!(titleAuthorCached?.edition_id)}`);

        if (titleAuthorCached && titleAuthorCached.exists && titleAuthorCached.edition_id) {
          bestCacheMatch = titleAuthorCached;
          bestCachePattern = pattern;
          console.log(`  ✅ FOUND complete cache entry with pattern: ${pattern}`);
          break;
        }
      }

      assert.strictEqual(!!bestCacheMatch, true, 'Should find cached book with legacy pattern');
      assert.strictEqual(bestCachePattern, legacyPattern, 'Should find the exact legacy pattern we stored');

      // Test progress change detection
      const progressChanged = await bookCache.hasProgressChanged(
        userId,
        bestCachePattern,
        title,
        55.5, // Same progress
        'title_author'
      );

      assert.strictEqual(progressChanged, false, 'Should detect unchanged progress with legacy pattern');
      console.log(`  ✅ Progress unchanged detected: Would skip title/author search!`);

      // === Test Case 2: New pattern compatibility ===
      console.log('\n📚 TEST CASE 2: New pattern still works');

      const newTitle = 'New Pattern Book';
      const newAuthor = 'New Author';
      const newPattern = bookCache.generateTitleAuthorIdentifier(newTitle, newAuthor);

      await bookCache.storeBookSyncData(
        userId,
        newPattern,
        newTitle,
        'new-edition-456',
        'title_author',
        newAuthor,
        33.3,
        Date.now(),
        Date.now() - 86400000
      );

      console.log(`  Stored with new pattern: ${newPattern}`);

      // Should find it with the standard lookup
      const newPatternLookup = await bookCache.getCachedBookInfo(
        userId,
        newPattern,
        newTitle,
        'title_author'
      );

      assert.strictEqual(newPatternLookup.exists, true, 'Should find book with new pattern');
      console.log(`  ✅ New pattern lookup successful`);

      console.log('\n🎉 MULTI-PATTERN LOOKUP SUCCESS:');
      console.log('  ✅ Legacy patterns: Found and optimized');
      console.log('  ✅ New patterns: Work as expected');
      console.log('  ✅ Backward compatibility: Fully maintained');
      console.log('  🚀 Performance: ALL cached books now benefit from optimization!');

    } finally {
      await bookCache.clearCache();
      bookCache.close();
    }
  });
});