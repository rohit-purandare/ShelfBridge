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
const title = 'Status Transition Book';
const author = 'Test Author';
const asin = 'B000000252';
const userId = 'test-user';
const edition = {
  id: 456,
  asin,
  pages: 200,
  audio_seconds: 20760,
  reading_format: { format: 'Listened' },
};
const startedAt = '2026-10-06';
const newReadId = 7088335;
const progressPercent = (1702 / edition.audio_seconds) * 100;

function makeRead(overrides = {}) {
  return {
    id: 7007938,
    user_book_id: 123,
    edition_id: edition.id,
    edition,
    started_at: startedAt,
    finished_at: null,
    progress: 4.8,
    progress_seconds: 1000,
    progress_pages: null,
    ...overrides,
  };
}

// Stateful backend: status changes can create reads, and queries return fresh
// snapshots so a stale pre-transition read cannot accidentally see new state.
function createBackend({
  reads = [makeRead()],
  statusId = 1,
  autoCreate = true,
  statusError = false,
  refreshError = null,
  rejectProgress = false,
} = {}) {
  const client = new HardcoverClient('test-token');
  clients.push(client);
  const state = { reads: structuredClone(reads), statusId, fetches: 0 };
  let nextId = newReadId;
  const writes = [];
  const userBook = () => ({
    id: 123,
    status_id: state.statusId,
    book: { title, editions: [edition] },
  });

  client._executeQuery = mock.fn(async (query, variables) => {
    if (query.includes('query getUserBooks')) {
      const book = userBook();
      if (query.includes('user_book_reads(order_by:')) {
        book.user_book_reads = state.reads.slice(-1);
      }
      return structuredClone({ me: [{ user_books: [book] }] });
    }
    if (query.includes('query getBookProgress')) {
      state.fetches++;
      const response = {
        user_book_reads: state.reads.slice(-1),
        user_books: [userBook()],
      };
      if (state.fetches > 1) {
        if (refreshError === 'throw') throw new Error('Refresh failed');
        if (refreshError === 'missing reads') delete response.user_book_reads;
        if (refreshError === 'missing book') response.user_books = [];
        if (refreshError === 'stale status')
          response.user_books[0].status_id = 1;
      }
      return structuredClone(response);
    }
    if (query.includes('mutation updateBookStatus')) {
      if (statusError) {
        return {
          update_user_book: {
            error: 'Status change rejected',
            user_book: { id: 123, status_id: 2 },
          },
        };
      }
      state.statusId = variables.statusId;
      if (autoCreate) {
        state.reads.push(
          makeRead({
            id: nextId++,
            started_at: '2026-10-07',
            progress: null,
            progress_seconds: null,
            progress_pages: null,
          }),
        );
      }
      return { update_user_book: { user_book: userBook() } };
    }
    const insert = query.includes('mutation InsertUserBookRead');
    if (insert || query.includes('mutation UpdateBookProgress')) {
      const operation = insert
        ? 'insert_user_book_read'
        : 'update_user_book_read';
      writes.push({ insert, ...variables });
      if (rejectProgress)
        return { [operation]: { error: 'Progress rejected' } };
      const record = insert
        ? makeRead({ id: nextId++ })
        : state.reads.find(read => read.id === variables.id);
      assert.ok(record, 'Progress must target a real read');
      if (insert) state.reads.push(record);
      const useSeconds = variables.seconds !== undefined;
      const position = useSeconds ? variables.seconds : variables.pages;
      Object.assign(record, {
        edition_id: variables.editionId,
        started_at: variables.startedAt,
        [useSeconds ? 'progress_seconds' : 'progress_pages']: position,
        progress:
          (position / (useSeconds ? edition.audio_seconds : edition.pages)) *
          100,
      });
      return structuredClone({ [operation]: { user_book_read: record } });
    }
    throw new Error('Unexpected GraphQL operation');
  });

  return { client, state, writes };
}

function createAbsBook(withAsin = true) {
  return {
    id: 'abs-252',
    progress_percentage: progressPercent,
    started_at: Date.parse(`${startedAt}T12:00:00Z`),
    last_listened_at: Date.parse('2026-10-07T12:00:00Z'),
    media: {
      duration: edition.audio_seconds,
      metadata: {
        title,
        authors: [{ name: author }],
        ...(withAsin ? { asin } : {}),
      },
    },
  };
}

async function createCachedScenario(options = {}, identifierType = 'asin') {
  const { cachedProgress = progressPercent, ...backendOptions } = options;
  const backend = createBackend({ statusId: 2, ...backendOptions });
  const dir = mkdtempSync(path.join(tmpdir(), 'shelfbridge-status-read-'));
  tempDirs.push(dir);
  const cache = new BookCache(path.join(dir, 'cache.db'));
  caches.push(cache);
  await cache.init();
  const identifier =
    identifierType === 'asin'
      ? asin
      : cache.generateTitleAuthorIdentifier(title, author);
  await cache.storeBookSyncData(
    userId,
    identifier,
    title,
    edition.id,
    identifierType,
    author,
    cachedProgress,
    '2026-10-07T12:00:00Z',
    `${startedAt}T12:00:00Z`,
    2,
    edition.id,
  );
  const findMatch = mock.fn(async () => {
    throw new Error('Cached repair must not need expensive matching');
  });
  const manager = Object.create(SyncManager.prototype);
  Object.assign(manager, {
    userId,
    globalConfig: {
      auto_add_books: false,
      force_sync: false,
      min_progress_threshold: 5,
      prevent_progress_regression: false,
    },
    dryRun: false,
    verbose: false,
    timezone: 'UTC',
    cache,
    hardcover: backend.client,
    hardcoverBooks: await backend.client.getUserBooks(),
    sessionManager: new SessionManager(cache, { enabled: false }),
    bookMatcher: { findMatch },
  });
  return { ...backend, cache, manager, identifier, identifierType, findMatch };
}

afterEach(() => {
  while (clients.length) clients.pop().cleanup();
  while (caches.length) caches.pop().close();
  while (tempDirs.length)
    rmSync(tempDirs.pop(), { recursive: true, force: true });
});

describe('Hardcover status-created reads (#252)', () => {
  for (const useSeconds of [true, false]) {
    for (const history of ['unfinished', 'none', 'completed']) {
      it(`reuses the automatic read for ${useSeconds ? 'seconds' : 'pages'} with ${history} history`, async () => {
        const reads =
          history === 'none'
            ? []
            : [
                makeRead({
                  finished_at: history === 'completed' ? startedAt : null,
                }),
              ];
        const { client, state, writes } = createBackend({ reads });
        const position = useSeconds ? 1702 : 16;

        const result = await client.updateReadingProgress(
          123,
          position,
          useSeconds ? progressPercent : 8,
          edition.id,
          useSeconds,
          startedAt,
        );

        assert.equal(result.id, newReadId);
        assert.equal(state.fetches, 2);
        assert.equal(writes.length, 1);
        assert.equal(writes[0].insert, false);
        assert.equal(state.reads.length, reads.length + 1);
        assert.deepEqual(
          state.reads.slice(0, reads.length),
          reads,
          'History stays intact',
        );
        assert.equal(state.reads.at(-1).started_at, startedAt);
        assert.equal(state.reads.at(-1).edition_id, edition.id);
        assert.equal(
          state.reads.at(-1)[
            useSeconds ? 'progress_seconds' : 'progress_pages'
          ],
          position,
        );
        assert.deepEqual(result._statusInfo, {
          currentStatusId: 2,
          statusWasUpdated: true,
        });
      });
    }
  }

  it('inserts the first read if the status transition did not create one', async () => {
    const { client, state, writes } = createBackend({
      reads: [],
      autoCreate: false,
    });
    const result = await client.updateReadingProgress(
      123,
      1702,
      progressPercent,
      edition.id,
      true,
      startedAt,
    );
    assert.ok(result.id);
    assert.equal(state.reads.length, 1);
    assert.equal(writes[0].insert, true);
    assert.equal(state.reads[0].started_at, startedAt);
  });

  it('preserves completed history when the transition did not create a read', async () => {
    const completed = makeRead({ finished_at: startedAt });
    const { client, state } = createBackend({
      reads: [completed],
      autoCreate: false,
    });
    const result = await client.updateReadingProgress(
      123,
      1702,
      progressPercent,
      edition.id,
      true,
      startedAt,
    );
    assert.equal(result.id, newReadId);
    assert.deepEqual(state.reads[0], completed);
    assert.equal(state.reads.length, 2);
  });

  it('stops when the status mutation returns an error, even with a user_book payload', async () => {
    const { client, state, writes } = createBackend({ statusError: true });
    const result = await client.updateReadingProgress(
      123,
      1702,
      progressPercent,
      edition.id,
      true,
      startedAt,
    );
    assert.equal(result, false);
    assert.equal(state.statusId, 1);
    assert.equal(writes.length, 0);
  });

  for (const refreshError of [
    'throw',
    'missing reads',
    'missing book',
    'stale status',
  ]) {
    it(`does not write stale progress when the refresh has ${refreshError}`, async () => {
      const { client, writes } = createBackend({ refreshError });
      const result = await client.updateReadingProgress(
        123,
        1702,
        progressPercent,
        edition.id,
        true,
        startedAt,
      );
      assert.equal(result, false);
      assert.equal(writes.length, 0);
    });
  }

  it('does not report success when writing to the automatic read fails', async () => {
    const { client, state } = createBackend({ rejectProgress: true });
    const result = await client.updateReadingProgress(
      123,
      1702,
      progressPercent,
      edition.id,
      true,
      startedAt,
    );
    assert.equal(result, false);
    assert.equal(state.reads.at(-1).progress_seconds, null);
  });

  it('keeps the normal one-fetch update for a book already Currently Reading', async () => {
    const { client, state } = createBackend({ statusId: 2 });
    const result = await client.updateReadingProgress(
      123,
      1702,
      progressPercent,
      edition.id,
      true,
      startedAt,
    );
    assert.equal(result.id, 7007938);
    assert.equal(state.fetches, 1);
    assert.equal(state.reads.length, 1);
    assert.equal(result._statusInfo.statusWasUpdated, false);
  });

  it('preserves the automatic read start date when Audiobookshelf has no date', async () => {
    const { client, state } = createBackend();
    const result = await client.updateReadingProgress(
      123,
      1702,
      progressPercent,
      edition.id,
      true,
    );
    assert.equal(result.id, newReadId);
    assert.equal(state.reads.at(-1).started_at, '2026-10-07');
  });
});

describe('Cache recovery for existing empty Hardcover reads', () => {
  const emptyRead = makeRead({
    id: newReadId,
    progress: null,
    progress_seconds: null,
  });

  for (const identifierType of ['asin', 'title_author']) {
    it(`repairs unchanged ${identifierType} progress once, then resumes cache skips`, async () => {
      const scenario = await createCachedScenario(
        { reads: [makeRead(), emptyRead] },
        identifierType,
      );
      // An ASIN book with an older title/author cache entry exercises fallback lookup.
      const first = await scenario.manager._syncSingleBook(
        createAbsBook(),
        null,
      );
      assert.equal(first.status, 'synced');
      assert.equal(scenario.writes.length, 1);
      assert.equal(scenario.writes[0].id, newReadId);
      assert.equal(scenario.writes[0].insert, false);
      assert.equal(scenario.state.reads.at(-1).progress_seconds, 1702);
      assert.equal(scenario.findMatch.mock.callCount(), 0);

      // Each scheduled sync fetches the library again before cache checks.
      scenario.manager.hardcoverBooks = await scenario.client.getUserBooks();
      const second = await scenario.manager._syncSingleBook(
        createAbsBook(),
        null,
      );
      assert.equal(second.status, 'skipped');
      assert.match(second.reason, /Progress unchanged/);
      assert.equal(scenario.writes.length, 1);
      assert.equal(
        await scenario.cache.getEditionForBook(
          userId,
          scenario.identifier,
          title,
          identifierType,
        ),
        edition.id,
      );
    });
  }

  it('also repairs a book with no ASIN using its title/author cache', async () => {
    const scenario = await createCachedScenario(
      { reads: [emptyRead] },
      'title_author',
    );
    const result = await scenario.manager._syncSingleBook(
      createAbsBook(false),
      null,
    );
    assert.equal(result.status, 'synced');
    assert.equal(scenario.writes[0].id, newReadId);
    assert.equal(scenario.findMatch.mock.callCount(), 0);
  });

  it('retries a failed repair without changing the cached success data', async () => {
    const scenario = await createCachedScenario({
      reads: [emptyRead],
      rejectProgress: true,
    });
    const before = await scenario.cache.getCachedBookInfo(
      userId,
      asin,
      title,
      'asin',
    );
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await scenario.manager._syncSingleBook(
        createAbsBook(),
        null,
      );
      assert.equal(result.status, 'error');
    }
    const after = await scenario.cache.getCachedBookInfo(
      userId,
      asin,
      title,
      'asin',
    );
    assert.deepEqual(after, before);
    assert.equal(scenario.writes.length, 2);
  });

  for (const failure of [{ statusError: true }, { refreshError: 'throw' }]) {
    it(`does not cache success when the transition ${failure.statusError ? 'is rejected' : 'cannot be refreshed'}`, async () => {
      const scenario = await createCachedScenario({
        statusId: 1,
        cachedProgress: 0,
        ...failure,
      });
      const before = await scenario.cache.getCachedBookInfo(
        userId,
        asin,
        title,
        'asin',
      );
      const result = await scenario.manager._syncSingleBook(
        createAbsBook(),
        null,
      );
      assert.equal(result.status, 'error');
      assert.equal(scenario.writes.length, 0);
      const after = await scenario.cache.getCachedBookInfo(
        userId,
        asin,
        title,
        'asin',
      );
      assert.deepEqual(after, before);
    });
  }

  for (const read of [
    makeRead(),
    makeRead({ finished_at: startedAt }),
    makeRead({ progress: 0, progress_seconds: 0 }),
  ]) {
    it(`keeps unchanged cache skips for ${read.finished_at ? 'completed' : read.progress === 0 ? 'zero-progress' : 'populated'} reads`, async () => {
      const scenario = await createCachedScenario({ reads: [read] });
      const result = await scenario.manager._syncSingleBook(
        createAbsBook(),
        null,
      );
      assert.equal(result.status, 'skipped');
      assert.equal(scenario.writes.length, 0);
      assert.equal(scenario.state.fetches, 0);
    });
  }
});
