import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { SyncManager } from '../src/sync-manager.js';

describe('Within-run auto-add deduplication', () => {
  it('reserves a Hardcover book before concurrent dry-run additions', async () => {
    const hardcoverBook = { id: 'lost-metal-book', title: 'The Lost Metal' };
    const searchBooksByAsin = mock.fn(async () => [
      {
        id: 'lost-metal-audio',
        asin: 'B09N7MXRNZ',
        audio_seconds: 67620,
        reading_format: { format: 'Listened' },
        book: hardcoverBook,
      },
    ]);
    const manager = {
      userId: 'test-user',
      dryRun: true,
      globalConfig: { force_sync: false },
      autoAddReservations: new Map(),
      hardcover: {
        searchBooksByAsin,
        searchBooksByIsbn: mock.fn(async () => []),
        addBookToLibrary: mock.fn(),
      },
      cache: {
        generateTitleAuthorIdentifier: () =>
          'title_author:the_lost_metal|brandon_sanderson',
        getCachedBookInfo: mock.fn(async () => ({ exists: false })),
      },
      _checkFormatCompatibility:
        SyncManager.prototype._checkFormatCompatibility,
      _mapHardcoverFormatToInternal:
        SyncManager.prototype._mapHardcoverFormatToInternal,
      _areFormatsCompatible: SyncManager.prototype._areFormatsCompatible,
    };
    const createAbsBook = (id, duration) => ({
      id,
      media: {
        audioFiles: [{ duration }],
        metadata: {
          title: 'The Lost Metal: A Mistborn Novel',
          author: 'Brandon Sanderson',
        },
      },
    });
    const identifiers = { asin: 'B09N7MXRNZ', isbn: null };

    const results = await Promise.all([
      SyncManager.prototype._tryAutoAddBook.call(
        manager,
        createAbsBook('abs-lost-metal-standard', 67620),
        identifiers,
        'The Lost Metal: A Mistborn Novel',
        'Brandon Sanderson',
      ),
      SyncManager.prototype._tryAutoAddBook.call(
        manager,
        createAbsBook('abs-lost-metal-full-cast', 56822),
        identifiers,
        'The Lost Metal: A Mistborn Novel',
        'Brandon Sanderson',
      ),
    ]);

    assert.deepEqual(
      results.map(result => result.status).sort(),
      ['auto_added', 'skipped'],
    );
    assert.equal(results.filter(result => result.duplicate).length, 1);
    assert.equal(manager.autoAddReservations.size, 1);
    assert.equal(manager.hardcover.addBookToLibrary.mock.callCount(), 0);
  });
});
