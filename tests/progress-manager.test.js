import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ProgressManager,
  ProgressValidationError,
} from '../src/progress-manager.js';

/**
 * Comprehensive unit tests for ProgressManager
 *
 * Covers all major functionality:
 * - Progress validation with boundary cases
 * - Position calculations and round-trip consistency
 * - Progress regression analysis
 * - Completion detection
 * - Error handling and edge cases
 */

describe('ProgressManager.validateProgress()', () => {
  it('trusts explicit finished flag over calculated progress', () => {
    const providedProgress = 42; // arbitrary value

    const result = ProgressManager.validateProgress(
      providedProgress,
      'unit-test',
      {
        isFinished: true,
      },
    );

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

  it('handles null/undefined progress gracefully', () => {
    const result = ProgressManager.validateProgress(null, 'unit-test');
    assert.equal(result, null);
  });

  it('validates progress boundaries (0-100)', () => {
    assert.equal(ProgressManager.validateProgress(-5, 'test'), 0); // Clamped to 0
    assert.equal(ProgressManager.validateProgress(105, 'test'), 100); // Clamped to 100
    assert.equal(ProgressManager.validateProgress(0, 'test'), 0);
    assert.equal(ProgressManager.validateProgress(100, 'test'), 100);
  });

  it('converts string progress to numbers', () => {
    assert.equal(ProgressManager.validateProgress('42.5', 'test'), 42.5);
    assert.equal(ProgressManager.validateProgress('  85  ', 'test'), 85);
  });

  it('rejects invalid string values', () => {
    assert.equal(
      ProgressManager.validateProgress('not-a-number', 'test'),
      null,
    );
    assert.equal(ProgressManager.validateProgress('', 'test'), null);
  });

  it('throws errors in strict mode', () => {
    assert.throws(
      () =>
        ProgressManager.validateProgress(null, 'test', {
          allowNull: false,
          strict: true,
        }),
      ProgressValidationError,
    );

    assert.throws(
      () =>
        ProgressManager.validateProgress('invalid', 'test', { strict: true }),
      ProgressValidationError,
    );
  });
});

describe('ProgressManager.calculateProgressFromPosition()', () => {
  it('calculates audiobook progress from time position', () => {
    const result = ProgressManager.calculateProgressFromPosition(1800, 3600, {
      type: 'seconds',
      context: 'test',
    });
    assert.equal(result, 50);
  });

  it('calculates book progress from page position', () => {
    const result = ProgressManager.calculateProgressFromPosition(150, 300, {
      type: 'pages',
      context: 'test',
    });
    assert.equal(result, 50);
  });

  it('handles zero total gracefully', () => {
    const result = ProgressManager.calculateProgressFromPosition(50, 0, {
      type: 'pages',
      context: 'test',
    });
    assert.equal(result, 0);
  });

  it('handles null position gracefully', () => {
    const result = ProgressManager.calculateProgressFromPosition(null, 300, {
      type: 'pages',
      context: 'test',
    });
    assert.equal(result, 0);
  });
});

describe('ProgressManager.calculateCurrentPosition()', () => {
  it('calculates page position from progress (1-based)', () => {
    const result = ProgressManager.calculateCurrentPosition(50, 300, {
      type: 'pages',
      context: 'test',
    });
    assert.equal(result, 150);
  });

  it('calculates time position from progress (0-based)', () => {
    const result = ProgressManager.calculateCurrentPosition(50, 3600, {
      type: 'seconds',
      context: 'test',
    });
    assert.equal(result, 1800);
  });

  it('enforces minimum page position of 1', () => {
    const result = ProgressManager.calculateCurrentPosition(0, 300, {
      type: 'pages',
      context: 'test',
    });
    assert.equal(result, 1);
  });

  it('enforces minimum time position of 0', () => {
    const result = ProgressManager.calculateCurrentPosition(0, 3600, {
      type: 'seconds',
      context: 'test',
    });
    assert.equal(result, 0);
  });

  it('enforces maximum boundaries', () => {
    const pageResult = ProgressManager.calculateCurrentPosition(100, 300, {
      type: 'pages',
      context: 'test',
    });
    assert.equal(pageResult, 300);

    const timeResult = ProgressManager.calculateCurrentPosition(100, 3600, {
      type: 'seconds',
      context: 'test',
    });
    assert.equal(timeResult, 3600);
  });
});

describe('ProgressManager.analyzeProgressRegression()', () => {
  it('detects no regression when progress increases', () => {
    const result = ProgressManager.analyzeProgressRegression(40, 60, {
      context: 'test',
    });

    assert.equal(result.isRegression, false);
    assert.equal(result.shouldBlock, false);
    assert.equal(result.shouldWarn, false);
  });

  it('detects minor regression within warning threshold', () => {
    const result = ProgressManager.analyzeProgressRegression(60, 50, {
      context: 'test',
      warnThreshold: 15,
    });

    assert.equal(result.isRegression, true);
    assert.equal(result.shouldBlock, false);
    assert.equal(result.shouldWarn, false); // 10% drop is below 15% threshold
  });

  it('detects major regression that should be blocked', () => {
    const result = ProgressManager.analyzeProgressRegression(90, 20, {
      context: 'test',
      blockThreshold: 50,
    });

    assert.equal(result.isRegression, true);
    assert.equal(result.shouldBlock, true);
    assert.equal(result.regressionAmount, 70);
  });

  it('detects potential re-reading scenario', () => {
    const result = ProgressManager.analyzeProgressRegression(95, 5, {
      context: 'test',
      highProgressThreshold: 85,
      rereadThreshold: 30,
    });

    assert.equal(result.isRegression, true);
    assert.equal(result.isPotentialReread, true);
    assert.equal(result.shouldBlock, true); // Also a major regression
  });

  it('handles missing old progress data gracefully (new books)', () => {
    const result = ProgressManager.analyzeProgressRegression(null, 50, {
      context: 'test',
    });

    assert.equal(result.isRegression, false);
    assert.equal(result.invalidData, false); // oldProgress=null with valid newProgress is normal for new books
    assert.equal(
      result.reason,
      'No previous progress data available - treating as new book',
    );
  });

  it('handles truly invalid progress data', () => {
    const result = ProgressManager.analyzeProgressRegression(null, null, {
      context: 'test',
    });

    assert.equal(result.isRegression, false);
    assert.equal(result.invalidData, true); // Both null is truly invalid
    assert.equal(
      result.reason,
      'Cannot analyze regression - invalid progress data',
    );
  });
});

describe('ProgressManager.isComplete()', () => {
  it('detects completion based on high progress percentage', () => {
    const result = ProgressManager.isComplete(98, {
      threshold: 95,
      context: 'test',
    });
    assert.equal(result, true);
  });

  it('detects completion based on finished flag', () => {
    const result = ProgressManager.isComplete(80, {
      isFinished: true,
      context: 'test',
    });
    assert.equal(result, true);
  });

  it('detects completion based on precise time remaining for audiobooks', () => {
    const bookData = {
      current_time: 3480, // 58 minutes
      media: { duration: 3600 }, // 1 hour total, 2 minutes remaining
    };

    const result = ProgressManager.isComplete(96.67, {
      context: 'test',
      _bookData: bookData,
      format: 'audiobook',
    });

    assert.equal(result, true);
  });

  it('detects completion based on precise pages remaining for books', () => {
    const bookData = {
      current_page: 298, // On page 298
      pages: 300, // Total 300 pages, 2 pages remaining
    };

    const result = ProgressManager.isComplete(99, {
      context: 'test',
      _bookData: bookData,
      format: 'ebook',
    });

    assert.equal(result, true);
  });

  it('does not detect completion for lower progress without other indicators', () => {
    const result = ProgressManager.isComplete(75, {
      context: 'test',
      threshold: 95,
    });
    assert.equal(result, false);
  });
});

describe('ProgressManager.formatProgress()', () => {
  it('formats progress with default settings', () => {
    const result = ProgressManager.formatProgress(42.6789);
    assert.equal(result, '42.7%');
  });

  it('formats progress with custom decimals', () => {
    const result = ProgressManager.formatProgress(42.6789, { decimals: 2 });
    assert.equal(result, '42.68%');
  });

  it('formats null progress with custom display', () => {
    const result = ProgressManager.formatProgress(null, {
      nullDisplay: 'Unknown',
    });
    assert.equal(result, 'Unknown');
  });

  it('formats progress with custom suffix', () => {
    const result = ProgressManager.formatProgress(42.6, { suffix: ' percent' });
    assert.equal(result, '42.6 percent');
  });
});
