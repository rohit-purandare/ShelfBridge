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
      hardcover: { addBookToLibrary },
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
