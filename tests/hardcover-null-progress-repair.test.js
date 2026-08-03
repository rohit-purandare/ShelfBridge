import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import { HardcoverClient } from '../src/hardcover-client.js';
import { SyncManager } from '../src/sync-manager.js';

const clients = [];

function createManager() {
  const manager = Object.create(SyncManager.prototype);
  manager.userId = 'test-user';
  manager.globalConfig = {};
  manager.dryRun = false;
  return manager;
}

function createClient() {
  const client = new HardcoverClient('test-token');
  clients.push(client);
  return client;
}

afterEach(() => {
  while (clients.length > 0) {
    clients.pop().cleanup();
  }
});

describe('Hardcover null progress repair', () => {
  it('treats a Listened edition without duration or pages as unusable', () => {
    const manager = createManager();
    const edition = {
      id: 31673834,
      reading_format: { format: 'Listened' },
      audio_seconds: null,
      pages: null,
    };

    assert.equal(manager._getEditionProgressBasis(edition), null);
    assert.equal(manager._isEditionProgressCapable(edition), false);
  });

  it('selects the closest usable audiobook edition from the same book', () => {
    const manager = createManager();
    const unusableEdition = {
      id: 31673834,
      reading_format: { format: 'Listened' },
      audio_seconds: null,
      pages: null,
    };
    const closestAudiobook = {
      id: 400,
      reading_format: { format: 'Listened' },
      audio_seconds: 28800,
      pages: null,
    };
    const longerAudiobook = {
      id: 401,
      reading_format: { format: 'Listened' },
      audio_seconds: 36000,
      pages: null,
    };
    const textEdition = {
      id: 402,
      reading_format: { format: 'Read' },
      audio_seconds: null,
      pages: 288,
    };
    const userBook = {
      book: {
        editions: [
          unusableEdition,
          longerAudiobook,
          textEdition,
          closestAudiobook,
        ],
      },
    };
    const absBook = { media: { duration: 29000 } };

    const selected = manager._selectProgressCapableEdition(
      absBook,
      userBook,
      unusableEdition,
      'Test Audiobook',
    );

    assert.equal(selected.id, closestAudiobook.id);
    assert.equal(selected.format, 'audiobook');
  });

  it('marks unchanged cached progress for repair when its edition is unusable', () => {
    const manager = createManager();
    const edition = {
      id: 31673834,
      reading_format: { format: 'Listened' },
      audio_seconds: null,
      pages: null,
    };
    manager.hardcoverBooks = [
      {
        id: 16884926,
        book: { editions: [edition] },
      },
    ];

    const repairState = manager._getCachedEditionRepairState(edition.id);

    assert.equal(repairState.requiresRepair, true);
    assert.match(
      repairState.reason,
      /neither audiobook duration nor page count/,
    );
  });

  it('defers caching a replacement edition until progress is confirmed', async () => {
    const manager = createManager();
    const unusableEdition = {
      id: 31673834,
      asin: 'B09WPZ3K2B',
      reading_format: { format: 'Listened' },
      audio_seconds: null,
      pages: null,
    };
    const replacementEdition = {
      id: 400,
      reading_format: { format: 'Listened' },
      audio_seconds: 28800,
      pages: null,
    };
    const executeTransaction = mock.fn(async () => {});
    manager.cache = {
      getEditionForBook: mock.fn(async () => unusableEdition.id),
      executeTransaction,
    };
    const userBook = {
      id: 16884926,
      book: { editions: [unusableEdition, replacementEdition] },
    };

    const selected = await manager._selectEditionWithCache(
      {
        media: {
          duration: 28800,
          metadata: { asin: 'B09WPZ3K2B' },
        },
      },
      { userBook, edition: unusableEdition },
      'Test Audiobook',
      'Test Author',
    );

    assert.equal(selected.id, replacementEdition.id);
    assert.equal(executeTransaction.mock.calls.length, 0);
  });

  it('does not call Hardcover when no edition can represent progress', async () => {
    const manager = createManager();
    const updateReadingProgress = mock.fn(async () => ({ id: 1 }));
    manager.hardcover = { updateReadingProgress };
    const edition = {
      id: 31673834,
      reading_format: { format: 'Listened' },
      audio_seconds: null,
      pages: null,
    };

    const result = await manager._handleProgressStatus(
      16884926,
      edition,
      'Test Audiobook',
      66.6,
      {},
      'Test Author',
    );

    assert.equal(result.status, 'error');
    assert.match(result.reason, /neither audiobook duration nor page count/);
    assert.equal(updateReadingProgress.mock.calls.length, 0);
  });

  it('rejects a Hardcover response whose requested progress field is null', async () => {
    const client = createClient();
    client.getBookCurrentProgress = mock.fn(async () => ({
      has_progress: true,
      latest_read: { id: 6130328 },
      user_book: { id: 16884926, status_id: 2 },
    }));
    client._shouldCreateNewReadingSession = mock.fn(() => ({
      createNew: false,
      isRegression: false,
    }));
    client._executeQuery = mock.fn(async () => ({
      update_user_book_read: {
        error: null,
        user_book_read: {
          id: 6130328,
          progress: null,
          progress_pages: null,
          edition_id: 31673834,
        },
      },
    }));

    const result = await client.updateReadingProgress(
      16884926,
      0,
      66.6,
      31673834,
      false,
      '2026-07-29',
    );

    assert.equal(result, false);
  });

  it('accepts a verified seconds-based Hardcover response', async () => {
    const client = createClient();
    client.getBookCurrentProgress = mock.fn(async () => ({
      has_progress: true,
      latest_read: { id: 6130328 },
      user_book: { id: 16884926, status_id: 2 },
    }));
    client._shouldCreateNewReadingSession = mock.fn(() => ({
      createNew: false,
      isRegression: false,
    }));
    client._executeQuery = mock.fn(async () => ({
      update_user_book_read: {
        error: null,
        user_book_read: {
          id: 6130328,
          progress: 66.6,
          progress_pages: null,
          progress_seconds: 19181,
          edition_id: 400,
        },
      },
    }));

    const result = await client.updateReadingProgress(
      16884926,
      19181,
      66.6,
      400,
      true,
      '2026-07-29',
    );

    assert.equal(result.id, 6130328);
    assert.equal(result.progress_seconds, 19181);
  });
});
