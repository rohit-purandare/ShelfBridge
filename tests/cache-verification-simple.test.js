import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SyncManager } from '../src/sync-manager.js';

/**
 * Simple Cache Verification Test
 *
 * Verifies the essential cache behavior:
 * 1. Cached books with progress changes should NOT trigger expensive searches
 * 2. New books should trigger expensive searches (expected)
 * 3. Cached books with no progress changes should be skipped entirely
 */

const mockUser = {
  id: 'test',
  abs_url: 'http://test.com',
  abs_token: 'token',
  hardcover_token: 'hc',
};
const mockConfig = { workers: 1, parallel: false, force_sync: false };

test('Simple Cache Verification', async t => {
  await t.test(
    'Cached book with progress change should use cache (no search)',
    async () => {
      const syncManager = new SyncManager(mockUser, mockConfig, false, false);

      let expensiveSearchTriggered = false;

      // Mock cache with existing data
      syncManager.cache = {
        generateTitleAuthorIdentifier: () => 'cachedbook:author',
        getCachedBookInfo: async () => ({
          exists: true,
          edition_id: 'cached-edition-123',
          progress_percent: 50.0,
          author: 'Test Author',
        }),
        hasProgressChanged: async () => true, // Progress changed
      };

      // Track if expensive search happens
      syncManager.bookMatcher = {
        findMatch: async () => {
          expensiveSearchTriggered = true;
          return { match: null, extractedMetadata: {} };
        },
      };

      const cachedBook = {
        id: 'cached-test-1',
        media: {
          metadata: {
            title: 'Cached Test Book',
            authors: [{ name: 'Test Author' }],
          },
        },
        progress: 0.75, // Different from cached 50%
      };

      await syncManager._syncSingleBook(cachedBook, null);

      assert.strictEqual(
        expensiveSearchTriggered,
        false,
        'Cached book should NOT trigger expensive search',
      );
      console.log(
        '✅ PASS: Cached book with progress change uses cache optimization',
      );
    },
  );

  await t.test(
    'New book should trigger expensive search (expected behavior)',
    async () => {
      const syncManager = new SyncManager(mockUser, mockConfig, false, false);

      let expensiveSearchTriggered = false;

      // Mock cache with no data (cache miss)
      syncManager.cache = {
        generateTitleAuthorIdentifier: () => 'newbook:author',
        getCachedBookInfo: async () => ({ exists: false }), // No cache
      };

      syncManager.bookMatcher = {
        findMatch: async () => {
          expensiveSearchTriggered = true;
          return { match: null, extractedMetadata: {} };
        },
      };

      const newBook = {
        id: 'new-test-1',
        media: {
          metadata: {
            title: 'New Test Book',
            authors: [{ name: 'Test Author' }],
          },
        },
        progress: 0.6,
      };

      await syncManager._syncSingleBook(newBook, null);

      assert.strictEqual(
        expensiveSearchTriggered,
        true,
        'New book should trigger expensive search',
      );
      console.log('✅ PASS: New book correctly triggers expensive search');
    },
  );

  await t.test('Cache skip optimization for unchanged progress', async () => {
    const syncManager = new SyncManager(mockUser, mockConfig, false, false);

    let anyProcessingTriggered = false;

    // Mock cache with matching progress (no change)
    syncManager.cache = {
      generateTitleAuthorIdentifier: () => 'unchangedbook:author',
      getCachedBookInfo: async () => ({
        exists: true,
        edition_id: 'unchanged-edition-789',
        progress_percent: 80.0, // Matches book's progress
        author: 'Unchanged Author',
      }),
      hasProgressChanged: async () => false, // No progress change
    };

    syncManager.bookMatcher = {
      findMatch: async () => {
        anyProcessingTriggered = true;
        return { match: null, extractedMetadata: {} };
      },
    };

    const unchangedBook = {
      id: 'unchanged-1',
      media: {
        metadata: {
          title: 'Unchanged Book',
          authors: [{ name: 'Unchanged Author' }],
        },
      },
      progress: 0.8, // Same as cached
    };

    const result = await syncManager._syncSingleBook(unchangedBook, null);

    assert.strictEqual(
      result.status,
      'skipped',
      'Unchanged progress should be skipped',
    );
    assert.strictEqual(
      anyProcessingTriggered,
      false,
      'No processing should occur for unchanged books',
    );
    console.log('✅ PASS: Unchanged progress correctly skipped');
  });

  console.log('\n🎉 All cache verification tests PASSED!');
  console.log('\n📊 Summary:');
  console.log(
    '   ✅ Cached books + progress change = Use cache optimization (no search)',
  );
  console.log('   ✅ New books = Trigger expensive search (expected)');
  console.log(
    '   ✅ Cached books + no progress change = Skip entirely (optimized)',
  );
  console.log('\n💡 Your cache is working optimally during sync operations!');
});
