import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { SyncManager } from '../src/sync-manager.js';

function createManager(bookDetails) {
  return {
    userId: 'test-user',
    dryRun: true,
    globalConfig: { force_sync: false },
    hardcover: {
      searchBooksByAsin: mock.fn(async () => []),
      searchBooksByIsbn: mock.fn(async () => [
        {
          id: 'ebook-edition',
          isbn_13: '9781429952040',
          reading_format: { format: 'Ebook' },
          book: { id: 'rhythm-book', title: 'Rhythm of War' },
        },
      ]),
      getBookDetailsWithEditions: mock.fn(async () => bookDetails),
      addBookToLibrary: mock.fn(),
    },
    cache: {
      generateTitleAuthorIdentifier: () =>
        'title_author:rhythm_of_war|brandon_sanderson',
      getCachedBookInfo: mock.fn(async () => ({ exists: false })),
    },
    _checkFormatCompatibility: SyncManager.prototype._checkFormatCompatibility,
    _mapHardcoverFormatToInternal:
      SyncManager.prototype._mapHardcoverFormatToInternal,
    _areFormatsCompatible: SyncManager.prototype._areFormatsCompatible,
    _getEditionProgressBasis: SyncManager.prototype._getEditionProgressBasis,
    _isEditionProgressCapable: SyncManager.prototype._isEditionProgressCapable,
    _selectProgressCapableEdition:
      SyncManager.prototype._selectProgressCapableEdition,
    _resolveProgressCapableAutoAddEdition:
      SyncManager.prototype._resolveProgressCapableAutoAddEdition,
  };
}

describe('Audiobook auto-add edition selection', () => {
  it('does not treat an ebook edition as audiobook-compatible', () => {
    assert.equal(
      SyncManager.prototype._areFormatsCompatible('audiobook', 'ebook'),
      false,
    );
  });

  it('keeps the identifier-matched book and selects its audiobook edition', async () => {
    const manager = createManager({
      id: 'rhythm-book',
      title: 'Rhythm of War',
      editions: [
        {
          id: 'ebook-edition',
          reading_format: { format: 'Ebook' },
          pages: 1213,
        },
        {
          id: 'audiobook-edition',
          reading_format: { format: 'Listened' },
          audio_seconds: 206760,
          users_count: 50,
        },
      ],
    });

    const result = await SyncManager.prototype._tryAutoAddBook.call(
      manager,
      {
        duration: 190000,
        media: {
          metadata: {
            title: 'Rhythm of War: Book Four of the Stormlight Archive',
            author: 'Brandon Sanderson',
          },
        },
      },
      { asin: null, isbn: '9781429952040' },
      'Rhythm of War: Book Four of the Stormlight Archive',
      'Brandon Sanderson',
    );

    assert.equal(result.status, 'auto_added');
    assert.equal(result.bookId, 'rhythm-book');
    assert.equal(result.editionId, 'audiobook-edition');
    assert.equal(
      manager.hardcover.getBookDetailsWithEditions.mock.callCount(),
      1,
    );
    assert.equal(manager.hardcover.addBookToLibrary.mock.callCount(), 0);
  });

  it('keeps the correct book when its audiobook duration differs', async () => {
    const manager = createManager({
      id: 'rhythm-book',
      title: 'Rhythm of War',
      editions: [
        {
          id: 'different-duration-audiobook',
          reading_format: { format: 'Listened' },
          audio_seconds: 250000,
        },
      ],
    });

    const result = await SyncManager.prototype._tryAutoAddBook.call(
      manager,
      {
        duration: 190000,
        media: {
          metadata: {
            title: 'Rhythm of War: Book Four of the Stormlight Archive',
            author: 'Brandon Sanderson',
          },
        },
      },
      { asin: null, isbn: '9781429952040' },
      'Rhythm of War: Book Four of the Stormlight Archive',
      'Brandon Sanderson',
    );

    assert.equal(result.status, 'auto_added');
    assert.equal(result.bookId, 'rhythm-book');
    assert.equal(result.editionId, 'different-duration-audiobook');
  });

  it('uses summed ABS file duration to choose the closest audiobook edition', async () => {
    const manager = createManager({
      id: 'rhythm-book',
      title: 'Rhythm of War',
      editions: [
        {
          id: 'far-duration-audiobook',
          reading_format: { format: 'Listened' },
          audio_seconds: 40000,
          users_count: 10,
        },
        {
          id: 'close-duration-audiobook',
          reading_format: { format: 'Listened' },
          audio_seconds: 20500,
          users_count: 10,
        },
      ],
    });

    const result = await SyncManager.prototype._tryAutoAddBook.call(
      manager,
      {
        media: {
          audioFiles: [{ duration: 10000 }, { duration: 10000 }],
          metadata: {
            title: 'Rhythm of War: Book Four of the Stormlight Archive',
            author: 'Brandon Sanderson',
          },
        },
      },
      { asin: null, isbn: '9781429952040' },
      'Rhythm of War: Book Four of the Stormlight Archive',
      'Brandon Sanderson',
    );

    assert.equal(result.status, 'auto_added');
    assert.equal(result.bookId, 'rhythm-book');
    assert.equal(result.editionId, 'close-duration-audiobook');
  });

  it('checks same-book editions when the identifier audiobook has the wrong duration', async () => {
    const manager = createManager({
      id: 'rhythm-book',
      title: 'Rhythm of War',
      editions: [
        {
          id: 'identifier-audiobook',
          asin: 'B082FARAWAY',
          reading_format: { format: 'Listened' },
          audio_seconds: 40000,
          users_count: 10,
        },
        {
          id: 'different-identifier-close-audiobook',
          asin: 'B082CLOSER1',
          reading_format: { format: 'Listened' },
          audio_seconds: 20500,
          users_count: 10,
        },
      ],
    });
    manager.hardcover.searchBooksByIsbn = mock.fn(async () => [
      {
        id: 'identifier-audiobook',
        reading_format: { format: 'Listened' },
        audio_seconds: 40000,
        book: { id: 'rhythm-book', title: 'Rhythm of War' },
      },
    ]);

    const result = await SyncManager.prototype._tryAutoAddBook.call(
      manager,
      {
        media: {
          audioFiles: [{ duration: 10000 }, { duration: 10000 }],
          metadata: {
            title: 'Rhythm of War: Book Four of the Stormlight Archive',
            author: 'Brandon Sanderson',
          },
        },
      },
      { asin: null, isbn: '9781429952040' },
      'Rhythm of War: Book Four of the Stormlight Archive',
      'Brandon Sanderson',
    );

    assert.equal(result.status, 'auto_added');
    assert.equal(result.bookId, 'rhythm-book');
    assert.equal(result.editionId, 'different-identifier-close-audiobook');
  });
});
