import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, it, mock } from 'node:test';
import { BookCache } from '../src/book-cache.js';
import { HardcoverClient } from '../src/hardcover-client.js';
import SessionManager from '../src/session-manager.js';
import { SyncManager } from '../src/sync-manager.js';

const clients = [];
const caches = [];
const tempDirs = [];

const repairFixture = {
  userId: 'test-user',
  title: 'We’ll Always Have Summer: Summer I Turned Pretty, Book 3',
  author: 'Jenny Han',
  asin: 'B09WZF7395',
  progress: 41.00631606693597,
};

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

function createAbsBook({ finished = false } = {}) {
  return {
    id: 'abs-book-1',
    progress_percentage: finished ? 100 : repairFixture.progress,
    is_finished: finished,
    started_at: Date.parse('2026-08-05T16:51:24.238Z'),
    last_listened_at: Date.parse('2026-08-09T16:57:15.911Z'),
    finished_at: finished ? Date.parse('2026-08-10T12:00:00.000Z') : null,
    media: {
      duration: 30000,
      metadata: {
        title: repairFixture.title,
        authors: [{ name: repairFixture.author }],
        asin: repairFixture.asin,
      },
    },
  };
}

async function createRepairScenario({
  finished = false,
  updateResult = {
    id: 6226610,
    progress: repairFixture.progress,
    progress_seconds: 12302,
    edition_id: 400,
  },
} = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'shelfbridge-repair-'));
  tempDirs.push(dir);

  const cache = new BookCache(path.join(dir, 'cache.db'));
  caches.push(cache);
  await cache.init();

  const unusableEdition = {
    id: 32426186,
    asin: repairFixture.asin,
    reading_format: { format: 'Listened' },
    audio_seconds: null,
    pages: null,
  };
  const replacementEdition = {
    id: 400,
    reading_format: { format: 'Listened' },
    audio_seconds: 30000,
    pages: null,
  };
  const userBook = {
    id: 17164525,
    status_id: finished ? 3 : 2,
    book: {
      title: repairFixture.title,
      editions: [unusableEdition, replacementEdition],
    },
  };

  await cache.storeBookSyncData(
    repairFixture.userId,
    repairFixture.asin,
    repairFixture.title,
    unusableEdition.id,
    'asin',
    repairFixture.author,
    finished ? 100 : repairFixture.progress,
    '2026-08-09T16:57:15.911Z',
    '2026-08-05T16:51:24.238Z',
    finished ? 3 : 2,
    unusableEdition.id,
  );

  if (finished) {
    await cache.storeBookCompletionData(
      repairFixture.userId,
      repairFixture.asin,
      repairFixture.title,
      'asin',
      '2026-08-10T12:00:00.000Z',
      '2026-08-05T16:51:24.238Z',
      '2026-08-10T12:00:00.000Z',
      3,
      unusableEdition.id,
    );
  }

  const updateReadingProgress = mock.fn(async () => updateResult);
  const markBookCompleted = mock.fn(async () => true);
  const findMatch = mock.fn(async () => {
    throw new Error('Expensive matching should not run during cache repair');
  });

  const manager = Object.create(SyncManager.prototype);
  Object.assign(manager, {
    userId: repairFixture.userId,
    globalConfig: {
      auto_add_books: false,
      force_sync: false,
      min_progress_threshold: 5,
      prevent_progress_regression: false,
      reread_detection: {},
    },
    dryRun: false,
    verbose: false,
    timezone: 'UTC',
    cache,
    sessionManager: new SessionManager(cache, { enabled: false }),
    bookMatcher: { findMatch },
    hardcoverBooks: [userBook],
    hardcover: {
      updateReadingProgress,
      markBookCompleted,
    },
  });

  return {
    cache,
    manager,
    unusableEdition,
    replacementEdition,
    updateReadingProgress,
    markBookCompleted,
    findMatch,
  };
}

afterEach(() => {
  while (clients.length > 0) {
    clients.pop().cleanup();
  }
  while (caches.length > 0) {
    caches.pop().close();
  }
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true });
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

  it('repairs unchanged cached progress through the full per-book sync path', async () => {
    const scenario = await createRepairScenario();

    const firstResult = await scenario.manager._syncSingleBook(
      createAbsBook(),
      null,
    );

    assert.equal(firstResult.status, 'synced');
    assert.equal(scenario.findMatch.mock.callCount(), 0);
    assert.equal(scenario.updateReadingProgress.mock.callCount(), 1);

    const updateCall = scenario.updateReadingProgress.mock.calls[0].arguments;
    assert.equal(updateCall[0], 17164525);
    assert.ok(updateCall[1] > 0);
    assert.equal(updateCall[3], scenario.replacementEdition.id);
    assert.equal(updateCall[4], true);

    const cachedEdition = await scenario.cache.getEditionForBook(
      repairFixture.userId,
      repairFixture.asin,
      repairFixture.title,
      'asin',
    );
    assert.equal(cachedEdition, scenario.replacementEdition.id);

    const secondResult = await scenario.manager._syncSingleBook(
      createAbsBook(),
      null,
    );

    assert.equal(secondResult.status, 'skipped');
    assert.match(secondResult.reason, /Progress unchanged/);
    assert.equal(scenario.updateReadingProgress.mock.callCount(), 1);
  });

  it('keeps the old cache mapping when the repair write fails', async () => {
    const scenario = await createRepairScenario({ updateResult: false });

    const result = await scenario.manager._syncSingleBook(
      createAbsBook(),
      null,
    );

    assert.equal(result.status, 'error');
    assert.equal(scenario.updateReadingProgress.mock.callCount(), 1);
    const cachedEdition = await scenario.cache.getEditionForBook(
      repairFixture.userId,
      repairFixture.asin,
      repairFixture.title,
      'asin',
    );
    assert.equal(cachedEdition, scenario.unusableEdition.id);
  });

  it('repairs completed books once and persists the replacement edition', async () => {
    const scenario = await createRepairScenario({ finished: true });

    const firstResult = await scenario.manager._syncSingleBook(
      createAbsBook({ finished: true }),
      null,
    );

    assert.equal(firstResult.status, 'completed');
    assert.equal(scenario.markBookCompleted.mock.callCount(), 1);
    assert.equal(
      scenario.markBookCompleted.mock.calls[0].arguments[1],
      scenario.replacementEdition.id,
    );

    const cachedEdition = await scenario.cache.getEditionForBook(
      repairFixture.userId,
      repairFixture.asin,
      repairFixture.title,
      'asin',
    );
    assert.equal(cachedEdition, scenario.replacementEdition.id);

    const secondResult = await scenario.manager._syncSingleBook(
      createAbsBook({ finished: true }),
      null,
    );

    assert.equal(secondResult.status, 'skipped');
    assert.equal(scenario.markBookCompleted.mock.callCount(), 1);
  });
});
