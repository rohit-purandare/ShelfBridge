import assert from 'node:assert/strict';
import { describe, it, before, after, beforeEach } from 'node:test';
import { unlinkSync } from 'fs';

import SessionManager from '../src/session-manager.js';
import { BookCache } from '../src/book-cache.js';

/**
 * Basic functional tests for delayed updates feature
 *
 * Tests core functionality with realistic scenarios:
 * - SessionManager basic operations
 * - BookCache session methods
 * - Configuration handling
 * - Decision logic
 */

describe('Delayed Updates Basic Functionality', () => {
  let sessionManager;
  let cache;
  const testCacheFile = 'test-basic-cache.db';

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
    // Create fresh cache for each test
    cache = new BookCache(testCacheFile);
    await cache.init();
  });

  describe('Configuration and Initialization', () => {
    it('initializes with disabled configuration', () => {
      sessionManager = new SessionManager(cache, { enabled: false });

      assert.equal(sessionManager.isEnabled(), false);
      const config = sessionManager.getConfigSummary();
      assert.equal(config.enabled, false);
      assert.equal(config.sessionTimeoutMinutes, 15); // Default
      assert.equal(config.maxDelayMinutes, 60); // Default
      assert.equal(config.immediateCompletion, true); // Default
    });

    it('initializes with enabled configuration', () => {
      sessionManager = new SessionManager(cache, {
        enabled: true,
        session_timeout: 1800, // 30 minutes
        max_delay: 7200, // 2 hours
        immediate_completion: false,
      });

      assert.equal(sessionManager.isEnabled(), true);
      const config = sessionManager.getConfigSummary();
      assert.equal(config.enabled, true);
      assert.equal(config.sessionTimeoutMinutes, 30);
      assert.equal(config.maxDelayMinutes, 120);
      assert.equal(config.immediateCompletion, false);
    });

    it('validates configuration ranges', () => {
      // Test minimum invalid values
      assert.throws(() => {
        new SessionManager(cache, {
          enabled: true,
          session_timeout: 30, // Too short
        });
      }, /Invalid sessionTimeout/);

      // Test session timeout >= max delay
      assert.throws(() => {
        new SessionManager(cache, {
          enabled: true,
          session_timeout: 1800,
          max_delay: 1200, // Less than session timeout
        });
      }, /sessionTimeout.*must be less than maxDelay/);
    });
  });

  describe('Basic Session Decision Logic', () => {
    beforeEach(() => {
      sessionManager = new SessionManager(cache, {
        enabled: true,
        session_timeout: 900,
        max_delay: 3600,
        immediate_completion: true,
      });
    });

    it('returns immediate sync when disabled', async () => {
      const disabledManager = new SessionManager(cache, { enabled: false });

      const decision = await disabledManager.shouldDelayUpdate(
        'user1',
        'book1',
        'Test Book',
        50,
        {},
        'isbn',
      );

      assert.equal(decision.action, 'sync_immediately');
      assert.equal(decision.reason, 'delayed_updates_disabled');
      assert.equal(decision.shouldDelay, false);
    });

    it('returns immediate sync for book completion', async () => {
      const completedBook = {
        is_finished: true,
        progress_percentage: 100,
      };

      const decision = await sessionManager.shouldDelayUpdate(
        'user1',
        'book1',
        'Test Book',
        100,
        completedBook,
        'isbn',
      );

      assert.equal(decision.action, 'sync_immediately');
      assert.equal(decision.reason, 'book_completion');
      assert.equal(decision.shouldDelay, false);
      assert.equal(decision.isCompletion, true);
    });

    it('handles new books (no previous progress)', async () => {
      const book = {
        is_finished: false,
        progress_percentage: 25,
      };

      const decision = await sessionManager.shouldDelayUpdate(
        'user1',
        'book1',
        'New Book',
        25,
        book,
        'isbn',
      );

      // New books should sync immediately (significant change from null)
      assert.equal(decision.action, 'sync_immediately');
      assert.equal(decision.reason, 'significant_progress_change');
      assert.equal(decision.shouldDelay, false);
    });
  });

  describe('BookCache Session Methods', () => {
    beforeEach(async () => {
      // Create a base book record
      await cache.storeProgress('user1', 'book1', 'Test Book', 20, 'isbn');
    });

    it('creates active sessions', async () => {
      const result = await cache.updateSessionProgress(
        'user1',
        'book1',
        'Test Book',
        35,
        'isbn',
      );

      assert.equal(result, true);

      // Verify the session was created
      const hasActive = await cache.hasActiveSession(
        'user1',
        'book1',
        'Test Book',
        'isbn',
      );
      assert.equal(hasActive, true);
    });

    it('completes sessions', async () => {
      // Start with active session
      await cache.updateSessionProgress(
        'user1',
        'book1',
        'Test Book',
        30,
        'isbn',
      );

      const success = await cache.markSessionComplete(
        'user1',
        'book1',
        'Test Book',
        35,
        'isbn',
      );

      assert.equal(success, true);

      // Verify session was completed
      const hasActive = await cache.hasActiveSession(
        'user1',
        'book1',
        'Test Book',
        'isbn',
      );
      assert.equal(hasActive, false);
    });

    it('tracks multiple active sessions', async () => {
      // Create multiple books with sessions
      await cache.storeProgress('user1', 'book2', 'Second Book', 15, 'isbn');
      await cache.updateSessionProgress(
        'user1',
        'book1',
        'Test Book',
        25,
        'isbn',
      );
      await cache.updateSessionProgress(
        'user1',
        'book2',
        'Second Book',
        20,
        'isbn',
      );

      const activeSessions = await cache.getActiveSessions('user1');
      assert.equal(activeSessions.length, 2);
    });
  });

  describe('Session Lifecycle Management', () => {
    beforeEach(() => {
      sessionManager = new SessionManager(cache, {
        enabled: true,
        session_timeout: 900,
        max_delay: 3600,
        immediate_completion: true,
      });
    });

    it('updates session progress through SessionManager', async () => {
      // Store initial book
      await cache.storeProgress('user1', 'book1', 'Test Book', 20, 'isbn');

      const success = await sessionManager.updateSession(
        'user1',
        'book1',
        'Test Book',
        25,
        'isbn',
      );

      assert.equal(success, true);

      // Verify session was updated
      const hasActive = await cache.hasActiveSession(
        'user1',
        'book1',
        'Test Book',
        'isbn',
      );
      assert.equal(hasActive, true);
    });

    it('completes sessions through SessionManager', async () => {
      // Start with active session
      await cache.updateSessionProgress(
        'user1',
        'book1',
        'Test Book',
        30,
        'isbn',
      );

      const success = await sessionManager.completeSession(
        'user1',
        'book1',
        'Test Book',
        35,
        'isbn',
      );

      assert.equal(success, true);

      // Verify session was completed
      const hasActive = await cache.hasActiveSession(
        'user1',
        'book1',
        'Test Book',
        'isbn',
      );
      assert.equal(hasActive, false);
    });
  });

  describe('Progress Change Detection', () => {
    beforeEach(() => {
      sessionManager = new SessionManager(cache, {
        enabled: true,
        session_timeout: 900,
        max_delay: 3600,
        immediate_completion: true,
      });
    });

    it('detects large progress changes as significant', async () => {
      // Store initial progress
      await cache.storeProgress('user1', 'book1', 'Test Book', 30, 'isbn');

      const book = {
        is_finished: false,
        progress_percentage: 50, // 20% jump
      };

      const decision = await sessionManager.shouldDelayUpdate(
        'user1',
        'book1',
        'Test Book',
        50,
        book,
        'isbn',
      );

      assert.equal(decision.action, 'sync_immediately');
      assert.equal(decision.reason, 'significant_progress_change');
      assert.equal(decision.shouldDelay, false);
    });

    it('handles missing book data gracefully', async () => {
      const decision = await sessionManager.shouldDelayUpdate(
        'user1',
        'book1',
        'Test Book',
        50,
        null,
        'isbn',
      );

      // Should have some reasonable decision (not crash)
      assert(decision.action);
      assert(decision.reason);
      assert(typeof decision.shouldDelay === 'boolean');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      sessionManager = new SessionManager(cache, {
        enabled: true,
        session_timeout: 900,
        max_delay: 3600,
        immediate_completion: true,
      });
    });

    it('handles non-existent books gracefully in cache methods', async () => {
      const updateResult = await cache.updateSessionProgress(
        'user1',
        'nonexistent',
        'Non Existent Book',
        50,
        'isbn',
      );
      assert.equal(updateResult, false);

      const completeResult = await cache.markSessionComplete(
        'user1',
        'nonexistent',
        'Non Existent Book',
        50,
        'isbn',
      );
      assert.equal(completeResult, false);

      const hasActive = await cache.hasActiveSession(
        'user1',
        'nonexistent',
        'Non Existent Book',
        'isbn',
      );
      // Should return false or undefined for non-existent books, but be falsy
      assert.equal(!!hasActive, false);
    });

    it('handles disabled state gracefully in SessionManager', async () => {
      const disabledManager = new SessionManager(cache, { enabled: false });

      const updateResult = await disabledManager.updateSession(
        'user1',
        'book1',
        'Test Book',
        25,
        'isbn',
      );
      assert.equal(updateResult, false);

      const completeResult = await disabledManager.completeSession(
        'user1',
        'book1',
        'Test Book',
        30,
        'isbn',
      );
      assert.equal(completeResult, false);
    });
  });

  describe('Real-world Scenarios', () => {
    beforeEach(() => {
      sessionManager = new SessionManager(cache, {
        enabled: true,
        session_timeout: 900,
        max_delay: 3600,
        immediate_completion: true,
      });
    });

    it('handles typical reading session workflow', async () => {
      // 1. Store initial book progress
      await cache.storeProgress('user1', 'book1', 'Test Book', 20, 'isbn');

      // 2. Start reading session with small updates (should delay)
      let decision = await sessionManager.shouldDelayUpdate(
        'user1',
        'book1',
        'Test Book',
        22,
        { is_finished: false },
        'isbn',
      );
      assert.equal(decision.shouldDelay, true);

      // 3. Continue with small updates
      await sessionManager.updateSession(
        'user1',
        'book1',
        'Test Book',
        22,
        'isbn',
      );

      decision = await sessionManager.shouldDelayUpdate(
        'user1',
        'book1',
        'Test Book',
        24,
        { is_finished: false },
        'isbn',
      );
      assert.equal(decision.shouldDelay, true);

      // 4. Large jump should force immediate sync
      decision = await sessionManager.shouldDelayUpdate(
        'user1',
        'book1',
        'Test Book',
        35,
        { is_finished: false },
        'isbn',
      );
      assert.equal(decision.shouldDelay, false);
      assert.equal(decision.reason, 'significant_progress_change');

      // 5. Complete the session
      await sessionManager.completeSession(
        'user1',
        'book1',
        'Test Book',
        35,
        'isbn',
      );

      const hasActive = await cache.hasActiveSession(
        'user1',
        'book1',
        'Test Book',
        'isbn',
      );
      assert.equal(hasActive, false);
    });
  });
});
