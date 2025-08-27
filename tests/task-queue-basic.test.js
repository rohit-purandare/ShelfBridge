import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { TaskQueue } from '../src/utils/task-queue.js';

/**
 * Basic TaskQueue Test Suite
 *
 * Essential functionality tests without complex async operations
 * that could cause hanging issues.
 */

describe('TaskQueue (Basic)', () => {
  describe('constructor', () => {
    it('creates a queue with default concurrency', () => {
      const queue = new TaskQueue();
      assert.equal(queue.queue.concurrency, 3);
      assert.equal(queue.rateLimiter, null);
    });

    it('creates a queue with custom concurrency', () => {
      const queue = new TaskQueue({ concurrency: 5 });
      assert.equal(queue.queue.concurrency, 5);
    });

    it('handles empty options object', () => {
      const queue = new TaskQueue({});
      assert.equal(queue.queue.concurrency, 3);
      assert.equal(queue.rateLimiter, null);
    });
  });

  describe('basic task execution', () => {
    it('executes synchronous tasks', async () => {
      const queue = new TaskQueue({ concurrency: 1 });

      const task = () => 'sync-result';
      const result = await queue.enqueue(task);

      assert.equal(result, 'sync-result');
    });

    it('executes async tasks', async () => {
      const queue = new TaskQueue({ concurrency: 1 });

      const task = () => Promise.resolve('async-result');
      const result = await queue.enqueue(task);

      assert.equal(result, 'async-result');
    });

    it('handles task errors', async () => {
      const queue = new TaskQueue({ concurrency: 1 });

      const errorTask = () => Promise.reject(new Error('Task failed'));

      await assert.rejects(
        async () => await queue.enqueue(errorTask),
        /Task failed/,
      );
    });

    it('handles synchronous errors', async () => {
      const queue = new TaskQueue({ concurrency: 1 });

      const syncErrorTask = () => {
        throw new Error('Sync error');
      };

      await assert.rejects(
        async () => await queue.enqueue(syncErrorTask),
        /Sync error/,
      );
    });

    it('continues working after errors', async () => {
      const queue = new TaskQueue({ concurrency: 1 });

      const errorTask = () => Promise.reject(new Error('Error'));
      const successTask = () => Promise.resolve('success');

      // First task should fail
      await assert.rejects(async () => await queue.enqueue(errorTask), /Error/);

      // Queue should still work
      const result = await queue.enqueue(successTask);
      assert.equal(result, 'success');
    });
  });

  describe('multiple tasks', () => {
    it('executes multiple synchronous tasks', async () => {
      const queue = new TaskQueue({ concurrency: 2 });

      const task1 = () => 'result1';
      const task2 = () => 'result2';
      const task3 = () => 'result3';

      const [result1, result2, result3] = await Promise.all([
        queue.enqueue(task1),
        queue.enqueue(task2),
        queue.enqueue(task3),
      ]);

      assert.equal(result1, 'result1');
      assert.equal(result2, 'result2');
      assert.equal(result3, 'result3');
    });

    it('executes tasks with concurrency limit', async () => {
      const queue = new TaskQueue({ concurrency: 1 });
      const results = [];

      // All tasks should execute in sequence with concurrency 1
      const promises = [1, 2, 3].map(i =>
        queue.enqueue(() => {
          results.push(i);
          return i;
        }),
      );

      await Promise.all(promises);

      // With concurrency 1, should execute in order
      assert.deepEqual(results, [1, 2, 3]);
    });
  });

  describe('queue control methods', () => {
    it('has clear method', () => {
      const queue = new TaskQueue({ concurrency: 1 });
      assert.equal(typeof queue.clear, 'function');

      // Should not throw when called
      queue.clear();
    });

    it('has pause method', () => {
      const queue = new TaskQueue({ concurrency: 1 });
      assert.equal(typeof queue.pause, 'function');

      // Should not throw when called
      queue.pause();
    });

    it('has resume method', () => {
      const queue = new TaskQueue({ concurrency: 1 });
      assert.equal(typeof queue.resume, 'function');

      // Should not throw when called
      queue.resume();
    });

    it('has onIdle method', () => {
      const queue = new TaskQueue({ concurrency: 1 });
      assert.equal(typeof queue.onIdle, 'function');

      // onIdle returns a promise
      const idlePromise = queue.onIdle();
      assert.ok(idlePromise instanceof Promise);
    });
  });

  describe('abort signal (basic)', () => {
    it('accepts abort signal parameter', async () => {
      const queue = new TaskQueue({ concurrency: 1 });
      const controller = new AbortController();

      // Immediately abort
      controller.abort();

      const task = () => 'result';

      // Should handle aborted signal (exact error type may vary)
      await assert.rejects(
        async () => await queue.enqueue(task, { signal: controller.signal }),
      );
    });
  });
});
