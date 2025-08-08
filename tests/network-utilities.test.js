import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Agent } from 'https';
import { Agent as HttpAgent } from 'http';

import { normalizeApiToken, createHttpAgent, retryWithBackoff } from '../src/utils/network.js';
import { sleep } from '../src/utils/time.js';

/**
 * Network Utilities Test Suite
 * 
 * Tests for network-related utilities including:
 * - API token normalization (Bearer prefix handling)
 * - HTTP/HTTPS agent creation with optimized settings
 * - Retry logic with exponential backoff
 */

describe('normalizeApiToken', () => {
  it('returns the token unchanged when no Bearer prefix is present', () => {
    const token = 'abc123xyz';
    const result = normalizeApiToken(token, 'TestAPI');
    assert.equal(result, 'abc123xyz');
  });

  it('removes "Bearer " prefix (case insensitive)', () => {
    assert.equal(normalizeApiToken('Bearer abc123', 'TestAPI'), 'abc123');
    assert.equal(normalizeApiToken('bearer abc123', 'TestAPI'), 'abc123');
    assert.equal(normalizeApiToken('BEARER abc123', 'TestAPI'), 'abc123');
    assert.equal(normalizeApiToken('BeArEr abc123', 'TestAPI'), 'abc123');
  });

  it('handles multiple spaces after Bearer', () => {
    assert.equal(normalizeApiToken('Bearer  abc123', 'TestAPI'), 'abc123');
    assert.equal(normalizeApiToken('Bearer   abc123', 'TestAPI'), 'abc123');
  });

  it('only removes prefix at the beginning of the token', () => {
    const token = 'abc Bearer xyz';
    const result = normalizeApiToken(token, 'TestAPI');
    assert.equal(result, 'abc Bearer xyz'); // Should not change
  });

  it('handles empty or null tokens gracefully', () => {
    assert.equal(normalizeApiToken('', 'TestAPI'), '');
    assert.equal(normalizeApiToken(null, 'TestAPI'), null);
    assert.equal(normalizeApiToken(undefined, 'TestAPI'), undefined);
  });

  it('preserves tokens that start with "Bearer" but without space', () => {
    const token = 'Bearertoken123';
    const result = normalizeApiToken(token, 'TestAPI');
    assert.equal(result, 'Bearertoken123'); // Should not change
  });

  it('uses default service name when not provided', () => {
    const token = 'Bearer abc123';
    const result = normalizeApiToken(token);
    assert.equal(result, 'abc123');
  });

  it('handles complex tokens with special characters', () => {
    const complexToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const expected = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    assert.equal(normalizeApiToken(complexToken, 'JWT'), expected);
  });
});

describe('createHttpAgent', () => {
  it('creates HTTPS agent by default', () => {
    const agent = createHttpAgent();
    assert.ok(agent instanceof Agent, 'Should be an HTTPS Agent instance');
  });

  it('creates HTTP agent when isHttps is false', () => {
    const agent = createHttpAgent(false);
    assert.ok(agent instanceof HttpAgent, 'Should be an HTTP Agent instance');
  });

  it('applies default options correctly', () => {
    const agent = createHttpAgent();
    
    // Check that default options are applied
    assert.equal(agent.keepAlive, true);
    assert.equal(agent.maxSockets, 10);
    assert.equal(agent.maxFreeSockets, 5);
    // Note: timeout is handled differently in Node.js agents
    assert.equal(agent.options.freeSocketTimeout, 30000);
  });

  it('allows custom options to override defaults', () => {
    const customOptions = {
      maxSockets: 20,
      keepAlive: false
    };
    
    const agent = createHttpAgent(true, customOptions);
    
    assert.equal(agent.keepAlive, false);
    assert.equal(agent.maxSockets, 20);
    // Default values should still be present for non-overridden options
    assert.equal(agent.maxFreeSockets, 5);
  });

  it('preserves all custom options while keeping defaults for others', () => {
    const customOptions = {
      maxSockets: 15,
      customProperty: 'test'
    };
    
    const agent = createHttpAgent(true, customOptions);
    
    // Custom options should be applied
    assert.equal(agent.maxSockets, 15);
    // Defaults should remain for non-overridden options
    assert.equal(agent.keepAlive, true);
    assert.equal(agent.maxFreeSockets, 5);
  });

  it('creates HTTP agent with custom options', () => {
    const customOptions = {
      maxSockets: 8,
      keepAlive: false
    };
    
    const agent = createHttpAgent(false, customOptions);
    
    assert.ok(agent instanceof HttpAgent);
    assert.equal(agent.keepAlive, false);
    assert.equal(agent.maxSockets, 8);
  });
});

describe('retryWithBackoff', () => {
  it('returns result immediately on first success', async () => {
    const mockFn = () => Promise.resolve('success');
    
    const start = Date.now();
    const result = await retryWithBackoff(mockFn, 3, 100);
    const elapsed = Date.now() - start;
    
    assert.equal(result, 'success');
    assert.ok(elapsed < 50, 'Should complete quickly without retries');
  });

  it('retries on failure and eventually succeeds', async () => {
    let attempts = 0;
    const mockFn = () => {
      attempts++;
      if (attempts < 3) {
        throw new Error(`Attempt ${attempts} failed`);
      }
      return Promise.resolve('success');
    };
    
    const result = await retryWithBackoff(mockFn, 3, 10); // Small delay for testing
    
    assert.equal(result, 'success');
    assert.equal(attempts, 3);
  });

  it('throws the last error after exceeding max retries', async () => {
    let attempts = 0;
    const mockFn = () => {
      attempts++;
      throw new Error(`Attempt ${attempts} failed`);
    };
    
    await assert.rejects(
      async () => await retryWithBackoff(mockFn, 2, 10),
      (error) => {
        assert.equal(error.message, 'Attempt 3 failed');
        return true;
      }
    );
    
    assert.equal(attempts, 3); // Initial attempt + 2 retries
  });

  it('implements exponential backoff correctly', async () => {
    let attempts = 0;
    const timestamps = [];
    
    const mockFn = () => {
      attempts++;
      timestamps.push(Date.now());
      if (attempts < 3) {
        throw new Error(`Attempt ${attempts} failed`);
      }
      return Promise.resolve('success');
    };
    
    await retryWithBackoff(mockFn, 3, 50); // 50ms base delay
    
    // Check that delays are roughly exponential (50ms, 100ms)
    // Allow some tolerance for timing variations
    const delay1 = timestamps[1] - timestamps[0];
    const delay2 = timestamps[2] - timestamps[1];
    
    assert.ok(delay1 >= 45 && delay1 <= 70, `First delay should be ~50ms, got ${delay1}ms`);
    assert.ok(delay2 >= 90 && delay2 <= 120, `Second delay should be ~100ms, got ${delay2}ms`);
  });

  it('handles zero retries (fails immediately)', async () => {
    const mockFn = () => {
      throw new Error('Immediate failure');
    };
    
    await assert.rejects(
      async () => await retryWithBackoff(mockFn, 0, 100),
      (error) => {
        assert.equal(error.message, 'Immediate failure');
        return true;
      }
    );
  });

  it('handles async functions that reject', async () => {
    let attempts = 0;
    const mockFn = async () => {
      attempts++;
      await sleep(1); // Small async delay
      if (attempts < 2) {
        throw new Error('Async failure');
      }
      return 'async success';
    };
    
    const result = await retryWithBackoff(mockFn, 2, 10);
    
    assert.equal(result, 'async success');
    assert.equal(attempts, 2);
  });

  it('uses correct default parameters', async () => {
    let attempts = 0;
    const mockFn = () => {
      attempts++;
      if (attempts === 1) {
        throw new Error('First attempt failed');
      }
      return Promise.resolve('success');
    };
    
    // Test with defaults (maxRetries=3, baseDelay=1000)
    // We'll override baseDelay to make test faster
    const result = await retryWithBackoff(mockFn, undefined, 10);
    
    assert.equal(result, 'success');
    assert.equal(attempts, 2);
  });
});
