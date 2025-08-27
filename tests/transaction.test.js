import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Transaction } from '../src/utils/transaction.js';

/**
 * Transaction Test Suite
 *
 * Tests for the Transaction class which provides rollback functionality
 * for multi-step operations. This is not a database transaction but a
 * lightweight utility for cleanup on failure.
 */

describe('Transaction', () => {
  describe('constructor', () => {
    it('creates a transaction with default label', () => {
      const txn = new Transaction();
      assert.equal(txn.label, 'transaction');
      assert.equal(txn._committed, false);
      assert.equal(txn._rollbackCallbacks.length, 0);
    });

    it('creates a transaction with custom label', () => {
      const txn = new Transaction('sync-operation');
      assert.equal(txn.label, 'sync-operation');
      assert.equal(txn._committed, false);
    });
  });

  describe('add()', () => {
    it('adds rollback callbacks successfully', () => {
      const txn = new Transaction();
      const callback1 = async () => {};
      const callback2 = async () => {};

      txn.add(callback1);
      txn.add(callback2);

      assert.equal(txn._rollbackCallbacks.length, 2);
      assert.equal(txn._rollbackCallbacks[0], callback1);
      assert.equal(txn._rollbackCallbacks[1], callback2);
    });

    it('throws error when adding non-function callback', () => {
      const txn = new Transaction();

      assert.throws(() => txn.add('not-a-function'), {
        name: 'TypeError',
        message: 'Rollback callback must be a function',
      });

      assert.throws(() => txn.add(null));
      assert.throws(() => txn.add(undefined));
      assert.throws(() => txn.add(123));
      assert.throws(() => txn.add({}));
    });

    it('throws error when adding callback after commit', async () => {
      const txn = new Transaction('test-txn');
      await txn.commit();

      assert.throws(() => txn.add(async () => {}), {
        name: 'Error',
        message: 'Cannot add rollback callback – test-txn already committed',
      });
    });

    it('allows adding callbacks after rollback', async () => {
      const txn = new Transaction();
      txn.add(async () => {});

      await txn.rollback();

      // After rollback, committed should be true, so adding should fail
      assert.throws(() => txn.add(async () => {}), /already committed/);
    });
  });

  describe('commit()', () => {
    it('marks transaction as committed', async () => {
      const txn = new Transaction();
      txn.add(async () => {});

      assert.equal(txn._committed, false);
      await txn.commit();
      assert.equal(txn._committed, true);
    });

    it('can be called multiple times safely', async () => {
      const txn = new Transaction();

      await txn.commit();
      await txn.commit(); // Should not throw

      assert.equal(txn._committed, true);
    });

    it('preserves rollback callbacks after commit', async () => {
      const txn = new Transaction();
      const callback = async () => {};
      txn.add(callback);

      await txn.commit();

      assert.equal(txn._rollbackCallbacks.length, 1);
      assert.equal(txn._rollbackCallbacks[0], callback);
    });
  });

  describe('rollback()', () => {
    it('executes callbacks in LIFO (reverse) order', async () => {
      const txn = new Transaction();
      const executionOrder = [];

      txn.add(async () => {
        executionOrder.push(1);
      });
      txn.add(async () => {
        executionOrder.push(2);
      });
      txn.add(async () => {
        executionOrder.push(3);
      });

      await txn.rollback();

      assert.deepEqual(executionOrder, [3, 2, 1]);
    });

    it('executes all callbacks even if some fail', async () => {
      const txn = new Transaction();
      const executionOrder = [];
      const mockLogger = { error: () => {} }; // Silent logger

      txn.add(async () => {
        executionOrder.push(1);
      });
      txn.add(async () => {
        executionOrder.push(2);
        throw new Error('Callback 2 failed');
      });
      txn.add(async () => {
        executionOrder.push(3);
      });

      await assert.rejects(
        async () => await txn.rollback(mockLogger),
        /Callback 2 failed/,
      );

      // All callbacks should have executed despite the failure
      assert.deepEqual(executionOrder, [3, 2, 1]);
    });

    it('throws the first error encountered during rollback', async () => {
      const txn = new Transaction();
      const mockLogger = { error: () => {} };

      txn.add(async () => {
        throw new Error('Third error');
      });
      txn.add(async () => {
        throw new Error('Second error');
      });
      txn.add(async () => {
        throw new Error('First error');
      }); // This executes first

      await assert.rejects(
        async () => await txn.rollback(mockLogger),
        /First error/, // Should be the first error encountered (last added callback)
      );
    });

    it('logs errors using provided logger', async () => {
      const txn = new Transaction('test-operation');
      const loggedMessages = [];
      const mockLogger = {
        error: message => loggedMessages.push(message),
      };

      txn.add(async () => {
        throw new Error('Rollback failed');
      });

      await assert.rejects(
        async () => await txn.rollback(mockLogger),
        /Rollback failed/,
      );

      assert.equal(loggedMessages.length, 1);
      assert.ok(loggedMessages[0].includes('test-operation'));
      assert.ok(loggedMessages[0].includes('Rollback failed'));
    });

    it('handles logger without error method gracefully', async () => {
      const txn = new Transaction();
      const invalidLogger = {}; // No error method

      txn.add(async () => {
        throw new Error('Test error');
      });

      await assert.rejects(
        async () => await txn.rollback(invalidLogger),
        /Test error/,
      );
      // Should not throw additional errors about logger
    });

    it('uses console as default logger', async () => {
      const txn = new Transaction();
      const originalConsoleError = console.error;
      const loggedMessages = [];

      // Mock console.error
      console.error = message => loggedMessages.push(message);

      try {
        txn.add(async () => {
          throw new Error('Default logger test');
        });

        await assert.rejects(
          async () => await txn.rollback(),
          /Default logger test/,
        );

        assert.equal(loggedMessages.length, 1);
        assert.ok(loggedMessages[0].includes('Default logger test'));
      } finally {
        // Restore original console.error
        console.error = originalConsoleError;
      }
    });

    it('clears callbacks after rollback', async () => {
      const txn = new Transaction();
      txn.add(async () => {});
      txn.add(async () => {});

      assert.equal(txn._rollbackCallbacks.length, 2);

      await txn.rollback();

      assert.equal(txn._rollbackCallbacks.length, 0);
    });

    it('marks transaction as committed after rollback', async () => {
      const txn = new Transaction();
      txn.add(async () => {});

      assert.equal(txn._committed, false);

      await txn.rollback();

      assert.equal(txn._committed, true);
    });

    it('handles empty callback list gracefully', async () => {
      const txn = new Transaction();

      // Should not throw when no callbacks are registered
      await txn.rollback();

      assert.equal(txn._committed, true);
    });

    it('handles async callbacks correctly', async () => {
      const txn = new Transaction();
      const results = [];

      txn.add(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        results.push('async-1');
      });

      txn.add(async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        results.push('async-2');
      });

      await txn.rollback();

      // Should execute in reverse order and wait for async completion
      assert.deepEqual(results, ['async-2', 'async-1']);
    });

    it('handles mixed sync and async callbacks', async () => {
      const txn = new Transaction();
      const results = [];

      txn.add(() => {
        results.push('sync-1');
      }); // Sync callback
      txn.add(async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        results.push('async-2');
      });
      txn.add(() => {
        results.push('sync-3');
      }); // Sync callback

      await txn.rollback();

      assert.deepEqual(results, ['sync-3', 'async-2', 'sync-1']);
    });
  });

  describe('integration scenarios', () => {
    it('supports typical usage pattern with success path', async () => {
      const txn = new Transaction('api-update');
      const cleanupActions = [];

      // Simulate registering cleanup actions
      txn.add(async () => {
        cleanupActions.push('revert-step-3');
      });
      txn.add(async () => {
        cleanupActions.push('revert-step-2');
      });
      txn.add(async () => {
        cleanupActions.push('revert-step-1');
      });

      // Simulate successful operation
      await txn.commit();

      // Cleanup actions should not have been executed
      assert.equal(cleanupActions.length, 0);
      assert.equal(txn._committed, true);

      // Should not be able to add more callbacks
      assert.throws(() => txn.add(async () => {}));
    });

    it('supports typical usage pattern with failure path', async () => {
      const txn = new Transaction('api-update');
      const cleanupActions = [];

      // Simulate registering cleanup actions
      txn.add(async () => {
        cleanupActions.push('revert-step-1');
      });
      txn.add(async () => {
        cleanupActions.push('revert-step-2');
      });
      txn.add(async () => {
        cleanupActions.push('revert-step-3');
      });

      // Simulate operation failure and rollback
      await txn.rollback();

      // Cleanup actions should have been executed in reverse order
      assert.deepEqual(cleanupActions, [
        'revert-step-3',
        'revert-step-2',
        'revert-step-1',
      ]);
      assert.equal(txn._committed, true);
      assert.equal(txn._rollbackCallbacks.length, 0);
    });

    it('handles complex scenario with partial rollback failures', async () => {
      const txn = new Transaction('complex-operation');
      const successfulCleanups = [];
      const mockLogger = {
        error: () => {}, // Silent logger for this test
      };

      // Mix of successful and failing cleanup actions
      txn.add(async () => {
        successfulCleanups.push('cleanup-1');
      });
      txn.add(async () => {
        successfulCleanups.push('cleanup-2-before-error');
        throw new Error('Cleanup 2 failed');
      });
      txn.add(async () => {
        successfulCleanups.push('cleanup-3');
      });

      await assert.rejects(
        async () => await txn.rollback(mockLogger),
        /Cleanup 2 failed/,
      );

      // All successful cleanups should have executed
      assert.deepEqual(successfulCleanups, [
        'cleanup-3',
        'cleanup-2-before-error',
        'cleanup-1',
      ]);
    });
  });
});
