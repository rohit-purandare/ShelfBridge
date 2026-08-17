import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { SyncManager } from '../src/sync-manager.js';
import { TitleAuthorMatcher } from '../src/matching/strategies/title-author-matcher.js';

function createTwoStageMatch() {
  return {
    userBook: null,
    book: {
      id: 292354,
      title: 'The Martian',
    },
    edition: {
      id: 30402186,
      format: 'Listened',
      reading_format: { format: 'Listened' },
      audio_seconds: 38400,
    },
    _matchType: 'title_author_two_stage',
    _isSearchResult: true,
  };
}

describe('Search-result auto-add guards', () => {
  it('uses the top-level book ID returned by two-stage matching', () => {
    const manager = Object.create(SyncManager.prototype);

    assert.equal(manager._getSearchResultBookId(createTwoStageMatch()), 292354);
  });

  it('does not auto-add search results when auto_add_books is disabled', async () => {
    const addBookToLibrary = mock.fn(async () => ({ id: 'user-book-1' }));
    const storeNegativeSyncSkip = mock.fn(async () => {});
    const manager = Object.create(SyncManager.prototype);

    Object.assign(manager, {
      userId: 'test-user',
      dryRun: false,
      verbose: false,
      timezone: 'UTC',
      globalConfig: {
        force_sync: true,
        auto_add_books: false,
        min_progress_threshold: 5,
      },
      bookMatcher: {
        findMatch: mock.fn(async () => ({
          match: createTwoStageMatch(),
          extractedMetadata: {},
        })),
      },
      cache: {
        generateTitleAuthorIdentifier: () =>
          'title_author:the_martian|andy_weir',
        getCachedBookInfo: mock.fn(async () => ({ exists: false })),
      },
      hardcover: { addBookToLibrary },
      _storeNegativeSyncSkip: storeNegativeSyncSkip,
    });

    const result = await manager._syncSingleBook(
      {
        id: 'abs-the-martian',
        progress_percentage: 100,
        media: {
          metadata: {
            title: 'The Martian',
            authors: [{ name: 'Andy Weir' }],
          },
        },
      },
      null,
    );

    assert.equal(result.status, 'skipped');
    assert.equal(
      result.reason,
      'Book not in Hardcover library and auto_add_books disabled',
    );
    assert.equal(addBookToLibrary.mock.callCount(), 0);
    assert.equal(storeNegativeSyncSkip.mock.callCount(), 1);
    assert.equal(
      storeNegativeSyncSkip.mock.calls[0].arguments.at(-1),
      'not_found_auto_add_disabled',
    );
  });

  it('auto-adds a two-stage match with its returned top-level book ID', async () => {
    const addBookToLibrary = mock.fn(async () => ({ id: 'user-book-1' }));
    const getBookEditions = mock.fn(async () => {
      throw new Error('A usable matched edition should not require a lookup');
    });
    const syncExistingBook = mock.fn(async () => ({
      status: 'synced',
      reason: 'test sync',
    }));
    const manager = Object.create(SyncManager.prototype);

    Object.assign(manager, {
      userId: 'test-user',
      dryRun: false,
      verbose: false,
      timezone: 'UTC',
      globalConfig: {
        force_sync: true,
        auto_add_books: true,
        min_progress_threshold: 5,
      },
      bookMatcher: {
        findMatch: mock.fn(async () => ({
          match: createTwoStageMatch(),
          extractedMetadata: {},
        })),
      },
      cache: {
        generateTitleAuthorIdentifier: () =>
          'title_author:the_martian|andy_weir',
        getCachedBookInfo: mock.fn(async () => ({ exists: false })),
      },
      hardcover: { addBookToLibrary, getBookEditions },
      sessionManager: {
        shouldDelayUpdate: mock.fn(async () => ({
          shouldDelay: false,
          reason: 'test sync',
        })),
        completeSession: mock.fn(async () => false),
      },
      _syncExistingBook: syncExistingBook,
      _clearNegativeSyncSkip: mock.fn(async () => {}),
    });

    const result = await manager._syncSingleBook(
      {
        id: 'abs-the-martian',
        progress_percentage: 100,
        media: {
          metadata: {
            title: 'The Martian',
            authors: [{ name: 'Andy Weir' }],
          },
        },
      },
      null,
    );

    assert.equal(result.status, 'synced');
    assert.equal(addBookToLibrary.mock.callCount(), 1);
    assert.deepEqual(
      addBookToLibrary.mock.calls[0].arguments,
      [292354, 2, 30402186],
    );
    assert.equal(syncExistingBook.mock.callCount(), 1);
    assert.equal(getBookEditions.mock.callCount(), 0);
    const hydratedMatch = syncExistingBook.mock.calls[0].arguments[1];
    assert.equal(hydratedMatch.userBook.book.editions.length, 1);
    assert.equal(hydratedMatch.userBook.book.editions[0].id, 30402186);
  });

  it('selects a progress-capable sibling before auto-adding an ISBN match', async () => {
    const matchedEdition = {
      id: 32307383,
      isbn_13: '9798350418903',
      reading_format: { format: 'Read' },
      audio_seconds: null,
      pages: null,
    };
    const audiobookEdition = {
      id: 400,
      reading_format: { format: 'Listened' },
      audio_seconds: 28800,
      pages: null,
      users_count: 50,
    };
    const match = {
      userBook: null,
      book: { id: 432760, title: 'Verity' },
      edition: matchedEdition,
      _matchType: 'isbn_search_result',
      _isSearchResult: true,
    };
    const addBookToLibrary = mock.fn(async () => ({ id: 17342399 }));
    const getBookEditions = mock.fn(async () => ({
      bookId: 432760,
      title: 'Verity',
      editions: [matchedEdition, audiobookEdition],
    }));
    const syncExistingBook = mock.fn(async () => ({ status: 'synced' }));
    const manager = Object.create(SyncManager.prototype);

    Object.assign(manager, {
      userId: 'test-user',
      dryRun: false,
      verbose: false,
      timezone: 'UTC',
      globalConfig: {
        force_sync: true,
        auto_add_books: true,
        min_progress_threshold: 5,
      },
      bookMatcher: {
        findMatch: mock.fn(async () => ({ match, extractedMetadata: {} })),
      },
      cache: {
        generateTitleAuthorIdentifier: () =>
          'title_author:verity|colleen_hoover',
        getCachedBookInfo: mock.fn(async () => ({ exists: false })),
      },
      hardcover: { addBookToLibrary, getBookEditions },
      sessionManager: {
        shouldDelayUpdate: mock.fn(async () => ({
          shouldDelay: false,
          reason: 'test sync',
        })),
        completeSession: mock.fn(async () => false),
      },
      _syncExistingBook: syncExistingBook,
      _clearNegativeSyncSkip: mock.fn(async () => {}),
    });

    const result = await manager._syncSingleBook(
      {
        id: 'abs-verity',
        progress_percentage: 9.3,
        media: {
          duration: 29000,
          metadata: {
            title: 'Verity',
            authors: [{ name: 'Colleen Hoover' }],
            isbn: '9798350418903',
          },
        },
      },
      null,
    );

    assert.equal(result.status, 'synced');
    assert.equal(getBookEditions.mock.callCount(), 1);
    assert.deepEqual(
      addBookToLibrary.mock.calls[0].arguments,
      [432760, 2, 400],
    );

    const hydratedMatch = syncExistingBook.mock.calls[0].arguments[1];
    assert.equal(hydratedMatch.edition.id, 400);
    assert.deepEqual(
      hydratedMatch.userBook.book.editions.map(edition => edition.id),
      [32307383, 400],
    );
  });

  it('does not add a search result when no edition can store progress', async () => {
    const matchedEdition = {
      id: 32307383,
      reading_format: { format: 'Read' },
      audio_seconds: null,
      pages: null,
    };
    const match = {
      userBook: null,
      book: { id: 432760, title: 'Verity' },
      edition: matchedEdition,
      _matchType: 'isbn_search_result',
      _isSearchResult: true,
    };
    const addBookToLibrary = mock.fn(async () => ({ id: 17342399 }));
    const manager = Object.create(SyncManager.prototype);

    Object.assign(manager, {
      userId: 'test-user',
      dryRun: false,
      verbose: false,
      timezone: 'UTC',
      globalConfig: {
        force_sync: true,
        auto_add_books: true,
        min_progress_threshold: 5,
      },
      bookMatcher: {
        findMatch: mock.fn(async () => ({ match, extractedMetadata: {} })),
      },
      cache: {
        generateTitleAuthorIdentifier: () =>
          'title_author:verity|colleen_hoover',
        getCachedBookInfo: mock.fn(async () => ({ exists: false })),
      },
      hardcover: {
        addBookToLibrary,
        getBookEditions: mock.fn(async () => ({
          bookId: 432760,
          title: 'Verity',
          editions: [matchedEdition],
        })),
      },
    });

    const result = await manager._syncSingleBook(
      {
        id: 'abs-verity',
        progress_percentage: 9.3,
        media: {
          duration: 29000,
          metadata: {
            title: 'Verity',
            authors: [{ name: 'Colleen Hoover' }],
          },
        },
      },
      null,
    );

    assert.equal(result.status, 'error');
    assert.match(result.reason, /book was not added/);
    assert.equal(addBookToLibrary.mock.callCount(), 0);
  });

  it('caches the edition ID from a two-stage match', async () => {
    const storeEditionMapping = mock.fn(async () => {});
    const matcher = new TitleAuthorMatcher(null, { storeEditionMapping }, {});

    await matcher._cacheSuccessfulMatch(
      'test-user',
      'title_author:the_martian|andy_weir',
      'The Martian',
      createTwoStageMatch(),
      'Andy Weir',
    );

    assert.equal(storeEditionMapping.mock.callCount(), 1);
    assert.equal(storeEditionMapping.mock.calls[0].arguments[3], 30402186);
  });

  it('does not overwrite a cache mapping when the edition ID is absent', async () => {
    const storeEditionMapping = mock.fn(async () => {});
    const matcher = new TitleAuthorMatcher(null, { storeEditionMapping }, {});

    await matcher._cacheSuccessfulMatch(
      'test-user',
      'title_author:the_martian|andy_weir',
      'The Martian',
      { book: { id: 292354 } },
      'Andy Weir',
    );

    assert.equal(storeEditionMapping.mock.callCount(), 0);
  });
});
