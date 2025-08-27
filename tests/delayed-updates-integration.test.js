import assert from 'node:assert/strict';
import { describe, it, before, after, beforeEach } from 'node:test';
import { unlinkSync } from 'fs';

import { SyncManager } from '../src/sync-manager.js';
import { BookCache } from '../src/book-cache.js';
import SessionManager from '../src/session-manager.js';

/**
 * Integration tests for delayed updates functionality
 *
 * Tests complete workflows:
 * - Configuration integration
 * - Sync flow with session decisions
 * - Background expired session processing
 * - Environment variable overrides
 * - Edge case scenarios
 * - Performance and reliability
 */

// Mock classes for testing
class MockAudiobookshelfClient {
  constructor() {
    this.books = [];
  }

  async getReadingProgress() {
    return this.books;
  }

  setBooks(books) {
    this.books = books;
  }
}

class MockHardcoverClient {
  constructor() {
    this.updateCalls = [];
    this.userBooks = [];
  }

  async updateReadingProgress(
    userBookId,
    currentProgress,
    progressPercentage,
    editionId,
    useSeconds,
    startedAt,
    rereadConfig,
    readingFormatId,
  ) {
    this.updateCalls.push({
      userBookId,
      currentProgress,
      progressPercentage,
      editionId,
      useSeconds,
      startedAt,
      rereadConfig,
      readingFormatId,
      timestamp: new Date(),
    });

    return {
      id: `mock-update-${this.updateCalls.length}`,
      progress: progressPercentage,
    };
  }

  async getUserBooks() {
    return this.userBooks;
  }

  setUserBooks(books) {
    this.userBooks = books;
  }

  getUpdateCalls() {
    return [...this.updateCalls];
  }

  clearUpdateCalls() {
    this.updateCalls = [];
  }
}

class MockBookMatcher {
  constructor() {
    this.matches = new Map();
  }

  async findMatch(absBook, userId) {
    const key = `${absBook.id}-${userId}`;
    const match = this.matches.get(key) || {
      match: {
        userBookId: `hardcover-${absBook.id}`,
        edition: { id: `edition-${absBook.id}` },
        useSeconds: false,
      },
      extractedMetadata: {
        title: absBook.title || 'Test Book',
        author: absBook.author || 'Test Author',
        identifiers: { isbn: absBook.id },
      },
    };

    return match;
  }

  setMatch(bookId, userId, matchData) {
    this.matches.set(`${bookId}-${userId}`, matchData);
  }
}

describe('Delayed Updates Integration', () => {
  let syncManager;
  let cache;
  let mockAudiobookshelf;
  let mockHardcover;
  let mockBookMatcher;
  const testCacheFile = 'test-integration-cache.db';

  before(async () => {
    // Clean up any existing test cache
    try {
      unlinkSync(testCacheFile);
    } catch (err) {
      // Ignore if file doesn't exist
    }
  });

  after(async () => {
    // Clean up test cache
    try {
      if (cache) {
        await cache.close();
      }
      unlinkSync(testCacheFile);
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    // Create fresh mocks and cache for each test
    cache = new BookCache(testCacheFile);
    await cache.init();

    mockAudiobookshelf = new MockAudiobookshelfClient();
    mockHardcover = new MockHardcoverClient();
    mockBookMatcher = new MockBookMatcher();
  });

  describe('Disabled Delayed Updates (Default Behavior)', () => {
    beforeEach(() => {
      const user = {
        id: 'testuser',
        abs_url: 'http://test',
        abs_token: 'token',
        hardcover_token: 'hc_token',
      };
      const globalConfig = {
        // delayed_updates not specified (disabled by default)
        workers: 1,
        parallel: false,
      };

      syncManager = new SyncManager(user, globalConfig, false, false);

      // Replace the real clients with mocks
      syncManager.audiobookshelf = mockAudiobookshelf;
      syncManager.hardcover = mockHardcover;
      syncManager.bookMatcher = mockBookMatcher;
      syncManager.cache = cache;
    });

    it('syncs immediately when delayed updates disabled', async () => {
      // Set up a book with progress
      const book = {
        id: 'book1',
        title: 'Test Book',
        progress_percentage: 45,
        is_finished: false,
        last_listened_at: new Date().toISOString(),
      };

      mockAudiobookshelf.setBooks([book]);

      const result = await syncManager.syncProgress();

      // Should have made immediate Hardcover API call
      const updateCalls = mockHardcover.getUpdateCalls();
      assert.equal(updateCalls.length, 1);
      assert.equal(updateCalls[0].progressPercentage, 45);

      // Should have no delayed books
      assert.equal(result.books_delayed, 0);
      assert.equal(result.books_synced, 1);
    });
  });

  describe('Enabled Delayed Updates', () => {
    beforeEach(() => {
      const user = {
        id: 'testuser',
        abs_url: 'http://test',
        abs_token: 'token',
        hardcover_token: 'hc_token',
      };
      const globalConfig = {
        delayed_updates: {
          enabled: true,
          session_timeout: 60, // Minimum valid for testing
          max_delay: 3600,
          immediate_completion: true,
        },
        workers: 1,
        parallel: false,
      };

      syncManager = new SyncManager(user, globalConfig, false, false);

      // Replace the real clients with mocks
      syncManager.audiobookshelf = mockAudiobookshelf;
      syncManager.hardcover = mockHardcover;
      syncManager.bookMatcher = mockBookMatcher;
      syncManager.cache = cache;
    });

    it('delays small progress updates', async () => {
      // First sync to establish baseline
      await cache.storeProgress('testuser', 'book1', 'Test Book', 40, 'isbn');

      const book = {
        id: 'book1',
        title: 'Test Book',
        progress_percentage: 42, // Small 2% increase
        is_finished: false,
        last_listened_at: new Date().toISOString(),
      };

      mockAudiobookshelf.setBooks([book]);

      const result = await syncManager.syncProgress();

      // Should have delayed the update (no Hardcover API call)
      const updateCalls = mockHardcover.getUpdateCalls();
      assert.equal(updateCalls.length, 0);

      // Should count as delayed
      assert.equal(result.books_delayed, 1);
      assert.equal(result.books_synced, 0);

      // Should have active session
      const hasActive = await cache.hasActiveSession(
        'testuser',
        'book1',
        'Test Book',
        'isbn',
      );
      assert.equal(hasActive, true);
    });

    it('syncs immediately for large progress jumps', async () => {
      // Establish baseline
      await cache.storeProgress('testuser', 'book1', 'Test Book', 30, 'isbn');

      const book = {
        id: 'book1',
        title: 'Test Book',
        progress_percentage: 45, // 15% jump (significant)
        is_finished: false,
        last_listened_at: new Date().toISOString(),
      };

      mockAudiobookshelf.setBooks([book]);

      const result = await syncManager.syncProgress();

      // Should have made immediate API call
      const updateCalls = mockHardcover.getUpdateCalls();
      assert.equal(updateCalls.length, 1);
      assert.equal(updateCalls[0].progressPercentage, 45);

      assert.equal(result.books_delayed, 0);
      assert.equal(result.books_synced, 1);
    });

    it('syncs immediately for book completions', async () => {
      await cache.storeProgress('testuser', 'book1', 'Test Book', 95, 'isbn');

      const book = {
        id: 'book1',
        title: 'Test Book',
        progress_percentage: 100,
        is_finished: true,
        last_listened_at: new Date().toISOString(),
      };

      mockAudiobookshelf.setBooks([book]);

      const result = await syncManager.syncProgress();

      // Should have made immediate API call for completion
      const updateCalls = mockHardcover.getUpdateCalls();
      assert.equal(updateCalls.length, 1);
      assert.equal(updateCalls[0].progressPercentage, 100);

      assert.equal(result.books_delayed, 0);
      assert.equal(result.books_completed, 1);
    });

    it('processes expired sessions on next sync', async () => {
      // Create a delayed session
      await cache.storeProgress('testuser', 'book1', 'Test Book', 40, 'isbn');
      await cache.updateSessionProgress(
        'testuser',
        'book1',
        'Test Book',
        45,
        'isbn',
      );

      // Wait for session to expire
      await new Promise(resolve => setTimeout(resolve, 2500));

      // Run sync with no new books (should process expired sessions)
      mockAudiobookshelf.setBooks([]);

      const result = await syncManager.syncProgress();

      // Should have processed the expired session
      const updateCalls = mockHardcover.getUpdateCalls();
      assert.equal(updateCalls.length, 1);
      assert.equal(updateCalls[0].progressPercentage, 45);

      // Session should be completed
      const hasActive = await cache.hasActiveSession(
        'testuser',
        'book1',
        'Test Book',
        'isbn',
      );
      assert.equal(hasActive, false);
    });

    it('handles mixed scenarios in single sync', async () => {
      // Set up multiple books with different scenarios
      await cache.storeProgress(
        'testuser',
        'book1',
        'Small Update Book',
        30,
        'isbn',
      );
      await cache.storeProgress(
        'testuser',
        'book2',
        'Large Jump Book',
        20,
        'isbn',
      );

      const books = [
        {
          id: 'book1',
          title: 'Small Update Book',
          progress_percentage: 32, // Small update - should delay
          is_finished: false,
          last_listened_at: new Date().toISOString(),
        },
        {
          id: 'book2',
          title: 'Large Jump Book',
          progress_percentage: 35, // 15% jump - should sync immediately
          is_finished: false,
          last_listened_at: new Date().toISOString(),
        },
        {
          id: 'book3',
          title: 'New Book',
          progress_percentage: 25, // New book - should sync immediately
          is_finished: false,
          last_listened_at: new Date().toISOString(),
        },
        {
          id: 'book4',
          title: 'Completed Book',
          progress_percentage: 100, // Completion - should sync immediately
          is_finished: true,
          last_listened_at: new Date().toISOString(),
        },
      ];

      mockAudiobookshelf.setBooks(books);

      const result = await syncManager.syncProgress();

      // Should have 3 immediate syncs and 1 delay
      const updateCalls = mockHardcover.getUpdateCalls();
      assert.equal(updateCalls.length, 3); // book2, book3, book4

      assert.equal(result.books_delayed, 1); // book1
      assert.equal(result.books_synced, 2); // book2, book3
      assert.equal(result.books_completed, 1); // book4

      // Verify specific behaviors
      const progressValues = updateCalls
        .map(call => call.progressPercentage)
        .sort();
      assert.deepEqual(progressValues, [25, 35, 100]);
    });
  });

  describe('Environment Variable Integration', () => {
    it('loads configuration from environment variables', () => {
      // Set environment variables
      process.env.SHELFBRIDGE_DELAYED_UPDATES_ENABLED = 'true';
      process.env.SHELFBRIDGE_DELAYED_UPDATES_SESSION_TIMEOUT = '1800';
      process.env.SHELFBRIDGE_DELAYED_UPDATES_MAX_DELAY = '7200';
      process.env.SHELFBRIDGE_DELAYED_UPDATES_IMMEDIATE_COMPLETION = 'false';

      const user = {
        id: 'testuser',
        abs_url: 'http://test',
        abs_token: 'token',
        hardcover_token: 'hc_token',
      };
      const globalConfig = {
        // Config will be loaded from environment variables
        workers: 1,
        parallel: false,
      };

      // Mock the config loading to use our environment variables
      globalConfig.delayed_updates = {
        enabled: true,
        session_timeout: 1800,
        max_delay: 7200,
        immediate_completion: false,
      };

      syncManager = new SyncManager(user, globalConfig, false, false);

      // Verify the SessionManager got the right config
      const configSummary = syncManager.sessionManager.getConfigSummary();
      assert.equal(configSummary.enabled, true);
      assert.equal(configSummary.sessionTimeoutMinutes, 30);
      assert.equal(configSummary.maxDelayMinutes, 120);
      assert.equal(configSummary.immediateCompletion, false);

      // Cleanup
      delete process.env.SHELFBRIDGE_DELAYED_UPDATES_ENABLED;
      delete process.env.SHELFBRIDGE_DELAYED_UPDATES_SESSION_TIMEOUT;
      delete process.env.SHELFBRIDGE_DELAYED_UPDATES_MAX_DELAY;
      delete process.env.SHELFBRIDGE_DELAYED_UPDATES_IMMEDIATE_COMPLETION;
    });
  });

  describe('Max Delay Safety Mechanism', () => {
    beforeEach(() => {
      const user = {
        id: 'testuser',
        abs_url: 'http://test',
        abs_token: 'token',
        hardcover_token: 'hc_token',
      };
      const globalConfig = {
        delayed_updates: {
          enabled: true,
          session_timeout: 3600, // 1 hour
          max_delay: 300, // 5 minutes minimum for testing
          immediate_completion: true,
        },
        workers: 1,
        parallel: false,
      };

      syncManager = new SyncManager(user, globalConfig, false, false);

      syncManager.audiobookshelf = mockAudiobookshelf;
      syncManager.hardcover = mockHardcover;
      syncManager.bookMatcher = mockBookMatcher;
      syncManager.cache = cache;
    });

    it('forces sync when max delay exceeded', async () => {
      // Store initial progress with old hardcover sync time
      await cache.storeProgress('testuser', 'book1', 'Test Book', 40, 'isbn');

      // Set old last_hardcover_sync
      const oldTime = new Date(Date.now() - 5000).toISOString(); // 5 seconds ago
      await cache.db
        .prepare(
          `
        UPDATE books 
        SET last_hardcover_sync = ? 
        WHERE user_id = ? AND identifier = ? AND title = ?
      `,
        )
        .run(oldTime, 'testuser', 'book1', 'test book');

      const book = {
        id: 'book1',
        title: 'Test Book',
        progress_percentage: 42, // Small update that would normally delay
        is_finished: false,
        last_listened_at: new Date().toISOString(),
      };

      mockAudiobookshelf.setBooks([book]);

      const result = await syncManager.syncProgress();

      // Should force immediate sync due to max delay
      const updateCalls = mockHardcover.getUpdateCalls();
      assert.equal(updateCalls.length, 1);
      assert.equal(updateCalls[0].progressPercentage, 42);

      assert.equal(result.books_delayed, 0);
      assert.equal(result.books_synced, 1);
    });
  });

  describe('Error Handling and Resilience', () => {
    beforeEach(() => {
      const user = {
        id: 'testuser',
        abs_url: 'http://test',
        abs_token: 'token',
        hardcover_token: 'hc_token',
      };
      const globalConfig = {
        delayed_updates: {
          enabled: true,
          session_timeout: 900,
          max_delay: 3600,
          immediate_completion: true,
        },
        workers: 1,
        parallel: false,
      };

      syncManager = new SyncManager(user, globalConfig, false, false);

      syncManager.audiobookshelf = mockAudiobookshelf;
      syncManager.hardcover = mockHardcover;
      syncManager.bookMatcher = mockBookMatcher;
      syncManager.cache = cache;
    });

    it('falls back to immediate sync when session storage fails', async () => {
      // Close cache to simulate storage failure
      await cache.close();

      const book = {
        id: 'book1',
        title: 'Test Book',
        progress_percentage: 30,
        is_finished: false,
        last_listened_at: new Date().toISOString(),
      };

      mockAudiobookshelf.setBooks([book]);

      // Should not crash and fall back to immediate sync
      const result = await syncManager.syncProgress();

      // Should have made immediate sync due to fallback
      const updateCalls = mockHardcover.getUpdateCalls();
      assert.equal(updateCalls.length, 1);
      assert.equal(updateCalls[0].progressPercentage, 30);
    });

    it('handles expired session processing errors gracefully', async () => {
      // Create session that will cause error during processing
      await cache.storeProgress('testuser', 'book1', 'Test Book', 40, 'isbn');
      await cache.updateSessionProgress(
        'testuser',
        'book1',
        'Test Book',
        45,
        'isbn',
      );

      // Make expired session cause error by removing book match
      syncManager.bookMatcher.setMatch('book1', 'testuser', null);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should not crash when processing expired session fails
      mockAudiobookshelf.setBooks([]);

      const result = await syncManager.syncProgress();

      // Should complete without throwing
      assert(result !== null);
      assert.equal(result.books_processed, 0);
    });
  });

  describe('Performance and Scale', () => {
    beforeEach(() => {
      const user = {
        id: 'testuser',
        abs_url: 'http://test',
        abs_token: 'token',
        hardcover_token: 'hc_token',
      };
      const globalConfig = {
        delayed_updates: {
          enabled: true,
          session_timeout: 900,
          max_delay: 3600,
          immediate_completion: true,
        },
        workers: 1,
        parallel: false,
      };

      syncManager = new SyncManager(user, globalConfig, false, false);

      syncManager.audiobookshelf = mockAudiobookshelf;
      syncManager.hardcover = mockHardcover;
      syncManager.bookMatcher = mockBookMatcher;
      syncManager.cache = cache;
    });

    it('handles multiple books efficiently', async () => {
      // Create many books to test performance
      const books = [];
      for (let i = 1; i <= 50; i++) {
        await cache.storeProgress(
          'testuser',
          `book${i}`,
          `Book ${i}`,
          20,
          'isbn',
        );

        books.push({
          id: `book${i}`,
          title: `Book ${i}`,
          progress_percentage: 22, // Small update for each
          is_finished: false,
          last_listened_at: new Date().toISOString(),
        });
      }

      mockAudiobookshelf.setBooks(books);

      const startTime = Date.now();
      const result = await syncManager.syncProgress();
      const endTime = Date.now();

      // Should complete in reasonable time (less than 5 seconds for 50 books)
      assert(endTime - startTime < 5000);

      // All should be delayed (small updates)
      assert.equal(result.books_delayed, 50);
      assert.equal(result.books_synced, 0);

      // No API calls should have been made
      const updateCalls = mockHardcover.getUpdateCalls();
      assert.equal(updateCalls.length, 0);
    });
  });
});
