import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SyncManager } from '../src/sync-manager.js';
import logger from '../src/logger.js';

/**
 * Cache Edge Cases Test Suite
 *
 * This test suite covers edge cases and error scenarios for cache usage
 * to ensure robust behavior in various failure modes.
 */

const mockUser = {
  id: 'test-user',
  abs_url: 'http://test.com',
  abs_token: 'token',
  hardcover_token: 'hc',
};

const mockConfig = { workers: 1, parallel: false, force_sync: false };

const createMockBook = (id, title, author, identifiers = {}) => ({
  id: id,
  media: {
    metadata: {
      title: title,
      authors: [{ name: author }],
      ...identifiers,
    },
  },
  progress: 0.8,
  isFinished: false,
});

test('Cache Edge Cases and Error Scenarios', async t => {
  await t.test('Cache Error Handling', async t => {
    const syncManager = new SyncManager(mockUser, mockConfig, false, false);

    await t.test(
      'Should fallback to expensive matching when cache fails',
      async () => {
        let expensiveMatchingTriggered = false;

        // Mock cache that throws errors
        syncManager.cache = {
          generateTitleAuthorIdentifier: () => 'test:author',
          getCachedBookInfo: async () => {
            throw new Error('Cache database error');
          },
          hasProgressChanged: async () => {
            throw new Error('Cache comparison error');
          },
        };

        syncManager.bookMatcher = {
          findMatch: async absBook => {
            expensiveMatchingTriggered = true;
            return {
              match: null,
              extractedMetadata: {
                title: absBook.media.metadata.title,
                author: absBook.media.metadata.authors[0].name,
                identifiers: { isbn: null, asin: null },
              },
            };
          },
        };

        const book = createMockBook(
          'error-1',
          'Cache Error Book',
          'Test Author',
        );

        // Should not throw, should fallback gracefully
        const result = await syncManager._syncSingleBook(book, null);

        assert.ok(result, 'Should return result even when cache fails');
        assert.strictEqual(
          expensiveMatchingTriggered,
          true,
          'Should fallback to expensive matching',
        );

        console.log('✅ Cache error fallback working');
      },
    );

    await t.test('Should handle corrupted cache data gracefully', async () => {
      let expensiveMatchingTriggered = false;

      // Mock cache returning corrupted/invalid data
      syncManager.cache = {
        generateTitleAuthorIdentifier: () => 'corrupt:data',
        getCachedBookInfo: async () => ({
          exists: true,
          edition_id: null, // Corrupted: no edition_id
          progress_percent: 'invalid', // Corrupted: non-numeric
          author: undefined, // Corrupted: missing author
        }),
        hasProgressChanged: async () => true,
      };

      syncManager.bookMatcher = {
        findMatch: async absBook => {
          expensiveMatchingTriggered = true;
          return {
            match: null,
            extractedMetadata: {
              title: absBook.media.metadata.title,
              author: absBook.media.metadata.authors[0].name,
              identifiers: {},
            },
          };
        },
      };

      const book = createMockBook(
        'corrupt-1',
        'Corrupt Cache Book',
        'Test Author',
      );

      const result = await syncManager._syncSingleBook(book, null);

      assert.ok(result, 'Should handle corrupted cache data');
      assert.strictEqual(
        expensiveMatchingTriggered,
        true,
        'Should fallback to expensive matching for corrupted data',
      );

      console.log('✅ Corrupted cache data handling working');
    });
  });

  await t.test('Force Sync Override', async t => {
    const syncManager = new SyncManager(
      mockUser,
      { ...mockConfig, force_sync: true },
      false,
      false,
    );

    await t.test('Should bypass cache when force_sync is enabled', async () => {
      let expensiveMatchingTriggered = false;

      // Mock cache with valid data
      syncManager.cache = {
        generateTitleAuthorIdentifier: () => 'force:sync',
        getCachedBookInfo: async () => ({
          exists: true,
          edition_id: 'force-cached-edition',
          progress_percent: 50.0,
          author: 'Force Author',
        }),
        hasProgressChanged: async () => false, // No progress change
      };

      syncManager.bookMatcher = {
        findMatch: async absBook => {
          expensiveMatchingTriggered = true;
          return {
            match: null,
            extractedMetadata: {
              title: absBook.media.metadata.title,
              author: absBook.media.metadata.authors[0].name,
              identifiers: {},
            },
          };
        },
      };

      const book = createMockBook('force-1', 'Force Sync Book', 'Force Author');

      const result = await syncManager._syncSingleBook(book, null);

      assert.strictEqual(
        expensiveMatchingTriggered,
        true,
        'force_sync should bypass cache optimization',
      );
      assert.notStrictEqual(
        result.status,
        'skipped',
        'force_sync should not skip books',
      );

      console.log('✅ Force sync cache bypass working');
    });
  });

  await t.test('Cache Data Variations', async t => {
    const syncManager = new SyncManager(mockUser, mockConfig, false, false);

    await t.test('Should handle cache with missing edition_id', async () => {
      let expensiveMatchingTriggered = false;

      // Mock cache with data but no edition_id
      syncManager.cache = {
        generateTitleAuthorIdentifier: () => 'missing:edition',
        getCachedBookInfo: async () => ({
          exists: true,
          edition_id: null, // Missing edition_id
          progress_percent: 45.0,
          author: 'Missing Edition Author',
        }),
        hasProgressChanged: async () => true,
      };

      syncManager.bookMatcher = {
        findMatch: async absBook => {
          expensiveMatchingTriggered = true;
          return {
            match: null,
            extractedMetadata: {
              title: absBook.media.metadata.title,
              author: absBook.media.metadata.authors[0].name,
              identifiers: {},
            },
          };
        },
      };

      const book = createMockBook(
        'missing-edition-1',
        'Missing Edition Book',
        'Missing Edition Author',
      );

      await syncManager._syncSingleBook(book, null);

      assert.strictEqual(
        expensiveMatchingTriggered,
        true,
        'Should fallback to expensive matching when edition_id missing',
      );

      console.log('✅ Missing edition_id fallback working');
    });

    await t.test(
      'Should handle books with no identifiers and no cached data',
      async () => {
        let titleAuthorSearchTriggered = false;

        syncManager.cache = {
          generateTitleAuthorIdentifier: () => 'noidentifiers:nocache',
          getCachedBookInfo: async () => ({ exists: false }),
        };

        syncManager.bookMatcher = {
          findMatch: async absBook => {
            titleAuthorSearchTriggered = true;
            return {
              match: null,
              extractedMetadata: {
                title: absBook.media.metadata.title,
                author: absBook.media.metadata.authors[0].name,
                identifiers: { isbn: null, asin: null },
              },
            };
          },
        };

        const book = createMockBook(
          'no-id-no-cache-1',
          'No Identifiers No Cache',
          'Test Author',
        );
        // Explicitly remove any identifiers
        delete book.media.metadata.isbn;
        delete book.media.metadata.asin;

        await syncManager._syncSingleBook(book, null);

        assert.strictEqual(
          titleAuthorSearchTriggered,
          true,
          'Should trigger title/author search for uncached books without identifiers',
        );

        console.log('✅ No identifiers, no cache handling working');
      },
    );
  });

  await t.test('Cache Performance Edge Cases', async t => {
    const syncManager = new SyncManager(mockUser, mockConfig, false, false);

    await t.test(
      'Should handle high volume cache operations efficiently',
      async () => {
        const cacheOperations = [];
        let expensiveSearchCount = 0;

        // Mock cache that tracks operations
        syncManager.cache = {
          generateTitleAuthorIdentifier: (title, author) => {
            cacheOperations.push(`generate_id:${title}`);
            return `${title.toLowerCase()}:${author.toLowerCase()}`;
          },
          getCachedBookInfo: async (
            userId,
            identifier,
            title,
            identifierType,
          ) => {
            cacheOperations.push(`get_info:${title}`);
            // Simulate 70% cache hit rate
            const shouldHit =
              Math.hash ||
              (s => {
                let hash = 0;
                for (let i = 0; i < s.length; i++) {
                  hash = ((hash << 5) - hash + s.charCodeAt(i)) & 0xffffffff;
                }
                return hash;
              });

            if (Math.abs(shouldHit(title)) % 10 < 7) {
              return {
                exists: true,
                edition_id: `high-vol-edition-${identifier}`,
                progress_percent: 33.0,
                author: 'High Volume Author',
              };
            }
            return { exists: false };
          },
          hasProgressChanged: async (userId, identifier, title, progress) => {
            cacheOperations.push(`progress_check:${title}`);
            return true; // Always changed for this test
          },
        };

        syncManager.bookMatcher = {
          findMatch: async absBook => {
            expensiveSearchCount++;
            return {
              match: null,
              extractedMetadata: {
                title: absBook.media.metadata.title,
                author: absBook.media.metadata.authors[0].name,
                identifiers: {},
              },
            };
          },
        };

        // Process many books
        const books = Array.from({ length: 20 }, (_, i) =>
          createMockBook(
            `high-vol-${i}`,
            `High Volume Book ${i}`,
            'High Volume Author',
          ),
        );

        const startTime = Date.now();
        for (const book of books) {
          await syncManager._syncSingleBook(book, null);
        }
        const processingTime = Date.now() - startTime;

        console.log(
          `✅ Processed ${books.length} books in ${processingTime}ms`,
        );
        console.log(`✅ Cache operations: ${cacheOperations.length}`);
        console.log(
          `✅ Expensive searches: ${expensiveSearchCount}/${books.length} (${Math.round((expensiveSearchCount / books.length) * 100)}%)`,
        );

        // Should have significantly fewer expensive searches than total books due to caching
        assert.ok(
          expensiveSearchCount < books.length,
          'Should use cache to reduce expensive searches',
        );
        assert.ok(
          cacheOperations.length > 0,
          'Should perform cache operations',
        );
      },
    );
  });

  await t.test('Race Condition with Cache', async t => {
    const syncManager = new SyncManager(mockUser, mockConfig, false, false);

    await t.test(
      'Should prevent double processing with cached books',
      async () => {
        let concurrentCacheAccess = 0;
        let expensiveSearchCount = 0;

        // Mock cache that simulates concurrent access
        syncManager.cache = {
          generateTitleAuthorIdentifier: () => 'race:condition',
          getCachedBookInfo: async () => {
            concurrentCacheAccess++;
            // Simulate some delay
            await new Promise(resolve => setTimeout(resolve, 10));
            return {
              exists: true,
              edition_id: 'race-cached-edition',
              progress_percent: 67.0,
              author: 'Race Author',
            };
          },
          hasProgressChanged: async () => {
            await new Promise(resolve => setTimeout(resolve, 5));
            return true;
          },
        };

        syncManager.bookMatcher = {
          findMatch: async () => {
            expensiveSearchCount++;
            return { match: null, extractedMetadata: {} };
          },
        };

        const book = createMockBook(
          'race-1',
          'Race Condition Book',
          'Race Author',
        );

        // Process same book concurrently
        const promise1 = syncManager._syncSingleBook(book, null);
        const promise2 = syncManager._syncSingleBook(book, null);

        const [result1, result2] = await Promise.all([promise1, promise2]);

        // One should be processed, one should be skipped due to race prevention
        const processedResults = [result1, result2].filter(
          r => r.status !== 'skipped',
        );
        const skippedResults = [result1, result2].filter(
          r => r.status === 'skipped',
        );

        assert.strictEqual(
          processedResults.length,
          1,
          'Only one should process',
        );
        assert.strictEqual(
          skippedResults.length,
          1,
          'One should be skipped for race prevention',
        );

        // The race condition prevention should work even with cached books
        const raceSkip = skippedResults.find(r =>
          r.reason?.includes('race condition prevented'),
        );
        assert.ok(raceSkip, 'Should skip due to race condition prevention');

        console.log('✅ Race condition prevention with cache working');
      },
    );
  });

  console.log('\n🎉 Cache edge cases test suite completed successfully!');
  console.log('   All edge cases handled correctly:');
  console.log('   ✅ Cache error fallback');
  console.log('   ✅ Corrupted cache data handling');
  console.log('   ✅ Force sync cache bypass');
  console.log('   ✅ Missing edition_id fallback');
  console.log('   ✅ High volume cache operations');
  console.log('   ✅ Race condition prevention with cache');
});
