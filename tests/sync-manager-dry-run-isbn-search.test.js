import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { SyncManager } from '../src/sync-manager.js';

describe('SyncManager dry-run ISBN search', () => {
  it('uses real read-only ISBN-13 search results for auto-add previews', async () => {
    const title = 'Project Hail Mary';
    const isbn = '9780593135211';
    const searchBooksByIsbn = mock.fn(async searchIsbn => [
      {
        id: 'hardcover-edition-1',
        isbn_13: searchIsbn,
        audio_seconds: 57600,
        reading_format: { format: 'Listened' },
        book: {
          id: 'hardcover-book-1',
          title,
        },
      },
    ]);
    const addBookToLibrary = mock.fn(async () => ({ id: 'user-book-1' }));

    const manager = {
      userId: 'test-user',
      dryRun: true,
      globalConfig: {
        force_sync: false,
      },
      hardcover: {
        searchBooksByAsin: mock.fn(async () => []),
        searchBooksByIsbn,
        addBookToLibrary,
      },
      cache: {
        generateTitleAuthorIdentifier: () => 'projecthailmary:andyweir',
        getCachedBookInfo: mock.fn(async () => ({ exists: false })),
      },
      _checkFormatCompatibility:
        SyncManager.prototype._checkFormatCompatibility,
      _mapHardcoverFormatToInternal:
        SyncManager.prototype._mapHardcoverFormatToInternal,
      _areFormatsCompatible: SyncManager.prototype._areFormatsCompatible,
      _getEditionProgressBasis: SyncManager.prototype._getEditionProgressBasis,
      _isEditionProgressCapable:
        SyncManager.prototype._isEditionProgressCapable,
      _selectProgressCapableEdition:
        SyncManager.prototype._selectProgressCapableEdition,
      _resolveProgressCapableAutoAddEdition:
        SyncManager.prototype._resolveProgressCapableAutoAddEdition,
    };

    const result = await SyncManager.prototype._tryAutoAddBook.call(
      manager,
      {
        id: 'abs-project-hail-mary',
        duration: 57600,
        media: {
          metadata: {
            title,
            author: 'Andy Weir',
            isbn,
          },
        },
      },
      {
        isbn,
        asin: null,
      },
      title,
      'Andy Weir',
    );

    assert.equal(result.status, 'auto_added');
    assert.equal(result.bookId, 'hardcover-book-1');
    assert.equal(result.editionId, 'hardcover-edition-1');
    assert.equal(searchBooksByIsbn.mock.callCount(), 1);
    assert.equal(searchBooksByIsbn.mock.calls[0].arguments[0], isbn);
    assert.equal(addBookToLibrary.mock.callCount(), 0);
  });

  it('uses read-only title/author fallback results in dry-run mode', async () => {
    const title = 'New Spring';
    const findMatchByTitleAuthor = mock.fn(async () => ({
      userBook: null,
      book: { id: 'hardcover-book-new-spring', title },
      edition: {
        id: 'hardcover-edition-new-spring',
        book: { id: 'hardcover-book-new-spring', title },
        audio_seconds: 43740,
        reading_format: { format: 'Listened' },
      },
      _matchType: 'title_author_two_stage',
      _isSearchResult: true,
    }));
    const addBookToLibrary = mock.fn(async () => ({ id: 'user-book-1' }));

    const manager = {
      userId: 'test-user',
      dryRun: true,
      hardcoverBooks: [],
      globalConfig: { force_sync: false },
      hardcover: {
        searchBooksByAsin: mock.fn(async () => []),
        searchBooksByIsbn: mock.fn(async () => []),
        addBookToLibrary,
      },
      bookMatcher: { findMatchByTitleAuthor },
      cache: {
        generateTitleAuthorIdentifier: () =>
          'title_author:new_spring|robert_jordan',
        getCachedBookInfo: mock.fn(async () => ({ exists: false })),
      },
      _checkFormatCompatibility:
        SyncManager.prototype._checkFormatCompatibility,
      _mapHardcoverFormatToInternal:
        SyncManager.prototype._mapHardcoverFormatToInternal,
      _areFormatsCompatible: SyncManager.prototype._areFormatsCompatible,
      _getEditionProgressBasis: SyncManager.prototype._getEditionProgressBasis,
      _isEditionProgressCapable:
        SyncManager.prototype._isEditionProgressCapable,
      _selectProgressCapableEdition:
        SyncManager.prototype._selectProgressCapableEdition,
      _resolveProgressCapableAutoAddEdition:
        SyncManager.prototype._resolveProgressCapableAutoAddEdition,
    };

    const result = await SyncManager.prototype._tryAutoAddBook.call(
      manager,
      {
        id: 'abs-new-spring',
        media: {
          metadata: {
            title,
            author: 'Robert Jordan',
            asin: 'B072325KCX',
          },
        },
      },
      { asin: 'B072325KCX', isbn: null },
      title,
      'Robert Jordan',
    );

    assert.equal(result.status, 'auto_added');
    assert.equal(result.bookId, 'hardcover-book-new-spring');
    assert.equal(result.editionId, 'hardcover-edition-new-spring');
    assert.equal(findMatchByTitleAuthor.mock.callCount(), 1);
    assert.equal(addBookToLibrary.mock.callCount(), 0);
  });
});
