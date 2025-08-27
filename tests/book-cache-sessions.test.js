import assert from 'node:assert/strict';
import { describe, it, before, after, beforeEach } from 'node:test';
import { unlinkSync } from 'fs';

import { BookCache } from '../src/book-cache.js';

/**
 * Comprehensive unit tests for BookCache session methods
 *
 * Tests all session-related database operations:
 * - Database migration (session columns)
 * - Session progress tracking
 * - Session state management
 * - Expired session detection
 * - Session completion and cleanup
 * - Database consistency and constraints
 */

describe('BookCache Session Methods', () => {
  let cache;
  const testCacheFile = 'test-cache-sessions.db';

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

  describe('Database Migration', () => {
    it('creates session columns on fresh database', async () => {
      // Check that session columns exist
      const columns = cache.db.prepare(`PRAGMA table_info(books)`).all();
      const columnNames = columns.map(col => col.name);

      assert(columnNames.includes('session_last_change'));
      assert(columnNames.includes('session_pending_progress'));
      assert(columnNames.includes('session_is_active'));
      assert(columnNames.includes('last_hardcover_sync'));
    });

    it('creates session timeout index', async () => {
      // Check that session timeout index exists
      const indexes = cache.db.prepare(`PRAGMA index_list(books)`).all();
      const indexNames = indexes.map(idx => idx.name);

      assert(indexNames.includes('idx_books_session_timeout'));
    });
  });

  describe('Session Progress Tracking', () => {
    beforeEach(async () => {
      // Create a base book record
      await cache.storeProgress('user1', 'book1', 'Test Book', 20, 'isbn');
    });

    it('updates session progress successfully', async () => {
      const result = await cache.updateSessionProgress(
        'user1',
        'book1',
        'Test Book',
        35,
        'isbn',
      );

      assert.equal(result, true);

      // Verify the session data was stored
      const book = cache.db
        .prepare(
          `
        SELECT session_pending_progress, session_is_active, session_last_change
        FROM books 
        WHERE user_id = ? AND identifier = ? AND title = ?
      `,
        )
        .get('user1', 'book1', 'test book');

      assert.equal(book.session_pending_progress, 35);
      assert.equal(book.session_is_active, 1);
      assert(book.session_last_change !== null);
    });

    it('handles non-existent book gracefully', async () => {
      const result = await cache.updateSessionProgress(
        'user1',
        'nonexistent',
        'Non Existent Book',
        50,
        'isbn',
      );

      assert.equal(result, false);
    });

    it('updates session timestamp on repeated calls', async () => {
      // First update
      await cache.updateSessionProgress(
        'user1',
        'book1',
        'Test Book',
        25,
        'isbn',
      );

      const firstUpdate = cache.db
        .prepare(
          `
        SELECT session_last_change FROM books 
        WHERE user_id = ? AND identifier = ? AND title = ?
      `,
        )
        .get('user1', 'book1', 'test book');

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 10));

      // Second update
      await cache.updateSessionProgress(
        'user1',
        'book1',
        'Test Book',
        30,
        'isbn',
      );

      const secondUpdate = cache.db
        .prepare(
          `
        SELECT session_last_change FROM books 
        WHERE user_id = ? AND identifier = ? AND title = ?
      `,
        )
        .get('user1', 'book1', 'test book');

      assert(
        secondUpdate.session_last_change > firstUpdate.session_last_change,
      );
    });
  });

  describe('Active Session Detection', () => {
    beforeEach(async () => {
      await cache.storeProgress('user1', 'book1', 'Test Book', 20, 'isbn');
    });

    it('detects active sessions', async () => {
      await cache.updateSessionProgress(
        'user1',
        'book1',
        'Test Book',
        25,
        'isbn',
      );

      const hasActive = await cache.hasActiveSession(
        'user1',
        'book1',
        'Test Book',
        'isbn',
      );
      assert.equal(hasActive, true);
    });

    it('returns false for non-active sessions', async () => {
      // Book exists but no active session
      const hasActive = await cache.hasActiveSession(
        'user1',
        'book1',
        'Test Book',
        'isbn',
      );
      assert.equal(hasActive, false);
    });

    it('returns false for non-existent books', async () => {
      const hasActive = await cache.hasActiveSession(
        'user1',
        'nonexistent',
        'Non Existent',
        'isbn',
      );
      assert.equal(hasActive, false);
    });

    it('gets all active sessions for user', async () => {
      // Create multiple books with sessions
      await cache.storeProgress('user1', 'book2', 'Second Book', 15, 'isbn');
      await cache.storeProgress('user1', 'book3', 'Third Book', 40, 'isbn');

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
      // book3 has no active session

      const activeSessions = await cache.getActiveSessions('user1');
      assert.equal(activeSessions.length, 2);

      const titles = activeSessions.map(s => s.title).sort();
      assert.deepEqual(titles, ['second book', 'test book']);
    });
  });

  describe('Expired Session Detection', () => {
    beforeEach(async () => {
      await cache.storeProgress('user1', 'book1', 'Test Book', 20, 'isbn');
      await cache.storeProgress('user1', 'book2', 'Recent Book', 30, 'isbn');
    });

    it('finds expired sessions', async () => {
      // Create old session
      await cache.updateSessionProgress(
        'user1',
        'book1',
        'Test Book',
        25,
        'isbn',
      );

      // Manually set old timestamp
      const oldTime = new Date(Date.now() - 2000 * 1000).toISOString(); // 2000 seconds ago
      cache.db
        .prepare(
          `
        UPDATE books 
        SET session_last_change = ? 
        WHERE user_id = ? AND identifier = ? AND title = ?
      `,
        )
        .run(oldTime, 'user1', 'book1', 'test book');

      // Create recent session
      await cache.updateSessionProgress(
        'user1',
        'book2',
        'Recent Book',
        35,
        'isbn',
      );

      const expiredSessions = await cache.getExpiredSessions('user1', 1800); // 30 minutes
      assert.equal(expiredSessions.length, 1);
      assert.equal(expiredSessions[0].title, 'test book');
      assert.equal(expiredSessions[0].session_pending_progress, 25);
    });

    it('returns empty array when no expired sessions', async () => {
      await cache.updateSessionProgress(
        'user1',
        'book1',
        'Test Book',
        25,
        'isbn',
      );

      const expiredSessions = await cache.getExpiredSessions('user1', 1800);
      assert.equal(expiredSessions.length, 0);
    });

    it('ignores inactive sessions when checking expiration', async () => {
      // Create session but don't make it active
      const expiredSessions = await cache.getExpiredSessions('user1', 1);
      assert.equal(expiredSessions.length, 0);
    });
  });

  describe('Session Completion', () => {
    beforeEach(async () => {
      await cache.storeProgress('user1', 'book1', 'Test Book', 20, 'isbn');
      await cache.updateSessionProgress(
        'user1',
        'book1',
        'Test Book',
        30,
        'isbn',
      );
    });

    it('completes session successfully', async () => {
      const result = await cache.markSessionComplete(
        'user1',
        'book1',
        'Test Book',
        35,
        'isbn',
      );

      assert.equal(result, true);

      // Verify session was completed
      const book = cache.db
        .prepare(
          `
        SELECT progress_percent, session_is_active, session_pending_progress, 
               session_last_change, last_hardcover_sync, last_sync
        FROM books 
        WHERE user_id = ? AND identifier = ? AND title = ?
      `,
        )
        .get('user1', 'book1', 'test book');

      assert.equal(book.progress_percent, 35);
      assert.equal(book.session_is_active, 0);
      assert.equal(book.session_pending_progress, null);
      assert.equal(book.session_last_change, null);
      assert(book.last_hardcover_sync !== null);
      assert(book.last_sync !== null);
    });

    it('handles non-existent book gracefully', async () => {
      const result = await cache.markSessionComplete(
        'user1',
        'nonexistent',
        'Non Existent Book',
        50,
        'isbn',
      );

      assert.equal(result, false);
    });

    it('updates timestamps correctly', async () => {
      const beforeTime = new Date().toISOString();

      await cache.markSessionComplete(
        'user1',
        'book1',
        'Test Book',
        40,
        'isbn',
      );

      const afterTime = new Date().toISOString();

      const book = cache.db
        .prepare(
          `
        SELECT last_hardcover_sync, last_sync, updated_at
        FROM books 
        WHERE user_id = ? AND identifier = ? AND title = ?
      `,
        )
        .get('user1', 'book1', 'test book');

      assert(book.last_hardcover_sync >= beforeTime);
      assert(book.last_hardcover_sync <= afterTime);
      assert(book.last_sync >= beforeTime);
      assert(book.last_sync <= afterTime);
      assert(book.updated_at >= beforeTime);
      assert(book.updated_at <= afterTime);
    });
  });

  describe('Identifier Type Handling', () => {
    it('works with ASIN identifiers', async () => {
      await cache.storeProgress('user1', 'B123456789', 'ASIN Book', 20, 'asin');

      const result = await cache.updateSessionProgress(
        'user1',
        'B123456789',
        'ASIN Book',
        30,
        'asin',
      );

      assert.equal(result, true);

      const hasActive = await cache.hasActiveSession(
        'user1',
        'B123456789',
        'ASIN Book',
        'asin',
      );
      assert.equal(hasActive, true);
    });

    it('maintains identifier type consistency', async () => {
      await cache.storeProgress('user1', 'book1', 'Test Book', 20, 'isbn');
      await cache.updateSessionProgress(
        'user1',
        'book1',
        'Test Book',
        25,
        'isbn',
      );

      // Try to access with different identifier type (should not find it)
      const hasActive = await cache.hasActiveSession(
        'user1',
        'book1',
        'Test Book',
        'asin',
      );
      assert.equal(hasActive, false);
    });
  });

  describe('Database Constraints and Edge Cases', () => {
    it('handles title normalization consistently', async () => {
      await cache.storeProgress(
        'user1',
        'book1',
        '  Mixed Case Title  ',
        20,
        'isbn',
      );

      // Update with different casing/spacing
      const result = await cache.updateSessionProgress(
        'user1',
        'book1',
        'mixed case title',
        25,
        'isbn',
      );

      assert.equal(result, true);

      // Check with another variation
      const hasActive = await cache.hasActiveSession(
        'user1',
        'book1',
        'MIXED CASE TITLE',
        'isbn',
      );
      assert.equal(hasActive, true);
    });

    it('handles concurrent session updates', async () => {
      await cache.storeProgress('user1', 'book1', 'Test Book', 20, 'isbn');

      // Simulate concurrent updates
      const promises = [
        cache.updateSessionProgress('user1', 'book1', 'Test Book', 25, 'isbn'),
        cache.updateSessionProgress('user1', 'book1', 'Test Book', 26, 'isbn'),
        cache.updateSessionProgress('user1', 'book1', 'Test Book', 27, 'isbn'),
      ];

      const results = await Promise.all(promises);

      // All should succeed
      assert(results.every(result => result === true));

      // Final progress should be one of the values
      const book = cache.db
        .prepare(
          `
        SELECT session_pending_progress FROM books 
        WHERE user_id = ? AND identifier = ? AND title = ?
      `,
        )
        .get('user1', 'book1', 'test book');

      assert([25, 26, 27].includes(book.session_pending_progress));
    });

    it('handles database errors gracefully', async () => {
      // Close the database to simulate error
      await cache.close();

      const result = await cache.updateSessionProgress(
        'user1',
        'book1',
        'Test Book',
        25,
        'isbn',
      );

      assert.equal(result, false);
    });
  });
});
