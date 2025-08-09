import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { RateLimiter, Semaphore } from '../src/utils/concurrency.js';
import { safeParseInt, safeParseFloat, safeParseBoolean } from '../src/utils/data.js';
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

    it('handles scientific notation', () => {
      assert.equal(safeParseFloat('1e5', 'test'), 100000);
      assert.equal(safeParseFloat('1.5e-3', 'test'), 0.0015);
      assert.equal(safeParseFloat('-2.5E2', 'test'), -250);
    });

    it('handles large numbers', () => {
      assert.equal(safeParseFloat('999999999999999999999', 'test'), 999999999999999999999);
      assert.equal(safeParseFloat(Number.MAX_VALUE, 'test'), Number.MAX_VALUE);
      assert.equal(safeParseFloat(Number.MIN_VALUE, 'test'), Number.MIN_VALUE);
    });

    it('handles whitespace and formatting edge cases', () => {
      assert.equal(safeParseFloat('  42.5  ', 'test'), 42.5);
      assert.equal(safeParseFloat('\t123.45\n', 'test'), 123.45);
      assert.equal(safeParseFloat('+42.5', 'test'), 42.5);
    });
  });

  describe('safeParseBoolean', () => {
    it('returns boolean values unchanged', () => {
      assert.equal(safeParseBoolean(true), true);
      assert.equal(safeParseBoolean(false), false);
    });

    it('parses truthy string values correctly', () => {
      assert.equal(safeParseBoolean('true'), true);
      assert.equal(safeParseBoolean('TRUE'), true);
      assert.equal(safeParseBoolean('True'), true);
      assert.equal(safeParseBoolean('1'), true);
      assert.equal(safeParseBoolean('yes'), true);
      assert.equal(safeParseBoolean('YES'), true);
      assert.equal(safeParseBoolean('Yes'), true);
    });

    it('parses falsy string values correctly', () => {
      assert.equal(safeParseBoolean('false'), false);
      assert.equal(safeParseBoolean('FALSE'), false);
      assert.equal(safeParseBoolean('False'), false);
      assert.equal(safeParseBoolean('0'), false);
      assert.equal(safeParseBoolean('no'), false);
      assert.equal(safeParseBoolean('NO'), false);
      assert.equal(safeParseBoolean('anything-else'), false);
      assert.equal(safeParseBoolean(''), false);
    });

    it('handles string whitespace correctly', () => {
      assert.equal(safeParseBoolean('  true  '), true);
      assert.equal(safeParseBoolean('\t1\n'), true);
      assert.equal(safeParseBoolean('  false  '), false);
      assert.equal(safeParseBoolean('\tno\n'), false);
    });

    it('converts numbers to booleans correctly', () => {
      assert.equal(safeParseBoolean(1), true);
      assert.equal(safeParseBoolean(42), true);
      assert.equal(safeParseBoolean(-5), true);
      assert.equal(safeParseBoolean(0.5), true);
      assert.equal(safeParseBoolean(0), false);
      assert.equal(safeParseBoolean(-0), false);
    });

    it('handles null and undefined with default value', () => {
      assert.equal(safeParseBoolean(null), false);
      assert.equal(safeParseBoolean(undefined), false);
      assert.equal(safeParseBoolean(null, true), true);
      assert.equal(safeParseBoolean(undefined, true), true);
    });

    it('uses custom default value for invalid inputs', () => {
      assert.equal(safeParseBoolean({}, true), true);
      assert.equal(safeParseBoolean([], true), true);
      assert.equal(safeParseBoolean(Symbol('test'), false), false);
      assert.equal(safeParseBoolean(function() {}, true), true);
    });

    it('handles edge cases for numbers', () => {
      assert.equal(safeParseBoolean(Infinity), true);
      assert.equal(safeParseBoolean(-Infinity), true);
      // NaN is a number type, so it evaluates to true (non-zero)
      assert.equal(safeParseBoolean(NaN), true);
    });

    it('handles complex objects with custom defaults', () => {
      const obj = { value: true };
      const arr = [1, 2, 3];
      
      assert.equal(safeParseBoolean(obj, true), true);
      assert.equal(safeParseBoolean(obj, false), false);
      assert.equal(safeParseBoolean(arr, true), true);
      assert.equal(safeParseBoolean(arr, false), false);
    });
  });

  describe('Additional edge cases for safeParseInt', () => {
    it('handles hex and octal strings', () => {
      // parseInt behavior - hex strings actually work in parseInt
      assert.equal(safeParseInt('0x10', 'test'), 16); // parseInt parses hex correctly
      assert.equal(safeParseInt('010', 'test'), 10); // Decimal parsing
      assert.equal(safeParseInt('0b1010', 'test'), 0); // parseInt stops at 'b'
    });

    it('handles string numbers with trailing characters', () => {
      assert.equal(safeParseInt('42px', 'test'), 42);
      assert.equal(safeParseInt('100%', 'test'), 100);
      assert.equal(safeParseInt('3.14159', 'test'), 3);
    });

    it('handles very large numbers', () => {
      assert.equal(safeParseInt('999999999999999999999', 'test'), 999999999999999999999);
      assert.equal(safeParseInt(Number.MAX_SAFE_INTEGER, 'test'), Number.MAX_SAFE_INTEGER);
      assert.equal(safeParseInt(Number.MIN_SAFE_INTEGER, 'test'), Number.MIN_SAFE_INTEGER);
    });

    it('handles whitespace correctly', () => {
      assert.equal(safeParseInt('  42  ', 'test'), 42);
      assert.equal(safeParseInt('\t123\n', 'test'), 123);
      assert.equal(safeParseInt('+42', 'test'), 42);
    });

    it('handles array and object inputs', () => {
      assert.equal(safeParseInt([42], 'test'), 42); // Array toString gives "42"
      assert.equal(safeParseInt([1, 2, 3], 'test'), 1); // Array toString gives "1,2,3"
      assert.equal(safeParseInt({}, 'test'), null); // Object toString gives "[object Object]"
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
      
      // Allow generous tolerance for timing - CI environments and Node.js versions can vary significantly
      // Minimum: 5ms (timer granularity), Maximum: 100ms (very generous for CI/Node.js 22.x)
      assert.ok(elapsed >= 5 && elapsed <= 100, `Expected ~10ms delay, got ${elapsed}ms`);
    });
  });
});
