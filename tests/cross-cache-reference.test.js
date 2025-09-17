import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BookCache } from '../src/book-cache.js';

/**
 * Cross-Cache Reference Test
 *
 * This test verifies that we can use complete cache entries from any
 * identifier type to avoid searches, even when other cache entries are incomplete.
 */

describe('Cross-Cache Reference', () => {
  it('should use complete ASIN cache to avoid title/author search when title/author cache is incomplete', async () => {
    const bookCache = new BookCache();
    await bookCache.init();

    try {
      const userId = 'cross-cache-user';
      const title = 'Cross Reference Test';
      const author = 'Cross Author';
      const asin = 'B987654321';

      console.log('\n🔍 TESTING CROSS-CACHE REFERENCE OPTIMIZATION\n');

      // Scenario: Book has complete ASIN cache but incomplete title/author cache
      // This simulates the real "Cleopatra and Frankenstein" situation

      // 1. Create complete ASIN cache
      await bookCache.storeBookSyncData(
        userId, asin, title, 'complete-edition-789', 'asin', author,
        45.0, Date.now() - 86400000, Date.now() - 172800000
      );

      // 2. Create incomplete title/author cache (edition_id: null)
      const titleAuthorId = bookCache.generateTitleAuthorIdentifier(title, author);
      const stmt = bookCache.db.prepare(`
        INSERT INTO books (user_id, identifier, identifier_type, title, author, progress_percent, last_sync)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(userId, titleAuthorId, 'title_author', title.toLowerCase().trim(), author, 0, Date.now());

      console.log('📚 Cache state:');
      console.log(`  ASIN cache: ${asin} (complete)`);
      console.log(`  Title/author cache: ${titleAuthorId} (incomplete - edition_id: null)`);

      // 3. Test current logic
      console.log('\n🔄 Current optimization logic:');

      const identifiers = { asin: asin, isbn: null };

      // Check all cache types comprehensively
      const allCacheKeys = [
        { key: asin, type: 'asin' },
        { key: titleAuthorId, type: 'title_author' }
      ];

      let bestCompleteCache = null;

      for (const { key, type } of allCacheKeys) {
        const cache = await bookCache.getCachedBookInfo(userId, key, title, type);
        console.log(`  ${type} cache: exists=${cache.exists}, edition_id=${cache.edition_id || 'null'}`);

        if (cache.exists && cache.edition_id) {
          bestCompleteCache = { key, type, cache };
          console.log(`    ✅ COMPLETE cache entry found with ${type}`);
          break; // Use first complete cache found
        }
      }

      // 4. Test enhanced optimization
      if (bestCompleteCache) {
        const progressChanged = await bookCache.hasProgressChanged(
          userId, bestCompleteCache.key, title, 50.0, bestCompleteCache.type
        );

        console.log(`  Progress changed via ${bestCompleteCache.type}: ${progressChanged}`);

        if (!progressChanged) {
          console.log(`  🎉 OPTIMIZATION: Would skip entirely via ${bestCompleteCache.type} cache`);
        } else {
          console.log(`  💡 ENHANCED IDEA: Could reuse ${bestCompleteCache.type} cache edition info`);
          console.log(`    - Edition ID: ${bestCompleteCache.cache.edition_id}`);
          console.log(`    - Skip TitleAuthorMatcher since we know the edition`);
          console.log(`    - Go directly to progress sync with known edition`);
        }
      }

      assert.strictEqual(!!bestCompleteCache, true, 'Should find complete cache entry');
      assert.strictEqual(bestCompleteCache.type, 'asin', 'Should find ASIN cache as complete');

      console.log('\n🎯 CROSS-CACHE REFERENCE BENEFITS:');
      console.log('  ✅ Use ANY complete cache entry available');
      console.log('  ✅ Avoid searches when edition is known from any source');
      console.log('  ✅ Handle cache inconsistencies gracefully');
      console.log('  ✅ Maximum optimization coverage');

    } finally {
      await bookCache.clearCache();
      bookCache.close();
    }
  });
});