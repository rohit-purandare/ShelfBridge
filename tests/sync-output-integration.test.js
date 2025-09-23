import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/**
 * Integration test to verify sync result formatting uses correct language
 *
 * This test specifically addresses the issue where users saw
 * "9 marked complete" in sync outputs, which was confusing because
 * it suggested books were being newly marked complete when they were
 * already complete from previous syncs.
 */

// We'll import the SyncResultFormatter to test the display output
const { SyncResultFormatter } = await import(
  '../src/display/SyncResultFormatter.js'
);

describe('Sync Output Integration Tests', () => {
  describe('SyncResultFormatter Output Language', () => {
    it('uses "completed books processed" instead of "marked complete"', () => {
      // Create a sample sync result that would have triggered the original issue
      const syncResult = {
        books_synced: 44,
        books_completed: 9, // These were already complete, just processed
        books_auto_added: 0,
        books_skipped: 44,
        books_with_errors: 0,
        errors: [],
      };

      const formatter = new SyncResultFormatter();
      const output = formatter.formatSyncResults(syncResult, { dryRun: false });

      // Verify the output uses the correct language
      assert.ok(
        output.includes('completed books processed'),
        'Should use "completed books processed" in sync output',
      );

      // Verify it does NOT use the old confusing language
      assert.ok(
        !output.includes('marked complete'),
        'Should not use "marked complete" in sync output',
      );
    });

    it('shows correct counts for already complete books scenario', () => {
      // This simulates the exact scenario from the original logs:
      // 54 books total, 44 skipped, 9 completed books processed
      const syncResult = {
        books_synced: 10,
        books_completed: 9,
        books_auto_added: 0,
        books_skipped: 44,
        books_with_errors: 0,
        errors: [],
      };

      const formatter = new SyncResultFormatter();
      const output = formatter.formatSyncResults(syncResult, { dryRun: false });

      // Should show that books were processed, not newly marked
      assert.ok(output.includes('9 completed books processed'));
      assert.ok(output.includes('44 skipped (no change)'));
      assert.ok(output.includes('10 progress updated'));
    });

    it('handles edge case of all books already complete', () => {
      const syncResult = {
        books_synced: 0,
        books_completed: 5,
        books_auto_added: 0,
        books_skipped: 15,
        books_with_errors: 0,
        errors: [],
      };

      const formatter = new SyncResultFormatter();
      const output = formatter.formatSyncResults(syncResult, { dryRun: false });

      assert.ok(output.includes('5 completed books processed'));
      assert.ok(output.includes('15 skipped (no change)'));
    });

    it('handles case where no completed books are processed', () => {
      const syncResult = {
        books_synced: 10,
        books_completed: 0,
        books_auto_added: 0,
        books_skipped: 30,
        books_with_errors: 0,
        errors: [],
      };

      const formatter = new SyncResultFormatter();
      const output = formatter.formatSyncResults(syncResult, { dryRun: false });

      // Should not include any completion line when books_completed = 0
      assert.ok(!output.includes('completed books processed'));
      assert.ok(!output.includes('marked complete'));
      assert.ok(output.includes('10 progress updated'));
      assert.ok(output.includes('30 skipped (no change)'));
    });

    it('maintains all other output formatting correctly', () => {
      const syncResult = {
        books_synced: 5,
        books_completed: 3,
        books_auto_added: 2,
        books_skipped: 20,
        books_with_errors: 1,
        errors: ['Sample error message'],
      };

      const formatter = new SyncResultFormatter();
      const output = formatter.formatSyncResults(syncResult, { dryRun: false });

      // Verify all sections are present with correct formatting
      assert.ok(output.includes('5 progress updated'));
      assert.ok(output.includes('3 completed books processed'));
      assert.ok(output.includes('2 auto-added'));
      assert.ok(output.includes('20 skipped (no change)'));
      assert.ok(output.includes('1 error occurred'));
    });

    it('dry run mode shows correct language', () => {
      const syncResult = {
        books_synced: 0,
        books_completed: 5,
        books_auto_added: 0,
        books_skipped: 10,
        books_with_errors: 0,
        errors: [],
      };

      const formatter = new SyncResultFormatter();
      const output = formatter.formatSyncResults(syncResult, { dryRun: true });

      // In dry run mode, it should use different language entirely
      assert.ok(
        output.includes('No changes would be made') ||
          output.includes('would be') ||
          !output.includes('completed books processed'),
        'Dry run mode should use different language or indicate no changes',
      );
    });
  });

  describe('Integration with Real Log Scenario', () => {
    it('demonstrates the fix for the original user complaint', () => {
      // This represents the exact scenario that confused the user:
      // Books were showing as "marked complete" every sync when they
      // were already complete from previous syncs

      const originalConfusingResult = {
        books_synced: 10,
        books_completed: 9, // These 9 were ALREADY complete
        books_auto_added: 0,
        books_skipped: 44, // 44 were correctly skipped
        books_with_errors: 0,
        errors: [],
      };

      const formatter = new SyncResultFormatter();
      const output = formatter.formatSyncResults(originalConfusingResult, {
        dryRun: false,
      });

      // The key fix: output now clearly indicates these are completed books
      // being processed, not books being newly marked as complete
      assert.ok(
        output.includes('9 completed books processed'),
        'Should indicate processing of already-complete books',
      );

      assert.ok(
        output.includes('44 skipped (no change)'),
        'Should show majority of books were correctly skipped',
      );

      // Most importantly: should NOT suggest new completions
      assert.ok(
        !output.includes('marked complete'),
        'Should not use language that suggests new completions',
      );
    });
  });
});
