// src/utils/transaction.js
// A simple transaction helper that allows callers to register rollback callbacks
// and execute them in case of a failure. This is **not** a database transaction
// but a lightweight utility for guaranteeing that multi-step operations either
// succeed completely or clean up any partial side-effects.
//
// Example usage:
//   const txn = new Transaction('Update progress');
//   txn.add(async () => api.revertChange());
//   try {
//     await doSomething();
//     await txn.commit();
//   } catch (err) {
//     await txn.rollback();
//     throw err;
//   }
//
// Rollback callbacks are executed in the reverse order in which they were added
// (LIFO) to mimic typical stack-based unwind semantics.

export class Transaction {
  /**
   * @param {string} [label] – Optional label to make log messages clearer.
   */
  constructor(label = 'transaction') {
    this.label = label;
    this._rollbackCallbacks = [];
    this._committed = false;
  }

  /**
   * Register a callback to be invoked if the transaction rolls back.
   * @param {Function} fn – An async function that performs the rollback.
   */
  add(fn) {
    if (this._committed) {
      throw new Error(
        `Cannot add rollback callback – ${this.label} already committed`,
      );
    }

    if (typeof fn !== 'function') {
      throw new TypeError('Rollback callback must be a function');
    }

    this._rollbackCallbacks.push(fn);
  }

  /**
   * Mark the transaction as committed. After calling this, new rollback
   * callbacks cannot be added.
   */
  async commit() {
    this._committed = true;
  }

  /**
   * Execute all registered rollback callbacks in reverse order.
   * Any errors thrown by callbacks are caught and logged so that the rollback
   * proceeds for all callbacks. The *first* error encountered is re-thrown at
   * the end so that callers are aware something went wrong.
   */
  async rollback(logger = console) {
    let firstError = null;
    // Execute in LIFO order – last added callback is executed first.
    for (let i = this._rollbackCallbacks.length - 1; i >= 0; i--) {
      const fn = this._rollbackCallbacks[i];
      try {
        await fn();
      } catch (err) {
        // Keep the first error so that we can re-throw it later.
        if (!firstError) firstError = err;
        if (logger && typeof logger.error === 'function') {
          logger.error(
            `Rollback callback failed in ${this.label}: ${err.message}`,
          );
        }
      }
    }

    // Clear callbacks to avoid accidental re-use.
    this._rollbackCallbacks = [];
    this._committed = true;

    if (firstError) {
      throw firstError;
    }
  }
}
