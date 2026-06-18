import assert from 'node:assert/strict';
import { describe, it, before, after, beforeEach } from 'node:test';
import { unlinkSync } from 'fs';

import { BookCache } from '../src/book-cache.js';

/**
 * Tests for BookCache transaction timeout and pragma handling
 *
 * These tests verify:
 * - Database pragma methods work correctly
 * - Transaction timeouts are set and restored properly
 * - The busy_timeout pragma is read/written correctly
 * - No errors occur during transaction execution
 */

describe('BookCache Transaction Timeout', () => {
  let cache;
  const testCacheFile = 'test-cache-timeout.db';

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

  describe('Pragma Reading', () => {
    it('can read busy_timeout pragma', async () => {
      const result = cache.db.pragma('busy_timeout');

      // Should return an array with a single object containing 'timeout' property
      assert(Array.isArray(result));
      assert(result.length > 0);
      assert(typeof result[0] === 'object');
      assert(result[0].hasOwnProperty('timeout'));
      assert(typeof result[0].timeout === 'number');
    });

    it('can read other pragma values', async () => {
      const journalMode = cache.db.pragma('journal_mode');
      assert(Array.isArray(journalMode));
      assert(journalMode.length > 0);
      assert(journalMode[0].journal_mode === 'wal');

      const synchronous = cache.db.pragma('synchronous');
      assert(Array.isArray(synchronous));
      assert(synchronous.length > 0);
      // synchronous returns numeric value: 0=OFF, 1=NORMAL, 2=FULL
      assert(typeof synchronous[0].synchronous === 'number');
    });
  });

  describe('Pragma Writing', () => {
    it('can set and verify busy_timeout', async () => {
      const testTimeout = 10000;

      // Set timeout
      cache.db.pragma(`busy_timeout = ${testTimeout}`);

      // Read it back
      const result = cache.db.pragma('busy_timeout');
      assert.equal(result[0].timeout, testTimeout);
    });

    it('can restore original busy_timeout', async () => {
      // Get original value
      const original = cache.db.pragma('busy_timeout');
      const originalValue = original[0].timeout;

      // Change it
      cache.db.pragma('busy_timeout = 15000');

      // Verify it changed
      const changed = cache.db.pragma('busy_timeout');
      assert.equal(changed[0].timeout, 15000);

      // Restore original
      cache.db.pragma(`busy_timeout = ${originalValue}`);

      // Verify restoration
      const restored = cache.db.pragma('busy_timeout');
      assert.equal(restored[0].timeout, originalValue);
    });
  });

  describe('Transaction Timeout Handling', () => {
    it('successfully executes transaction with timeout', async () => {
      await cache.storeProgress('user1', 'book1', 'Test Book', 20, 'isbn');

      // Execute a transaction that should use the timeout
      const operations = [
        () =>
          cache._storeProgressOperation(
            'user1',
            'book1',
            'Test Book',
            30,
            'isbn',
            null,
            null,
          ),
      ];

      const result = await cache.executeTransaction(operations, {
        description: 'Test transaction with timeout',
        timeout: 3000,
      });

      // Transaction should succeed
      assert(Array.isArray(result));
      assert.equal(result.length, 1);

      // Verify progress was updated
      const progress = await cache.getLastProgress(
        'user1',
        'book1',
        'Test Book',
        'isbn',
      );
      assert.equal(progress, 30);
    });

    it('executes storeBookSyncData without pragma errors', async () => {
      // This should not generate any "Expected second argument" errors
      const result = await cache.storeBookSyncData(
        'user1',
        'B094XCNV6G',
        "The Dungeon Anarchist's Cookbook",
        32126950,
        'asin',
        'Matt Dinniman',
        99.7689581700846,
        new Date().toISOString(),
        new Date().toISOString(),
      );

      // Verify it worked
      assert(Array.isArray(result));
      assert.equal(result.length, 2);

      // Check that data was stored
      const editionId = await cache.getEditionForBook(
        'user1',
        'B094XCNV6G',
        "The Dungeon Anarchist's Cookbook",
        'asin',
      );
      assert.equal(editionId, 32126950);

      const progress = await cache.getLastProgress(
        'user1',
        'B094XCNV6G',
        "The Dungeon Anarchist's Cookbook",
        'asin',
      );
      assert(Math.abs(progress - 99.7689581700846) < 0.0001);
    });

    it('handles multiple concurrent transactions', async () => {
      // Create base books
      await cache.storeProgress('user1', 'book1', 'Book One', 10, 'isbn');
      await cache.storeProgress('user1', 'book2', 'Book Two', 20, 'isbn');
      await cache.storeProgress('user1', 'book3', 'Book Three', 30, 'isbn');

      // Execute multiple transactions concurrently
      const promises = [
        cache.executeTransaction(
          [
            () =>
              cache._storeProgressOperation(
                'user1',
                'book1',
                'Book One',
                15,
                'isbn',
                null,
                null,
              ),
          ],
          { description: 'Transaction 1', timeout: 2000 },
        ),
        cache.executeTransaction(
          [
            () =>
              cache._storeProgressOperation(
                'user1',
                'book2',
                'Book Two',
                25,
                'isbn',
                null,
                null,
              ),
          ],
          { description: 'Transaction 2', timeout: 2500 },
        ),
        cache.executeTransaction(
          [
            () =>
              cache._storeProgressOperation(
                'user1',
                'book3',
                'Book Three',
                35,
                'isbn',
                null,
                null,
              ),
          ],
          { description: 'Transaction 3', timeout: 3000 },
        ),
      ];

      const results = await Promise.all(promises);

      // All transactions should succeed
      assert.equal(results.length, 3);
      results.forEach(result => {
        assert(Array.isArray(result));
        assert.equal(result.length, 1);
      });

      // Verify all updates
      const progress1 = await cache.getLastProgress(
        'user1',
        'book1',
        'Book One',
        'isbn',
      );
      const progress2 = await cache.getLastProgress(
        'user1',
        'book2',
        'Book Two',
        'isbn',
      );
      const progress3 = await cache.getLastProgress(
        'user1',
        'book3',
        'Book Three',
        'isbn',
      );

      assert.equal(progress1, 15);
      assert.equal(progress2, 25);
      assert.equal(progress3, 35);
    });

    it('preserves busy_timeout across transaction boundary', async () => {
      // Get original timeout
      const originalTimeout = cache.db.pragma('busy_timeout')[0].timeout;

      // Execute transaction with different timeout
      await cache.storeProgress('user1', 'book1', 'Test Book', 20, 'isbn');

      const operations = [
        () =>
          cache._storeProgressOperation(
            'user1',
            'book1',
            'Test Book',
            30,
            'isbn',
            null,
            null,
          ),
      ];

      await cache.executeTransaction(operations, {
        description: 'Test transaction',
        timeout: 7500,
      });

      // Check that timeout was restored to original value
      const finalTimeout = cache.db.pragma('busy_timeout')[0].timeout;
      assert.equal(finalTimeout, originalTimeout);
    });
  });

  describe('Error Handling', () => {
    it('restores timeout even when transaction fails', async () => {
      const originalTimeout = cache.db.pragma('busy_timeout')[0].timeout;

      // Create an operation that will fail
      const operations = [
        () => {
          throw new Error('Intentional transaction failure');
        },
      ];

      try {
        await cache.executeTransaction(operations, {
          description: 'Failing transaction',
          timeout: 5000,
        });
        assert.fail('Transaction should have thrown an error');
      } catch (error) {
        assert.equal(error.message, 'Intentional transaction failure');
      }

      // Timeout should still be restored
      const finalTimeout = cache.db.pragma('busy_timeout')[0].timeout;
      assert.equal(finalTimeout, originalTimeout);
    });

    it('handles pragma errors gracefully', async () => {
      // Even if pragma operations fail, transaction should still work
      await cache.storeProgress('user1', 'book1', 'Test Book', 20, 'isbn');

      const operations = [
        () =>
          cache._storeProgressOperation(
            'user1',
            'book1',
            'Test Book',
            30,
            'isbn',
            null,
            null,
          ),
      ];

      // Should not throw even with potential pragma issues
      const result = await cache.executeTransaction(operations, {
        description: 'Transaction with potential pragma issues',
        timeout: 3000,
      });

      assert(Array.isArray(result));
      assert.equal(result.length, 1);
    });
  });

  describe('Regression Tests', () => {
    it('does not generate "Expected second argument" error', async () => {
      // This test simulates the exact scenario from the user's logs
      let errorLogged = false;
      const originalPragma = cache.db.pragma.bind(cache.db);

      // Wrap pragma to detect if it's called with invalid arguments
      cache.db.pragma = function (...args) {
        if (args.length === 2 && typeof args[1] === 'boolean') {
          errorLogged = true;
          // This would have caused the error in the old code
        }
        return originalPragma(...args);
      };

      // Execute the same type of transaction from the logs
      await cache.storeBookSyncData(
        'user1',
        'B094XCNV6G',
        "The Dungeon Anarchist's Cookbook",
        32126950,
        'asin',
        'Matt Dinniman',
        99.7689581700846,
        new Date().toISOString(),
        new Date().toISOString(),
      );

      // Restore original pragma
      cache.db.pragma = originalPragma;

      // Should not have logged the error
      assert.equal(
        errorLogged,
        false,
        'pragma should not be called with boolean second argument',
      );
    });
  });
});
