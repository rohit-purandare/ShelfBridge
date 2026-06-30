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
});
