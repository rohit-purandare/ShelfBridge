import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { SyncManager } from '../src/sync-manager.js';

function createManager({ threshold, forceSync = true } = {}) {
  const findMatch = mock.fn(async () => ({
    match: null,
    extractedMetadata: {},
  }));
  const syncExistingBook = mock.fn(async () => ({ status: 'synced' }));
  const manager = Object.create(SyncManager.prototype);

  Object.assign(manager, {
    userId: 'test-user',
    dryRun: false,
    verbose: false,
    timezone: 'UTC',
    globalConfig: {
      force_sync: forceSync,
      auto_add_books: false,
      ...(threshold === undefined ? {} : { min_progress_threshold: threshold }),
    },
    bookMatcher: { findMatch },
    cache: {
      getCachedBookInfo: mock.fn(async () => ({ exists: false })),
    },
    _syncExistingBook: syncExistingBook,
    _storeNegativeSyncSkip: mock.fn(async () => {}),
  });

  return { manager, findMatch, syncExistingBook };
}

function createBook(progress, overrides = {}) {
  return {
    id: 'abs-book-1',
    progress_percentage: progress,
    is_finished: false,
    media: {
      metadata: {
        title: 'Threshold Test Book',
        authors: [{ name: 'Test Author' }],
        asin: 'B000000001',
      },
    },
    ...overrides,
  };
}

describe('SyncManager minimum progress threshold', () => {
  it('skips a low-progress book before matching, even during force sync', async () => {
    const { manager, findMatch, syncExistingBook } = createManager();

    const result = await manager._syncSingleBook(createBook(3.072659), null);

    assert.equal(result.status, 'skipped');
    assert.match(result.reason, /3\.1% <= 5%/);
    assert.equal(result.hardcover_status, 'not-checked');
    assert.equal(findMatch.mock.callCount(), 0);
    assert.equal(syncExistingBook.mock.callCount(), 0);
  });

  it('preserves the existing must-exceed threshold boundary', async () => {
    const { manager, findMatch } = createManager({ threshold: 5 });

    const result = await manager._syncSingleBook(createBook(5), null);

    assert.equal(result.status, 'skipped');
    assert.match(result.reason, /5\.0% <= 5%/);
    assert.equal(findMatch.mock.callCount(), 0);
  });

  it('respects a configured threshold of zero', () => {
    const { manager } = createManager({ threshold: 0 });

    assert.equal(manager._getMinimumProgressThreshold(), 0);
    assert.equal(manager._isZeroProgress(3), false);
  });

  it('allows explicitly finished books to bypass the threshold', async () => {
    const { manager, findMatch } = createManager({ threshold: 5 });

    const result = await manager._syncSingleBook(
      createBook(3, { is_finished: true }),
      null,
    );

    assert.equal(findMatch.mock.callCount(), 1);
    assert.doesNotMatch(result.reason, /minimum threshold/);
  });
});
