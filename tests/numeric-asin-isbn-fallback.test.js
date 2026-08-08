import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { AsinMatcher } from '../src/matching/strategies/asin-matcher.js';
import { getIsbn10FromNumericAsin } from '../src/matching/utils/text-matching.js';
import { SyncManager } from '../src/sync-manager.js';

describe('Numeric ASIN ISBN-10 fallback', () => {
  it('only treats valid numeric ISBN-10 values as fallback candidates', () => {
    assert.equal(getIsbn10FromNumericAsin('1250759781'), '1250759781');
    assert.equal(getIsbn10FromNumericAsin('B082FQRWWR'), null);
    assert.equal(getIsbn10FromNumericAsin('1250759782'), null);
  });

  it('retries a failed numeric ASIN lookup as ISBN-10 in AsinMatcher', async () => {
    const searchBooksByAsin = mock.fn(async () => []);
    const searchBooksByIsbn = mock.fn(async () => [
      {
        id: 'rhythm-audio',
        isbn_10: '1250759781',
        reading_format: { format: 'Listened' },
        book: { id: 'rhythm-book', title: 'Rhythm of War' },
      },
    ]);
    const matcher = new AsinMatcher({
      searchBooksByAsin,
      searchBooksByIsbn,
    });

    const result = await matcher.findMatch(
      {
        media: {
          metadata: {
            title: 'Rhythm of War: Book Four of the Stormlight Archive',
          },
        },
      },
      { asin: '1250759781' },
      {},
      () => null,
    );

    assert.equal(result.edition.id, 'rhythm-audio');
    assert.equal(result._matchType, 'isbn_search_result');
    assert.equal(searchBooksByAsin.mock.callCount(), 1);
    assert.equal(searchBooksByIsbn.mock.callCount(), 1);
    assert.equal(searchBooksByIsbn.mock.calls[0].arguments[0], '1250759781');
  });

  it('prefers numeric-ASIN ISBN results over a separate ebook ISBN', async () => {
    const searchBooksByIsbn = mock.fn(async isbn =>
      isbn === '1250759781'
        ? [
            {
              id: 'rhythm-audio',
              isbn_10: isbn,
              audio_seconds: 206760,
              reading_format: { format: 'Listened' },
              book: { id: 'rhythm-book', title: 'Rhythm of War' },
            },
          ]
        : [
            {
              id: 'rhythm-ebook',
              isbn_13: isbn,
              reading_format: { format: 'Ebook' },
              book: { id: 'rhythm-book', title: 'Rhythm of War' },
            },
          ],
    );
    const manager = {
      userId: 'test-user',
      dryRun: true,
      globalConfig: { force_sync: false },
      autoAddReservations: new Map(),
      hardcover: {
        searchBooksByAsin: mock.fn(async () => []),
        searchBooksByIsbn,
        addBookToLibrary: mock.fn(),
      },
      cache: {
        generateTitleAuthorIdentifier: () =>
          'title_author:rhythm_of_war|brandon_sanderson',
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
        media: {
          audioFiles: [{ duration: 206700 }],
          metadata: {
            title: 'Rhythm of War: Book Four of the Stormlight Archive',
            author: 'Brandon Sanderson',
          },
        },
      },
      { asin: '1250759781', isbn: '9781429952040' },
      'Rhythm of War: Book Four of the Stormlight Archive',
      'Brandon Sanderson',
    );

    assert.equal(result.status, 'auto_added');
    assert.equal(result.editionId, 'rhythm-audio');
    assert.equal(searchBooksByIsbn.mock.callCount(), 1);
    assert.equal(searchBooksByIsbn.mock.calls[0].arguments[0], '1250759781');
  });

  it('does not run ISBN fallback when a numeric ASIN already matches', async () => {
    const searchBooksByIsbn = mock.fn(async () => []);
    const manager = {
      userId: 'test-user',
      dryRun: true,
      globalConfig: { force_sync: false },
      autoAddReservations: new Map(),
      hardcover: {
        searchBooksByAsin: mock.fn(async () => [
          {
            id: 'ready-player-two-audio',
            asin: '0593396960',
            reading_format: { format: 'Listened' },
            book: { id: 'ready-player-two-book', title: 'Ready Player Two' },
          },
        ]),
        searchBooksByIsbn,
        addBookToLibrary: mock.fn(),
      },
      cache: {
        generateTitleAuthorIdentifier: () =>
          'title_author:ready_player_two|ernest_cline',
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
        media: {
          metadata: {
            title: 'Ready Player Two: A Novel',
            author: 'Ernest Cline',
          },
        },
      },
      { asin: '0593396960', isbn: null },
      'Ready Player Two: A Novel',
      'Ernest Cline',
    );

    assert.equal(result.editionId, 'ready-player-two-audio');
    assert.equal(searchBooksByIsbn.mock.callCount(), 0);
  });
});
