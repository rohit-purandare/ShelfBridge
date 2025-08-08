import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ProgressManager } from '../src/progress-manager.js';

/**
 * Unit tests for ProgressManager.validateProgress
 *
 * These tests focus on the core decision-making branches:
 * 1. Finished-flag precedence
 * 2. Position-based fallback calculation for audiobooks
 */

describe('ProgressManager.validateProgress()', () => {
  it('trusts explicit finished flag over calculated progress', () => {
    const providedProgress = 42; // arbitrary value

    const result = ProgressManager.validateProgress(providedProgress, 'unit-test', {
      isFinished: true,
    });

    assert.equal(result, providedProgress);
  });

  it('calculates progress from position data when no finished flag', () => {
    const dummyBook = {
      current_time: 1800, // 30 minutes listened
      media: {
        duration: 3600, // 1 hour total
      },
    };

    const result = ProgressManager.validateProgress(null, 'unit-test', {
      bookData: dummyBook,
      format: 'audiobook',
    });

    // 30 min / 60 min = 0.5 -> 50%
    assert.equal(result, 50);
  });
});

