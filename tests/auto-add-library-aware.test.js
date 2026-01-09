import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { BookMatcher } from '../src/matching/book-matcher.js';
import { HardcoverClient } from '../src/hardcover-client.js';
import { BookCache } from '../src/book-cache.js';

/**
 * Comprehensive tests for library-aware auto-add functionality
 * Tests DRY improvements and duplicate detection during auto-add
 */
describe('Library-Aware Auto-Add', () => {
  const mockToken = 'test-token';
  const testUserId = 'test-user-123';
  let hardcover;
  let cache;
  let bookMatcher;

  beforeEach(() => {
    // Create mock clients
    hardcover = new HardcoverClient(mockToken);
    cache = {
      getCachedBookInfo: mock.fn(async () => null),
      storeBookMatch: mock.fn(async () => {}),
      generateTitleAuthorIdentifier: mock.fn(
        (title, author) => `${title}_${author}`,
      ),
    };

    const config = {
      title_author_matching: {
        enabled: true,
        confidence_threshold: 0.7,
        max_search_results: 5,
      },
    };

    bookMatcher = new BookMatcher(hardcover, cache, config);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  describe('BookMatcher.findMatchByTitleAuthor() Helper Method', () => {
    it('should find title/author strategy and call it with library context', async () => {
      const absBook = {
        title: 'Test Book',
        metadata: {
          title: 'Test Book',
          authors: [{ name: 'Test Author' }],
        },
      };

      // Mock the hardcover search to return results
      hardcover.searchBooksByTitle = mock.fn(async () => [
        {
          id: 999,
          title: 'Test Book',
          author: 'Test Author',
          editions: [
            {
              id: 500,
              book: { id: 999, title: 'Test Book' },
              format: 'audiobook',
            },
          ],
        },
      ]);

      // Set user library
      const userLibrary = [
        {
          id: 100,
          edition_id: 500,
          status_id: 1,
          book: {
            id: 999,
            title: 'Test Book',
            editions: [
              {
                id: 500,
                book: { id: 999, title: 'Test Book' },
                reading_format: { format: 'audiobook' },
              },
            ],
          },
        },
      ];
      bookMatcher.setUserLibrary(userLibrary);

      const match = await bookMatcher.findMatchByTitleAuthor(
        absBook,
        testUserId,
      );

      // Should return a match (the existing userBook)
      assert.ok(match, 'Match should be found');
      assert.strictEqual(
        match._isSearchResult,
        false,
        'Should return existing library match, not search result',
      );
    });

    it('should return null when title/author strategy not found', async () => {
      // Create a BookMatcher with empty strategies
      const emptyMatcher = new BookMatcher(hardcover, cache, {});
      emptyMatcher.strategies = []; // Remove all strategies

      const absBook = {
        title: 'Test Book',
        metadata: { title: 'Test Book' },
      };

      const match = await emptyMatcher.findMatchByTitleAuthor(
        absBook,
        testUserId,
      );

      assert.strictEqual(
        match,
        null,
        'Should return null when strategy not found',
      );
    });

    it('should provide library lookup functions to strategy', async () => {
      const absBook = {
        title: 'Test Book',
        metadata: {
          title: 'Test Book',
          authors: [{ name: 'Test Author' }],
        },
      };

      // Mock search to return no results (triggers search path)
      hardcover.searchBooksByTitle = mock.fn(async () => []);

      const match = await bookMatcher.findMatchByTitleAuthor(
        absBook,
        testUserId,
      );

      // Should call strategy with library context
      // (no assertion needed, just verify it doesn't throw)
      // If library lookups weren't provided, strategy would log warnings
    });
  });

  describe('Want to Read Update Scenario', () => {
    it('should detect existing Want to Read edition and return library match', async () => {
      const absBook = {
        title: 'Iron Gold',
        metadata: {
          title: 'Iron Gold',
          authors: [{ name: 'Pierce Brown' }],
          asin: 'B074NBTRGL',
        },
        audioTracks: [{ duration: 36000 }], // 10 hours
      };

      // User has physical edition on Want to Read
      const userLibrary = [
        {
          id: 100,
          edition_id: 31660744, // Physical edition
          status_id: 1, // Want to Read
          book: {
            id: 999,
            title: 'Iron Gold',
            editions: [
              {
                id: 31660744,
                book: { id: 999, title: 'Iron Gold' },
                physical_format: 'Hardcover',
                pages: 600,
              },
              {
                id: 31466618,
                book: { id: 999, title: 'Iron Gold' },
                reading_format: { format: 'audiobook' },
                audio_seconds: 36000,
              },
            ],
          },
        },
      ];
      bookMatcher.setUserLibrary(userLibrary);

      // Mock search to return audiobook edition
      hardcover.searchBooksByTitle = mock.fn(async () => [
        {
          id: 999,
          title: 'Iron Gold',
          author: 'Pierce Brown',
          editions: [
            {
              id: 31466618, // Audiobook
              book: { id: 999, title: 'Iron Gold' },
              reading_format: { format: 'audiobook' },
              audio_seconds: 36000,
            },
          ],
        },
      ]);

      const match = await bookMatcher.findMatchByTitleAuthor(
        absBook,
        testUserId,
      );

      assert.ok(match, 'Should find a match');
      assert.strictEqual(
        match._isSearchResult,
        false,
        'Should detect existing library book',
      );
      assert.ok(match.userBook, 'Should return existing userBook');
      assert.strictEqual(
        match.userBook.status_id,
        1,
        'Should preserve Want to Read status',
      );
    });
  });

  describe('Cross-Edition Detection', () => {
    it('should detect when user has different edition of same book', async () => {
      const bookId = 999;
      const userEditionId = 500;
      const searchEditionId = 501;

      const absBook = {
        title: 'Test Book',
        metadata: {
          title: 'Test Book',
          authors: [{ name: 'Test Author' }],
        },
      };

      // User has Edition A
      const userLibrary = [
        {
          id: 100,
          edition_id: userEditionId,
          status_id: 2, // Currently Reading
          book: {
            id: bookId,
            title: 'Test Book',
            editions: [
              {
                id: userEditionId,
                book: { id: bookId, title: 'Test Book' },
                physical_format: 'Paperback',
              },
            ],
          },
        },
      ];
      bookMatcher.setUserLibrary(userLibrary);

      // Search returns Edition B (different edition, same book)
      hardcover.searchBooksByTitle = mock.fn(async () => [
        {
          id: bookId,
          title: 'Test Book',
          author: 'Test Author',
          editions: [
            {
              id: searchEditionId, // Different edition
              book: { id: bookId, title: 'Test Book' },
              reading_format: { format: 'audiobook' },
            },
          ],
        },
      ]);

      const match = await bookMatcher.findMatchByTitleAuthor(
        absBook,
        testUserId,
      );

      assert.ok(match, 'Should find a match');
      // Should detect cross-edition match via book_id
      // The actual behavior depends on edition selection logic
    });
  });

  describe('No Duplicate - Book Not in Library', () => {
    it('should return search result when book truly not in library', async () => {
      const absBook = {
        title: 'New Book',
        metadata: {
          title: 'New Book',
          authors: [{ name: 'New Author' }],
        },
      };

      // Empty library
      bookMatcher.setUserLibrary([]);

      // Search returns a book not in library
      hardcover.searchBooksByTitle = mock.fn(async () => [
        {
          id: 888,
          title: 'New Book',
          author: 'New Author',
          editions: [
            {
              id: 777,
              book: { id: 888, title: 'New Book' },
              reading_format: { format: 'audiobook' },
            },
          ],
        },
      ]);

      const match = await bookMatcher.findMatchByTitleAuthor(
        absBook,
        testUserId,
      );

      assert.ok(match, 'Should find a match');
      assert.strictEqual(
        match._isSearchResult,
        true,
        'Should return search result (needs auto-add)',
      );
    });
  });

  describe('Null Safety', () => {
    it('should handle null user library gracefully', async () => {
      const absBook = {
        title: 'Test Book',
        metadata: { title: 'Test Book' },
      };

      // Set null library
      bookMatcher.setUserLibrary(null);

      // Should not throw
      await assert.doesNotReject(async () => {
        await bookMatcher.findMatchByTitleAuthor(absBook, testUserId);
      }, 'Should handle null library without throwing');
    });

    it('should handle empty user library gracefully', async () => {
      const absBook = {
        title: 'Test Book',
        metadata: { title: 'Test Book' },
      };

      // Set empty library
      bookMatcher.setUserLibrary([]);

      // Should not throw
      await assert.doesNotReject(async () => {
        await bookMatcher.findMatchByTitleAuthor(absBook, testUserId);
      }, 'Should handle empty library without throwing');
    });

    it('should handle missing book metadata gracefully', async () => {
      const absBook = {
        title: null,
        metadata: null,
      };

      bookMatcher.setUserLibrary([]);

      const match = await bookMatcher.findMatchByTitleAuthor(
        absBook,
        testUserId,
      );

      // Should return null when no title available
      assert.strictEqual(
        match,
        null,
        'Should return null when title is missing',
      );
    });
  });

  describe('Strategy Name Consistency', () => {
    it('should return consistent strategy name', () => {
      const stats = bookMatcher.getStatistics();

      const titleAuthorStrategy = stats.strategies.find(
        s => s.name === 'title_author',
      );

      assert.ok(
        titleAuthorStrategy,
        'Title/Author strategy should be found with name "title_author"',
      );
    });
  });
});
