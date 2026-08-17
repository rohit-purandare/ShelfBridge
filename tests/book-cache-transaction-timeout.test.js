import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BookCache } from '../src/book-cache.js';

describe('BookCache transaction timeout', () => {
  it('applies and restores the configured SQLite busy timeout', async () => {
    const cache = new BookCache(':memory:');
    await cache.init();

    try {
      cache.db.pragma('busy_timeout = 1234');
      const results = await cache.executeTransaction(
        [() => cache.db.pragma('busy_timeout', { simple: true })],
        { timeout: 4321, description: 'timeout regression test' },
      );

      assert.deepEqual(results, [4321]);
      assert.equal(cache.db.pragma('busy_timeout', { simple: true }), 1234);
    } finally {
      cache.close();
    }
  });
});
