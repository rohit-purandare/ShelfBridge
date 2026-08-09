import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { SyncManager } from '../src/sync-manager.js';

const hardcoverBook = { id: 'lost-metal-book', title: 'The Lost Metal' };
const identifiers = { asin: 'B09N7MXRNZ', isbn: null };

function createAbsBook(id, duration = 67620) {
  return {
    id,
    media: {
      audioFiles: [{ duration }],
      metadata: {
        title: 'The Lost Metal: A Mistborn Novel',
        author: 'Brandon Sanderson',
      },
    },
  };
}

function createManager({
  dryRun = false,
  addBookToLibrary = mock.fn(),
  storeBookSyncData = mock.fn(async () => {}),
} = {}) {
  return {
    userId: 'test-user',
    dryRun,
    globalConfig: { force_sync: false },
    autoAddReservations: new Map(),
    hardcover: {
      searchBooksByAsin: mock.fn(async () => [
        {
          id: 'lost-metal-audio',
          asin: 'B09N7MXRNZ',
          audio_seconds: 67620,
          reading_format: { format: 'Listened' },
          book: hardcoverBook,
        },
      ]),
      searchBooksByIsbn: mock.fn(async () => []),
      addBookToLibrary,
    },
    cache: {
      generateTitleAuthorIdentifier: () =>
        'title_author:the_lost_metal|brandon_sanderson',
      getCachedBookInfo: mock.fn(async () => ({ exists: false })),
      storeBookSyncData,
    },
    _checkFormatCompatibility: SyncManager.prototype._checkFormatCompatibility,
    _mapHardcoverFormatToInternal:
      SyncManager.prototype._mapHardcoverFormatToInternal,
    _areFormatsCompatible: SyncManager.prototype._areFormatsCompatible,
  };
}

function tryAutoAdd(manager, id) {
  return SyncManager.prototype._tryAutoAddBook.call(
    manager,
    createAbsBook(id),
    identifiers,
    'The Lost Metal: A Mistborn Novel',
    'Brandon Sanderson',
  );
}

describe('Within-run auto-add deduplication', () => {
  it('reserves a Hardcover book before concurrent dry-run additions', async () => {
    const manager = createManager({ dryRun: true });

    const results = await Promise.all([
      tryAutoAdd(manager, 'abs-lost-metal-standard'),
      tryAutoAdd(manager, 'abs-lost-metal-full-cast'),
    ]);

    assert.deepEqual(
      results.map(result => result.status).sort(),
      ['auto_added', 'skipped'],
    );
    assert.equal(results.filter(result => result.duplicate).length, 1);
    assert.equal(manager.autoAddReservations.size, 1);
    assert.equal(manager.hardcover.addBookToLibrary.mock.callCount(), 0);
  });

  it('releases a reservation when the add returns null', async () => {
    const addBookToLibrary = mock.fn(async () => null);
    const manager = createManager({ addBookToLibrary });

    const first = await tryAutoAdd(manager, 'abs-first');
    const second = await tryAutoAdd(manager, 'abs-second');

    assert.equal(first.status, 'error');
    assert.equal(second.status, 'error');
    assert.equal(addBookToLibrary.mock.callCount(), 2);
    assert.equal(manager.autoAddReservations.size, 0);
  });

  it('releases a reservation when the add throws', async () => {
    const addBookToLibrary = mock.fn(async () => {
      throw new Error('temporary add failure');
    });
    const manager = createManager({ addBookToLibrary });

    const first = await tryAutoAdd(manager, 'abs-first');
    const second = await tryAutoAdd(manager, 'abs-second');

    assert.equal(first.status, 'error');
    assert.equal(second.status, 'error');
    assert.equal(addBookToLibrary.mock.callCount(), 2);
    assert.equal(manager.autoAddReservations.size, 0);
  });

  it('lets a concurrent duplicate retry after the owner add fails', async () => {
    let resolveFirstAdd;
    const firstAdd = new Promise(resolve => {
      resolveFirstAdd = resolve;
    });
    const addBookToLibrary = mock.fn(async () => {
      if (addBookToLibrary.mock.callCount() === 1) return firstAdd;
      return null;
    });
    const manager = createManager({ addBookToLibrary });

    const firstPromise = tryAutoAdd(manager, 'abs-first');
    await new Promise(resolve => setImmediate(resolve));
    const secondPromise = tryAutoAdd(manager, 'abs-second');
    resolveFirstAdd(null);
    const results = await Promise.all([firstPromise, secondPromise]);

    assert.deepEqual(
      results.map(result => result.status),
      ['error', 'error'],
    );
    assert.equal(addBookToLibrary.mock.callCount(), 2);
    assert.equal(manager.autoAddReservations.size, 0);
  });

  it('retains the reservation after a successful add if caching fails', async () => {
    const addBookToLibrary = mock.fn(async () => ({ id: 'user-book-1' }));
    const manager = createManager({
      addBookToLibrary,
      storeBookSyncData: mock.fn(async () => {
        throw new Error('cache unavailable');
      }),
    });

    const first = await tryAutoAdd(manager, 'abs-first');
    const second = await tryAutoAdd(manager, 'abs-second');

    assert.equal(first.status, 'error');
    assert.equal(second.status, 'skipped');
    assert.equal(second.duplicate, true);
    assert.equal(addBookToLibrary.mock.callCount(), 1);
    assert.equal(manager.autoAddReservations.size, 1);
  });
});
