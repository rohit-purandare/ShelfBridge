import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BookCache } from '../src/book-cache.js';
import ProgressManager from '../src/progress-manager.js';

/**
 * Debug Mixed Identifier Scenarios
 *
 * This tests scenarios where books might have both identifiers AND
 * title/author cache entries, or other edge cases that could bypass optimization.
 */

describe('Debug Mixed Identifier Scenarios', () => {
  it('should handle books that gain identifiers after being matched by title/author', async () => {
    const bookCache = new BookCache();
    await bookCache.init();

    try {
      const userId = 'mixed-scenario-user';
      const title = 'Book That Gained ISBN';
      const author = 'Evolving Author';

      console.log('\n🔍 TESTING MIXED IDENTIFIER SCENARIOS\n');

      // === Scenario 1: Book originally matched by title/author (no identifiers) ===
      console.log('📚 SCENARIO 1: Book originally cached via title/author');

      const titleAuthorId = bookCache.generateTitleAuthorIdentifier(
        title,
        author,
      );
      await bookCache.storeBookSyncData(
        userId,
        titleAuthorId,
        title,
        'mixed-edition-123',
        'title_author',
        author,
        45.0,
        Date.now() - 86400000, // Yesterday
        Date.now() - 172800000, // Started 2 days ago
      );

      console.log(`  Cached with title/author ID: ${titleAuthorId}`);

      // === Scenario 2: Same book later gains ISBN metadata ===
      console.log('\n📚 SCENARIO 2: Book metadata updated with ISBN');

      const isbn = '9781234567890';
      console.log(`  Book now has ISBN: ${isbn}`);

      // Simulate updated book object with identifiers
      const absBookWithISBN = {
        id: 'mixed-book-test',
        progress_percentage: 45.0, // Same progress
        is_finished: false,
        media: {
          metadata: {
            title: title,
            authors: [{ name: author }],
            isbn: isbn, // NOW has ISBN
          },
        },
      };

      // === Scenario 3: Test early optimization with identifiers present ===
      console.log('\n📚 SCENARIO 3: Early optimization with identifiers');

      const identifiers = {
        isbn: isbn,
        asin: null,
      };

      console.log(`  Identifiers: ${JSON.stringify(identifiers)}`);
      console.log(
        `  Has identifiers: ${!!(identifiers.isbn || identifiers.asin)}`,
      );

      // The current logic only checks title/author cache if NO identifiers
      const wouldCheckTitleAuthor = !identifiers.asin && !identifiers.isbn;
      console.log(`  Would check title/author cache: ${wouldCheckTitleAuthor}`);

      if (!wouldCheckTitleAuthor) {
        console.log(
          `  ❌ PROBLEM: Current logic skips title/author cache check!`,
        );
        console.log(
          `      This book has existing title/author cache but optimization won't find it`,
        );

        // Try ISBN cache lookup (will fail since it was cached with title/author)
        const isbnCached = await bookCache.getCachedBookInfo(
          userId,
          isbn,
          title,
          'isbn',
        );

        console.log(`  ISBN cache lookup: ${isbnCached.exists}`);

        if (!isbnCached.exists) {
          console.log(
            `  ❌ ISBN cache miss - would trigger expensive matching`,
          );
          console.log(`     But title/author cache exists and could be used!`);

          // Verify title/author cache still exists
          const titleAuthorCached = await bookCache.getCachedBookInfo(
            userId,
            titleAuthorId,
            title,
            'title_author',
          );

          console.log(
            `  Title/author cache exists: ${titleAuthorCached.exists}`,
          );

          if (titleAuthorCached.exists) {
            console.log(
              `  💡 SOLUTION: Check ALL cache types, not just identifier-based`,
            );
          }
        }
      }

      // === Scenario 4: Test the comprehensive fix ===
      console.log('\n📚 SCENARIO 4: Comprehensive cache lookup test');

      // This simulates checking ALL possible cache keys
      const allPossibleKeys = [];

      // Add identifier-based keys
      if (identifiers.asin) {
        allPossibleKeys.push({ key: identifiers.asin, type: 'asin' });
      }
      if (identifiers.isbn) {
        allPossibleKeys.push({ key: identifiers.isbn, type: 'isbn' });
      }

      // ALWAYS add title/author keys (not just when no identifiers)
      const titleAuthorKey = bookCache.generateTitleAuthorIdentifier(
        title,
        author,
      );
      allPossibleKeys.push({ key: titleAuthorKey, type: 'title_author' });

      console.log(
        `  Checking ALL possible cache keys (${allPossibleKeys.length}):`,
      );

      let foundCache = false;
      for (const { key, type } of allPossibleKeys) {
        const cached = await bookCache.getCachedBookInfo(
          userId,
          key,
          title,
          type,
        );
        console.log(`    ${type} (${key}): exists=${cached.exists}`);

        if (cached.exists && cached.edition_id) {
          foundCache = true;
          console.log(`    ✅ FOUND complete cache entry with ${type}`);

          // Test progress detection
          const progressChanged = await bookCache.hasProgressChanged(
            userId,
            key,
            title,
            45.0, // Same progress
            type,
          );

          if (!progressChanged) {
            console.log(
              `    ✅ Progress unchanged - would skip expensive matching!`,
            );
            break;
          }
        }
      }

      assert.strictEqual(
        foundCache,
        true,
        'Should find cache entry with comprehensive lookup',
      );

      console.log('\n🎯 COMPREHENSIVE LOOKUP BENEFITS:');
      console.log('  ✅ Finds books cached with any identifier type');
      console.log('  ✅ Handles books that gain/lose identifiers over time');
      console.log('  ✅ Maximizes cache optimization coverage');
    } finally {
      await bookCache.clearCache();
      bookCache.close();
    }
  });

  it('should check if force_sync or other config bypasses optimization', () => {
    console.log('\n🔍 CHECKING OPTIMIZATION BYPASS CONDITIONS\n');

    const scenarios = [
      {
        name: 'Normal operation',
        config: { force_sync: false },
        progressValid: true,
        shouldOptimize: true,
      },
      {
        name: 'Force sync enabled',
        config: { force_sync: true },
        progressValid: true,
        shouldOptimize: false,
      },
      {
        name: 'Invalid progress data',
        config: { force_sync: false },
        progressValid: false,
        shouldOptimize: false,
      },
    ];

    scenarios.forEach(scenario => {
      console.log(`📚 ${scenario.name}:`);
      console.log(`  Config: ${JSON.stringify(scenario.config)}`);
      console.log(`  Progress valid: ${scenario.progressValid}`);

      // Simulate the conditions from sync-manager.js
      const wouldOptimize =
        !scenario.config.force_sync && scenario.progressValid;

      console.log(`  Would run optimization: ${wouldOptimize}`);
      console.log(`  Expected: ${scenario.shouldOptimize}`);

      assert.strictEqual(
        wouldOptimize,
        scenario.shouldOptimize,
        `${scenario.name} should ${scenario.shouldOptimize ? 'optimize' : 'skip optimization'}`,
      );

      if (!wouldOptimize && scenario.name !== 'Invalid progress data') {
        console.log(
          `  ⚠️  This scenario would bypass optimization and could trigger searches`,
        );
      } else {
        console.log(`  ✅ Behaves correctly`);
      }

      console.log('');
    });

    console.log(
      '💡 KEY INSIGHT: Check if force_sync is accidentally enabled in config',
    );
  });
});
