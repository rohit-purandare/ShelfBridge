import assert from 'node:assert/strict';
import { describe, it, before, after, beforeEach } from 'node:test';
import { readFileSync, unlinkSync } from 'fs';
import path from 'path';

import SessionManager from '../src/session-manager.js';
import { BookCache } from '../src/book-cache.js';

/**
 * Comprehensive unit tests for SessionManager
 *
 * Tests all delayed updates functionality:
 * - Configuration validation and defaults
 * - Session decision logic (delay vs immediate sync)
 * - Milestone and completion detection
 * - Session lifecycle management
 * - Expired session processing
 * - Edge cases and error handling
 */

describe('SessionManager', () => {
  let sessionManager;
  let cache;
  const testCacheFile = 'test-session-cache.db';

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

  describe('Configuration', () => {
    it('initializes with default configuration when disabled', () => {
      sessionManager = new SessionManager(cache, {});

      assert.equal(sessionManager.isEnabled(), false);
      const config = sessionManager.getConfigSummary();
      assert.equal(config.enabled, false);
      assert.equal(config.sessionTimeoutMinutes, 15);
      assert.equal(config.maxDelayMinutes, 60);
      assert.equal(config.immediateCompletion, true);
    });

    it('initializes with custom configuration', () => {
      const customConfig = {
        enabled: true,
        session_timeout: 1800, // 30 minutes
        max_delay: 7200, // 2 hours
        immediate_completion: false,
      };

      sessionManager = new SessionManager(cache, customConfig);

      assert.equal(sessionManager.isEnabled(), true);
      const config = sessionManager.getConfigSummary();
      assert.equal(config.enabled, true);
      assert.equal(config.sessionTimeoutMinutes, 30);
      assert.equal(config.maxDelayMinutes, 120);
      assert.equal(config.immediateCompletion, false);
    });

    it('validates configuration ranges', () => {
      assert.throws(() => {
        new SessionManager(cache, {
          enabled: true,
          session_timeout: 30, // Too short
        });
      }, /Invalid sessionTimeout/);

      assert.throws(() => {
        new SessionManager(cache, {
          enabled: true,
          session_timeout: 600,
          max_delay: 300, // Less than session timeout
        });
      }, /sessionTimeout.*must be less than maxDelay/);
    });

    it('handles environment variable style config keys', () => {
      const envStyleConfig = {
        enabled: true,
        session_timeout: 1200,
        max_delay: 3600,
        immediate_completion: false,
      };

      sessionManager = new SessionManager(cache, envStyleConfig);

      const config = sessionManager.getConfigSummary();
      assert.equal(config.sessionTimeoutMinutes, 20);
      assert.equal(config.maxDelayMinutes, 60);
      assert.equal(config.immediateCompletion, false);
    });
  });

  describe('Session Decision Logic', () => {
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

    it('delays normal progress updates', async () => {
      const book = {
        is_finished: false,
        progress_percentage: 45,
      };

      const decision = await sessionManager.shouldDelayUpdate(
        'user1',
        'book1',
        'Test Book',
        45,
        book,
        'isbn',
      );

      assert.equal(decision.action, 'delay_update');
      assert.equal(decision.reason, 'active_session_detected');
      assert.equal(decision.shouldDelay, true);
      assert.equal(decision.sessionTimeout, 900);
    });

    it('forces immediate sync when max delay exceeded', async () => {
      // First, store some progress in cache with old timestamp
      await cache.storeProgress('user1', 'book1', 'Test Book', 30, 'isbn');

      // Manually set last_hardcover_sync to simulate old sync
      const oldTime = new Date(Date.now() - 4000 * 1000).toISOString(); // 4000 seconds ago
      await cache.db
        .prepare(
          `
        UPDATE books 
        SET last_hardcover_sync = ? 
        WHERE user_id = ? AND identifier = ? AND title = ?
      `,
        )
        .run(oldTime, 'user1', 'book1', 'test book');

      const book = {
        is_finished: false,
        progress_percentage: 35,
      };

      const decision = await sessionManager.shouldDelayUpdate(
        'user1',
        'book1',
        'Test Book',
        35,
        book,
        'isbn',
      );

      assert.equal(decision.action, 'sync_immediately');
      assert.equal(decision.reason, 'max_delay_exceeded');
      assert.equal(decision.shouldDelay, false);
      assert.equal(decision.forcedSync, true);
    });

    it('forces immediate sync for significant progress changes', async () => {
      // Store initial progress
      await cache.storeProgress('user1', 'book1', 'Test Book', 30, 'isbn');

      const book = {
        is_finished: false,
        progress_percentage: 40, // 10% jump
      };

      const decision = await sessionManager.shouldDelayUpdate(
        'user1',
        'book1',
        'Test Book',
        40,
        book,
        'isbn',
      );

      assert.equal(decision.action, 'sync_immediately');
      assert.equal(decision.reason, 'significant_progress_change');
      assert.equal(decision.shouldDelay, false);
      assert.equal(decision.changeDetails.isSignificant, true);
    });
  });

  describe('Milestone Detection', () => {
    beforeEach(() => {
      sessionManager = new SessionManager(cache, {
        enabled: true,
        session_timeout: 900,
        max_delay: 3600,
        immediate_completion: true,
      });
    });

    it('detects milestone crossings as significant', async () => {
      // Store progress just before milestone
      await cache.storeProgress('user1', 'book1', 'Test Book', 49, 'isbn');

      const book = {
        is_finished: false,
        progress_percentage: 51, // Crosses 50% milestone
      };

      const decision = await sessionManager.shouldDelayUpdate(
        'user1',
        'book1',
        'Test Book',
        51,
        book,
        'isbn',
      );

      assert.equal(decision.action, 'sync_immediately');
      assert.equal(decision.reason, 'significant_progress_change');
      assert.equal(decision.shouldDelay, false);
    });

    it('delays small increments within milestone range', async () => {
      // Store progress
      await cache.storeProgress('user1', 'book1', 'Test Book', 30, 'isbn');

      const book = {
        is_finished: false,
        progress_percentage: 32, // Small 2% increment
      };

      const decision = await sessionManager.shouldDelayUpdate(
        'user1',
        'book1',
        'Test Book',
        32,
        book,
        'isbn',
      );

      assert.equal(decision.action, 'delay_update');
      assert.equal(decision.reason, 'active_session_detected');
      assert.equal(decision.shouldDelay, true);
    });
  });

  describe('Session Lifecycle', () => {
    beforeEach(() => {
      sessionManager = new SessionManager(cache, {
        enabled: true,
        session_timeout: 900,
        max_delay: 3600,
        immediate_completion: true,
      });
    });

    it('updates session progress', async () => {
      // First store a book to update
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

    it('completes session and clears state', async () => {
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

    it('handles disabled state gracefully', async () => {
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

      const expiredSessions = await disabledManager.getExpiredSessions('user1');
      assert.equal(expiredSessions.length, 0);
    });
  });

  describe('Expired Session Processing', () => {
    beforeEach(() => {
      sessionManager = new SessionManager(cache, {
        enabled: true,
        session_timeout: 60, // Minimum valid value for testing
        max_delay: 3600,
        immediate_completion: true,
      });
    });

    it('finds expired sessions', async () => {
      // Create active session
      await cache.storeProgress('user1', 'book1', 'Test Book', 20, 'isbn');
      await cache.updateSessionProgress(
        'user1',
        'book1',
        'Test Book',
        25,
        'isbn',
      );

      // Manually mark session as expired by setting old timestamp
      const oldTime = new Date(Date.now() - 70 * 1000).toISOString(); // 70 seconds ago
      await cache.db
        .prepare(
          `
        UPDATE books 
        SET session_last_change = ? 
        WHERE user_id = ? AND identifier = ? AND title = ?
      `,
        )
        .run(oldTime, 'user1', 'book1', 'test book');

      const expiredSessions = await cache.getExpiredSessions('user1', 60);
      assert.equal(expiredSessions.length, 1);
      assert.equal(expiredSessions[0].title, 'test book');
      assert.equal(expiredSessions[0].session_pending_progress, 25);
    });

    it('processes expired sessions with callback', async () => {
      // Create expired session
      await cache.storeProgress('user1', 'book1', 'Test Book', 20, 'isbn');
      await cache.updateSessionProgress(
        'user1',
        'book1',
        'Test Book',
        30,
        'isbn',
      );

      // Manually mark session as expired by setting old timestamp
      const oldTime = new Date(Date.now() - 70 * 1000).toISOString(); // 70 seconds ago
      await cache.db
        .prepare(
          `
        UPDATE books 
        SET session_last_change = ? 
        WHERE user_id = ? AND identifier = ? AND title = ?
      `,
        )
        .run(oldTime, 'user1', 'book1', 'test book');

      let callbackCalled = false;
      let callbackData = null;

      const result = await sessionManager.processExpiredSessions(
        'user1',
        async data => {
          callbackCalled = true;
          callbackData = data;
        },
      );

      assert.equal(result.processed, 1);
      assert.equal(result.errors, 0);
      assert.equal(callbackCalled, true);
      assert.equal(callbackData.title, 'Test Book');
      assert.equal(callbackData.finalProgress, 30);
    });

    it('handles callback errors gracefully', async () => {
      // Create expired session
      await cache.storeProgress('user1', 'book1', 'Test Book', 20, 'isbn');
      await cache.updateSessionProgress(
        'user1',
        'book1',
        'Test Book',
        30,
        'isbn',
      );

      // Manually mark session as expired by setting old timestamp
      const oldTime = new Date(Date.now() - 70 * 1000).toISOString(); // 70 seconds ago
      await cache.db
        .prepare(
          `
        UPDATE books 
        SET session_last_change = ? 
        WHERE user_id = ? AND identifier = ? AND title = ?
      `,
        )
        .run(oldTime, 'user1', 'book1', 'test book');

      const result = await sessionManager.processExpiredSessions(
        'user1',
        async () => {
          throw new Error('Test callback error');
        },
      );

      assert.equal(result.processed, 0);
      assert.equal(result.errors, 1);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      sessionManager = new SessionManager(cache, {
        enabled: true,
        session_timeout: 900,
        max_delay: 3600,
        immediate_completion: true,
      });
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

      // Should default to delay when no completion data available
      assert.equal(decision.action, 'delay_update');
      assert.equal(decision.shouldDelay, true);
    });

    it('handles books with no previous progress', async () => {
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

      // Should sync immediately for new books (significant change from null)
      assert.equal(decision.action, 'sync_immediately');
      assert.equal(decision.reason, 'significant_progress_change');
    });

    it('respects immediate_completion=false setting', async () => {
      const noImmediateCompletionManager = new SessionManager(cache, {
        enabled: true,
        session_timeout: 900,
        max_delay: 3600,
        immediate_completion: false,
      });

      const completedBook = {
        is_finished: true,
        progress_percentage: 100,
      };

      const decision = await noImmediateCompletionManager.shouldDelayUpdate(
        'user1',
        'book1',
        'Test Book',
        100,
        completedBook,
        'isbn',
      );

      // Should delay even completions when immediate_completion is false
      assert.equal(decision.action, 'delay_update');
      assert.equal(decision.shouldDelay, true);
    });
  });
});
