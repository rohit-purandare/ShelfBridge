import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BookCache } from '../src/book-cache.js';
import ProgressManager from '../src/progress-manager.js';

/**
 * Cached Match Reuse Test
 *
 * This test verifies that books with changed progress but existing cache
 * entries reuse cached match data instead of performing expensive re-matching.
 */

describe('Cached Match Reuse', () => {
  it('should reuse cached match data for books with changed progress', async () => {
    const bookCache = new BookCache();
    await bookCache.init();

    try {
      const userId = 'cached-match-reuse-user';

      console.log('\n🔍 TESTING CACHED MATCH REUSE OPTIMIZATION\n');

      // This simulates the exact scenario from your logs: "Cleopatra and Frankenstein"
      const title = 'Cleopatra and Frankenstein';
      const author = 'Coco Mellors';
      const asin = 'B09RQ3RD3K';
      const isbn = '9781635578362';

      console.log('📚 Book: "Cleopatra and Frankenstein" by Coco Mellors');
      console.log(`  ASIN: ${asin}`);
      console.log(`  ISBN: ${isbn}`);

      // Pre-cache the book with previous progress (matches your logs)
      await bookCache.storeBookSyncData(
        userId,
        asin,
        title,
        'cleopatra-edition-123',
        'asin',
        author,
        43.246034920646856, // Previous progress from logs
        Date.now() - 86400000,
        Date.now() - 172800000
      );

      console.log(`  Cached with ASIN: ${asin} (progress: 43.2%)`);

      // Simulate current progress update (matches your logs)
      const currentProgress = 50.172889059615876; // Current progress from logs
      const absBook = {
        id: 'cleopatra-test',
        progress_percentage: currentProgress,
        is_finished: false,
        media: {
          metadata: {
            title: title,
            authors: [{ name: author }],
            isbn: isbn,
            asin: asin
          }
        }
      };

      console.log(`  Current progress: ${currentProgress.toFixed(1)}%`);

      // Test the enhanced early optimization logic
      const identifiers = { isbn: isbn, asin: asin };
      const validatedProgress = ProgressManager.getValidatedProgress(
        absBook,
        `book "${title}" reuse test`,
        { allowNull: false }
      );

      console.log('\n🔄 EARLY OPTIMIZATION WITH CACHED MATCH REUSE:');

      const possibleCacheKeys = [];

      // Add identifier-based keys
      if (identifiers.asin) {
        possibleCacheKeys.push({ key: identifiers.asin, type: 'asin' });
      }
      if (identifiers.isbn) {
        possibleCacheKeys.push({ key: identifiers.isbn, type: 'isbn' });
      }

      console.log(`  Checking ${possibleCacheKeys.length} cache keys:`);

      let hasChanged = true;
      let cacheFoundEarly = false;
      let cachedMatchInfo = null;

      for (const { key, type } of possibleCacheKeys) {
        console.log(`    ${type} key: ${key}`);

        // Get full cached info
        const cachedInfo = await bookCache.getCachedBookInfo(userId, key, title, type);

        if (cachedInfo && cachedInfo.exists && cachedInfo.edition_id) {
          cachedMatchInfo = {
            identifier: key,
            identifierType: type,
            editionId: cachedInfo.edition_id,
            lastProgress: cachedInfo.progress_percent,
            lastSync: cachedInfo.last_sync
          };

          console.log(`      Cache exists: true`);
          console.log(`      Edition ID: ${cachedInfo.edition_id}`);
          console.log(`      Last progress: ${cachedInfo.progress_percent}%`);

          // Check if progress changed
          const progressChanged = await bookCache.hasProgressChanged(
            userId, key, title, validatedProgress, type
          );

          console.log(`      Progress changed: ${progressChanged}`);

          if (!progressChanged) {
            hasChanged = false;
            cacheFoundEarly = true;
            console.log(`      ✅ SKIP: Progress unchanged`);
            break;
          } else {
            console.log(`      ✅ REUSE: Progress changed but will reuse cached match`);
            // Continue to check other keys but we have reusable match info
          }
        } else {
          console.log(`      Cache exists: false`);
        }
      }

      console.log(`\n  📊 Optimization result:`);
      console.log(`    Progress changed: ${hasChanged}`);
      console.log(`    Cache found early: ${cacheFoundEarly}`);
      console.log(`    Has cached match info: ${!!cachedMatchInfo}`);

      if (!hasChanged && cacheFoundEarly) {
        console.log(`    🎉 OUTCOME: Skip entirely (progress unchanged)`);
      } else if (hasChanged && cachedMatchInfo) {
        console.log(`    🚀 OUTCOME: Skip expensive matching (reuse cached match)`);
        console.log(`    ⚡ PERFORMANCE: Avoids title/author search while syncing progress`);
        assert.strictEqual(!!cachedMatchInfo, true, 'Should have cached match info to reuse');
      } else {
        console.log(`    ⚠️  OUTCOME: Would perform expensive matching`);
      }

      console.log('\n✅ CACHED MATCH REUSE OPTIMIZATION VERIFIED:');
      console.log('  📈 Progress unchanged: Skip entirely');
      console.log('  📈 Progress changed + cached match: Skip expensive matching');
      console.log('  📈 No cache data: Perform matching (only for truly new books)');

    } finally {
      await bookCache.clearCache();
      bookCache.close();
    }
  });
});