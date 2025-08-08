import PQueue from 'p-queue';

/**
 * Declarative task queue with built-in concurrency & optional rate-limit handling.
 * Each `enqueue` returns the task promise exactly like `queue.add`, but ensures
 * the provided rate-limiter is respected first.
 */
export class TaskQueue {
  /**
   * @param {Object} opts
   * @param {number} [opts.concurrency=3] – Max number of active tasks.
   * @param {import('./concurrency.js').RateLimiter} [opts.rateLimiter] – Optional rate-limiter to wait on for every task.
   */
  constructor({ concurrency = 3, rateLimiter = null } = {}) {
    this.queue = new PQueue({ concurrency });
    this.rateLimiter = rateLimiter;
  }

  /**
   * Enqueue a task function.
   * @param {Function} task – Function returning a promise.
   * @param {Object} [opts]
   * @param {AbortSignal} [opts.signal] – Optional abort signal; task will not run if already aborted and queue.add will be cancelled if aborted later.
   * @returns {Promise<*>}
   */
  enqueue(task, { signal } = {}) {
    const wrapped = async () => {
      if (signal?.aborted) throw new Error('Task aborted');
      if (this.rateLimiter) {
        await this.rateLimiter.waitIfNeeded('task-queue');
      }
      return task();
    };
    return this.queue.add(wrapped, { signal });
  }

  /** Clear pending jobs */
  clear() {
    this.queue.clear();
  }

  /** Pause processing */
  pause() {
    this.queue.pause();
  }

  /** Resume processing */
  resume() {
    if (this.queue.isPaused) this.queue.start();
  }

  /** Await until queue is fully empty */
  onIdle() {
    return this.queue.onIdle();
  }
}
