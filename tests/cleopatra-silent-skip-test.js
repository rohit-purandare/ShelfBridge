import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SyncManager } from '../src/sync-manager.js';
import logger from '../src/logger.js';

/**
 * Test the exact "Cleopatra and Frankenstein" silent skip scenario
 *
 * Based on the logs:
 * 1. Progress change detected (18.86% -> 20.83%)
 * 2. Cache optimization triggered ("using cached edition (asin)")
 * 3. Processing started
 * 4. Book silently disappears from logs
 * 5. Marked as skipped in final summary
 */

const mockUser = {
  id: 'rpurandare',
  abs_url: 'http://test.com',
  abs_token: 'token',
  hardcover_token: 'hc',
};

const mockConfig = {
  workers: 3,
  parallel: true,
  auto_add_books: true, // Enabled in user's config
  force_sync: false,
};

test('Cleopatra and Frankenstein Silent Skip Bug', async t => {
  await t.test(
    'Should NOT silently skip cache-optimized books with progress changes',
    async () => {
      const syncManager = new SyncManager(mockUser, mockConfig, false, false);

      // Track what happens to the book
      let wasSkipped = false;
      let wasProcessed = false;
      let actualUserBookIdLookupAttempted = false;

      // Mock cache exactly like the user's scenario
      syncManager.cache = {
        generateTitleAuthorIdentifier: () =>
          'cleopatraandfrankenstein:cocochen',
        getCachedBookInfo: async (
          userId,
          identifier,
          title,
          identifierType,
        ) => {
          if (
            identifierType === 'asin' &&
            title === 'Cleopatra and Frankenstein'
          ) {
            return {
              exists: true,
              edition_id: 'cached-edition-cleopatra', // Has cached edition
              progress_percent: 18.85966697756357, // Old progress from logs
              author: 'Coco Chen',
              last_sync: '2025-09-12T03:02:10.711Z',
            };
          }
          return { exists: false };
        },
        hasProgressChanged: async (userId, identifier, title, progress) => {
          if (title === 'Cleopatra and Frankenstein') {
            return progress !== 18.85966697756357; // Should detect change for 20.829%
          }
          return false;
        },
      };

      // Mock bookMatcher with lookup function
      syncManager.bookMatcher = {
        findMatch: async () => {
          // This should NOT be called for cache-optimized books
          throw new Error('Expensive matching called for cache-optimized book');
        },

        findUserBookByEditionId: editionId => {
          actualUserBookIdLookupAttempted = true;
          if (editionId === 'cached-edition-cleopatra') {
            return {
              id: 'user-book-cleopatra-123', // Found in user's library
              book: {
                id: 'book-cleopatra-456',
                title: 'Cleopatra and Frankenstein',
              },
            };
          }
          return null;
        },
      };

      // Mock hardcover client
      syncManager.hardcover = {
        updateBookProgress: async (userBookId, editionId, progress) => {
          wasProcessed = true;
          assert.strictEqual(
            userBookId,
            'user-book-cleopatra-123',
            'Should use correct userBookId',
          );
          return { success: true };
        },
      };

      // Recreate the exact book from logs
      const cleopatraBook = {
        id: 'cleopatra-test-id',
        media: {
          metadata: {
            title: 'Cleopatra and Frankenstein',
            authors: [{ name: 'Coco Chen' }],
            asin: 'B09RQ3RD3K', // From logs
            isbn: '9781635578362', // From logs
          },
        },
        progress: 0.20829123773605563, // New progress from logs (20.829%)
        isFinished: false,
      };

      // Track logs to see what happens
      const logs = [];
      const originalDebug = logger.debug;
      const originalError = logger.error;

      logger.debug = (msg, data) => {
        logs.push({ level: 'debug', msg, data });
        originalDebug(msg, data);
      };

      logger.error = (msg, data) => {
        logs.push({ level: 'error', msg, data });
        originalError(msg, data);
      };

      try {
        const result = await syncManager._syncSingleBook(cleopatraBook, null);

        // Verify the fix worked
        assert.ok(
          actualUserBookIdLookupAttempted,
          'Should attempt to lookup actual userBookId',
        );
        assert.notStrictEqual(
          result.status,
          'skipped',
          'Should NOT be silently skipped',
        );

        // Should either process successfully or show clear error
        if (result.status === 'error') {
          assert.ok(result.reason, 'Should have clear error reason');
          console.log(
            `✅ Clear error instead of silent skip: ${result.reason}`,
          );
        } else {
          assert.ok(wasProcessed, 'Should process the book successfully');
          console.log('✅ Book processed successfully instead of silent skip');
        }

        // Log analysis
        const cacheOptimizationLogs = logs.filter(l =>
          l.msg.includes('using cached edition'),
        );
        const userBookLookupLogs = logs.filter(l =>
          l.msg.includes('looking up actual userBookId'),
        );

        console.log(
          `✅ Cache optimization triggered: ${cacheOptimizationLogs.length > 0}`,
        );
        console.log(
          `✅ UserBookId lookup attempted: ${userBookLookupLogs.length > 0}`,
        );
        console.log(`✅ Final status: ${result.status} (not silent skip)`);
      } finally {
        logger.debug = originalDebug;
        logger.error = originalError;
      }
    },
  );

  await t.test(
    'Should handle case where cached edition not in current library',
    async () => {
      const syncManager = new SyncManager(mockUser, mockConfig, false, false);

      syncManager.cache = {
        generateTitleAuthorIdentifier: () => 'staletest:author',
        getCachedBookInfo: async () => ({
          exists: true,
          edition_id: 'stale-edition-999', // Cached but not in current library
          progress_percent: 50.0,
          author: 'Test Author',
        }),
        hasProgressChanged: async () => true,
      };

      syncManager.bookMatcher = {
        findUserBookByEditionId: editionId => {
          // Simulate stale cache - edition not found in current library
          return null;
        },
      };

      const staleBook = {
        id: 'stale-test',
        media: {
          metadata: {
            title: 'Stale Cache Book',
            authors: [{ name: 'Test Author' }],
            asin: 'B0STALE123',
          },
        },
        progress: 0.75,
        isFinished: false,
      };

      const result = await syncManager._syncSingleBook(staleBook, null);

      // Should return clear error instead of silent skip
      assert.strictEqual(
        result.status,
        'error',
        'Should return error for stale cache',
      );
      assert.ok(
        result.reason.includes('library data may be stale'),
        'Should explain stale cache issue',
      );

      console.log('✅ Stale cache handled with clear error message');
    },
  );

  console.log('\n🎯 Silent skip bug should now be fixed!');
  console.log(
    '   Next sync should show clear logs for Cleopatra and Frankenstein',
  );
  console.log('   - Either successful processing with userBookId lookup');
  console.log('   - Or clear error message explaining the issue');
  console.log('   - No more silent disappearing from logs');
});
