import assert from 'node:assert/strict';
import { describe, it, before, after, beforeEach } from 'node:test';
import { unlinkSync } from 'fs';

import { BookCache } from '../src/book-cache.js';
import SessionManager from '../src/session-manager.js';

/**
 * Tests for startup session recovery functionality
 *
 * Validates that active sessions from previous app shutdowns
 * are properly detected and processed on startup
 */

describe('Startup Session Recovery', () => {
  let cache;
  let sessionManager;
  const testCacheFile = 'test-startup-recovery.db';

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
    // Clean up any existing cache file
    try {
      unlinkSync(testCacheFile);
    } catch (err) {
      // Ignore if file doesn't exist
    }

    // Create fresh cache for each test
    cache = new BookCache(testCacheFile);
    await cache.init();

    sessionManager = new SessionManager(cache, {
      enabled: true,
      session_timeout: 900,
      max_delay: 3600,
      immediate_completion: true,
    });
  });

  describe('Active Session Detection', () => {
    it('detects active sessions left from previous shutdown', async () => {
      // Simulate a shutdown scenario: create active sessions
      await cache.storeProgress('user1', 'book1', 'Test Book 1', 30, 'isbn');
      await cache.storeProgress('user1', 'book2', 'Test Book 2', 45, 'isbn');

      await cache.updateSessionProgress(
        'user1',
        'book1',
        'Test Book 1',
        35,
        'isbn',
      );
      await cache.updateSessionProgress(
        'user1',
        'book2',
        'Test Book 2',
        50,
        'isbn',
      );

      // Verify sessions are active
      const activeSessions = await cache.getActiveSessions('user1');
      assert.equal(activeSessions.length, 2);

      const titles = activeSessions.map(s => s.title).sort();
      assert.deepEqual(titles, ['test book 1', 'test book 2']);
    });

    it('returns empty array when no active sessions exist', async () => {
      const activeSessions = await cache.getActiveSessions('user1');
      assert.equal(activeSessions.length, 0);
    });

    it('handles completed sessions correctly', async () => {
      // Create and complete a session
      await cache.storeProgress('user1', 'book1', 'Test Book', 30, 'isbn');
      await cache.updateSessionProgress(
        'user1',
        'book1',
        'Test Book',
        35,
        'isbn',
      );
      await cache.markSessionComplete(
        'user1',
        'book1',
        'Test Book',
        40,
        'isbn',
      );

      // Should not appear in active sessions
      const activeSessions = await cache.getActiveSessions('user1');
      assert.equal(activeSessions.length, 0);
    });
  });

  describe('Session Recovery Processing', () => {
    it('processes active sessions as expired on startup', async () => {
      // Create active sessions that would be processed on startup
      await cache.storeProgress('user1', 'book1', 'Test Book', 30, 'isbn');
      await cache.updateSessionProgress(
        'user1',
        'book1',
        'Test Book',
        35,
        'isbn',
      );

      // Simulate time passing (set old timestamp)
      const oldTime = new Date(Date.now() - 1000 * 1000).toISOString(); // Very old
      await cache.db
        .prepare(
          `
        UPDATE books 
        SET session_last_change = ? 
        WHERE user_id = ? AND identifier = ? AND title = ?
      `,
        )
        .run(oldTime, 'user1', 'book1', 'test book');

      let callbackInvoked = false;
      let recoveredSession = null;

      // Process expired sessions (simulating startup recovery)
      const result = await sessionManager.processExpiredSessions(
        'user1',
        async sessionData => {
          callbackInvoked = true;
          recoveredSession = sessionData;
        },
      );

      assert.equal(result.processed, 1);
      assert.equal(result.errors, 0);
      assert.equal(callbackInvoked, true);
      assert.equal(recoveredSession.title, 'test book'); // Title comes from database (normalized)
      assert.equal(recoveredSession.finalProgress, 35);
    });

    it('handles multiple users with active sessions', async () => {
      // Create sessions for multiple users
      await cache.storeProgress('user1', 'book1', 'User1 Book', 25, 'isbn');
      await cache.storeProgress('user2', 'book2', 'User2 Book', 50, 'isbn');

      await cache.updateSessionProgress(
        'user1',
        'book1',
        'User1 Book',
        30,
        'isbn',
      );
      await cache.updateSessionProgress(
        'user2',
        'book2',
        'User2 Book',
        55,
        'isbn',
      );

      // Check both users have active sessions
      const user1Sessions = await cache.getActiveSessions('user1');
      const user2Sessions = await cache.getActiveSessions('user2');

      assert.equal(user1Sessions.length, 1);
      assert.equal(user2Sessions.length, 1);
      assert.equal(user1Sessions[0].title, 'user1 book');
      assert.equal(user2Sessions[0].title, 'user2 book');
    });

    it('preserves session data integrity during recovery', async () => {
      // Create session with specific data
      await cache.storeProgress('user1', 'book1', 'Test Book', 20, 'isbn');
      await cache.updateSessionProgress(
        'user1',
        'book1',
        'Test Book',
        25,
        'isbn',
      );

      // Get the session data
      const sessions = await cache.getActiveSessions('user1');
      const session = sessions[0];

      // Verify all session data is preserved
      assert.equal(session.user_id, 'user1');
      assert.equal(session.identifier, 'book1');
      assert.equal(session.title, 'test book');
      assert.equal(session.identifier_type, 'isbn');
      assert.equal(session.session_pending_progress, 25);
      // Note: session_is_active is not selected by getActiveSessions query
      assert(session.session_last_change !== null);
    });
  });

  describe('Error Handling During Recovery', () => {
    it('handles database errors gracefully', async () => {
      // Close the database to simulate error
      await cache.close();

      const activeSessions = await cache.getActiveSessions('user1');

      // Should return empty array on error, not crash
      assert.equal(activeSessions.length, 0);
    });

    it('continues processing other sessions if one fails', async () => {
      // Create multiple sessions
      await cache.storeProgress('user1', 'book1', 'Good Book', 30, 'isbn');
      await cache.storeProgress('user1', 'book2', 'Problem Book', 40, 'isbn');

      await cache.updateSessionProgress(
        'user1',
        'book1',
        'Good Book',
        35,
        'isbn',
      );
      await cache.updateSessionProgress(
        'user1',
        'book2',
        'Problem Book',
        45,
        'isbn',
      );

      // Make sessions expired
      const oldTime = new Date(Date.now() - 1000 * 1000).toISOString();
      await cache.db
        .prepare(
          `
        UPDATE books 
        SET session_last_change = ? 
        WHERE user_id = ? AND session_is_active = 1
      `,
        )
        .run(oldTime, 'user1');

      let processedCount = 0;
      let errorCount = 0;

      // Process with one callback that fails
      const result = await sessionManager.processExpiredSessions(
        'user1',
        async sessionData => {
          if (sessionData.title === 'problem book') {
            // Database normalizes to lowercase
            throw new Error('Simulated processing error');
          }
          processedCount++;
        },
      );

      // Should process the good one and count the error
      assert.equal(result.processed, 1);
      assert.equal(result.errors, 1);
      assert.equal(processedCount, 1);
    });
  });

  describe('Startup Recovery Configuration', () => {
    it('respects delayed updates enabled/disabled setting', () => {
      // Test enabled
      const enabledManager = new SessionManager(cache, { enabled: true });
      assert.equal(enabledManager.isEnabled(), true);

      // Test disabled
      const disabledManager = new SessionManager(cache, { enabled: false });
      assert.equal(disabledManager.isEnabled(), false);
    });

    it('handles missing delayed_updates configuration', () => {
      // Should default to disabled when not configured
      const defaultManager = new SessionManager(cache, {});
      assert.equal(defaultManager.isEnabled(), false);
    });

    it('skips session recovery when delayed updates disabled', async () => {
      const disabledManager = new SessionManager(cache, { enabled: false });

      // Even with active sessions, should return empty result
      await cache.storeProgress('user1', 'book1', 'Test Book', 30, 'isbn');
      await cache.updateSessionProgress(
        'user1',
        'book1',
        'Test Book',
        35,
        'isbn',
      );

      const result = await disabledManager.processExpiredSessions(
        'user1',
        async () => {
          throw new Error('Should not be called');
        },
      );

      assert.equal(result.processed, 0);
    });
  });

  describe('Real-world Startup Scenarios', () => {
    it('simulates app restart with multiple active sessions', async () => {
      // Simulate several books being read when app was shut down
      const books = [
        { id: 'book1', title: 'Book One', progress: 25 },
        { id: 'book2', title: 'Book Two', progress: 67 },
        { id: 'book3', title: 'Book Three', progress: 89 },
      ];

      // Create active sessions for all books
      for (const book of books) {
        await cache.storeProgress(
          'user1',
          book.id,
          book.title,
          book.progress - 5,
          'isbn',
        );
        await cache.updateSessionProgress(
          'user1',
          book.id,
          book.title,
          book.progress,
          'isbn',
        );
      }

      // Verify all sessions are active
      const activeSessions = await cache.getActiveSessions('user1');
      assert.equal(activeSessions.length, 3);

      // Simulate startup recovery by processing as expired
      const oldTime = new Date(Date.now() - 2000 * 1000).toISOString();
      await cache.db
        .prepare(
          `
        UPDATE books 
        SET session_last_change = ? 
        WHERE user_id = ? AND session_is_active = 1
      `,
        )
        .run(oldTime, 'user1');

      const recoveredSessions = [];
      const result = await sessionManager.processExpiredSessions(
        'user1',
        async sessionData => {
          recoveredSessions.push({
            title: sessionData.title,
            progress: sessionData.finalProgress,
          });
        },
      );

      // All sessions should be recovered
      assert.equal(result.processed, 3);
      assert.equal(result.errors, 0);
      assert.equal(recoveredSessions.length, 3);

      // Verify correct progress was recovered (titles are normalized to lowercase)
      const progressMap = new Map(
        recoveredSessions.map(s => [s.title, s.progress]),
      );
      assert.equal(progressMap.get('book one'), 25);
      assert.equal(progressMap.get('book two'), 67);
      assert.equal(progressMap.get('book three'), 89);

      // After recovery, no sessions should be active
      const remainingSessions = await cache.getActiveSessions('user1');
      assert.equal(remainingSessions.length, 0);
    });
  });
});
