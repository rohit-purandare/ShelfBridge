import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { AsinMatcher } from '../src/matching/strategies/asin-matcher.js';
import { IsbnMatcher } from '../src/matching/strategies/isbn-matcher.js';
import { isIdentifierTitlePlausible } from '../src/matching/utils/identifier-title-validator.js';
import { SyncManager } from '../src/sync-manager.js';

function createAutoAddManager({
  asinResults = [],
  isbnResults = [],
  titleAuthorMatch = null,
}) {
  return {
    userId: 'test-user',
    dryRun: false,
    hardcoverBooks: [],
    globalConfig: { force_sync: false },
    hardcover: {
      searchBooksByAsin: mock.fn(async () => asinResults),
      searchBooksByIsbn: mock.fn(async () => isbnResults),
      addBookToLibrary: mock.fn(async () => ({ id: 'user-book-1' })),
    },
    bookMatcher: {
      findMatchByTitleAuthor: mock.fn(async () => titleAuthorMatch),
    },
    cache: {
      generateTitleAuthorIdentifier: () =>
        'title_author:fourth_wing|rebecca_yarros',
      getCachedBookInfo: mock.fn(async () => ({ exists: false })),
      storeBookSyncData: mock.fn(async () => {}),
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

describe('Identifier title validation', () => {
  it('rejects a single book mapped to a multi-book collection', () => {
    assert.equal(
      isIdentifierTitlePlausible(
        'Fourth Wing: Empyrean, Book 1',
        'The Empyrean Series, 3 Books Collection Set, Fourth Wing, Iron Flame, Onyx Storm, by Rebecca Yarros',
      ),
      false,
    );
    assert.equal(
      isIdentifierTitlePlausible(
        'Fourth Wing: 3 Book Collection',
        'Fourth Wing',
      ),
      false,
    );
    assert.equal(
      isIdentifierTitlePlausible(
        'Fourth Wing: 3 Book Collection',
        'Fourth Wing: 2 Book Collection',
      ),
      false,
    );
  });

  it('rejects distinct works with shared series or volume titles', () => {
    const conflictingTitles = [
      ['The Sandman: Act II', 'The Sandman: Act I'],
      ['Mistborn: The Final Empire', 'Mistborn: The Well of Ascension'],
      ['Example Book 1', 'Example Book 2'],
      ['Example Volume 1', 'Example Volume 2'],
      ['Example Part One', 'Example Part Two'],
    ];

    for (const [sourceTitle, candidateTitle] of conflictingTitles) {
      assert.equal(
        isIdentifierTitlePlausible(sourceTitle, candidateTitle),
        false,
        `${sourceTitle} should not match ${candidateTitle}`,
      );
    }
  });

  it('intentionally fails closed for regional titles without corroborating metadata', () => {
    // These are the same work under UK and US titles. Title-only validation
    // cannot establish that alias, so metadata-aware fallback must decide it.
    assert.equal(
      isIdentifierTitlePlausible('Northern Lights', 'The Golden Compass'),
      false,
    );
    assert.equal(
      isIdentifierTitlePlausible('The Golden Compass', 'Northern Lights'),
      false,
    );
  });

  it('accepts common subtitle differences for the same book', () => {
    assert.equal(
      isIdentifierTitlePlausible(
        'Ready Player Two: A Novel',
        'Ready Player Two',
      ),
      true,
    );
    assert.equal(
      isIdentifierTitlePlausible(
        'The Way of Kings: The Stormlight Archive, Book 1',
        'The Way of Kings',
      ),
      true,
    );
    assert.equal(
      isIdentifierTitlePlausible(
        "The Emperor's Soul [Dramatized Adaptation]: Elantris",
        "The Emperor's Soul",
      ),
      true,
    );
  });

  it('does not return a conflicting global ASIN result', async () => {
    const matcher = new AsinMatcher({
      searchBooksByAsin: mock.fn(async () => [
        {
          id: 'collection-edition',
          book: {
            id: 'collection-book',
            title:
              'The Empyrean Series, 3 Books Collection Set, Fourth Wing, Iron Flame, Onyx Storm, by Rebecca Yarros',
          },
        },
      ]),
    });

    const result = await matcher.findMatch(
      { media: { metadata: { title: 'Fourth Wing: Empyrean, Book 1' } } },
      { asin: 'B0BVD25SYT' },
      {},
      () => null,
    );

    assert.equal(result, null);
  });

  it('rejects conflicting direct ASIN and ISBN library matches', async () => {
    const conflictingMatch = {
      userBook: {
        id: 'collection-user-book',
        book: {
          title:
            'The Empyrean Series, 3 Books Collection Set, Fourth Wing, Iron Flame, Onyx Storm, by Rebecca Yarros',
        },
      },
      edition: { id: 'collection-edition' },
    };
    const absBook = {
      media: { metadata: { title: 'Fourth Wing: Empyrean, Book 1' } },
    };

    const asinResult = await new AsinMatcher().findMatch(
      absBook,
      { asin: 'B0BVD25SYT' },
      { B0BVD25SYT: conflictingMatch },
    );
    const isbnResult = await new IsbnMatcher().findMatch(
      absBook,
      { isbn: '9780575082014' },
      { 9780575082014: conflictingMatch },
    );

    assert.equal(asinResult, null);
    assert.equal(isbnResult, null);
  });

  it('falls back to title matching after rejecting an identifier title', async () => {
    const correctBook = { id: 'fourth-wing-book', title: 'Fourth Wing' };
    const correctEdition = {
      id: 'fourth-wing-audio',
      book: correctBook,
      audio_seconds: 76920,
      reading_format: { format: 'Listened' },
    };
    const manager = createAutoAddManager({
      asinResults: [
        {
          id: 'collection-edition',
          book: {
            id: 'collection-book',
            title:
              'The Empyrean Series, 3 Books Collection Set, Fourth Wing, Iron Flame, Onyx Storm, by Rebecca Yarros',
          },
          reading_format: { format: 'Listened' },
        },
      ],
      titleAuthorMatch: {
        userBook: null,
        book: correctBook,
        edition: correctEdition,
        _matchType: 'title_author_two_stage',
        _isSearchResult: true,
      },
    });

    const result = await SyncManager.prototype._tryAutoAddBook.call(
      manager,
      {
        media: {
          metadata: {
            title: 'Fourth Wing: Empyrean, Book 1',
            author: 'Rebecca Yarros',
          },
        },
      },
      { asin: 'B0BVD25SYT', isbn: null },
      'Fourth Wing: Empyrean, Book 1',
      'Rebecca Yarros',
    );

    assert.equal(result.status, 'auto_added');
    assert.deepEqual(
      manager.hardcover.addBookToLibrary.mock.calls[0].arguments,
      ['fourth-wing-book', 2, 'fourth-wing-audio'],
    );
  });

  it('tries ISBN after rejecting conflicting ASIN results', async () => {
    const manager = createAutoAddManager({
      asinResults: [
        {
          id: 'collection-edition',
          book: {
            id: 'collection-book',
            title:
              'The Empyrean Series, 3 Books Collection Set, Fourth Wing, Iron Flame, Onyx Storm, by Rebecca Yarros',
          },
          reading_format: { format: 'Listened' },
        },
      ],
      isbnResults: [
        {
          id: 'fourth-wing-audio',
          book: { id: 'fourth-wing-book', title: 'Fourth Wing' },
          audio_seconds: 76920,
          reading_format: { format: 'Listened' },
        },
      ],
    });

    const result = await SyncManager.prototype._tryAutoAddBook.call(
      manager,
      {
        media: {
          metadata: {
            title: 'Fourth Wing: Empyrean, Book 1',
            author: 'Rebecca Yarros',
          },
        },
      },
      { asin: 'B0BVD25SYT', isbn: '9781649374042' },
      'Fourth Wing: Empyrean, Book 1',
      'Rebecca Yarros',
    );

    assert.equal(result.status, 'auto_added');
    assert.equal(manager.hardcover.searchBooksByIsbn.mock.calls.length, 1);
    assert.equal(
      manager.bookMatcher.findMatchByTitleAuthor.mock.calls.length,
      0,
    );
    assert.deepEqual(
      manager.hardcover.addBookToLibrary.mock.calls[0].arguments,
      ['fourth-wing-book', 2, 'fourth-wing-audio'],
    );
  });
});
