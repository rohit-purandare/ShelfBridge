import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Semaphore } from '../src/utils/concurrency.js';

/**
 * Parallel Sync Orchestration Tests
 *
 * Validates the Promise.allSettled-based parallel user sync logic used in
 * runScheduledSync. Since main.js calls program.parse() at module level it
 * cannot be imported directly, so these tests mirror the exact orchestration
 * pattern to verify correctness.
 */

/**
 * Runs the same parallel orchestration logic as runScheduledSync.
 * Returns the array of settled results so callers can inspect outcomes.
 */
async function runParallelSync(users, syncUser, workers = 3) {
  const semaphore = new Semaphore(workers);

  const results = await Promise.allSettled(
    users.map(async user => {
      await semaphore.acquire();
      try {
        await syncUser(user);
      } finally {
        semaphore.release();
      }
    }),
  );

  return results;
}

describe('Parallel sync orchestration (Promise.allSettled)', () => {
  it('processes all users when none fail', async () => {
    const processed = [];
    const users = [{ id: 'alice' }, { id: 'bob' }, { id: 'carol' }];

    const syncUser = async user => {
      processed.push(user.id);
    };

    const results = await runParallelSync(users, syncUser);

    assert.equal(results.length, 3);
    assert.ok(results.every(r => r.status === 'fulfilled'));
    assert.deepEqual(processed.sort(), ['alice', 'bob', 'carol']);
  });

  it('processes all users even when one throws', async () => {
    const processed = [];
    const users = [{ id: 'alice' }, { id: 'bob' }, { id: 'carol' }];

    const syncUser = async user => {
      if (user.id === 'bob') {
        throw new Error('bob sync failed');
      }
      processed.push(user.id);
    };

    const results = await runParallelSync(users, syncUser);

    assert.equal(results.length, 3);

    const failed = results.filter(r => r.status === 'rejected');
    const fulfilled = results.filter(r => r.status === 'fulfilled');

    assert.equal(failed.length, 1);
    assert.equal(fulfilled.length, 2);
    assert.match(failed[0].reason.message, /bob sync failed/);

    // alice and carol were still processed despite bob failing
    assert.deepEqual(processed.sort(), ['alice', 'carol']);
  });

  it('processes all users when all throw', async () => {
    const users = [{ id: 'alice' }, { id: 'bob' }];

    const syncUser = async user => {
      throw new Error(`${user.id} failed`);
    };

    const results = await runParallelSync(users, syncUser);

    assert.equal(results.length, 2);
    assert.ok(results.every(r => r.status === 'rejected'));
  });

  it('semaphore is always released after a failure', async () => {
    const workers = 1;
    const users = [{ id: 'alice' }, { id: 'bob' }];
    const processed = [];

    const syncUser = async user => {
      if (user.id === 'alice') throw new Error('alice failed');
      processed.push(user.id);
    };

    // With workers=1 the semaphore serialises users. If release() were skipped
    // on failure, bob would never acquire and the promise would hang.
    const results = await runParallelSync(users, syncUser, workers);

    assert.equal(results.length, 2);
    assert.equal(results.filter(r => r.status === 'rejected').length, 1);
    assert.deepEqual(processed, ['bob']);
  });

  it('correctly counts failed syncs', async () => {
    const users = [
      { id: 'u1' },
      { id: 'u2' },
      { id: 'u3' },
      { id: 'u4' },
      { id: 'u5' },
    ];

    const syncUser = async user => {
      if (['u2', 'u4'].includes(user.id)) {
        throw new Error(`${user.id} failed`);
      }
    };

    const results = await runParallelSync(users, syncUser);
    const failed = results.filter(r => r.status === 'rejected');

    assert.equal(failed.length, 2);
    assert.equal(results.length - failed.length, 3);
  });
});
