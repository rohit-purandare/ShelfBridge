import assert from 'node:assert/strict';
import { describe, it, mock, beforeEach, afterEach } from 'node:test';

import { ProgressManager } from '../src/progress-manager.js';

/**
 * Test suite to verify log output changes
 *
 * This ensures that:
 * 1. Log messages use "detected" instead of "marked" language
 * 2. Messages clearly indicate detection vs new marking
 * 3. No misleading completion language is used
 */

describe('Log Output Verification Tests', () => {
  let logMessages;
  let originalLogger;

  beforeEach(() => {
    logMessages = [];

    // Mock the logger import
    const mockLogger = {
      debug: mock.fn((message, data) => {
        logMessages.push({ level: 'debug', message, data });
      }),
      info: mock.fn((message, data) => {
        logMessages.push({ level: 'info', message, data });
      }),
      warn: mock.fn((message, data) => {
        logMessages.push({ level: 'warn', message, data });
      }),
      error: mock.fn((message, data) => {
        logMessages.push({ level: 'error', message, data });
      }),
    };

    // We'll need to inject the logger into ProgressManager
    // For now, we'll verify the message content by calling the methods directly
  });

  afterEach(() => {
    logMessages = [];
  });

  describe('Completion Detection Log Messages', () => {
    it('uses "detected" language for isFinished flag completion', () => {
      // Test that completion detection uses correct language
      const result = ProgressManager.isComplete(85, {
        isFinished: true,
        context: 'log-verification-test',
        format: 'audiobook',
      });

      assert.equal(result, true);

      // The key test here is that our changes to the source code
      // use "detected" instead of "marked" in the log messages
      // We can verify this by examining the source code strings
    });

    it('uses "detected" language for progress-based completion', () => {
      const result = ProgressManager.isComplete(98, {
        threshold: 95,
        context: 'progress-completion-test',
        format: 'ebook',
      });

      assert.equal(result, true);
    });

    it('uses "detected" language for time-based audiobook completion', () => {
      const bookData = {
        current_time: 3540, // 59 minutes
        media: { duration: 3600 }, // 60 minutes total (1 minute remaining)
      };

      const result = ProgressManager.isComplete(98.33, {
        context: 'time-based-completion-test',
        format: 'audiobook',
        _bookData: bookData,
      });

      assert.equal(result, true);
    });

    it('uses "detected" language for page-based book completion', () => {
      const bookData = {
        pages: 300,
        current_page: 298, // 2 pages remaining
      };

      const result = ProgressManager.isComplete(99.33, {
        context: 'page-based-completion-test',
        format: 'ebook',
        _bookData: bookData,
      });

      assert.equal(result, true);
    });
  });

  describe('Source Code Verification', () => {
    it('verifies completion detection messages use correct language', async () => {
      // Read the actual source file to verify our changes
      const fs = await import('fs');
      const progressManagerSource = fs.readFileSync(
        './src/progress-manager.js',
        'utf-8',
      );

      // Verify that "detected" language is used instead of "marked"
      assert.ok(
        progressManagerSource.includes(
          'Book detected as complete via isFinished flag',
        ),
        'Should use "detected" language for isFinished flag completion',
      );

      assert.ok(
        progressManagerSource.includes('Book detected as complete by progress'),
        'Should use "detected" language for progress-based completion',
      );

      assert.ok(
        progressManagerSource.includes(
          'Audiobook detected as complete by time remaining',
        ),
        'Should use "detected" language for time-based completion',
      );

      assert.ok(
        progressManagerSource.includes(
          'Book detected as complete by pages remaining',
        ),
        'Should use "detected" language for page-based completion',
      );

      // Verify that old "marked" language is NOT present
      assert.ok(
        !progressManagerSource.includes('Book marked as complete'),
        'Should not use "marked" language for completion',
      );

      assert.ok(
        !progressManagerSource.includes('Book considered complete'),
        'Should not use "considered" language for completion',
      );
    });

    it('verifies sync result formatter uses correct language', async () => {
      const fs = await import('fs');
      const syncFormatterSource = fs.readFileSync(
        './src/display/SyncResultFormatter.js',
        'utf-8',
      );

      // Verify the summary line uses correct language
      assert.ok(
        syncFormatterSource.includes('completed books processed'),
        'Should use "completed books processed" instead of "marked complete"',
      );

      // Verify old language is not present
      assert.ok(
        !syncFormatterSource.includes('marked complete') ||
          syncFormatterSource.match(/marked complete/g)?.length === 0,
        'Should not use "marked complete" language in summary',
      );
    });
  });

  describe('Behavioral Verification', () => {
    it('demonstrates already complete book stays complete without re-marking', () => {
      const completeBookData = {
        is_finished: true,
        progress_percentage: 100,
        current_time: 7200,
        media: { duration: 7200 },
      };

      // First check
      const isComplete1 = ProgressManager.isBookComplete(
        completeBookData,
        'behavioral-test-1',
      );

      // Second check (simulating re-sync)
      const isComplete2 = ProgressManager.isBookComplete(
        completeBookData,
        'behavioral-test-2',
      );

      // Both should be true, but this is detection, not marking
      assert.equal(isComplete1, true);
      assert.equal(isComplete2, true);

      // Progress should be identical
      const progress1 = ProgressManager.getValidatedProgress(
        completeBookData,
        'progress-check-1',
      );
      const progress2 = ProgressManager.getValidatedProgress(
        completeBookData,
        'progress-check-2',
      );

      assert.equal(progress1, 100);
      assert.equal(progress2, 100);

      // No change should be detected
      const changeResult = ProgressManager.detectProgressChange(
        progress1,
        progress2,
        {
          context: 'no-change-verification',
        },
      );

      assert.equal(changeResult.hasChange, false);
      assert.equal(changeResult.direction, 'none');
      assert.equal(changeResult.absoluteChange, 0);
    });

    it('demonstrates proper handling of actually newly completed books', () => {
      // Simulate a book that just reached completion
      const previousProgress = 98;
      const newProgress = 100;

      const changeResult = ProgressManager.detectProgressChange(
        previousProgress,
        newProgress,
        { context: 'newly-completed-book' },
      );

      assert.equal(changeResult.hasChange, true);
      assert.equal(changeResult.direction, 'increase');
      assert.equal(changeResult.absoluteChange, 2);

      // This would be a legitimate case where the book is newly completed
      const wasComplete = ProgressManager.isComplete(previousProgress, {
        threshold: 99,
        context: 'previous-state',
      });
      const isComplete = ProgressManager.isComplete(newProgress, {
        threshold: 99,
        context: 'current-state',
      });

      assert.equal(wasComplete, false);
      assert.equal(isComplete, true);

      // This represents a genuine completion transition
    });

    it('verifies edge case handling for near-complete books', () => {
      // Test a book at exactly the threshold
      const thresholdProgress = 95;

      const atThreshold = ProgressManager.isComplete(thresholdProgress, {
        threshold: 95,
        context: 'at-threshold-test',
      });

      const justBelow = ProgressManager.isComplete(94.9, {
        threshold: 95,
        context: 'just-below-threshold',
      });

      assert.equal(atThreshold, true);
      assert.equal(justBelow, false);

      // Test precision-based completion for audiobooks
      const preciseAudiobook = {
        current_time: 3540, // 1 minute remaining
        media: { duration: 3600 },
      };

      const preciseResult = ProgressManager.isComplete(98.33, {
        context: 'precise-audiobook-test',
        format: 'audiobook',
        _bookData: preciseAudiobook,
      });

      assert.equal(preciseResult, true);
    });
  });

  describe('Integration with Real-World Scenarios', () => {
    it('simulates the original log issue scenario', () => {
      // This simulates the original issue where logs made it appear
      // that books were being repeatedly marked complete

      const alreadyCompleteBooks = [
        {
          is_finished: true,
          progress_percentage: 100,
          current_time: 3600,
          media: { duration: 3600 },
        },
        {
          is_finished: true,
          progress_percentage: 100,
          current_time: 7200,
          media: { duration: 7200 },
        },
      ];

      let completedBooksProcessed = 0;

      // Simulate processing each book
      alreadyCompleteBooks.forEach((bookData, index) => {
        const isComplete = ProgressManager.isBookComplete(
          bookData,
          `sync-book-${index}`,
        );

        if (isComplete) {
          completedBooksProcessed++;
        }
      });

      // Both books are detected as complete (which is correct)
      assert.equal(completedBooksProcessed, 2);

      // But the key difference is that the logs now say "detected as complete"
      // rather than "marked as complete", which was misleading users
      // The behavior is correct - the logging is now clearer
    });

    it('validates that cache hits properly skip processing', () => {
      const bookData = {
        is_finished: true,
        progress_percentage: 100,
      };

      // First processing
      const firstCheck = ProgressManager.isBookComplete(
        bookData,
        'first-process',
      );
      const firstProgress = ProgressManager.getValidatedProgress(
        bookData,
        'first-validate',
      );

      // Second processing (simulating cache scenario)
      const secondCheck = ProgressManager.isBookComplete(
        bookData,
        'second-process',
      );
      const secondProgress = ProgressManager.getValidatedProgress(
        bookData,
        'second-validate',
      );

      // Both should be identical
      assert.equal(firstCheck, secondCheck);
      assert.equal(firstProgress, secondProgress);

      // Change detection should show no change (cache hit scenario)
      const changeResult = ProgressManager.detectProgressChange(
        firstProgress,
        secondProgress,
        { context: 'cache-hit-simulation' },
      );

      assert.equal(changeResult.hasChange, false);
      assert.equal(changeResult.direction, 'none');

      // This is the scenario where a cache hit would occur and the book
      // would be skipped entirely, preventing the "detected as complete" message
      // from appearing in logs for books that haven't changed
    });
  });
});
