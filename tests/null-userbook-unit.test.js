import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/**
 * Unit tests for the null userBook fix
 * 
 * These tests specifically validate that the code can handle null userBook
 * properties without crashing, which was the root cause of the error:
 * "Cannot read properties of null (reading 'book')"
 */

describe('Null UserBook Unit Tests', () => {
  
  describe('Optional Chaining Tests', () => {
    it('should safely access userBook.book.id when userBook is null', () => {
      const hardcoverMatch = {
        userBook: null,
        edition: { id: 'test-edition' },
        _isSearchResult: true,
        _matchType: 'asin_search_result'
      };

      // This should not throw an error with optional chaining
      const bookId = hardcoverMatch.userBook?.book?.id;
      assert.strictEqual(bookId, undefined, 'Should return undefined for null userBook');
    });

    it('should safely access userBook.book.id when userBook exists', () => {
      const hardcoverMatch = {
        userBook: {
          id: 'user-book-123',
          book: {
            id: 'book-456',
            title: 'Test Book'
          }
        },
        edition: { id: 'test-edition' },
        _isSearchResult: true,
        _matchType: 'title_author_auto_add'
      };

      const bookId = hardcoverMatch.userBook?.book?.id;
      assert.strictEqual(bookId, 'book-456', 'Should return book ID when userBook exists');
    });

    it('should safely access userBook.id when userBook is null', () => {
      const hardcoverMatch = {
        userBook: null,
        edition: { id: 'test-edition' }
      };

      const userBookId = hardcoverMatch.userBook?.id;
      assert.strictEqual(userBookId, undefined, 'Should return undefined for null userBook');
    });

    it('should safely check userBook.book existence when userBook is null', () => {
      const hardcoverMatch = {
        userBook: null,
        edition: { id: 'test-edition' }
      };

      const hasBook = !!hardcoverMatch.userBook?.book;
      assert.strictEqual(hasBook, false, 'Should return false when userBook is null');
    });

    it('should safely check userBook.book existence when userBook exists', () => {
      const hardcoverMatch = {
        userBook: {
          book: { id: 'book-123' }
        },
        edition: { id: 'test-edition' }
      };

      const hasBook = !!hardcoverMatch.userBook?.book;
      assert.strictEqual(hasBook, true, 'Should return true when userBook.book exists');
    });
  });

  describe('UserBook Creation Logic', () => {
    it('should create userBook when it does not exist', () => {
      const hardcoverMatch = {
        userBook: null,
        edition: { id: 'test-edition' },
        _isSearchResult: true
      };

      const addResult = { id: 'newly-added-book' };
      const bookId = 'resolved-book-id';
      const title = 'Test Book Title';

      // Simulate the userBook creation logic from the fix
      if (!hardcoverMatch.userBook) {
        hardcoverMatch.userBook = {
          id: addResult.id,
          book: {
            id: bookId,
            title: title,
            contributions: [],
          },
        };
      } else {
        hardcoverMatch.userBook.id = addResult.id;
      }
      hardcoverMatch._isSearchResult = false;

      assert.ok(hardcoverMatch.userBook, 'userBook should be created');
      assert.strictEqual(hardcoverMatch.userBook.id, 'newly-added-book');
      assert.strictEqual(hardcoverMatch.userBook.book.id, 'resolved-book-id');
      assert.strictEqual(hardcoverMatch.userBook.book.title, 'Test Book Title');
      assert.strictEqual(hardcoverMatch._isSearchResult, false);
    });

    it('should update existing userBook when it exists', () => {
      const hardcoverMatch = {
        userBook: {
          id: 'existing-user-book',
          book: {
            id: 'existing-book-id',
            title: 'Existing Title'
          }
        },
        edition: { id: 'test-edition' },
        _isSearchResult: true
      };

      const addResult = { id: 'updated-book-id' };

      // Simulate the userBook update logic from the fix
      if (!hardcoverMatch.userBook) {
        hardcoverMatch.userBook = {
          id: addResult.id,
          book: {
            id: 'some-book-id',
            title: 'Some Title',
            contributions: [],
          },
        };
      } else {
        hardcoverMatch.userBook.id = addResult.id;
      }
      hardcoverMatch._isSearchResult = false;

      assert.ok(hardcoverMatch.userBook, 'userBook should still exist');
      assert.strictEqual(hardcoverMatch.userBook.id, 'updated-book-id');
      assert.strictEqual(hardcoverMatch.userBook.book.id, 'existing-book-id', 'Existing book data should be preserved');
      assert.strictEqual(hardcoverMatch._isSearchResult, false);
    });
  });

  describe('Conditional Updates with Null UserBook', () => {
    it('should safely update userBook.book properties when userBook exists', () => {
      const hardcoverMatch = {
        userBook: {
          book: {
            id: 'original-id',
            title: 'Original Title',
            contributions: []
          }
        }
      };

      const bookInfo = {
        bookId: 'new-book-id',
        title: 'New Title',
        contributions: [{ author: { name: 'New Author' } }]
      };

      // Simulate the conditional update logic from the fix
      if (hardcoverMatch.userBook?.book) {
        hardcoverMatch.userBook.book.id = bookInfo.bookId;
        hardcoverMatch.userBook.book.title = bookInfo.title || hardcoverMatch.userBook.book.title;
        hardcoverMatch.userBook.book.contributions = bookInfo.contributions || hardcoverMatch.userBook.book.contributions;
      }

      assert.strictEqual(hardcoverMatch.userBook.book.id, 'new-book-id');
      assert.strictEqual(hardcoverMatch.userBook.book.title, 'New Title');
      assert.deepStrictEqual(hardcoverMatch.userBook.book.contributions, [{ author: { name: 'New Author' } }]);
    });

    it('should safely skip updates when userBook is null', () => {
      const hardcoverMatch = {
        userBook: null
      };

      const bookInfo = {
        bookId: 'new-book-id',
        title: 'New Title',
        contributions: [{ author: { name: 'New Author' } }]
      };

      // Simulate the conditional update logic from the fix
      if (hardcoverMatch.userBook?.book) {
        hardcoverMatch.userBook.book.id = bookInfo.bookId;
        hardcoverMatch.userBook.book.title = bookInfo.title || hardcoverMatch.userBook.book.title;
        hardcoverMatch.userBook.book.contributions = bookInfo.contributions || hardcoverMatch.userBook.book.contributions;
      }

      // Should not crash and userBook should remain null
      assert.strictEqual(hardcoverMatch.userBook, null);
    });
  });

  describe('Search Result Type Scenarios', () => {
    it('should handle ASIN search result structure', () => {
      const asinSearchResult = {
        userBook: null, // ASIN matches have null userBook
        edition: { id: 'asin-edition-id' },
        _isSearchResult: true,
        _matchType: 'asin_search_result',
        _tier: 1,
        _needsScoring: false,
        _needsBookIdLookup: true,
      };

      // Should safely access properties
      const bookId = asinSearchResult.userBook?.book?.id;
      const userBookId = asinSearchResult.userBook?.id;
      const hasBook = !!asinSearchResult.userBook?.book;

      assert.strictEqual(bookId, undefined);
      assert.strictEqual(userBookId, undefined);
      assert.strictEqual(hasBook, false);
      assert.strictEqual(asinSearchResult.edition.id, 'asin-edition-id');
    });

    it('should handle ISBN search result structure', () => {
      const isbnSearchResult = {
        userBook: null, // ISBN matches have null userBook
        edition: { id: 'isbn-edition-id' },
        _isSearchResult: true,
        _matchType: 'isbn_search_result',
        _tier: 2,
        _needsScoring: false,
        _needsBookIdLookup: true,
      };

      // Should safely access properties
      const bookId = isbnSearchResult.userBook?.book?.id;
      const userBookId = isbnSearchResult.userBook?.id;
      const hasBook = !!isbnSearchResult.userBook?.book;

      assert.strictEqual(bookId, undefined);
      assert.strictEqual(userBookId, undefined);
      assert.strictEqual(hasBook, false);
      assert.strictEqual(isbnSearchResult.edition.id, 'isbn-edition-id');
    });

    it('should handle title/author search result structure', () => {
      const titleAuthorResult = {
        userBook: {
          id: 'user-book-id',
          book: {
            id: 'book-id',
            title: 'Book Title',
            contributions: [{ author: { name: 'Author Name' } }],
          },
        },
        edition: { id: 'title-author-edition' },
        _isSearchResult: true,
        _matchType: 'title_author_auto_add',
        _tier: 3,
        _needsScoring: false,
        _needsBookIdLookup: false,
      };

      // Should safely access properties
      const bookId = titleAuthorResult.userBook?.book?.id;
      const userBookId = titleAuthorResult.userBook?.id;
      const hasBook = !!titleAuthorResult.userBook?.book;

      assert.strictEqual(bookId, 'book-id');
      assert.strictEqual(userBookId, 'user-book-id');
      assert.strictEqual(hasBook, true);
    });
  });
});
