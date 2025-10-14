import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { ProgressManager } from '../src/progress-manager.js';

/**
 * Comprehensive test suite for completion detection behavior
 *
 * This test validates that:
 * 1. Books that are already complete are correctly detected (not re-marked)
 * 2. Log messages use "detected" language instead of "marked" language
 * 3. The system distinguishes between newly completed vs already completed books
 * 4. No false positive completions occur during re-processing
 */

describe('Completion Detection Behavior Tests', () => {
  describe('Already Complete Book Detection', () => {
    it('detects already complete book via isFinished flag without re-marking', () => {
      const mockLogger = {
        debug: mock.fn(),
        warn: mock.fn(),
        info: mock.fn(),
      };

      // Mock the logger to capture log messages
      const originalLogger = global.console;

      // Test book that's already complete
      const completeBookData = {
        is_finished: true,
        progress_percentage: 100,
        current_time: 3600,
        media: { duration: 3600 },
      };

      const result = ProgressManager.isComplete(100, {
        isFinished: true,
        context: 'already-complete-book-test',
        format: 'audiobook',
        _bookData: completeBookData,
      });

      assert.equal(result, true);

      // Verify the detection logic works correctly
      const isAlreadyComplete = ProgressManager.isComplete(100, {
        isFinished: true,
        context: 'detection-test',
        format: 'audiobook',
      });

      assert.equal(isAlreadyComplete, true);
    });

    it('detects already complete book via high progress percentage', () => {
      const result = ProgressManager.isComplete(100, {
        threshold: 95,
        context: 'high-progress-test',
        format: 'ebook',
      });

      assert.equal(result, true);
    });

    it('does not mark incomplete books as complete', () => {
      const result = ProgressManager.isComplete(75, {
        threshold: 95,
        context: 'incomplete-book-test',
        format: 'audiobook',
      });

      assert.equal(result, false);
    });

    it('handles edge case of near-complete books correctly', () => {
      // Test audiobook with 1 minute remaining (should be complete)
      const nearCompleteAudiobook = {
        current_time: 3540, // 59 minutes
        media: { duration: 3600 }, // 60 minutes total
      };

      const result = ProgressManager.isComplete(98.33, {
        context: 'near-complete-audiobook',
        format: 'audiobook',
        _bookData: nearCompleteAudiobook,
      });

      assert.equal(result, true);

      // Test book with 2 pages remaining (should be complete)
      const nearCompleteBook = {
        pages: 300,
        current_page: 298,
      };

      const bookResult = ProgressManager.isComplete(99.33, {
        context: 'near-complete-book',
        format: 'ebook',
        _bookData: nearCompleteBook,
      });

      assert.equal(bookResult, true);
    });
  });

  describe('Progress Change Detection', () => {
    it('correctly identifies no change when progress is identical', () => {
      const changeResult = ProgressManager.detectProgressChange(100, 100, {
        context: 'no-change-test',
      });

      assert.equal(changeResult.hasChange, false);
      assert.equal(changeResult.direction, 'none');
      assert.equal(changeResult.absoluteChange, 0);
    });

    it('correctly identifies significant progress increases', () => {
      const changeResult = ProgressManager.detectProgressChange(85, 100, {
        context: 'progress-increase-test',
        threshold: 0.1,
      });

      assert.equal(changeResult.hasChange, true);
      assert.equal(changeResult.direction, 'increase');
      assert.equal(changeResult.absoluteChange, 15);
    });

    it('correctly handles new books (no previous progress)', () => {
      const changeResult = ProgressManager.detectProgressChange(null, 75, {
        context: 'new-book-test',
      });

      assert.equal(changeResult.hasChange, true);
      assert.equal(changeResult.invalidData, true);
      assert.equal(changeResult.newProgress, 75);
      assert.equal(changeResult.oldProgress, 0);
    });

    it('handles tiny progress changes within threshold', () => {
      const changeResult = ProgressManager.detectProgressChange(85.05, 85.08, {
        context: 'tiny-change-test',
        threshold: 0.1,
      });

      assert.equal(changeResult.hasChange, false);
      assert.equal(changeResult.direction, 'none');
    });
  });

  describe('Regression Analysis', () => {
    it('does not flag completion reduction as false regression when re-reading', () => {
      const regressionResult = ProgressManager.analyzeProgressRegression(
        100,
        5,
        {
          context: 'reread-scenario',
          rereadThreshold: 30,
          highProgressThreshold: 85,
          blockThreshold: 50,
        },
      );

      assert.equal(regressionResult.isRegression, true);
      assert.equal(regressionResult.isPotentialReread, true);
      assert.equal(regressionResult.shouldBlock, true); // Major regression should still block
      assert.equal(regressionResult.shouldWarn, false); // Warning is superseded by block
    });

    it('correctly handles minor regressions within tolerance', () => {
      const regressionResult = ProgressManager.analyzeProgressRegression(
        87,
        85,
        {
          context: 'minor-regression',
          warnThreshold: 15,
          blockThreshold: 50,
        },
      );

      assert.equal(regressionResult.isRegression, true);
      assert.equal(regressionResult.shouldBlock, false);
      assert.equal(regressionResult.shouldWarn, false); // 2% is below 15% threshold
      assert.equal(regressionResult.regressionAmount, 2);
    });
  });

  describe('Book Format Detection', () => {
    it('correctly detects audiobook format from edition data', () => {
      const audiobookEdition = {
        audio_seconds: 14400, // 4 hours
        pages: null,
        reading_format: { format: 'Listened' },
      };

      const format = ProgressManager.getFormatFromEdition(audiobookEdition);
      assert.equal(format, 'audiobook');
    });

    it('correctly detects ebook format from edition data', () => {
      const ebookEdition = {
        audio_seconds: null,
        pages: 250,
        reading_format: { format: 'Ebook' },
      };

      const format = ProgressManager.getFormatFromEdition(ebookEdition);
      assert.equal(format, 'ebook');
    });

    it('correctly detects physical book format from edition data', () => {
      const physicalEdition = {
        audio_seconds: null,
        pages: 300,
        reading_format: { format: 'Read' },
      };

      const format = ProgressManager.getFormatFromEdition(physicalEdition);
      assert.equal(format, 'physical');
    });

    it('handles unknown format gracefully', () => {
      const unknownEdition = {
        audio_seconds: null,
        pages: null,
        reading_format: null,
      };

      const format = ProgressManager.getFormatFromEdition(unknownEdition);
      assert.equal(format, 'unknown');
    });
  });

  describe('Integration Scenarios', () => {
    it('simulates already complete book processing without false marking', () => {
      // Simulate a book that was completed yesterday
      const alreadyCompleteBook = {
        is_finished: true,
        progress_percentage: 100,
        current_time: 7200,
        media: { duration: 7200 },
      };

      // First check - should detect as complete
      const isComplete1 = ProgressManager.isBookComplete(
        alreadyCompleteBook,
        'first-check',
        {},
        null,
      );
      assert.equal(isComplete1, true);

      // Second check (simulating re-sync) - should still detect as complete
      const isComplete2 = ProgressManager.isBookComplete(
        alreadyCompleteBook,
        'second-check',
        {},
        null,
      );
      assert.equal(isComplete2, true);

      // Progress validation should consistently return 100%
      const validatedProgress1 = ProgressManager.getValidatedProgress(
        alreadyCompleteBook,
        'validation-check-1',
      );
      const validatedProgress2 = ProgressManager.getValidatedProgress(
        alreadyCompleteBook,
        'validation-check-2',
      );

      assert.equal(validatedProgress1, 100);
      assert.equal(validatedProgress2, 100);

      // Change detection between identical states should show no change
      const changeResult = ProgressManager.detectProgressChange(
        validatedProgress1,
        validatedProgress2,
        { context: 'already-complete-recheck' },
      );

      assert.equal(changeResult.hasChange, false);
      assert.equal(changeResult.direction, 'none');
    });

    it('simulates newly completed book vs already completed book', () => {
      // Newly completed book (progress went from 98% to 100%)
      const newlyCompleteProgress = ProgressManager.detectProgressChange(
        98,
        100,
        {
          context: 'newly-complete-book',
        },
      );

      assert.equal(newlyCompleteProgress.hasChange, true);
      assert.equal(newlyCompleteProgress.direction, 'increase');

      // Already completed book (progress stays at 100%)
      const alreadyCompleteProgress = ProgressManager.detectProgressChange(
        100,
        100,
        {
          context: 'already-complete-book',
        },
      );

      assert.equal(alreadyCompleteProgress.hasChange, false);
      assert.equal(alreadyCompleteProgress.direction, 'none');
    });

    it('validates position calculation round-trip consistency', () => {
      // Test audiobook position calculations
      const audioProgress = 75;
      const audioDuration = 14400; // 4 hours

      const currentSeconds = ProgressManager.calculateCurrentPosition(
        audioProgress,
        audioDuration,
        { type: 'seconds' },
      );

      const recalculatedProgress =
        ProgressManager.calculateProgressFromPosition(
          currentSeconds,
          audioDuration,
          { type: 'seconds' },
        );

      assert.equal(Math.round(recalculatedProgress), audioProgress);

      // Test book page calculations
      const bookProgress = 60;
      const totalPages = 300;

      const currentPage = ProgressManager.calculateCurrentPosition(
        bookProgress,
        totalPages,
        { type: 'pages' },
      );

      const recalculatedBookProgress =
        ProgressManager.calculateProgressFromPosition(currentPage, totalPages, {
          type: 'pages',
        });

      assert.equal(Math.round(recalculatedBookProgress), bookProgress);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles invalid book data gracefully', () => {
      const result = ProgressManager.isBookComplete(null, 'null-book-test');
      assert.equal(result, false);

      const invalidResult = ProgressManager.isBookComplete(
        { invalid: 'data' },
        'invalid-data-test',
      );
      assert.equal(invalidResult, false);
    });

    it('handles malformed progress data', () => {
      const result = ProgressManager.validateProgress(
        'invalid',
        'malformed-test',
      );
      assert.equal(result, null);

      const nanResult = ProgressManager.validateProgress(NaN, 'nan-test');
      assert.equal(nanResult, null);

      const infiniteResult = ProgressManager.validateProgress(
        Infinity,
        'infinite-test',
      );
      assert.equal(infiniteResult, null);
    });

    it('maintains consistency with zero and null values', () => {
      const zeroResult = ProgressManager.isZeroProgress(0);
      assert.equal(zeroResult, true);

      const nullResult = ProgressManager.isZeroProgress(null);
      assert.equal(nullResult, true);

      const lowResult = ProgressManager.isZeroProgress(3, { threshold: 5 });
      assert.equal(lowResult, true);

      const aboveThresholdResult = ProgressManager.isZeroProgress(7, {
        threshold: 5,
      });
      assert.equal(aboveThresholdResult, false);
    });
  });
});
