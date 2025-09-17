import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BookCache } from '../src/book-cache.js';

/**
 * Diagnose Cleopatra Issue
 *
 * This test diagnoses why "Cleopatra and Frankenstein" is still
 * triggering title/author searches despite optimization attempts.
 */

describe('Diagnose Cleopatra Issue', () => {
  it('should check what cache entries exist for Cleopatra and Frankenstein', async () => {
    const bookCache = new BookCache();
    await bookCache.init();

    try {
      const userId = 'diagnose-user';
      const title = 'Cleopatra and Frankenstein';
      const author = 'Coco Mellors';
      const asin = 'B09RQ3RD3K';
      const isbn = '9781635578362';

      console.log('\n🔍 DIAGNOSING CLEOPATRA AND FRANKENSTEIN ISSUE\n');

      // Simulate what might be in the real cache based on logs
      console.log('📚 Testing cache scenarios:');

      // Scenario 1: ASIN cache with progress (from logs)
      await bookCache.storeBookSyncData(
        userId,
        asin,
        title,
        'real-edition-30420670',
        'asin',
        author,
        43.246034920646856, // From real logs
        Date.now() - 86400000,
        Date.now() - 172800000,
      );

      console.log(`  Created ASIN cache: ${asin} (progress: 43.2%)`);

      // Scenario 2: Incomplete title/author cache (from logs showing edition_id: null)
      const titleAuthorId = bookCache.generateTitleAuthorIdentifier(
        title,
        author,
      );

      // Simulate incomplete cache entry (edition_id: null like in the logs)
      const stmt = bookCache.db.prepare(`
        INSERT INTO books (user_id, identifier, identifier_type, title, author, progress_percent, last_sync)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        userId,
        titleAuthorId,
        'title_author',
        title.toLowerCase().trim(),
        author,
        0, // From logs: progress_percent: 0
        Date.now() - 86400000,
      );

      console.log(
        `  Created incomplete title/author cache: ${titleAuthorId} (edition_id: null)`,
      );

      // Test what early optimization would find
      console.log('\n🔄 Early optimization simulation:');

      const identifiers = { asin: asin, isbn: isbn };
      const currentProgress = 52.085650305425666; // From error logs

      console.log(`  Current progress: ${currentProgress.toFixed(1)}%`);
      console.log(`  Identifiers: ASIN=${asin}, ISBN=${isbn}`);

      // Test identifier-based cache lookup
      const asinCache = await bookCache.getCachedBookInfo(
        userId,
        asin,
        title,
        'asin',
      );
      console.log(
        `  ASIN cache: exists=${asinCache.exists}, edition_id=${asinCache.edition_id}`,
      );

      if (asinCache.exists) {
        const asinProgressChanged = await bookCache.hasProgressChanged(
          userId,
          asin,
          title,
          currentProgress,
          'asin',
        );
        console.log(`  ASIN progress changed: ${asinProgressChanged}`);

        if (asinProgressChanged) {
          console.log(
            `  ✅ ASIN cache found BUT progress changed → would proceed to matching`,
          );
        }
      }

      // Test title/author cache lookup
      const titleAuthorCache = await bookCache.getCachedBookInfo(
        userId,
        titleAuthorId,
        title,
        'title_author',
      );
      console.log(
        `  Title/author cache: exists=${titleAuthorCache.exists}, edition_id=${titleAuthorCache.edition_id}`,
      );

      if (titleAuthorCache.exists && !titleAuthorCache.edition_id) {
        console.log(
          `  ❌ PROBLEM: Title/author cache is incomplete (edition_id: null)`,
        );
        console.log(
          `     TitleAuthorMatcher will reject this and trigger search!`,
        );
      }

      // Test comprehensive cache lookup
      console.log('\n🔄 Comprehensive cache lookup test:');

      const allPossibleKeys = [
        { key: asin, type: 'asin' },
        { key: isbn, type: 'isbn' },
        { key: titleAuthorId, type: 'title_author' },
      ];

      let foundValidCache = false;
      for (const { key, type } of allPossibleKeys) {
        const cache = await bookCache.getCachedBookInfo(
          userId,
          key,
          title,
          type,
        );
        console.log(
          `  ${type} (${key}): exists=${cache.exists}, edition_id=${cache.edition_id || 'null'}`,
        );

        if (cache.exists && cache.edition_id) {
          foundValidCache = true;
          console.log(`    ✅ Valid cache entry found`);

          const progressChanged = await bookCache.hasProgressChanged(
            userId,
            key,
            title,
            currentProgress,
            type,
          );
          console.log(`    Progress changed: ${progressChanged}`);

          if (!progressChanged) {
            console.log(`    🎉 Would skip matching entirely`);
          } else {
            console.log(
              `    ➡️  Would proceed with matching (progress changed)`,
            );
          }
        } else if (cache.exists) {
          console.log(`    ⚠️  Incomplete cache entry (missing edition_id)`);
        }
      }

      if (!foundValidCache) {
        console.log(`\n❌ NO VALID CACHE ENTRIES FOUND`);
        console.log(`   This explains why title/author search is triggered!`);
        console.log(`   The optimization can't work without valid cache data.`);
      }

      console.log('\n💡 DIAGNOSIS RESULTS:');
      console.log('  - ASIN cache exists but may have progress changes');
      console.log('  - Title/author cache is incomplete (edition_id: null)');
      console.log('  - BookMatcher falls back to title/author search');
      console.log('  - Need to fix incomplete cache entries');
    } finally {
      await bookCache.clearCache();
      bookCache.close();
    }
  });

  it('should demonstrate the cache repair needed', async () => {
    console.log('\n🔧 CACHE REPAIR STRATEGY\n');

    console.log('🚨 Current state (from logs):');
    console.log('  - ASIN cache: Complete but progress changes frequently');
    console.log('  - Title/author cache: Incomplete (edition_id: null)');
    console.log('  - Result: TitleAuthorMatcher rejects own cache → searches');

    console.log('\n💡 Solutions needed:');
    console.log('  1. Fix incomplete title/author cache entries');
    console.log('  2. Ensure edition_id is stored properly');
    console.log('  3. Handle cache inconsistencies gracefully');
    console.log('  4. Consider cache migration for existing entries');

    console.log('\n🎯 Expected outcome:');
    console.log('  - Title/author cache becomes complete');
    console.log('  - TitleAuthorMatcher uses its own cache');
    console.log('  - No more searches for known books');
  });
});
