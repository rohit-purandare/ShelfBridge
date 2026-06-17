import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { RetryManager } from '../src/utils/retry-manager.js';

describe('RetryManager', () => {
  it('retries ECONNREFUSED as a transient network error', async () => {
    const retryManager = new RetryManager('TestService');
    let attempts = 0;

    const result = await retryManager.executeWithRetry(
      async () => {
        attempts++;

        if (attempts === 1) {
          const error = new Error('connect ECONNREFUSED 157.230.65.225:443');
          error.code = 'ECONNREFUSED';
          throw error;
        }

        return 'success';
      },
      { maxRetries: 1 },
    );

    assert.equal(result, 'success');
    assert.equal(attempts, 2);
  });
});
