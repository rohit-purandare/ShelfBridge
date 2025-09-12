import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SyncManager } from '../src/sync-manager.js';
import logger from '../src/logger.js';

/**
 * Cross-Format Sync Test
 *
 * Tests the new cross_format_sync functionality that allows using found editions
 * even when format doesn't match and book isn't in user's library.
 *
 * Addresses the issue where:
 * - User has audiobook
 * - Hardcover has text edition
 * - Auto-add is disabled
 * - Sync fails instead of using available edition
 */

const mockUser = {
  id: 'test-user',
  abs_url: 'http://test.com',
  abs_token: 'token',
  hardcover_token: 'hc',
};

const createMockBook = (title, author, userFormat = 'audiobook') => ({
  id: `test-${title.toLowerCase().replace(/\s+/g, '-')}`,
  media: {
    metadata: {
      title: title,
      authors: [{ name: author }],
      // No ISBN/ASIN to force title/author matching
    },
  },
  progress: 0.65,
  isFinished: false,
  mediaType: userFormat === 'audiobook' ? 'book' : 'ebook',
});

test('Cross-Format Sync Functionality', async t => {
  await t.test(
    'Should use search result when cross_format_sync enabled',
    async () => {
      // Enable cross-format sync
      const configWithCrossFormat = {
        workers: 1,
        parallel: false,
        force_sync: false,
        auto_add_books: false, // Auto-add disabled
        cross_format_sync: true, // Cross-format enabled
      };

      const syncManager = new SyncManager(
        mockUser,
        configWithCrossFormat,
        false,
        false,
      );

      // Mock cache (no cache for this test)
      syncManager.cache = {
        generateTitleAuthorIdentifier: () => 'crossformat:test',
        getCachedBookInfo: async () => ({ exists: false }),
      };

      // Mock bookMatcher that returns search result (not in user's library)
      syncManager.bookMatcher = {
        findMatch: async absBook => {
          return {
            match: {
              userBook: null, // Not in user's library
              book: { id: 'search-book-123', title: 'Salvage Rat' },
              edition: { id: 'search-edition-456', format: 'Read' }, // Text edition
              _isSearchResult: true, // This is a search result, not user library
              _matchType: 'title_author_search',
            },
            extractedMetadata: {
              title: 'Salvage Rat',
              author: 'Larry N. Martin',
              identifiers: { isbn: null, asin: null },
              userFormat: 'audiobook',
            },
          };
        },
      };

      const audiobook = createMockBook(
        'Salvage Rat',
        'Larry N. Martin',
        'audiobook',
      );

      // Track cross-format logs
      const crossFormatLogs = [];
      const originalInfo = logger.info;
      logger.info = (msg, data) => {
        if (msg.includes('cross-format sync')) {
          crossFormatLogs.push({ msg, data });
        }
        originalInfo(msg, data);
      };

      try {
        const result = await syncManager._syncSingleBook(audiobook, null);

        // Should NOT be skipped when cross_format_sync is enabled
        assert.notStrictEqual(
          result.status,
          'skipped',
          'Should not skip when cross_format_sync enabled',
        );

        // Should log cross-format usage
        assert.ok(
          crossFormatLogs.length > 0,
          'Should log cross-format sync usage',
        );

        // Should indicate cross-format matching method
        assert.strictEqual(
          result.matching_method,
          'cross_format_search',
          'Should indicate cross-format matching',
        );

        console.log('✅ Cross-format sync allows using search results');
      } finally {
        logger.info = originalInfo;
      }
    },
  );

  await t.test(
    'Should skip when cross_format_sync disabled (original behavior)',
    async () => {
      // Disable cross-format sync (default behavior)
      const configNoCrossFormat = {
        workers: 1,
        parallel: false,
        force_sync: false,
        auto_add_books: false, // Auto-add disabled
        cross_format_sync: false, // Cross-format disabled (default)
      };

      const syncManager = new SyncManager(
        mockUser,
        configNoCrossFormat,
        false,
        false,
      );

      syncManager.cache = {
        generateTitleAuthorIdentifier: () => 'nocrossformat:test',
        getCachedBookInfo: async () => ({ exists: false }),
      };

      syncManager.bookMatcher = {
        findMatch: async absBook => {
          return {
            match: {
              userBook: null, // Not in user's library
              book: { id: 'search-book-789', title: 'Test Book' },
              edition: { id: 'search-edition-789', format: 'Read' },
              _isSearchResult: true,
              _matchType: 'title_author_search',
            },
            extractedMetadata: {
              title: 'Test Book',
              author: 'Test Author',
              identifiers: { isbn: null, asin: null },
              userFormat: 'audiobook',
            },
          };
        },
      };

      const audiobook = createMockBook('Test Book', 'Test Author', 'audiobook');
      const result = await syncManager._syncSingleBook(audiobook, null);

      // Should be skipped when cross_format_sync is disabled (original behavior)
      assert.strictEqual(
        result.status,
        'skipped',
        'Should skip when cross_format_sync disabled',
      );
      assert.ok(
        result.reason.includes('cross_format_sync disabled'),
        'Should explain cross_format_sync is disabled',
      );

      console.log(
        '✅ Default behavior preserved when cross_format_sync disabled',
      );
    },
  );

  await t.test(
    'Should work with books already in user library (normal case)',
    async () => {
      const configNormal = {
        workers: 1,
        parallel: false,
        force_sync: false,
        auto_add_books: false,
        cross_format_sync: false, // Not needed when book is in library
      };

      const syncManager = new SyncManager(mockUser, configNormal, false, false);

      syncManager.cache = {
        generateTitleAuthorIdentifier: () => 'inlibrary:test',
        getCachedBookInfo: async () => ({ exists: false }),
      };

      syncManager.bookMatcher = {
        findMatch: async absBook => {
          return {
            match: {
              userBook: { id: 'user-book-456' }, // In user's library
              book: { id: 'lib-book-456', title: 'Library Book' },
              edition: { id: 'lib-edition-456', format: 'Audiobook' },
              _isSearchResult: false, // From user library, not search
              _matchType: 'title_author_library',
            },
            extractedMetadata: {
              title: 'Library Book',
              author: 'Library Author',
              identifiers: { isbn: null, asin: null },
              userFormat: 'audiobook',
            },
          };
        },
      };

      const audiobook = createMockBook(
        'Library Book',
        'Library Author',
        'audiobook',
      );
      const result = await syncManager._syncSingleBook(audiobook, null);

      // Should process normally when book is in user's library
      assert.notStrictEqual(
        result.status,
        'skipped',
        'Should process books in user library normally',
      );

      console.log('✅ Normal library books work unchanged');
    },
  );

  console.log('\n🎉 Cross-format sync functionality working!');
  console.log('\n📚 Solutions for the user:');
  console.log('   1. Enable cross_format_sync: true in config');
  console.log('   2. Keep auto_add_books: false (as desired)');
  console.log('   3. Audiobook progress will sync to text editions');
  console.log('   4. No unwanted books added to library');
});
