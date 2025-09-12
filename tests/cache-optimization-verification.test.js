import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SyncManager } from '../src/sync-manager.js';
import logger from '../src/logger.js';

/**
 * Focused Cache Optimization Verification Test
 *
 * This test verifies the core cache optimization functionality:
 * - Cached books with progress changes use cached edition_id (no expensive search)
 * - New books without cache trigger expensive search (expected)
 * - Early skip works for unchanged progress
 */

const mockUser = {
  id: 'cache-test-user',
  abs_url: 'http://test.com',
  abs_token: 'token',
  hardcover_token: 'hc',
};

const mockConfig = { workers: 1, parallel: false, force_sync: false };

test('Cache Optimization Verification', async t => {
  await t.test('Core Cache Optimization Logic', async () => {
    const syncManager = new SyncManager(mockUser, mockConfig, false, false);

    // Track expensive searches
    let expensiveSearchCount = 0;
    const searchedBooks = [];

    // Track cache optimization usage
    const cacheOptimizationLogs = [];
    const originalDebug = logger.debug;
    logger.debug = (msg, data) => {
      if (msg.includes('using cached edition')) {
        cacheOptimizationLogs.push(msg);
      }
      originalDebug(msg, data);
    };

    // Mock cache behavior
    syncManager.cache = {
      generateTitleAuthorIdentifier: (title, author) =>
        `${title.toLowerCase().replace(/\s+/g, '')}:${author.toLowerCase().replace(/\s+/g, '')}`,

      getCachedBookInfo: async (userId, identifier, title, identifierType) => {
        if (title.includes('Cached')) {
          return {
            exists: true,
            edition_id: `cached-${identifierType}-${identifier.slice(-6)}`,
            progress_percent: 40.0,
            author: 'Cached Author',
          };
        }
        return { exists: false };
      },

      hasProgressChanged: async (userId, identifier, title, progress) => {
        // All test books have 75% progress, cached books have 40%, so change = true
        return progress !== 40.0;
      },
    };

    // Mock expensive matching
    syncManager.bookMatcher = {
      findMatch: async absBook => {
        expensiveSearchCount++;
        const title = absBook.media?.metadata?.title || 'Unknown';
        searchedBooks.push(title);

        return {
          match: null,
          extractedMetadata: {
            title: title,
            author: absBook.media?.metadata?.authors?.[0]?.name || 'Unknown',
            identifiers: { isbn: null, asin: null },
          },
        };
      },
    };

    // Test different book scenarios
    const testBooks = [
      // These should use cache optimization (no expensive search)
      {
        book: {
          id: 'test1',
          media: {
            metadata: {
              title: 'Cached Book A',
              authors: [{ name: 'Author A' }],
            },
          },
          progress: 0.75,
        },
        expectExpensive: false,
      },
      {
        book: {
          id: 'test2',
          media: {
            metadata: {
              title: 'Cached Book B',
              authors: [{ name: 'Author B' }],
              isbn: '9781111111111',
            },
          },
          progress: 0.75,
        },
        expectExpensive: false,
      },

      // These should trigger expensive search (no cache)
      {
        book: {
          id: 'test3',
          media: {
            metadata: { title: 'New Book A', authors: [{ name: 'Author A' }] },
          },
          progress: 0.75,
        },
        expectExpensive: true,
      },
      {
        book: {
          id: 'test4',
          media: {
            metadata: { title: 'New Book B', authors: [{ name: 'Author B' }] },
          },
          progress: 0.75,
        },
        expectExpensive: true,
      },
    ];

    const initialExpensiveCount = expensiveSearchCount;

    for (const { book, expectExpensive } of testBooks) {
      const beforeCount = expensiveSearchCount;
      await syncManager._syncSingleBook(book, null);
      const afterCount = expensiveSearchCount;

      const triggeredExpensive = afterCount > beforeCount;

      if (expectExpensive) {
        assert.ok(
          triggeredExpensive,
          `${book.media.metadata.title} should trigger expensive search (no cache)`,
        );
      } else {
        assert.ok(
          !triggeredExpensive,
          `${book.media.metadata.title} should NOT trigger expensive search (use cache)`,
        );
      }
    }

    const totalExpensiveSearches = expensiveSearchCount - initialExpensiveCount;
    const expectedExpensiveSearches = testBooks.filter(
      t => t.expectExpensive,
    ).length;

    assert.strictEqual(
      totalExpensiveSearches,
      expectedExpensiveSearches,
      `Should have ${expectedExpensiveSearches} expensive searches, got ${totalExpensiveSearches}`,
    );

    // Should have cache optimization logs for cached books
    const expectedOptimizations = testBooks.filter(
      t => !t.expectExpensive,
    ).length;
    assert.ok(
      cacheOptimizationLogs.length >= expectedOptimizations,
      `Should have cache optimization logs, got ${cacheOptimizationLogs.length}`,
    );

    logger.debug = originalDebug;

    console.log('✅ Cache optimization working correctly:');
    console.log(
      `   - Cached books: ${testBooks.filter(t => !t.expectExpensive).length}/4 used cache optimization`,
    );
    console.log(
      `   - New books: ${testBooks.filter(t => t.expectExpensive).length}/4 used expensive search`,
    );
    console.log(
      `   - Total expensive searches: ${totalExpensiveSearches}/${testBooks.length} (${Math.round((totalExpensiveSearches / testBooks.length) * 100)}%)`,
    );
  });

  await t.test('Progress Change Detection Accuracy', async () => {
    const syncManager = new SyncManager(mockUser, mockConfig, false, false);

    let skipCount = 0;
    let processCount = 0;

    syncManager.cache = {
      generateTitleAuthorIdentifier: () => 'progress:test',
      getCachedBookInfo: async () => ({
        exists: true,
        edition_id: 'progress-test-edition',
        progress_percent: 50.0, // Base progress
        author: 'Progress Author',
      }),
      hasProgressChanged: async (userId, identifier, title, progress) => {
        // Only trigger change for progress significantly different from 50%
        return Math.abs(progress - 50.0) > 5.0;
      },
    };

    syncManager.bookMatcher = {
      findMatch: async () => ({ match: null, extractedMetadata: {} }),
    };

    // Test books with different progress levels
    const progressTests = [
      { progress: 0.5, shouldSkip: true }, // Same as cached (50%) - should skip
      { progress: 0.52, shouldSkip: true }, // Close to cached (52%) - should skip
      { progress: 0.75, shouldSkip: false }, // Different from cached (75%) - should process
      { progress: 0.25, shouldSkip: false }, // Different from cached (25%) - should process
    ];

    for (const { progress, shouldSkip } of progressTests) {
      const book = {
        id: `progress-${progress}`,
        media: {
          metadata: {
            title: `Progress ${progress} Book`,
            authors: [{ name: 'Progress Author' }],
          },
        },
        progress: progress,
        isFinished: false,
      };

      const result = await syncManager._syncSingleBook(book, null);

      if (shouldSkip) {
        assert.strictEqual(
          result.status,
          'skipped',
          `${progress * 100}% progress should be skipped`,
        );
        skipCount++;
      } else {
        assert.notStrictEqual(
          result.status,
          'skipped',
          `${progress * 100}% progress should be processed`,
        );
        processCount++;
      }
    }

    console.log(
      `✅ Progress detection accuracy: ${skipCount} skipped, ${processCount} processed`,
    );
  });

  console.log('\n🎯 Cache optimization test suite PASSED!');
  console.log('   Your cache is being used properly during sync operations.');
  console.log('   Expensive searches are minimized for cached books.');
});
