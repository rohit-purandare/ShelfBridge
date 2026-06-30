import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it, afterEach } from 'node:test';

import { BookCache } from '../src/book-cache.js';
import { SyncManager } from '../src/sync-manager.js';

describe('Negative sync skip cache', () => {
  const tempDirs = [];

  function createTempCache() {
    const dir = mkdtempSync(path.join(tmpdir(), 'shelfbridge-skip-cache-'));
    tempDirs.push(dir);
    return new BookCache(path.join(dir, 'cache.db'));
  }

  afterEach(() => {
    while (tempDirs.length > 0) {
      rmSync(tempDirs.pop(), { recursive: true, force: true });
    }
  });

  it('reuses skip entries only when progress, timestamp, and context match', async () => {
    const cache = createTempCache();
    await cache.init();

    try {
      await cache.storeSyncSkip({
        userId: 'user-1',
        identifier: 'B012345678',
        identifierType: 'asin',
        title: 'Skipped Book',
        author: 'Test Author',
        progressPercent: 35.5,
        lastListenedAt: 123456,
        reason: 'not_found_auto_add_disabled',
        contextHash: 'context-a',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      });

      const fresh = await cache.getFreshSyncSkip({
        userId: 'user-1',
        identifier: 'B012345678',
        identifierType: 'asin',
        title: 'Skipped Book',
        progressPercent: 35.5,
        lastListenedAt: 123456,
        contextHash: 'context-a',
      });
      assert.equal(fresh.reason, 'not_found_auto_add_disabled');

      const changedProgress = await cache.getFreshSyncSkip({
        userId: 'user-1',
        identifier: 'B012345678',
        identifierType: 'asin',
        title: 'Skipped Book',
        progressPercent: 40,
        lastListenedAt: 123456,
        contextHash: 'context-a',
      });
      assert.equal(changedProgress, null);

      const changedTimestamp = await cache.getFreshSyncSkip({
        userId: 'user-1',
        identifier: 'B012345678',
        identifierType: 'asin',
        title: 'Skipped Book',
        progressPercent: 35.5,
        lastListenedAt: 999999,
        contextHash: 'context-a',
      });
      assert.equal(changedTimestamp, null);

      const changedContext = await cache.getFreshSyncSkip({
        userId: 'user-1',
        identifier: 'B012345678',
        identifierType: 'asin',
        title: 'Skipped Book',
        progressPercent: 35.5,
        lastListenedAt: 123456,
        contextHash: 'context-b',
      });
      assert.equal(changedContext, null);
    } finally {
      cache.close();
    }
  });

  it('skips expensive matching when a fresh negative skip exists', async () => {
    const cache = createTempCache();
    await cache.init();

    const user = {
      id: 'user-1',
      abs_url: 'http://abs.local',
      abs_token: 'abs-token',
      hardcover_token: 'hardcover-token',
    };
    const config = {
      force_sync: false,
      auto_add_books: false,
      min_progress_threshold: 5,
      parallel: true,
      workers: 1,
      audiobookshelf_semaphore: 1,
      hardcover_semaphore: 1,
    };
    const book = {
      id: 'abs-1',
      progress_percentage: 100,
      last_listened_at: 123456,
      media: {
        metadata: {
          title: 'Skipped Book',
          authors: [{ name: 'Test Author' }],
          asin: 'B012345678',
        },
      },
    };

    const syncManager = new SyncManager(user, config, false, false);
    syncManager.cache = cache;
    syncManager.audiobookshelf = {
      getReadingProgress: async () => [book],
      cleanup: () => {},
    };
    syncManager.hardcover = {
      getUserBooks: async () => [],
      cleanup: () => {},
    };

    let matchCalled = false;
    syncManager.bookMatcher.findMatch = async () => {
      matchCalled = true;
      return { match: null, extractedMetadata: {} };
    };

    syncManager.hardcoverBooks = [];
    await cache.storeSyncSkip({
      userId: user.id,
      identifier: 'B012345678',
      identifierType: 'asin',
      title: 'Skipped Book',
      author: 'Test Author',
      progressPercent: 100,
      lastListenedAt: 123456,
      reason: 'not_found_auto_add_disabled',
      contextHash: syncManager._getSkipCacheContextHash(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    try {
      const result = await syncManager.syncProgress();

      assert.equal(matchCalled, false);
      assert.equal(result.books_processed, 1);
      assert.equal(result.books_skipped, 1);
      assert.equal(result.books_synced, 0);
      assert.equal(result.book_details[0].status, 'skipped');
      assert.equal(result.book_details[0].hardcover_info, null);
      assert.match(
        result.book_details[0].reason,
        /Previously skipped with unchanged progress/,
      );
    } finally {
      syncManager.cleanup();
    }
  });

  it('checks negative skips before stale positive cache entries', async () => {
    const cache = createTempCache();
    await cache.init();

    const user = {
      id: 'user-1',
      abs_url: 'http://abs.local',
      abs_token: 'abs-token',
      hardcover_token: 'hardcover-token',
    };
    const config = {
      force_sync: false,
      auto_add_books: false,
      min_progress_threshold: 5,
      parallel: true,
      workers: 1,
      audiobookshelf_semaphore: 1,
      hardcover_semaphore: 1,
    };
    const book = {
      id: 'abs-1',
      progress_percentage: 100,
      last_listened_at: 123456,
      media: {
        metadata: {
          title: 'The Martian',
          authors: [{ name: 'Andy Weir' }],
        },
      },
    };
    const identifier = 'title_author:the_martian|andy_weir';

    await cache.storeBookSyncData(
      user.id,
      identifier,
      'The Martian',
      30402186,
      'title_author',
      'Andy Weir',
      0,
      123456,
    );

    const syncManager = new SyncManager(user, config, false, false);
    syncManager.cache = cache;
    syncManager.audiobookshelf = {
      getReadingProgress: async () => [book],
      cleanup: () => {},
    };
    syncManager.hardcover = {
      getUserBooks: async () => [],
      cleanup: () => {},
    };
    syncManager.hardcoverBooks = [];

    await cache.storeSyncSkip({
      userId: user.id,
      identifier,
      identifierType: 'title_author',
      title: 'The Martian',
      author: 'Andy Weir',
      progressPercent: 100,
      lastListenedAt: 123456,
      reason: 'no_identifiers_or_match',
      contextHash: syncManager._getSkipCacheContextHash(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    let matchCalled = false;
    syncManager.bookMatcher.findMatch = async () => {
      matchCalled = true;
      return { match: null, extractedMetadata: {} };
    };

    try {
      const result = await syncManager.syncProgress();

      assert.equal(matchCalled, false);
      assert.equal(result.books_processed, 1);
      assert.equal(result.books_skipped, 1);
      assert.deepEqual(result.book_details[0].actions, [
        'Negative skip cache - no_identifiers_or_match',
      ]);
      assert.match(
        result.book_details[0].reason,
        /Previously skipped with unchanged progress/,
      );
    } finally {
      syncManager.cleanup();
    }
  });

  it('invalidates stale positive cache before falling back to matching', async () => {
    const cache = createTempCache();
    await cache.init();

    const user = {
      id: 'user-1',
      abs_url: 'http://abs.local',
      abs_token: 'abs-token',
      hardcover_token: 'hardcover-token',
    };
    const config = {
      force_sync: false,
      auto_add_books: false,
      min_progress_threshold: 5,
      parallel: true,
      workers: 1,
      audiobookshelf_semaphore: 1,
      hardcover_semaphore: 1,
    };
    const book = {
      id: 'abs-1',
      progress_percentage: 100,
      last_listened_at: 123456,
      media: {
        metadata: {
          title: 'The Martian',
          authors: [{ name: 'Andy Weir' }],
        },
      },
    };
    const identifier = 'title_author:the_martian|andy_weir';

    await cache.storeBookSyncData(
      user.id,
      identifier,
      'The Martian',
      30402186,
      'title_author',
      'Andy Weir',
      0,
      123456,
    );

    const syncManager = new SyncManager(user, config, false, false);
    syncManager.cache = cache;
    syncManager.audiobookshelf = {
      getReadingProgress: async () => [book],
      cleanup: () => {},
    };
    syncManager.hardcover = {
      getUserBooks: async () => [],
      cleanup: () => {},
    };

    let matchCalled = false;
    syncManager.bookMatcher.findMatch = async () => {
      matchCalled = true;
      return {
        match: null,
        extractedMetadata: {
          title: 'The Martian',
          author: 'Andy Weir',
          identifiers: {},
        },
      };
    };

    try {
      const result = await syncManager.syncProgress();
      const staleCacheEntry = await cache.getCachedBookInfo(
        user.id,
        identifier,
        'The Martian',
        'title_author',
      );
      const negativeSkip = await cache.getFreshSyncSkip({
        userId: user.id,
        identifier,
        identifierType: 'title_author',
        title: 'The Martian',
        progressPercent: 100,
        lastListenedAt: 123456,
        contextHash: syncManager._getSkipCacheContextHash(),
      });

      assert.equal(matchCalled, true);
      assert.equal(staleCacheEntry.exists, false);
      assert.equal(negativeSkip.reason, 'no_identifiers_or_match');
      assert.equal(result.books_processed, 1);
      assert.equal(result.books_skipped, 1);
    } finally {
      syncManager.cleanup();
    }
  });
});
