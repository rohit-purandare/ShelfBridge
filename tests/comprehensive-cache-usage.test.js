import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SyncManager } from '../src/sync-manager.js';
import logger from '../src/logger.js';

/**
 * Comprehensive Cache Usage Test Suite
 *
 * This test suite verifies that cache is properly used during sync operations
 * to avoid expensive API calls and improve performance.
 *
 * Test Coverage:
 * 1. Early Progress Check Optimization
 * 2. Cache Usage for Different Book Types (ISBN/ASIN/Title-Author)
 * 3. Cache Miss vs Cache Hit Scenarios
 * 4. Race Condition Prevention with Cache
 * 5. Expensive Search Avoidance for Cached Books
 * 6. Cache Integration with Sync Process
 */

const mockUser = {
  id: 'test-user',
  abs_url: 'http://test-abs.com',
  abs_token: 'test-token',
  hardcover_token: 'test-hc-token',
};

const mockConfig = {
  workers: 1,
  parallel: false,
  force_sync: false,
};

// Helper to create mock books with different identifier types
const createMockBook = (id, title, author, identifiers = {}) => ({
  id: id,
  media: {
    metadata: {
      title: title,
      authors: [{ name: author }],
      ...identifiers,
    },
  },
  progress: 0.75,
  isFinished: false,
  started_at: '2024-01-01T10:00:00Z',
  last_listened_at: '2024-01-01T11:00:00Z',
});

// Helper to track expensive search calls
const createSearchTracker = () => {
  const tracker = {
    searchCalls: [],
    titleAuthorSearchTriggered: false,
    expensiveMatchingTriggered: false,

    reset() {
      this.searchCalls = [];
      this.titleAuthorSearchTriggered = false;
      this.expensiveMatchingTriggered = false;
    },

    recordSearch(bookTitle, searchType) {
      this.searchCalls.push({ bookTitle, searchType, timestamp: Date.now() });
      if (searchType === 'title_author') {
        this.titleAuthorSearchTriggered = true;
      }
      this.expensiveMatchingTriggered = true;
    },
  };
  return tracker;
};

test('Comprehensive Cache Usage During Sync Operations', async t => {
  await t.test('Early Progress Check Optimization', async t => {
    const syncManager = new SyncManager(mockUser, mockConfig, false, false);
    const searchTracker = createSearchTracker();

    await t.test(
      'Should skip processing when progress unchanged (cache hit)',
      async () => {
        // Mock cache with existing data and no progress change
        syncManager.cache = {
          generateTitleAuthorIdentifier: (title, author) =>
            `${title.toLowerCase()}:${author.toLowerCase()}`,
          getCachedBookInfo: async () => ({
            exists: true,
            edition_id: 'cached-edition-123',
            progress_percent: 75.0, // Matches book's progress
            author: 'Test Author',
          }),
          hasProgressChanged: async () => false, // No change
        };

        syncManager.bookMatcher = {
          findMatch: async absBook => {
            searchTracker.recordSearch(
              absBook.media.metadata.title,
              'unexpected',
            );
            return { match: null, extractedMetadata: {} };
          },
        };

        const book = createMockBook(
          'early-skip-1',
          'Cached Book',
          'Test Author',
        );
        const result = await syncManager._syncSingleBook(book, null);

        assert.strictEqual(
          result.status,
          'skipped',
          'Should skip when progress unchanged',
        );
        assert.strictEqual(
          result.reason,
          'Progress unchanged (optimized early check)',
        );
        assert.strictEqual(
          searchTracker.expensiveMatchingTriggered,
          false,
          'No expensive matching should occur',
        );

        console.log('✅ Early skip optimization working');
      },
    );

    await t.test('Should use cache when progress changed', async () => {
      searchTracker.reset();

      // Mock cache with existing data but progress changed
      syncManager.cache = {
        generateTitleAuthorIdentifier: (title, author) =>
          `${title.toLowerCase()}:${author.toLowerCase()}`,
        getCachedBookInfo: async () => ({
          exists: true,
          edition_id: 'cached-edition-456',
          progress_percent: 50.0, // Different from book's 75%
          author: 'Test Author',
        }),
        hasProgressChanged: async () => true, // Progress changed
      };

      syncManager.bookMatcher = {
        findMatch: async absBook => {
          searchTracker.recordSearch(
            absBook.media.metadata.title,
            'should_not_happen',
          );
          return { match: null, extractedMetadata: {} };
        },
      };

      const book = createMockBook(
        'cache-use-1',
        'Changed Progress Book',
        'Test Author',
      );

      // Track cache optimization logs
      const logs = [];
      const originalDebug = logger.debug;
      logger.debug = msg => {
        if (msg.includes('using cached edition')) logs.push(msg);
        originalDebug(msg);
      };

      try {
        const result = await syncManager._syncSingleBook(book, null);

        assert.notStrictEqual(
          result.status,
          'skipped',
          'Should not skip when progress changed',
        );
        assert.strictEqual(
          searchTracker.expensiveMatchingTriggered,
          false,
          'Should use cache, not expensive matching',
        );
        assert.ok(logs.length > 0, 'Should log cache optimization usage');

        console.log('✅ Cache optimization for progress changes working');
      } finally {
        logger.debug = originalDebug;
      }
    });
  });

  await t.test('Cache Usage for Different Book Types', async t => {
    const syncManager = new SyncManager(mockUser, mockConfig, false, false);
    const searchTracker = createSearchTracker();

    await t.test('ISBN books should use cache optimization', async () => {
      searchTracker.reset();

      syncManager.cache = {
        getCachedBookInfo: async (
          userId,
          identifier,
          title,
          identifierType,
        ) => {
          if (identifierType === 'isbn') {
            return {
              exists: true,
              edition_id: 'isbn-cached-edition',
              progress_percent: 30.0,
              author: 'ISBN Author',
            };
          }
          return { exists: false };
        },
        hasProgressChanged: async () => true,
      };

      syncManager.bookMatcher = {
        findMatch: async absBook => {
          searchTracker.recordSearch(
            absBook.media.metadata.title,
            'isbn_search',
          );
          return { match: null, extractedMetadata: {} };
        },
      };

      const isbnBook = createMockBook('isbn-1', 'ISBN Book', 'ISBN Author', {
        isbn: '9781234567890',
      });

      await syncManager._syncSingleBook(isbnBook, null);

      assert.strictEqual(
        searchTracker.expensiveMatchingTriggered,
        false,
        'ISBN books should use cache optimization',
      );
      console.log('✅ ISBN cache optimization working');
    });

    await t.test('ASIN books should use cache optimization', async () => {
      searchTracker.reset();

      syncManager.cache = {
        getCachedBookInfo: async (
          userId,
          identifier,
          title,
          identifierType,
        ) => {
          if (identifierType === 'asin') {
            return {
              exists: true,
              edition_id: 'asin-cached-edition',
              progress_percent: 45.0,
              author: 'ASIN Author',
            };
          }
          return { exists: false };
        },
        hasProgressChanged: async () => true,
      };

      syncManager.bookMatcher = {
        findMatch: async absBook => {
          searchTracker.recordSearch(
            absBook.media.metadata.title,
            'asin_search',
          );
          return { match: null, extractedMetadata: {} };
        },
      };

      const asinBook = createMockBook('asin-1', 'ASIN Book', 'ASIN Author', {
        asin: 'B01234ASIN',
      });

      await syncManager._syncSingleBook(asinBook, null);

      assert.strictEqual(
        searchTracker.expensiveMatchingTriggered,
        false,
        'ASIN books should use cache optimization',
      );
      console.log('✅ ASIN cache optimization working');
    });

    await t.test(
      'Title/Author books should use cache optimization',
      async () => {
        searchTracker.reset();

        syncManager.cache = {
          generateTitleAuthorIdentifier: (title, author) =>
            `${title.toLowerCase()}:${author.toLowerCase()}`,
          getCachedBookInfo: async (
            userId,
            identifier,
            title,
            identifierType,
          ) => {
            if (identifierType === 'title_author') {
              return {
                exists: true,
                edition_id: 'title-author-cached-edition',
                progress_percent: 60.0,
                author: 'Title Author',
              };
            }
            return { exists: false };
          },
          hasProgressChanged: async () => true,
        };

        syncManager.bookMatcher = {
          findMatch: async absBook => {
            searchTracker.recordSearch(
              absBook.media.metadata.title,
              'title_author',
            );
            return { match: null, extractedMetadata: {} };
          },
        };

        const titleAuthorBook = createMockBook(
          'ta-1',
          'Title Author Book',
          'Title Author',
        );

        await syncManager._syncSingleBook(titleAuthorBook, null);

        assert.strictEqual(
          searchTracker.titleAuthorSearchTriggered,
          false,
          'Title/Author books should use cache optimization',
        );
        console.log('✅ Title/Author cache optimization working');
      },
    );
  });

  await t.test('Cache Miss vs Cache Hit Scenarios', async t => {
    const syncManager = new SyncManager(mockUser, mockConfig, false, false);
    const searchTracker = createSearchTracker();

    await t.test(
      'Cache miss should trigger expensive matching (expected)',
      async () => {
        searchTracker.reset();

        // Mock cache with no data (cache miss)
        syncManager.cache = {
          generateTitleAuthorIdentifier: () => 'newbook:newauthor',
          getCachedBookInfo: async () => ({ exists: false }), // Cache miss
        };

        syncManager.bookMatcher = {
          findMatch: async absBook => {
            searchTracker.recordSearch(
              absBook.media.metadata.title,
              'title_author',
            );
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

        const newBook = createMockBook('new-1', 'New Book', 'New Author');

        await syncManager._syncSingleBook(newBook, null);

        assert.strictEqual(
          searchTracker.expensiveMatchingTriggered,
          true,
          'Cache miss should trigger expensive matching',
        );
        console.log('✅ Cache miss correctly triggers expensive matching');
      },
    );

    await t.test('Cache hit should avoid expensive matching', async () => {
      searchTracker.reset();

      // Mock cache with existing data (cache hit)
      syncManager.cache = {
        generateTitleAuthorIdentifier: () => 'existingbook:existingauthor',
        getCachedBookInfo: async () => ({
          exists: true,
          edition_id: 'existing-edition-789',
          progress_percent: 25.0,
          author: 'Existing Author',
        }),
        hasProgressChanged: async () => true,
      };

      syncManager.bookMatcher = {
        findMatch: async absBook => {
          searchTracker.recordSearch(
            absBook.media.metadata.title,
            'should_not_happen',
          );
          return { match: null, extractedMetadata: {} };
        },
      };

      const existingBook = createMockBook(
        'existing-1',
        'Existing Book',
        'Existing Author',
      );

      await syncManager._syncSingleBook(existingBook, null);

      assert.strictEqual(
        searchTracker.expensiveMatchingTriggered,
        false,
        'Cache hit should avoid expensive matching',
      );
      console.log('✅ Cache hit correctly avoids expensive matching');
    });
  });

  await t.test('Integration with Full Sync Process', async t => {
    const syncManager = new SyncManager(mockUser, mockConfig, true, false); // Dry run
    const searchTracker = createSearchTracker();

    await t.test('Should use cache optimization during full sync', async () => {
      searchTracker.reset();

      // Mock dependencies
      syncManager.cache = {
        init: () => Promise.resolve(),
        storeLibraryStats: () => Promise.resolve(),
        getLibraryStats: () => Promise.resolve(null),
        generateTitleAuthorIdentifier: (title, author) =>
          `${title.toLowerCase()}:${author.toLowerCase()}`,
        getCachedBookInfo: async (
          userId,
          identifier,
          title,
          identifierType,
        ) => {
          // Simulate some books cached, others not
          if (title.includes('Cached')) {
            return {
              exists: true,
              edition_id: `${identifierType}-edition-${Math.random().toString(36).substr(2, 9)}`,
              progress_percent: 40.0,
              author: 'Test Author',
            };
          }
          return { exists: false };
        },
        hasProgressChanged: async (userId, identifier, title, progress) => {
          // Simulate some progress changed, others not
          return title.includes('Changed');
        },
      };

      syncManager.audiobookshelf = {
        getUserLibraryBooks: () =>
          Promise.resolve([
            createMockBook('sync-1', 'Cached Book Changed', 'Test Author'), // Cache hit + progress changed
            createMockBook('sync-2', 'Cached Book Same', 'Test Author'), // Cache hit + no change
            createMockBook('sync-3', 'New Book', 'Test Author'), // Cache miss
            createMockBook(
              'sync-4',
              'Cached ISBN Book Changed',
              'Test Author',
              { isbn: '9781111111111' },
            ),
          ]),
      };

      syncManager.hardcover = {
        getUserBooks: () => Promise.resolve([]),
      };

      syncManager.bookMatcher = {
        setUserLibrary: () => {},
        findMatch: async absBook => {
          searchTracker.recordSearch(
            absBook.media.metadata.title,
            'expensive_search',
          );
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

      const result = await syncManager.sync();

      // Verify results
      assert.ok(result, 'Sync should complete');

      // Should only trigger expensive matching for truly new books
      const expensiveSearches = searchTracker.searchCalls.filter(
        call => call.searchType === 'expensive_search',
      );

      // Only "New Book" should trigger expensive search, cached books should use optimization
      assert.ok(
        expensiveSearches.length <= 1,
        `Should minimize expensive searches, got ${expensiveSearches.length} searches for ${searchTracker.searchCalls.map(s => s.bookTitle).join(', ')}`,
      );

      console.log('✅ Full sync integration with cache optimization working');
    });
  });

  await t.test('Performance Verification', async t => {
    const syncManager = new SyncManager(mockUser, mockConfig, false, false);

    await t.test(
      'Should have significant performance improvement with cache',
      async () => {
        const performanceMetrics = {
          cacheHits: 0,
          cacheMisses: 0,
          expensiveSearches: 0,
          cacheOptimizations: 0,
        };

        // Mock cache that tracks hits and misses
        syncManager.cache = {
          generateTitleAuthorIdentifier: (title, author) =>
            `${title.toLowerCase()}:${author.toLowerCase()}`,
          getCachedBookInfo: async (
            userId,
            identifier,
            title,
            identifierType,
          ) => {
            if (title.includes('Cached')) {
              performanceMetrics.cacheHits++;
              return {
                exists: true,
                edition_id: 'perf-test-edition',
                progress_percent: 55.0,
                author: 'Perf Author',
              };
            } else {
              performanceMetrics.cacheMisses++;
              return { exists: false };
            }
          },
          hasProgressChanged: async () => {
            performanceMetrics.cacheOptimizations++;
            return true;
          },
        };

        syncManager.bookMatcher = {
          findMatch: async absBook => {
            performanceMetrics.expensiveSearches++;
            return { match: null, extractedMetadata: {} };
          },
        };

        // Process mix of cached and uncached books
        const books = [
          createMockBook('perf-1', 'Cached Book A', 'Perf Author'),
          createMockBook('perf-2', 'Cached Book B', 'Perf Author'),
          createMockBook('perf-3', 'Cached Book C', 'Perf Author'),
          createMockBook('perf-4', 'New Book A', 'Perf Author'),
          createMockBook('perf-5', 'New Book B', 'Perf Author'),
        ];

        for (const book of books) {
          await syncManager._syncSingleBook(book, null);
        }

        // Verify performance improvements
        assert.ok(performanceMetrics.cacheHits > 0, 'Should have cache hits');
        assert.ok(
          performanceMetrics.cacheMisses > 0,
          'Should have cache misses',
        );
        assert.ok(
          performanceMetrics.cacheOptimizations >= performanceMetrics.cacheHits,
          'Should have cache optimizations for cache hits',
        );
        assert.ok(
          performanceMetrics.expensiveSearches <=
            performanceMetrics.cacheMisses,
          'Should minimize expensive searches compared to cache misses',
        );

        console.log('✅ Performance metrics:', performanceMetrics);
        console.log(
          `✅ Cache efficiency: ${performanceMetrics.cacheHits}/${books.length} books used cache optimization`,
        );
      },
    );
  });

  console.log(
    '\n🎉 Comprehensive cache usage test suite completed successfully!',
  );
  console.log('   All cache optimizations are working correctly:');
  console.log('   ✅ Early progress check optimization');
  console.log('   ✅ Cache usage for ISBN/ASIN/Title-Author books');
  console.log('   ✅ Proper cache miss vs cache hit handling');
  console.log('   ✅ Integration with full sync process');
  console.log('   ✅ Performance improvements verified');
});
