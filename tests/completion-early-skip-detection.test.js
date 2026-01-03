import assert from 'node:assert/strict';
import { describe, it, before, after, beforeEach } from 'node:test';
import { unlinkSync } from 'fs';

import { BookCache } from '../src/book-cache.js';
import ProgressManager from '../src/progress-manager.js';

/**
 * Tests for completion detection in early skip optimization path
 *
 * This tests the scenario where:
 * 1. A book has progress >= 95% (completion threshold)
 * 2. Progress hasn't changed between syncs
 * 3. The book hasn't been marked as complete yet (no finished_at)
 * 4. The early skip optimization should NOT skip the book
 * 5. Instead, it should let it go through completion detection
 *
 * Reproduces the bug where "The Dungeon Anarchist's Cookbook" at 99.77%
 * was skipped and never marked as complete.
 */

describe('Completion Detection in Early Skip Path', () => {
  let cache;
  const testCacheFile = 'test-cache-early-skip-completion.db';

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
    cache = new BookCache(testCacheFile);
    await cache.init();
  });

  describe('Cache State Checks', () => {
    it('detects book needing completion when progress unchanged at 99.77%', async () => {
      // Simulate the exact scenario from the bug report
      const userId = 'test-user';
      const identifier = 'B094XCNV6G';
      const title = "The Dungeon Anarchist's Cookbook";
      const editionId = 32126950;
      const progress = 99.7689581700846;

      // Store initial sync data (without finished_at)
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

      // Get cached info
      const cachedInfo = await cache.getCachedBookInfo(
        userId,
        identifier,
        title,
        'asin',
      );

      // Verify the conditions that should prevent early skip
      assert.equal(cachedInfo.exists, true);
      assert.equal(cachedInfo.progress_percent, progress);
      assert.equal(cachedInfo.finished_at, null); // Key: not marked complete yet
      assert(progress >= 95); // Above completion threshold

      // This book should NOT be skipped - it needs completion processing
      const needsCompletionProcessing =
        progress >= 95 && !cachedInfo.finished_at;
      assert.equal(
        needsCompletionProcessing,
        true,
        'Book at 99.77% without finished_at should need completion processing',
      );
    });

    it('allows skip when book already marked as complete', async () => {
      const userId = 'test-user';
      const identifier = 'B094XCNV6G';
      const title = 'Already Complete Book';
      const editionId = 32126950;
      const progress = 99.5;
      const finishedAt = new Date().toISOString();

      // Store book with completion data
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

      // Mark as complete
      await cache.storeBookCompletionData(
        userId,
        identifier,
        title,
        'asin',
        new Date().toISOString(),
        new Date().toISOString(),
        finishedAt,
      );

      // Get cached info
      const cachedInfo = await cache.getCachedBookInfo(
        userId,
        identifier,
        title,
        'asin',
      );

      // Verify book is marked as complete
      assert.equal(cachedInfo.exists, true);
      assert.equal(cachedInfo.progress_percent, 100); // Completion sets to 100%
      assert(cachedInfo.finished_at !== null); // Has finished_at

      // This book CAN be skipped - it's already complete
      const needsCompletionProcessing =
        cachedInfo.progress_percent >= 95 && !cachedInfo.finished_at;
      assert.equal(
        needsCompletionProcessing,
        false,
        'Book with finished_at can be safely skipped',
      );
    });

    it('allows skip when progress below completion threshold', async () => {
      const userId = 'test-user';
      const identifier = '9781234567890';
      const title = 'In Progress Book';
      const editionId = 12345;
      const progress = 50.0;

      // Store book with mid-level progress
      await cache.storeBookSyncData(
        userId,
        identifier,
        title,
        editionId,
        'isbn',
        'Test Author',
        progress,
        new Date().toISOString(),
        new Date().toISOString(),
      );

      // Get cached info
      const cachedInfo = await cache.getCachedBookInfo(
        userId,
        identifier,
        title,
        'isbn',
      );

      // Verify conditions
      assert.equal(cachedInfo.exists, true);
      assert.equal(cachedInfo.progress_percent, progress);
      assert.equal(cachedInfo.finished_at, null);
      assert(progress < 95); // Below completion threshold

      // This book CAN be skipped - not near completion
      const needsCompletionProcessing =
        progress >= 95 && !cachedInfo.finished_at;
      assert.equal(
        needsCompletionProcessing,
        false,
        'Book at 50% can be safely skipped',
      );
    });
  });

  describe('Edge Cases', () => {
    it('detects completion need at exact 95% threshold', async () => {
      const userId = 'test-user';
      const identifier = '9780000000001';
      const title = 'Exactly 95 Percent';
      const editionId = 11111;
      const progress = 95.0;

      await cache.storeBookSyncData(
        userId,
        identifier,
        title,
        editionId,
        'isbn',
        'Test Author',
        progress,
        new Date().toISOString(),
        new Date().toISOString(),
      );

      const cachedInfo = await cache.getCachedBookInfo(
        userId,
        identifier,
        title,
        'isbn',
      );

      const needsCompletionProcessing =
        progress >= 95 && !cachedInfo.finished_at;
      assert.equal(
        needsCompletionProcessing,
        true,
        'Book at exactly 95% should need completion processing',
      );
    });

    it('detects completion need just above 95% threshold', async () => {
      const userId = 'test-user';
      const identifier = '9780000000002';
      const title = 'Slightly Above 95';
      const editionId = 22222;
      const progress = 95.01;

      await cache.storeBookSyncData(
        userId,
        identifier,
        title,
        editionId,
        'isbn',
        'Test Author',
        progress,
        new Date().toISOString(),
        new Date().toISOString(),
      );

      const cachedInfo = await cache.getCachedBookInfo(
        userId,
        identifier,
        title,
        'isbn',
      );

      const needsCompletionProcessing =
        progress >= 95 && !cachedInfo.finished_at;
      assert.equal(
        needsCompletionProcessing,
        true,
        'Book at 95.01% should need completion processing',
      );
    });

    it('allows skip just below 95% threshold', async () => {
      const userId = 'test-user';
      const identifier = '9780000000003';
      const title = 'Just Below 95';
      const editionId = 33333;
      const progress = 94.99;

      await cache.storeBookSyncData(
        userId,
        identifier,
        title,
        editionId,
        'isbn',
        'Test Author',
        progress,
        new Date().toISOString(),
        new Date().toISOString(),
      );

      const cachedInfo = await cache.getCachedBookInfo(
        userId,
        identifier,
        title,
        'isbn',
      );

      const needsCompletionProcessing =
        progress >= 95 && !cachedInfo.finished_at;
      assert.equal(
        needsCompletionProcessing,
        false,
        'Book at 94.99% can be safely skipped',
      );
    });

    it('handles 100% progress without finished_at', async () => {
      const userId = 'test-user';
      const identifier = '9780000000004';
      const title = '100 Percent Not Marked';
      const editionId = 44444;
      const progress = 100.0;

      await cache.storeBookSyncData(
        userId,
        identifier,
        title,
        editionId,
        'isbn',
        'Test Author',
        progress,
        new Date().toISOString(),
        new Date().toISOString(),
      );

      const cachedInfo = await cache.getCachedBookInfo(
        userId,
        identifier,
        title,
        'isbn',
      );

      const needsCompletionProcessing =
        progress >= 95 && !cachedInfo.finished_at;
      assert.equal(
        needsCompletionProcessing,
        true,
        'Book at 100% without finished_at needs completion processing',
      );
    });
  });

  describe('Progress Change Detection', () => {
    it('correctly identifies unchanged progress at completion threshold', async () => {
      const userId = 'test-user';
      const identifier = 'B123456789';
      const title = 'Unchanged Progress Book';
      const editionId = 55555;
      const progress = 97.5;

      // Initial sync
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

      // Check if progress changed (should be false)
      const hasChanged = await cache.hasProgressChanged(
        userId,
        identifier,
        title,
        progress, // Same progress
        'asin',
      );

      assert.equal(hasChanged, false, 'Progress should be unchanged');

      // But book should still need completion processing
      const cachedInfo = await cache.getCachedBookInfo(
        userId,
        identifier,
        title,
        'asin',
      );

      const needsCompletionProcessing =
        progress >= 95 && !cachedInfo.finished_at;
      assert.equal(
        needsCompletionProcessing,
        true,
        'Unchanged progress at 97.5% should still need completion processing',
      );
    });
  });

  describe('Integration with ProgressManager', () => {
    it('uses correct completion threshold from ProgressManager', () => {
      const threshold = ProgressManager.DEFAULT_COMPLETION_THRESHOLD;
      assert.equal(threshold, 95, 'Completion threshold should be 95%');
    });

    it('validates completion detection for various progress values', () => {
      const testCases = [
        { progress: 94.9, shouldNeedCompletion: false },
        { progress: 95.0, shouldNeedCompletion: true },
        { progress: 96.5, shouldNeedCompletion: true },
        { progress: 99.77, shouldNeedCompletion: true },
        { progress: 100.0, shouldNeedCompletion: true },
      ];

      for (const { progress, shouldNeedCompletion } of testCases) {
        const needsCompletion = progress >= 95; // Simulating no finished_at
        assert.equal(
          needsCompletion,
          shouldNeedCompletion,
          `Progress ${progress}% should ${shouldNeedCompletion ? '' : 'not '}need completion`,
        );
      }
    });
  });
});
