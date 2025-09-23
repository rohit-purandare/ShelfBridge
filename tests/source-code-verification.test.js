import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'fs';

/**
 * Source code verification tests
 *
 * These tests verify that our log message changes are present in the source code
 * and that the old misleading language has been removed.
 */

describe('Source Code Verification Tests', () => {
  describe('ProgressManager Log Messages', () => {
    it('uses "detected" language instead of "marked" for completion messages', () => {
      const progressManagerSource = fs.readFileSync('./src/progress-manager.js', 'utf-8');

      // Verify correct "detected" language is present
      assert.ok(
        progressManagerSource.includes('Book detected as complete via isFinished flag'),
        'Should use "detected" language for isFinished flag completion'
      );

      assert.ok(
        progressManagerSource.includes('Book detected as complete by progress'),
        'Should use "detected" language for progress-based completion'
      );

      assert.ok(
        progressManagerSource.includes('Audiobook detected as complete by time remaining'),
        'Should use "detected" language for time-based audiobook completion'
      );

      assert.ok(
        progressManagerSource.includes('Book detected as complete by pages remaining'),
        'Should use "detected" language for page-based book completion'
      );

      // Verify old misleading language is NOT present
      assert.ok(
        !progressManagerSource.includes('Book marked as complete via isFinished flag'),
        'Should not use "marked" language for completion detection'
      );

      assert.ok(
        !progressManagerSource.includes('Book considered complete by progress'),
        'Should not use "considered" language for completion detection'
      );

      assert.ok(
        !progressManagerSource.includes('Audiobook complete by time remaining') ||
        progressManagerSource.includes('Audiobook detected as complete by time remaining'),
        'Should not use ambiguous "complete by" language without "detected"'
      );
    });
  });

  describe('SyncResultFormatter Display Messages', () => {
    it('uses "completed books processed" instead of "marked complete"', () => {
      const syncFormatterSource = fs.readFileSync('./src/display/SyncResultFormatter.js', 'utf-8');

      // Verify correct language is present for normal mode
      assert.ok(
        syncFormatterSource.includes('completed books processed'),
        'Should use "completed books processed" in normal sync results'
      );

      // Verify correct language is present for dry-run mode
      assert.ok(
        syncFormatterSource.includes('completed books would be processed'),
        'Should use "completed books would be processed" in dry-run mode'
      );

      // Verify old misleading language is NOT present
      const markedCompleteMatches = syncFormatterSource.match(/marked complete/g);
      assert.ok(
        !markedCompleteMatches || markedCompleteMatches.length === 0,
        'Should not use "marked complete" language in sync results'
      );

      // Also check that "would mark complete" is not present
      assert.ok(
        !syncFormatterSource.includes('would mark complete'),
        'Should not use "would mark complete" in dry-run mode'
      );
    });
  });

  describe('Comprehensive Language Audit', () => {
    it('ensures no misleading completion language remains in key files', () => {
      const progressManagerSource = fs.readFileSync('./src/progress-manager.js', 'utf-8');
      const syncFormatterSource = fs.readFileSync('./src/display/SyncResultFormatter.js', 'utf-8');

      // List of potentially misleading phrases that should not be present
      const misleadingPhrases = [
        'Book marked as complete',
        'marked complete',  // In context of summaries
        'would mark complete',
        'Book considered complete',
        'Audiobook complete by', // Without "detected as"
        'Book complete by'       // Without "detected as"
      ];

      const problematicFindings = [];

      misleadingPhrases.forEach(phrase => {
        if (progressManagerSource.includes(phrase)) {
          problematicFindings.push(`ProgressManager contains: "${phrase}"`);
        }

        // Special handling for sync formatter - some phrases might be acceptable in comments
        if (syncFormatterSource.includes(phrase)) {
          // Check if it's our corrected versions
          if (phrase === 'marked complete' &&
              syncFormatterSource.includes('completed books processed')) {
            // This is likely acceptable - it's been replaced
          } else if (phrase === 'would mark complete' &&
                     syncFormatterSource.includes('completed books would be processed')) {
            // This is likely acceptable - it's been replaced
          } else {
            problematicFindings.push(`SyncResultFormatter contains: "${phrase}"`);
          }
        }
      });

      assert.equal(
        problematicFindings.length,
        0,
        `Found misleading language: ${problematicFindings.join(', ')}`
      );
    });

    it('verifies all detection messages use consistent language', () => {
      const progressManagerSource = fs.readFileSync('./src/progress-manager.js', 'utf-8');

      // Count occurrences of our preferred "detected as" pattern
      const detectedAsMatches = progressManagerSource.match(/detected as complete/g);

      // Should have at least 4 occurrences (one for each completion detection method)
      assert.ok(
        detectedAsMatches && detectedAsMatches.length >= 4,
        `Should have at least 4 "detected as complete" messages, found ${detectedAsMatches ? detectedAsMatches.length : 0}`
      );

      // Verify specific detection contexts are present
      const requiredDetectionContexts = [
        'via isFinished flag',
        'by progress',
        'by time remaining',
        'by pages remaining'
      ];

      requiredDetectionContexts.forEach(context => {
        const pattern = `detected as complete ${context}`;
        assert.ok(
          progressManagerSource.includes(pattern),
          `Should contain detection message: "${pattern}"`
        );
      });
    });
  });

  describe('Functional Verification', () => {
    it('confirms the original issue scenario would now show correct language', () => {
      // This test documents the fix for the original user complaint:
      //
      // BEFORE: Logs showed "9 marked complete" suggesting new completions
      // AFTER: Logs show "9 completed books processed" indicating detection/processing
      //
      // BEFORE: Debug logs said "Book marked as complete via isFinished flag"
      // AFTER: Debug logs say "Book detected as complete via isFinished flag"

      const syncFormatterSource = fs.readFileSync('./src/display/SyncResultFormatter.js', 'utf-8');
      const progressManagerSource = fs.readFileSync('./src/progress-manager.js', 'utf-8');

      // Verify sync summary uses processing language
      assert.ok(
        syncFormatterSource.includes('completed books processed'),
        'Sync summary should indicate processing, not marking'
      );

      // Verify debug logs use detection language
      assert.ok(
        progressManagerSource.includes('detected as complete via isFinished flag'),
        'Debug logs should indicate detection, not marking'
      );

      // The key insight: Books that are already complete from previous syncs
      // will be "detected" as complete and "processed" but not "marked" as newly complete
      // This eliminates the confusion that led to the original bug report
    });

    it('demonstrates behavior distinction: detection vs marking', () => {
      const progressManagerSource = fs.readFileSync('./src/progress-manager.js', 'utf-8');

      // The system should "detect" completion status (which is a read operation)
      // It should not "mark" completion status (which implies a write operation)

      // For books that are already complete, the system:
      // 1. DETECTS they are complete (reads existing status)
      // 2. Potentially skips them via caching
      // 3. If processed, shows them as "completed books processed"

      // For books that become newly complete, the system:
      // 1. DETECTS the completion (progress crossed threshold)
      // 2. MARKS them as complete in Hardcover (writes new status)
      // 3. Shows them as "completed books processed" (same message, but different action)

      // The key fix is that the LOGS don't distinguish between these cases
      // because both involve processing completed books, but the language
      // no longer suggests that already-complete books are being newly marked

      assert.ok(
        progressManagerSource.includes('detected as complete'),
        'System should detect completion status'
      );

      // Note: The actual "marking" (writing to Hardcover) happens in a different
      // part of the system (sync-manager), but the detection logic should use
      // clear language about what it's doing
    });
  });
});