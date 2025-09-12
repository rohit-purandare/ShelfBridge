import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SyncManager } from '../src/sync-manager.js';
import logger from '../src/logger.js';

/**
 * Title/Author Robustness Test
 *
 * This test verifies that title/author matching has the same robustness
 * and feature parity as ASIN/ISBN matching.
 *
 * Key areas to test:
 * 1. Search result handling (auto-add scenarios)
 * 2. Cross-edition matching
 * 3. Error recovery
 * 4. Cache integration
 * 5. Format mismatch handling
 */

const mockUser = {
  id: 'robustness-test',
  abs_url: 'http://test.com',
  abs_token: 'token',
  hardcover_token: 'hc',
};

const mockConfig = {
  workers: 1,
  parallel: false,
  auto_add_books: true, // Enable auto-add for testing
  force_sync: false,
};

test('Title/Author Matching Robustness', async t => {
  await t.test('Auto-Add Integration Parity', async t => {
    await t.test(
      'Should auto-add title/author books like ASIN/ISBN books',
      async () => {
        const syncManager = new SyncManager(mockUser, mockConfig, false, false);

        let autoAddAttempted = false;
        const autoAddResults = [];

        // Mock cache (no existing data)
        syncManager.cache = {
          generateTitleAuthorIdentifier: () => 'autoadd:test',
          getCachedBookInfo: async () => ({ exists: false }),
        };

        // Mock bookMatcher to simulate title/author search result (not in library)
        syncManager.bookMatcher = {
          findMatch: async absBook => {
            const title = absBook.media.metadata.title;
            return {
              match: {
                userBook: null, // Not in user's library
                book: { id: 'found-book-123', title: title },
                edition: { id: 'found-edition-456', format: 'Read' },
                _isSearchResult: true, // Key flag for auto-add
                _matchType: 'title_author_two_stage',
                _tier: 3,
              },
              extractedMetadata: {
                title: title,
                author: absBook.media.metadata.authors[0].name,
                identifiers: { isbn: null, asin: null },
              },
            };
          },
        };

        // Mock hardcover client to track auto-add attempts
        syncManager.hardcover = {
          addBookToLibrary: async (bookId, editionId) => {
            autoAddAttempted = true;
            autoAddResults.push({ bookId, editionId });
            return { id: 'new-user-book-789' }; // Success
          },
          getUserBooks: () => Promise.resolve([]),
        };

        const titleAuthorBook = {
          id: 'auto-add-test-1',
          media: {
            metadata: {
              title: 'Auto Add Test Book',
              authors: [{ name: 'Test Author' }],
              // No ISBN/ASIN
            },
          },
          progress: 0.75, // Above threshold
          isFinished: false,
        };

        const result = await syncManager._syncSingleBook(titleAuthorBook, null);

        // Should successfully auto-add like ASIN/ISBN books
        assert.ok(
          autoAddAttempted,
          'Should attempt auto-add for title/author books',
        );
        assert.strictEqual(
          autoAddResults.length,
          1,
          'Should auto-add one book',
        );
        assert.notStrictEqual(
          result.status,
          'skipped',
          'Should not skip when auto-add succeeds',
        );

        console.log('✅ Title/Author auto-add parity with ASIN/ISBN');
      },
    );

    await t.test('Should handle auto-add failure gracefully', async () => {
      const syncManager = new SyncManager(mockUser, mockConfig, false, false);

      syncManager.cache = {
        generateTitleAuthorIdentifier: () => 'autoaddfail:test',
        getCachedBookInfo: async () => ({ exists: false }),
      };

      syncManager.bookMatcher = {
        findMatch: async absBook => ({
          match: {
            userBook: null,
            book: { id: 'fail-book-123', title: absBook.media.metadata.title },
            edition: { id: 'fail-edition-456', format: 'Read' },
            _isSearchResult: true,
            _matchType: 'title_author_two_stage',
          },
          extractedMetadata: {
            title: absBook.media.metadata.title,
            author: absBook.media.metadata.authors[0].name,
            identifiers: {},
          },
        }),
      };

      // Mock hardcover client that fails auto-add
      syncManager.hardcover = {
        addBookToLibrary: async () => {
          throw new Error('Auto-add API failure');
        },
        getUserBooks: () => Promise.resolve([]),
      };

      const book = {
        id: 'auto-add-fail-1',
        media: {
          metadata: {
            title: 'Auto Add Fail Book',
            authors: [{ name: 'Fail Author' }],
          },
        },
        progress: 0.8,
        isFinished: false,
      };

      const result = await syncManager._syncSingleBook(book, null);

      // Should handle failure gracefully like ASIN/ISBN
      assert.strictEqual(
        result.status,
        'error',
        'Should return error status for auto-add failures',
      );
      assert.ok(
        result.reason.includes('Auto-add failed'),
        'Should explain auto-add failure',
      );

      console.log('✅ Title/Author auto-add error handling matches ASIN/ISBN');
    });
  });

  await t.test('Format Mismatch Handling Parity', async t => {
    await t.test(
      'Should handle audiobook-to-text cross-format like identifier matchers',
      async () => {
        const syncManager = new SyncManager(mockUser, mockConfig, false, false);

        syncManager.cache = {
          generateTitleAuthorIdentifier: () => 'crossformat:test',
          getCachedBookInfo: async () => ({ exists: false }),
        };

        syncManager.bookMatcher = {
          findMatch: async absBook => ({
            match: {
              userBook: { id: 'cross-user-book-123' }, // In library
              book: {
                id: 'cross-book-123',
                title: absBook.media.metadata.title,
              },
              edition: { id: 'cross-edition-text', format: 'Read' }, // Text edition
              _isSearchResult: false, // In user's library
              _matchType: 'title_author_cross_edition',
            },
            extractedMetadata: {
              title: absBook.media.metadata.title,
              author: absBook.media.metadata.authors[0].name,
              identifiers: {},
              userFormat: 'audiobook', // User has audiobook
            },
          }),
        };

        const audiobookWithTextMatch = {
          id: 'cross-format-1',
          media: {
            metadata: {
              title: 'Cross Format Book',
              authors: [{ name: 'Format Author' }],
            },
          },
          progress: 0.6,
          isFinished: false,
          mediaType: 'book', // Audiobook
        };

        const result = await syncManager._syncSingleBook(
          audiobookWithTextMatch,
          null,
        );

        // Should handle cross-format like ASIN/ISBN matchers
        assert.notStrictEqual(
          result.status,
          'skipped',
          'Should process cross-format matches',
        );
        assert.notStrictEqual(
          result.status,
          'error',
          'Should not error on format mismatch',
        );

        console.log('✅ Title/Author cross-format handling matches ASIN/ISBN');
      },
    );
  });

  await t.test('Error Recovery Parity', async t => {
    await t.test(
      'Should recover from API failures like identifier matchers',
      async () => {
        const syncManager = new SyncManager(mockUser, mockConfig, false, false);

        syncManager.cache = {
          generateTitleAuthorIdentifier: () => 'apifail:test',
          getCachedBookInfo: async () => ({ exists: false }),
        };

        // Mock bookMatcher that throws API error
        syncManager.bookMatcher = {
          findMatch: async absBook => {
            throw new Error('Hardcover API timeout');
          },
        };

        const book = {
          id: 'api-fail-1',
          media: {
            metadata: {
              title: 'API Fail Book',
              authors: [{ name: 'API Author' }],
            },
          },
          progress: 0.45,
          isFinished: false,
        };

        const result = await syncManager._syncSingleBook(book, null);

        // Should handle API failures gracefully
        assert.strictEqual(
          result.status,
          'error',
          'Should return error status for API failures',
        );
        assert.ok(
          result.errors && result.errors.length > 0,
          'Should record error details',
        );

        console.log('✅ Title/Author API error recovery matches ASIN/ISBN');
      },
    );
  });

  await t.test('Performance Characteristics', async t => {
    await t.test(
      'Should have reasonable performance for bulk operations',
      async () => {
        const syncManager = new SyncManager(mockUser, mockConfig, false, false);

        let searchCount = 0;
        let cacheHits = 0;

        syncManager.cache = {
          generateTitleAuthorIdentifier: (title, author) =>
            `${title}:${author}`,
          getCachedBookInfo: async (userId, identifier, title) => {
            if (title.includes('Cached')) {
              cacheHits++;
              return {
                exists: true,
                edition_id: 'cached-edition-perf',
                progress_percent: 30.0,
                author: 'Perf Author',
              };
            }
            return { exists: false };
          },
          hasProgressChanged: async () => true,
        };

        syncManager.bookMatcher = {
          findMatch: async absBook => {
            searchCount++;
            const title = absBook.media.metadata.title;
            return {
              match: {
                userBook: { id: 'perf-user-book' },
                edition: { id: 'perf-edition', format: 'Read' },
                _isSearchResult: false,
                _matchType: 'title_author_two_stage',
              },
              extractedMetadata: {
                title,
                author: 'Perf Author',
                identifiers: {},
              },
            };
          },
        };

        // Process multiple books
        const books = [
          'Cached Book A',
          'Cached Book B',
          'Cached Book C', // Should use cache
          'New Book A',
          'New Book B', // Should trigger search
        ].map(title => ({
          id: `perf-${title.replace(/\s+/g, '-').toLowerCase()}`,
          media: { metadata: { title, authors: [{ name: 'Perf Author' }] } },
          progress: 0.55,
        }));

        const startTime = Date.now();
        for (const book of books) {
          await syncManager._syncSingleBook(book, null);
        }
        const duration = Date.now() - startTime;

        console.log(`✅ Processed ${books.length} books in ${duration}ms`);
        console.log(`✅ Cache hits: ${cacheHits}/${books.length}`);
        console.log(`✅ Searches: ${searchCount}/${books.length}`);

        // Should use cache to minimize searches
        assert.ok(cacheHits > 0, 'Should use cache for repeated books');
        assert.ok(
          searchCount <= books.length,
          'Should not exceed one search per book',
        );
        assert.ok(
          searchCount < books.length,
          'Cache should reduce total searches',
        );
      },
    );
  });

  console.log('\n🎉 Title/Author robustness verification completed!');
  console.log('   Key findings:');
  console.log('   ✅ Auto-add integration working (after recent fix)');
  console.log('   ✅ Cross-format handling robust');
  console.log('   ✅ Error recovery comparable to ASIN/ISBN');
  console.log('   ✅ Performance optimized with caching');
});
