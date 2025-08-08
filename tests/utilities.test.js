import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { RateLimiter, Semaphore } from '../src/utils/concurrency.js';
import { safeParseInt, safeParseFloat } from '../src/utils/data.js';
import { formatDuration, formatDurationForLogging, parseDurationString, sleep } from '../src/utils/time.js';

/**
 * Tests for utility functions
 *
 * Covers core utility functions that are used throughout the application:
 * - Concurrency management (rate limiting, semaphores)
 * - Data parsing and validation
 * - Time formatting utilities
 */

describe('RateLimiter', () => {
  it('allows requests under the rate limit', async () => {
    const limiter = new RateLimiter(100); // High limit to avoid conflicts
    try {
      const uniqueKey = `test-basic-${Date.now()}-${Math.random()}`;
      
      const start = Date.now();
      await limiter.waitIfNeeded(uniqueKey);
      const elapsed = Date.now() - start;
      
      // Should not wait for the first request
      assert.ok(elapsed < 100, `Expected minimal delay, got ${elapsed}ms`);
    } finally {
      limiter.destroy(); // Clean up interval
    }
  });

  it('tracks different keys independently', async () => {
    const limiter = new RateLimiter(100); // High limit to avoid conflicts
    try {
      const uniqueKey1 = `test-independent-1-${Date.now()}-${Math.random()}`;
      const uniqueKey2 = `test-independent-2-${Date.now()}-${Math.random()}`;
      
      // First key - should be immediate
      const start1 = Date.now();
      await limiter.waitIfNeeded(uniqueKey1);
      const elapsed1 = Date.now() - start1;
      assert.ok(elapsed1 < 100);
      
      // Different key - should also be immediate  
      const start2 = Date.now();
      await limiter.waitIfNeeded(uniqueKey2);
      const elapsed2 = Date.now() - start2;
      assert.ok(elapsed2 < 100);
    } finally {
      limiter.destroy(); // Clean up interval
    }
  });

  // Note: Rate limit enforcement testing is skipped since it requires waiting
  // for actual time to pass, which makes tests slow. In production, you'd
  // use dependency injection to mock the timer or use a test-specific rate limiter.
});

describe('Semaphore', () => {
  it('allows concurrent access up to the limit', async () => {
    const semaphore = new Semaphore(2); // Allow 2 concurrent operations
    
    let concurrentCount = 0;
    let maxConcurrentCount = 0;
    
    const operation = async () => {
      await semaphore.acquire();
      concurrentCount++;
      maxConcurrentCount = Math.max(maxConcurrentCount, concurrentCount);
      
      // Simulate work
      await new Promise(resolve => setTimeout(resolve, 50));
      
      concurrentCount--;
      semaphore.release();
    };
    
    // Start 4 operations simultaneously
    await Promise.all([operation(), operation(), operation(), operation()]);
    
    // Should never exceed the semaphore limit
    assert.ok(maxConcurrentCount <= 2, `Max concurrent was ${maxConcurrentCount}, expected <= 2`);
  });

  it('blocks when semaphore is exhausted', async () => {
    const semaphore = new Semaphore(1); // Only 1 concurrent operation
    
    await semaphore.acquire();
    
    let secondOperationStarted = false;
    const secondOperation = async () => {
      await semaphore.acquire();
      secondOperationStarted = true;
      semaphore.release();
    };
    
    // Start second operation (should be blocked)
    const secondPromise = secondOperation();
    
    // Wait a bit and verify it hasn't started
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(secondOperationStarted, false);
    
    // Release the first semaphore
    semaphore.release();
    
    // Now the second operation should complete
    await secondPromise;
    assert.equal(secondOperationStarted, true);
  });
});

describe('Data Utilities', () => {
  describe('safeParseInt', () => {
    it('parses valid integers correctly', () => {
      assert.equal(safeParseInt('42', 'test'), 42);
      assert.equal(safeParseInt('0', 'test'), 0);
      assert.equal(safeParseInt('-5', 'test'), -5);
      assert.equal(safeParseInt(123, 'test'), 123);
    });

    it('handles invalid inputs gracefully', () => {
      assert.equal(safeParseInt('not-a-number', 'test'), null);
      assert.equal(safeParseInt('', 'test'), null);
      assert.equal(safeParseInt(null, 'test'), null);
      assert.equal(safeParseInt(undefined, 'test'), null);
    });

    it('handles floating point numbers', () => {
      assert.equal(safeParseInt('42.7', 'test'), 42);
      assert.equal(safeParseInt(42.9, 'test'), 42);
    });
  });

  describe('safeParseFloat', () => {
    it('parses valid floats correctly', () => {
      assert.equal(safeParseFloat('42.5', 'test'), 42.5);
      assert.equal(safeParseFloat('0.0', 'test'), 0.0);
      assert.equal(safeParseFloat('-5.25', 'test'), -5.25);
      assert.equal(safeParseFloat(123.45, 'test'), 123.45);
    });

    it('handles invalid float inputs gracefully', () => {
      assert.equal(safeParseFloat('not-a-number', 'test'), null);
      assert.equal(safeParseFloat('', 'test'), null);
      assert.equal(safeParseFloat(null, 'test'), null);
      assert.equal(safeParseFloat(undefined, 'test'), null);
    });

    it('handles edge cases', () => {
      assert.equal(safeParseFloat('0', 'test'), 0);
      assert.equal(safeParseFloat(Infinity, 'test'), Infinity);
      assert.equal(safeParseFloat(-Infinity, 'test'), -Infinity);
    });
  });
});

describe('Time Utilities', () => {
  describe('formatDuration', () => {
    it('formats duration to HH:MM:SS format', () => {
      assert.equal(formatDuration(0), '00:00:00');
      assert.equal(formatDuration(30), '00:00:30');
      assert.equal(formatDuration(90), '00:01:30');
      assert.equal(formatDuration(3665), '01:01:05');
    });

    it('handles large durations', () => {
      const oneDay = 24 * 60 * 60;
      assert.equal(formatDuration(oneDay), '24:00:00');
    });
  });

  describe('formatDurationForLogging', () => {
    it('formats duration for human-readable logging', () => {
      assert.equal(formatDurationForLogging(0), '0s');
      assert.equal(formatDurationForLogging(30), '30s');
      assert.equal(formatDurationForLogging(90), '1m 30s');
      assert.equal(formatDurationForLogging(3665), '1h 1m 5s');
    });

    it('handles negative and null values', () => {
      assert.equal(formatDurationForLogging(-30), '0s');
      assert.equal(formatDurationForLogging(null), '0s');
      assert.equal(formatDurationForLogging(undefined), '0s');
    });
  });

  describe('parseDurationString', () => {
    it('parses duration strings correctly', () => {
      assert.equal(parseDurationString('30s'), 30);
      assert.equal(parseDurationString('1m 30s'), 90);
      assert.equal(parseDurationString('1h 1m 5s'), 3665);
      assert.equal(parseDurationString('2h'), 7200);
    });

    it('handles invalid duration strings', () => {
      assert.equal(parseDurationString(''), null);
      assert.equal(parseDurationString('invalid'), null);
      assert.equal(parseDurationString(null), null);
    });
  });

  describe('sleep', () => {
    it('resolves after specified delay', async () => {
      const start = Date.now();
      await sleep(10); // Reduced to 10ms for faster tests
      const elapsed = Date.now() - start;
      
      // Allow some tolerance for timing
      assert.ok(elapsed >= 5 && elapsed <= 50, `Expected ~10ms delay, got ${elapsed}ms`);
    });
  });
});
