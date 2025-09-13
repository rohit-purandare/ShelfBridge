import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SyncManager } from '../src/sync-manager.js';

/**
 * Test auto-add search result structure validation
 */

const mockUser = {
  id: 'test-user',
  abs_url: 'http://test.com',
  abs_token: 'token',
  hardcover_token: 'hc',
};

const mockConfig = {
  workers: 1,
  parallel: false,
  auto_add_books: true,
  force_sync: false,
  min_progress_threshold: 5.0,
};

test('Auto-Add Search Result Structure Validation', async t => {
  await t.test(
    'Should handle invalid search result structure gracefully',
    async () => {
      const syncManager = new SyncManager(mockUser, mockConfig, false, false);

      // Mock cache (no cache)
      syncManager.cache = {
        generateTitleAuthorIdentifier: () => 'test:author',
        getCachedBookInfo: async () => ({ exists: false }),
      };

      // Mock bookMatcher returning search result
      syncManager.bookMatcher = {
        findMatch: async () => ({
          match: {
            userBook: null,
            book: { id: 'search-book-123', title: 'Test Book' },
            edition: { id: 'search-edition-456', format: 'Read' },
            _isSearchResult: true,
            _matchType: 'title_author_two_stage',
          },
          extractedMetadata: {
            title: 'Test Book',
            author: 'Test Author',
            identifiers: { isbn: '9781234567890', asin: null },
          },
        }),
      };

      // Mock hardcover client that returns invalid search results
      syncManager.hardcover = {
        searchBooksByIsbn: async isbn => {
          // Return invalid structure (missing book.id)
          return [
            {
              id: 'edition-123',
              format: 'Read',
              book: null, // Invalid: book is null
            },
          ];
        },
        getUserBooks: () => Promise.resolve([]),
      };

      const testBook = {
        id: 'invalid-structure-test',
        media: {
          metadata: {
            title: 'Invalid Structure Book',
            authors: [{ name: 'Test Author' }],
            isbn: '9781234567890',
          },
        },
        progress_percentage: 25.0, // Above threshold
        isFinished: false,
      };

      const result = await syncManager._syncSingleBook(testBook, null);

      // Should return clear error instead of crashing
      assert.strictEqual(
        result.status,
        'error',
        'Should return error for invalid structure',
      );
      assert.ok(
        result.reason.includes('Invalid search result structure'),
        'Should explain structure issue',
      );

      console.log('✅ Invalid search result structure handled gracefully');
    },
  );

  await t.test('Should work with valid search result structure', async () => {
    const syncManager = new SyncManager(mockUser, mockConfig, false, false);

    let autoAddAttempted = false;

    syncManager.cache = {
      generateTitleAuthorIdentifier: () => 'valid:test',
      getCachedBookInfo: async () => ({ exists: false }),
    };

    syncManager.bookMatcher = {
      findMatch: async () => ({
        match: {
          userBook: null,
          book: { id: 'valid-book-123', title: 'Valid Book' },
          edition: { id: 'valid-edition-456', format: 'Read' },
          _isSearchResult: true,
          _matchType: 'title_author_two_stage',
        },
        extractedMetadata: {
          title: 'Valid Book',
          author: 'Valid Author',
          identifiers: { isbn: '9781111111111', asin: null },
        },
      }),
    };

    // Mock hardcover client with valid structure
    syncManager.hardcover = {
      searchBooksByIsbn: async isbn => {
        return [
          {
            id: 'valid-edition-789',
            format: 'Read',
            book: {
              id: 'valid-book-789', // Valid structure
              title: 'Valid Book',
            },
          },
        ];
      },
      addBookToLibrary: async (bookId, statusId, editionId) => {
        autoAddAttempted = true;
        return { id: 'new-user-book-999' };
      },
      getUserBooks: () => Promise.resolve([]),
    };

    const validBook = {
      id: 'valid-structure-test',
      media: {
        metadata: {
          title: 'Valid Book',
          authors: [{ name: 'Valid Author' }],
          isbn: '9781111111111',
        },
      },
      progress_percentage: 30.0,
      isFinished: false,
    };

    const result = await syncManager._syncSingleBook(validBook, null);

    // Should succeed with valid structure
    assert.ok(autoAddAttempted, 'Should attempt auto-add with valid structure');
    assert.notStrictEqual(
      result.status,
      'error',
      'Should not error with valid structure',
    );

    console.log('✅ Valid search result structure works correctly');
  });

  console.log('\n🎯 Auto-add structure validation working!');
  console.log(
    '   Will now show clear errors instead of crashing on invalid data',
  );
});
