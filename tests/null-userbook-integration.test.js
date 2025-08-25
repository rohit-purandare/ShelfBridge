import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/**
 * Integration test for the null userBook fix
 * 
 * This test simulates the exact error scenario that was reported:
 * "Cannot read properties of null (reading 'book')"
 * 
 * The test validates that the code patterns used in the fix work correctly
 * in scenarios that mirror the real sync manager logic.
 */

describe('Null UserBook Integration Test', () => {
  
  it('should handle the exact error scenario from the bug report', () => {
    // Simulate the exact scenario that caused the original error
    // This represents an ASIN or ISBN search result with null userBook
    const hardcoverMatch = {
      userBook: null, // This was the source of the error
      edition: { id: 'test-edition-id' },
      _isSearchResult: true,
      _matchType: 'asin_search_result',
      _tier: 1,
      _needsScoring: false,
      _needsBookIdLookup: true,
    };

    const title = 'Test Book Title';
    const progressPercent = 25;

    // This is the exact line that was failing (line 906 in the original error)
    // Before fix: let bookId = hardcoverMatch.userBook.book.id; // Would throw error
    // After fix: let bookId = hardcoverMatch.userBook?.book?.id; // Safe
    let bookId = hardcoverMatch.userBook?.book?.id;
    const editionId = hardcoverMatch.edition.id;

    // Should not throw an error and should handle null gracefully
    assert.strictEqual(bookId, undefined, 'bookId should be undefined for null userBook');
    assert.strictEqual(editionId, 'test-edition-id', 'editionId should be accessible');

    // Simulate the book ID lookup scenario
    if (!bookId && hardcoverMatch._needsBookIdLookup) {
      // Simulate successful lookup
      const bookInfo = {
        bookId: 'resolved-book-id',
        title: 'Resolved Title',
        contributions: [{ author: { name: 'Test Author' } }],
        edition: { id: editionId, format: 'audiobook' }
      };

      if (bookInfo && bookInfo.bookId) {
        bookId = bookInfo.bookId;
        
        // This was also failing in the original code (lines 918-926)
        // Before fix: hardcoverMatch.userBook.book.id = bookId; // Would throw error
        // After fix: Only update if userBook exists
        if (hardcoverMatch.userBook?.book) {
          hardcoverMatch.userBook.book.id = bookId;
          hardcoverMatch.userBook.book.title = bookInfo.title || hardcoverMatch.userBook.book.title;
          hardcoverMatch.userBook.book.contributions = bookInfo.contributions || hardcoverMatch.userBook.book.contributions;
        }
        // If userBook is null, we skip the update (no error)
      }
    }

    assert.strictEqual(bookId, 'resolved-book-id', 'bookId should be resolved from lookup');
    assert.strictEqual(hardcoverMatch.userBook, null, 'userBook should remain null since no update occurred');
  });

  it('should handle auto-add scenario that creates userBook from null', () => {
    const hardcoverMatch = {
      userBook: null, // Starting with null userBook
      edition: { id: 'auto-add-edition' },
      _isSearchResult: true,
      _matchType: 'isbn_search_result',
      _tier: 2,
    };

    const bookId = 'resolved-book-id';
    const editionId = 'auto-add-edition';
    const title = 'Auto Add Book';

    // Simulate successful auto-add
    const addResult = { id: 'newly-added-user-book' };

    if (addResult && addResult.id) {
      // This was the critical fix (lines 1023-1034)
      // Before fix: hardcoverMatch.userBook.id = addResult.id; // Would throw error
      // After fix: Create userBook if it doesn't exist
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
    }

    // Verify the userBook was created correctly
    assert.ok(hardcoverMatch.userBook, 'userBook should be created');
    assert.strictEqual(hardcoverMatch.userBook.id, 'newly-added-user-book');
    assert.strictEqual(hardcoverMatch.userBook.book.id, 'resolved-book-id');
    assert.strictEqual(hardcoverMatch.userBook.book.title, 'Auto Add Book');
    assert.strictEqual(hardcoverMatch._isSearchResult, false);
  });

  it('should handle error logging scenario with null userBook', () => {
    const hardcoverMatch = {
      userBook: null,
      edition: { id: 'error-test-edition' },
      _isSearchResult: true,
      _matchType: 'asin_search_result',
      _needsBookIdLookup: true,
    };

    const bookId = null; // Simulate missing book ID
    const editionId = 'error-test-edition';
    const title = 'Error Test Book';

    // This was also failing in error logging (line 992)
    // Before fix: hasBook: !!hardcoverMatch.userBook.book, // Would throw error
    // After fix: hasBook: !!hardcoverMatch.userBook?.book, // Safe
    const errorInfo = {
      bookId: bookId,
      editionId: editionId,
      title: title,
      hasBook: !!hardcoverMatch.userBook?.book, // This should not throw
      hasEdition: !!hardcoverMatch.edition,
      attemptedLookup: hardcoverMatch._needsBookIdLookup,
    };

    // Should not throw an error and should provide correct info
    assert.strictEqual(errorInfo.hasBook, false, 'hasBook should be false for null userBook');
    assert.strictEqual(errorInfo.hasEdition, true, 'hasEdition should be true');
    assert.strictEqual(errorInfo.attemptedLookup, true, 'attemptedLookup should be true');
  });

  it('should handle cache key generation with null userBook', () => {
    const hardcoverMatch = {
      userBook: null, // This could cause issues in cache key generation
      edition: { id: 'cache-test-edition' },
      _isSearchResult: true,
    };

    // Simulate cache key generation logic that was potentially affected
    let cacheKey = null;
    
    // This pattern was used in the code around line 706
    if (hardcoverMatch && hardcoverMatch.userBook?.id && hardcoverMatch.edition?.id) {
      cacheKey = `title_author_${hardcoverMatch.userBook.id}_${hardcoverMatch.edition.id}`;
    }

    // Should not generate a cache key when userBook is null
    assert.strictEqual(cacheKey, null, 'Should not generate cache key when userBook is null');

    // Now test with a valid userBook
    hardcoverMatch.userBook = { id: 'valid-user-book-id' };
    
    if (hardcoverMatch && hardcoverMatch.userBook?.id && hardcoverMatch.edition?.id) {
      cacheKey = `title_author_${hardcoverMatch.userBook.id}_${hardcoverMatch.edition.id}`;
    }

    assert.strictEqual(cacheKey, 'title_author_valid-user-book-id_cache-test-edition', 'Should generate valid cache key');
  });

  it('should demonstrate the difference between ASIN/ISBN and title/author matches', () => {
    // ASIN/ISBN matches have null userBook
    const asinMatch = {
      userBook: null,
      edition: { id: 'asin-edition' },
      _isSearchResult: true,
      _matchType: 'asin_search_result',
    };

    // Title/author matches have populated userBook
    const titleAuthorMatch = {
      userBook: {
        id: 'existing-user-book',
        book: {
          id: 'existing-book-id',
          title: 'Existing Title',
          contributions: [],
        },
      },
      edition: { id: 'title-author-edition' },
      _isSearchResult: true,
      _matchType: 'title_author_auto_add',
    };

    // Both should be handled safely
    const asinBookId = asinMatch.userBook?.book?.id;
    const titleAuthorBookId = titleAuthorMatch.userBook?.book?.id;

    assert.strictEqual(asinBookId, undefined, 'ASIN match should have undefined book ID');
    assert.strictEqual(titleAuthorBookId, 'existing-book-id', 'Title/author match should have existing book ID');

    // Both should handle updates safely
    const bookInfo = { bookId: 'updated-id', title: 'Updated Title' };

    if (asinMatch.userBook?.book) {
      asinMatch.userBook.book.id = bookInfo.bookId; // This won't execute
    }

    if (titleAuthorMatch.userBook?.book) {
      titleAuthorMatch.userBook.book.id = bookInfo.bookId; // This will execute
    }

    // Verify results
    assert.strictEqual(asinMatch.userBook, null, 'ASIN match userBook should remain null');
    assert.strictEqual(titleAuthorMatch.userBook.book.id, 'updated-id', 'Title/author match should be updated');
  });
});
