import assert from 'node:assert/strict';
import { describe, it, before, after, beforeEach } from 'node:test';
import { unlinkSync, existsSync } from 'fs';

import { BookCache } from '../src/book-cache.js';
import ProgressManager from '../src/progress-manager.js';

/**
 * Integration tests for completion detection with early skip optimization
 *
 * These tests simulate real-world sync scenarios to ensure:
 * 1. Books crossing the 95% threshold get marked as complete
 * 2. Books already at completion threshold don't get skipped if not yet marked complete
 * 3. Multiple syncs with unchanged progress still trigger completion
 * 4. Early skip optimization works correctly with completion detection
 */

describe('Completion Detection Early Skip Integration', () => {
  let cache;
  const testCacheFile = 'test-cache-integration-early-skip.db';

  before(async () => {
    // Clean up any existing test cache
    try {
      unlinkSync(testCacheFile);
    } catch (err) {
      // Ignore if file doesn't exist
    }
  });

  after(async () => {
    // Clean up test cache
    try {
      if (cache) {
        await cache.close();
      }
      unlinkSync(testCacheFile);
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    // Create fresh cache for each test
    if (cache) {
      await cache.close();
    }
    if (existsSync(testCacheFile)) {
      unlinkSync(testCacheFile);
    }
    cache = new BookCache(testCacheFile);
    await cache.init();
  });

  describe('Real-World Sync Scenarios', () => {
    it('handles book progressing from 94% to 96% across multiple syncs', async () => {
      const userId = 'test-user';
      const identifier = 'B111111111';
      const title = 'Progressive Book';
      const editionId = 10001;

      // Sync 1: Book at 94% - below threshold
      await cache.storeBookSyncData(
        userId,
        identifier,
        title,
        editionId,
        'asin',
        'Test Author',
        94.0,
        new Date().toISOString(),
        new Date().toISOString(),
      );

      let cachedInfo = await cache.getCachedBookInfo(
        userId,
        identifier,
        title,
        'asin',
      );
      assert.equal(cachedInfo.progress_percent, 94.0);
      assert.equal(cachedInfo.finished_at, null);

      // Check if progress changed
      let hasChanged = await cache.hasProgressChanged(
        userId,
        identifier,
        title,
        94.0,
        'asin',
      );
      assert.equal(
        hasChanged,
        false,
        'Progress 94% -> 94% should be unchanged',
      );

      // Should allow early skip (below threshold)
      let needsCompletion = 94.0 >= 95 && !cachedInfo.finished_at;
      assert.equal(needsCompletion, false, 'Should allow skip at 94%');

      // Sync 2: Book progresses to 96% - crosses threshold
      await cache.storeBookSyncData(
        userId,
        identifier,
        title,
        editionId,
        'asin',
        'Test Author',
        96.0,
        new Date().toISOString(),
        new Date().toISOString(),
      );

      cachedInfo = await cache.getCachedBookInfo(
        userId,
        identifier,
        title,
        'asin',
      );
      assert.equal(cachedInfo.progress_percent, 96.0);
      assert.equal(cachedInfo.finished_at, null);

      hasChanged = await cache.hasProgressChanged(
        userId,
        identifier,
        title,
        96.0,
        'asin',
      );
      assert.equal(
        hasChanged,
        false,
        'Progress 96% -> 96% should be unchanged',
      );

      // Should NOT allow early skip (above threshold, not marked complete)
      needsCompletion = 96.0 >= 95 && !cachedInfo.finished_at;
      assert.equal(
        needsCompletion,
        true,
        'Should NOT skip at 96% without finished_at',
      );

      // Sync 3: Complete the book
      await cache.storeBookCompletionData(
        userId,
        identifier,
        title,
        'asin',
        new Date().toISOString(),
        new Date().toISOString(),
        new Date().toISOString(),
      );

      cachedInfo = await cache.getCachedBookInfo(
        userId,
        identifier,
        title,
        'asin',
      );
      assert.equal(cachedInfo.progress_percent, 100);
      assert(cachedInfo.finished_at !== null);

      // Should NOW allow early skip (marked complete)
      needsCompletion = 100 >= 95 && !cachedInfo.finished_at;
      assert.equal(needsCompletion, false, 'Should allow skip when complete');
    });

    it('handles the exact bug scenario from logs (99.77% unchanged)', async () => {
      const userId = 'rpurandare';
      const identifier = 'B094XCNV6G';
      const title = "The Dungeon Anarchist's Cookbook";
      const editionId = 32126950;
      const progress = 99.7689581700846;

      // Simulate first sync at 99.77%
      await cache.storeBookSyncData(
        userId,
        identifier,
        title,
        editionId,
        'asin',
        'Matt Dinniman',
        progress,
        new Date().toISOString(),
        new Date().toISOString(),
      );

      // Simulate second sync with same progress (the bug scenario)
      const hasChanged = await cache.hasProgressChanged(
        userId,
        identifier,
        title,
        progress,
        'asin',
      );
      assert.equal(
        hasChanged,
        false,
        'Progress should be detected as unchanged',
      );

      const cachedInfo = await cache.getCachedBookInfo(
        userId,
        identifier,
        title,
        'asin',
      );

      // This is the critical check - should NOT allow skip
      const needsCompletion = progress >= 95 && !cachedInfo.finished_at;
      assert.equal(
        needsCompletion,
        true,
        'Book at 99.77% without finished_at MUST NOT be skipped',
      );

      // Verify it would have been logged as needing completion processing
      assert(progress >= 95);
      assert.equal(cachedInfo.finished_at, null);
      assert.equal(cachedInfo.progress_percent, progress);
    });

    it('handles multiple books at various completion states', async () => {
      const userId = 'test-user';
      const now = new Date().toISOString();

      // Book 1: Below threshold, should skip
      await cache.storeBookSyncData(
        userId,
        'B001',
        'Book Below Threshold',
        1001,
        'asin',
        'Author 1',
        85.0,
        now,
        now,
      );

      // Book 2: At threshold, not complete, should NOT skip
      await cache.storeBookSyncData(
        userId,
        'B002',
        'Book At Threshold',
        1002,
        'asin',
        'Author 2',
        95.0,
        now,
        now,
      );

      // Book 3: Above threshold, not complete, should NOT skip
      await cache.storeBookSyncData(
        userId,
        'B003',
        'Book Above Threshold',
        1003,
        'asin',
        'Author 3',
        98.5,
        now,
        now,
      );

      // Book 4: At 100%, not marked complete, should NOT skip
      await cache.storeBookSyncData(
        userId,
        'B004',
        'Book At 100',
        1004,
        'asin',
        'Author 4',
        100.0,
        now,
        now,
      );

      // Book 5: At 98%, marked complete, should skip
      await cache.storeBookSyncData(
        userId,
        'B005',
        'Book Complete',
        1005,
        'asin',
        'Author 5',
        98.0,
        now,
        now,
      );
      await cache.storeBookCompletionData(
        userId,
        'B005',
        'Book Complete',
        'asin',
        now,
        now,
        now,
      );

      // Check each book
      const book1 = await cache.getCachedBookInfo(
        userId,
        'B001',
        'Book Below Threshold',
        'asin',
      );
      const needs1 = 85.0 >= 95 && !book1.finished_at;
      assert.equal(needs1, false, 'Book 1 (85%) should allow skip');

      const book2 = await cache.getCachedBookInfo(
        userId,
        'B002',
        'Book At Threshold',
        'asin',
      );
      const needs2 = 95.0 >= 95 && !book2.finished_at;
      assert.equal(needs2, true, 'Book 2 (95%) should NOT allow skip');

      const book3 = await cache.getCachedBookInfo(
        userId,
        'B003',
        'Book Above Threshold',
        'asin',
      );
      const needs3 = 98.5 >= 95 && !book3.finished_at;
      assert.equal(needs3, true, 'Book 3 (98.5%) should NOT allow skip');

      const book4 = await cache.getCachedBookInfo(
        userId,
        'B004',
        'Book At 100',
        'asin',
      );
      const needs4 = 100.0 >= 95 && !book4.finished_at;
      assert.equal(needs4, true, 'Book 4 (100%) should NOT allow skip');

      const book5 = await cache.getCachedBookInfo(
        userId,
        'B005',
        'Book Complete',
        'asin',
      );
      const needs5 = 100.0 >= 95 && !book5.finished_at;
      assert.equal(needs5, false, 'Book 5 (complete) should allow skip');
    });
  });

  describe('Title/Author Cache Path', () => {
    it('checks completion in title/author cache path', async () => {
      const userId = 'test-user';
      const title = 'Title Author Match Book';
      const author = 'Test Author';
      const editionId = 20001;

      // Create a title/author identifier
      const titleAuthorId = cache.generateTitleAuthorIdentifier(title, author);

      // Store with title/author identifier at completion threshold
      await cache.storeBookSyncData(
        userId,
        titleAuthorId,
        title,
        editionId,
        'title_author',
        author,
        97.5,
        new Date().toISOString(),
        new Date().toISOString(),
      );

      const cachedInfo = await cache.getCachedBookInfo(
        userId,
        titleAuthorId,
        title,
        'title_author',
      );

      assert.equal(cachedInfo.exists, true);
      assert.equal(cachedInfo.progress_percent, 97.5);
      assert.equal(cachedInfo.finished_at, null);

      // Check if needs completion
      const needsCompletion = 97.5 >= 95 && !cachedInfo.finished_at;
      assert.equal(
        needsCompletion,
        true,
        'Title/author match at 97.5% should need completion',
      );

      // Progress unchanged check
      const hasChanged = await cache.hasProgressChanged(
        userId,
        titleAuthorId,
        title,
        97.5,
        'title_author',
      );
      assert.equal(hasChanged, false);

      // Should still need completion processing
      assert.equal(needsCompletion, true);
    });
  });

  describe('Edge Cases and Race Conditions', () => {
    it('handles rapid syncs at completion boundary', async () => {
      const userId = 'test-user';
      const identifier = 'B999999999';
      const title = 'Rapid Sync Book';
      const editionId = 30001;

      // Sync 1: 94.9% (just below)
      await cache.storeBookSyncData(
        userId,
        identifier,
        title,
        editionId,
        'asin',
        'Test Author',
        94.9,
        new Date().toISOString(),
        new Date().toISOString(),
      );

      let cachedInfo = await cache.getCachedBookInfo(
        userId,
        identifier,
        title,
        'asin',
      );
      let needsCompletion = 94.9 >= 95 && !cachedInfo.finished_at;
      assert.equal(needsCompletion, false);

      // Sync 2: 95.0% (exactly at threshold)
      await cache.storeBookSyncData(
        userId,
        identifier,
        title,
        editionId,
        'asin',
        'Test Author',
        95.0,
        new Date().toISOString(),
        new Date().toISOString(),
      );

      cachedInfo = await cache.getCachedBookInfo(
        userId,
        identifier,
        title,
        'asin',
      );
      needsCompletion = 95.0 >= 95 && !cachedInfo.finished_at;
      assert.equal(needsCompletion, true);

      // Sync 3: Still 95.0% (unchanged)
      const hasChanged = await cache.hasProgressChanged(
        userId,
        identifier,
        title,
        95.0,
        'asin',
      );
      assert.equal(hasChanged, false);

      // Still needs completion even though progress unchanged
      needsCompletion = 95.0 >= 95 && !cachedInfo.finished_at;
      assert.equal(needsCompletion, true);
    });

    it('handles book marked complete then synced again', async () => {
      const userId = 'test-user';
      const identifier = 'B888888888';
      const title = 'Already Complete Book';
      const editionId = 40001;
      const now = new Date().toISOString();

      // Initial sync and mark complete
      await cache.storeBookSyncData(
        userId,
        identifier,
        title,
        editionId,
        'asin',
        'Test Author',
        98.0,
        now,
        now,
      );

      await cache.storeBookCompletionData(
        userId,
        identifier,
        title,
        'asin',
        now,
        now,
        now,
      );

      let cachedInfo = await cache.getCachedBookInfo(
        userId,
        identifier,
        title,
        'asin',
      );
      assert.equal(cachedInfo.progress_percent, 100);
      assert(cachedInfo.finished_at !== null);

      // Subsequent sync with unchanged progress
      const hasChanged = await cache.hasProgressChanged(
        userId,
        identifier,
        title,
        100.0,
        'asin',
      );
      assert.equal(hasChanged, false);

      // Should allow skip (already complete)
      const needsCompletion = 100.0 >= 95 && !cachedInfo.finished_at;
      assert.equal(needsCompletion, false);
    });

    it('verifies ProgressManager isComplete consistency', async () => {
      const userId = 'test-user';
      const identifier = 'B777777777';
      const title = 'ProgressManager Test';
      const editionId = 50001;

      // Test various progress levels
      const testCases = [
        { progress: 94.99, shouldBeComplete: false },
        { progress: 95.0, shouldBeComplete: true },
        { progress: 96.5, shouldBeComplete: true },
        { progress: 99.77, shouldBeComplete: true },
        { progress: 100.0, shouldBeComplete: true },
      ];

      for (const { progress, shouldBeComplete } of testCases) {
        await cache.storeBookSyncData(
          userId,
          identifier,
          title,
          editionId,
          'asin',
          'Test Author',
          progress,
          new Date().toISOString(),
          new Date().toISOString(),
        );

        const cachedInfo = await cache.getCachedBookInfo(
          userId,
          identifier,
          title,
          'asin',
        );

        const needsCompletion = progress >= 95 && !cachedInfo.finished_at;

        assert.equal(
          needsCompletion,
          shouldBeComplete,
          `Progress ${progress}% completion detection mismatch`,
        );

        // Also verify with ProgressManager's threshold
        const meetsThreshold =
          progress >= ProgressManager.DEFAULT_COMPLETION_THRESHOLD;
        assert.equal(
          meetsThreshold,
          shouldBeComplete,
          `Progress ${progress}% ProgressManager threshold mismatch`,
        );
      }
    });
  });

  describe('Performance Verification', () => {
    it('early skip still works for books below threshold', async () => {
      const userId = 'test-user';
      const books = [];

      // Create 100 books below threshold
      for (let i = 0; i < 100; i++) {
        const identifier = `B${i.toString().padStart(9, '0')}`;
        const title = `Book ${i}`;
        const editionId = 60000 + i;
        const progress = 50.0 + Math.random() * 40; // 50-90%

        await cache.storeBookSyncData(
          userId,
          identifier,
          title,
          editionId,
          'asin',
          'Test Author',
          progress,
          new Date().toISOString(),
          new Date().toISOString(),
        );

        books.push({ identifier, title, progress });
      }

      // Verify all can be skipped (progress unchanged, below threshold)
      let canSkipCount = 0;
      for (const book of books) {
        const hasChanged = await cache.hasProgressChanged(
          userId,
          book.identifier,
          book.title,
          book.progress,
          'asin',
        );

        const cachedInfo = await cache.getCachedBookInfo(
          userId,
          book.identifier,
          book.title,
          'asin',
        );

        const needsCompletion = book.progress >= 95 && !cachedInfo.finished_at;

        if (!hasChanged && !needsCompletion) {
          canSkipCount++;
        }
      }

      assert.equal(
        canSkipCount,
        100,
        'All books below 95% should be skippable',
      );
    });
  });
});
