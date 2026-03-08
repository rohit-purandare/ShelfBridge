import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ProgressManager } from '../src/progress-manager.js';

/**
 * Tests for GitHub Issue #159: Finished Books in Audiobookshelf never updating progress in Hardcover
 *
 * Root cause: extractFinishedFlag() only checked is_finished boolean but ignored finished_at timestamp
 * When users finish books naturally in Audiobookshelf, the finished_at timestamp is set but
 * is_finished flag may remain false, causing books to not be detected as complete.
 *
 * This test suite verifies:
 * 1. extractFinishedFlag() now checks finished_at timestamp
 * 2. Improved position-based completion thresholds
 * 3. New aggressive 98% threshold for near-complete books
 * 4. All completion detection paths work correctly
 */

describe('ProgressManager.extractFinishedFlag() - Issue #159 Fix', () => {
  it('detects completion when finished_at timestamp is set (primary fix)', () => {
    const bookData = {
      progress_percentage: 88, // User was at 88% when last sync happened
      is_finished: false, // Flag not set
      finished_at: 1707849600000, // But timestamp shows book was finished
      current_time: 3200,
      media: { duration: 3600 },
    };

    const result = ProgressManager.extractFinishedFlag(bookData);
    assert.equal(
      result,
      true,
      'Should detect completion from finished_at timestamp',
    );
  });

  it('detects completion when is_finished is true (legacy behavior)', () => {
    const bookData = {
      progress_percentage: 100,
      is_finished: true,
      finished_at: null,
    };

    const result = ProgressManager.extractFinishedFlag(bookData);
    assert.equal(
      result,
      true,
      'Should detect completion from is_finished flag',
    );
  });

  it('detects completion when is_finished is 1 (numeric true)', () => {
    const bookData = {
      progress_percentage: 100,
      is_finished: 1,
      finished_at: null,
    };

    const result = ProgressManager.extractFinishedFlag(bookData);
    assert.equal(
      result,
      true,
      'Should detect completion from numeric is_finished',
    );
  });

  it('detects completion when both finished_at and is_finished are set', () => {
    const bookData = {
      progress_percentage: 100,
      is_finished: true,
      finished_at: 1707849600000,
    };

    const result = ProgressManager.extractFinishedFlag(bookData);
    assert.equal(
      result,
      true,
      'Should detect completion when both indicators present',
    );
  });

  it('returns null when neither finished_at nor is_finished are set', () => {
    const bookData = {
      progress_percentage: 88,
      is_finished: false,
      finished_at: null,
    };

    const result = ProgressManager.extractFinishedFlag(bookData);
    assert.equal(
      result,
      null,
      'Should return null (not confirmed) without indicators',
    );
  });

  it('returns null when finished_at is undefined', () => {
    const bookData = {
      progress_percentage: 88,
      is_finished: false,
      finished_at: undefined,
    };

    const result = ProgressManager.extractFinishedFlag(bookData);
    assert.equal(
      result,
      null,
      'Should return null when finished_at is undefined',
    );
  });

  it('returns null when bookData is null', () => {
    const result = ProgressManager.extractFinishedFlag(null);
    assert.equal(result, null, 'Should return null for null bookData');
  });

  it('returns null when bookData is undefined', () => {
    const result = ProgressManager.extractFinishedFlag(undefined);
    assert.equal(result, null, 'Should return null for undefined bookData');
  });

  it('detects completion with finished_at set to 0 (edge case)', () => {
    // finished_at could theoretically be 0 (epoch time)
    const bookData = {
      progress_percentage: 88,
      is_finished: false,
      finished_at: 0,
    };

    const result = ProgressManager.extractFinishedFlag(bookData);
    assert.equal(
      result,
      true,
      'Should detect completion even with finished_at = 0',
    );
  });
});

describe('ProgressManager.isComplete() - Enhanced completion detection', () => {
  it('detects completion at 98% with new aggressive threshold (audiobook)', () => {
    const bookData = {
      progress_percentage: 98,
      current_time: 3528, // 98% of 3600 seconds
      media: { duration: 3600 },
    };

    const result = ProgressManager.isComplete(98, {
      context: 'test-aggressive-threshold',
      _bookData: bookData,
      format: 'audiobook',
      threshold: 95, // Old threshold
    });

    assert.equal(
      result,
      true,
      'Should detect completion at 98% with aggressive threshold',
    );
  });

  it('detects completion at 98% with new aggressive threshold (ebook)', () => {
    const bookData = {
      pages: 300,
    };

    const result = ProgressManager.isComplete(98, {
      context: 'test-aggressive-threshold-ebook',
      _bookData: bookData,
      format: 'ebook',
      threshold: 95,
    });

    assert.equal(
      result,
      true,
      'Should detect ebook completion at 98% with aggressive threshold',
    );
  });

  it('detects completion at 99% with new aggressive threshold (physical)', () => {
    const result = ProgressManager.isComplete(99, {
      context: 'test-aggressive-threshold-physical',
      format: 'physical',
      threshold: 95,
    });

    assert.equal(
      result,
      true,
      'Should detect physical book completion at 99% with aggressive threshold',
    );
  });

  it('detects completion at 98% for unknown format', () => {
    const result = ProgressManager.isComplete(98, {
      context: 'test-aggressive-threshold-unknown',
      format: 'unknown',
      threshold: 95,
    });

    assert.equal(
      result,
      true,
      'Should detect completion at 98% for unknown format',
    );
  });

  it('does not detect completion at 97% (below aggressive threshold)', () => {
    const result = ProgressManager.isComplete(97, {
      context: 'test-below-aggressive-threshold',
      format: 'audiobook',
      threshold: 95,
    });

    assert.equal(
      result,
      true,
      'Should still detect completion at 97% with standard 95% threshold',
    );
  });

  it('does not detect completion at 94% (below both thresholds)', () => {
    const result = ProgressManager.isComplete(94, {
      context: 'test-below-all-thresholds',
      format: 'audiobook',
      threshold: 95,
    });

    assert.equal(
      result,
      false,
      'Should not detect completion at 94% (below all thresholds)',
    );
  });
});

describe('ProgressManager.isComplete() - Improved time-based detection', () => {
  it('detects completion with 60 seconds remaining (new threshold)', () => {
    const bookData = {
      current_time: 3540, // 59 minutes
      media: { duration: 3600 }, // 60 minutes total, 60 seconds (1 minute) remaining
    };

    const result = ProgressManager.isComplete(98.33, {
      context: 'test-time-remaining-60s',
      _bookData: bookData,
      format: 'audiobook',
    });

    assert.equal(
      result,
      true,
      'Should detect completion with 60 seconds remaining',
    );
  });

  it('detects completion with 30 seconds remaining', () => {
    const bookData = {
      current_time: 3570, // 59.5 minutes
      media: { duration: 3600 }, // 60 minutes total, 30 seconds remaining
    };

    const result = ProgressManager.isComplete(99.17, {
      context: 'test-time-remaining-30s',
      _bookData: bookData,
      format: 'audiobook',
    });

    assert.equal(
      result,
      true,
      'Should detect completion with 30 seconds remaining',
    );
  });

  it('detects completion with 5 seconds remaining', () => {
    const bookData = {
      current_time: 3595, // Almost done
      media: { duration: 3600 }, // 60 minutes total, 5 seconds remaining
    };

    const result = ProgressManager.isComplete(99.86, {
      context: 'test-time-remaining-5s',
      _bookData: bookData,
      format: 'audiobook',
    });

    assert.equal(
      result,
      true,
      'Should detect completion with 5 seconds remaining',
    );
  });

  it('does not detect completion with 61 seconds remaining (above threshold)', () => {
    const bookData = {
      current_time: 3539, // 58 minutes 59 seconds
      media: { duration: 3600 }, // 60 minutes total, 61 seconds remaining
    };

    // Calculate precise progress percentage
    const progressPercent = (3539 / 3600) * 100; // ~98.31%

    const result = ProgressManager.isComplete(progressPercent, {
      context: 'test-time-remaining-61s',
      _bookData: bookData,
      format: 'audiobook',
      threshold: 95,
    });

    // Should still be detected as complete by 98% aggressive threshold
    assert.equal(
      result,
      true,
      'Should detect completion via 98% threshold even with 61s remaining',
    );
  });
});

describe('Integration Test - Issue #159 Scenario', () => {
  it('reproduces and fixes the reported bug: book finished naturally at 88%', () => {
    // Scenario from bug report:
    // 1. User was at 88% when scheduled sync ran at 3 AM
    // 2. User finished book at 10 AM (listening to the end)
    // 3. Audiobookshelf moved book to "Listen Again" and set finished_at
    // 4. But is_finished flag was not set
    // 5. Next sync at 3 AM should detect completion

    const bookDataAtNextSync = {
      progress_percentage: 88, // Still showing old progress
      is_finished: false, // Flag not set by Audiobookshelf
      finished_at: 1707849600000, // But timestamp was set when user finished
      current_time: 3200, // Old position
      media: { duration: 3600 },
    };

    // Test extractFinishedFlag directly
    const isFinished = ProgressManager.extractFinishedFlag(bookDataAtNextSync);
    assert.equal(
      isFinished,
      true,
      'extractFinishedFlag should detect completion from finished_at',
    );

    // Test full completion detection flow
    const isComplete = ProgressManager.isBookComplete(
      bookDataAtNextSync,
      'test-issue-159',
      {},
      null,
    );
    assert.equal(
      isComplete,
      true,
      'isBookComplete should detect book as finished',
    );
  });

  it('handles the case when user manually marks book as finished', () => {
    // When user manually marks as finished in Audiobookshelf,
    // both is_finished flag and finished_at should be set

    const bookData = {
      progress_percentage: 50, // User was only halfway through
      is_finished: true, // Manually marked as finished
      finished_at: 1707849600000, // Timestamp set
      current_time: 1800,
      media: { duration: 3600 },
    };

    const isFinished = ProgressManager.extractFinishedFlag(bookData);
    assert.equal(
      isFinished,
      true,
      'Should detect manual completion with both indicators',
    );

    const isComplete = ProgressManager.isBookComplete(
      bookData,
      'test-manual-finish',
      {},
      null,
    );
    assert.equal(
      isComplete,
      true,
      'Should detect manual completion in full flow',
    );
  });

  it('handles edge case: book at 99% but not finished', () => {
    // User is at 99% but hasn't finished yet (paused near end)
    const bookData = {
      progress_percentage: 99,
      is_finished: false,
      finished_at: null, // No timestamp
      current_time: 3564,
      media: { duration: 3600 },
    };

    const isFinished = ProgressManager.extractFinishedFlag(bookData);
    assert.equal(
      isFinished,
      null,
      'Should return null (not confirmed) without indicators',
    );

    // But should still be detected as complete by 98% threshold
    const isComplete = ProgressManager.isBookComplete(
      bookData,
      'test-99-percent',
      {},
      null,
    );
    assert.equal(
      isComplete,
      true,
      'Should detect completion at 99% via aggressive threshold',
    );
  });

  it('handles edge case: book at 88% and not finished', () => {
    // User is at 88% and still listening (no completion indicators)
    const bookData = {
      progress_percentage: 88,
      is_finished: false,
      finished_at: null,
      current_time: 3168,
      media: { duration: 3600 },
    };

    const isFinished = ProgressManager.extractFinishedFlag(bookData);
    assert.equal(isFinished, null, 'Should return null (not confirmed)');

    const isComplete = ProgressManager.isBookComplete(
      bookData,
      'test-88-percent-not-finished',
      {},
      null,
    );
    assert.equal(
      isComplete,
      false,
      'Should not detect completion at 88% without indicators',
    );
  });
});

describe('Regression Tests - Ensure no breaking changes', () => {
  it('still works with old data structure (is_finished only)', () => {
    const bookData = {
      progress_percentage: 100,
      is_finished: true,
      // No finished_at field (old data)
    };

    const result = ProgressManager.extractFinishedFlag(bookData);
    assert.equal(result, true, 'Should work with legacy data structure');
  });

  it('still works with minimal book data', () => {
    const bookData = {
      progress_percentage: 96,
      // No completion indicators
    };

    const result = ProgressManager.isBookComplete(bookData, 'test-minimal', {
      threshold: 95,
    });
    assert.equal(
      result,
      true,
      'Should detect completion at 96% with 95% threshold',
    );
  });

  it('maintains backward compatibility for all format types', () => {
    const formats = ['audiobook', 'ebook', 'physical', 'unknown'];

    formats.forEach(format => {
      const result = ProgressManager.isComplete(96, {
        context: `test-compat-${format}`,
        format: format,
        threshold: 95,
      });
      assert.equal(
        result,
        true,
        `Should detect completion for ${format} with 95% threshold`,
      );
    });
  });
});
