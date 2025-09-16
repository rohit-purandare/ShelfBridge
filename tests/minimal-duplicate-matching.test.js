import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BookCache } from '../src/book-cache.js';
import ProgressManager from '../src/progress-manager.js';

/**
 * Minimal test to verify the duplicate matching fix works
 * Tests the core early progress optimization logic from sync-manager.js
 */

describe('Minimal Duplicate Matching Prevention', () => {
  it('should demonstrate early progress optimization prevents duplicate matching', async () => {
    const bookCache = new BookCache();
    await bookCache.init();

    try {
      const userId = 'test-user';
      const testBook = {
        media: {
          metadata: {
            title: 'Test Book',
            authors: [{ name: 'Test Author' }],
            isbn: '9781234567890',
          },
        },
        progress_percentage: 45.5,
        is_finished: false,
      };

      // Extract identifiers (simulating the sync-manager logic)
      const identifiers = {
        isbn: testBook.media.metadata.isbn,
        asin: null,
      };

      const title = testBook.media.metadata.title;
      const author = testBook.media.metadata.authors[0].name;

      // Validate progress (simulating ProgressManager.getValidatedProgress)
      const validatedProgress = ProgressManager.getValidatedProgress(
        testBook,
        `book "${title}" test`,
        { allowNull: false },
      );

      assert.strictEqual(
        validatedProgress,
        45.5,
        'Progress validation should work',
      );

      // Pre-populate cache (simulating previous sync)
      await bookCache.storeBookSyncData(
        userId,
        identifiers.isbn,
        title,
        'test-edition-123',
        'isbn',
        author,
        45.5, // Same progress
        Date.now(),
        Date.now() - 86400000,
      );

      // Simulate the early optimization check from sync-manager.js
      const possibleCacheKeys = [];

      // Add identifier-based keys (highest priority)
      if (identifiers.asin) {
        possibleCacheKeys.push({ key: identifiers.asin, type: 'asin' });
      }
      if (identifiers.isbn) {
        possibleCacheKeys.push({ key: identifiers.isbn, type: 'isbn' });
      }

      let hasChanged = true; // Default to true (needs sync)
      let cacheFoundEarly = false;

      // Try each cache key to find existing progress data
      for (const { key, type } of possibleCacheKeys) {
        try {
          const progressChanged = await bookCache.hasProgressChanged(
            userId,
            key,
            title,
            validatedProgress,
            type,
          );

          if (!progressChanged) {
            hasChanged = false;
            cacheFoundEarly = true;
            console.log(
              `Early skip for ${title}: Progress unchanged via ${type} cache (${validatedProgress.toFixed(1)}%)`,
            );
            break;
          }
        } catch (cacheError) {
          // Cache lookup failed for this key, try next
          console.log(
            `Early cache lookup failed for ${title} with ${type} key: ${cacheError.message}`,
          );
          continue;
        }
      }

      // Verify the optimization worked
      assert.strictEqual(hasChanged, false, 'Should detect unchanged progress');
      assert.strictEqual(
        cacheFoundEarly,
        true,
        'Should find cache entry early',
      );

      console.log(
        `✅ Early optimization test passed - book would be skipped, avoiding expensive matching`,
      );
    } finally {
      await bookCache.clearCache();
      bookCache.close();
    }
  });

  it('should proceed with sync when progress has changed', async () => {
    const bookCache = new BookCache();
    await bookCache.init();

    try {
      const userId = 'test-user-2';
      const testBook = {
        media: {
          metadata: {
            title: 'Changed Progress Book',
            authors: [{ name: 'Test Author' }],
            isbn: '9781111111111',
          },
        },
        progress_percentage: 67.3, // Changed from cached 45.0
        is_finished: false,
      };

      const identifiers = {
        isbn: testBook.media.metadata.isbn,
        asin: null,
      };

      const title = testBook.media.metadata.title;
      const author = testBook.media.metadata.authors[0].name;

      const validatedProgress = ProgressManager.getValidatedProgress(
        testBook,
        `book "${title}" test`,
        { allowNull: false },
      );

      // Pre-populate cache with different progress
      await bookCache.storeBookSyncData(
        userId,
        identifiers.isbn,
        title,
        'test-edition-456',
        'isbn',
        author,
        45.0, // Different from current 67.3
        Date.now() - 3600000, // 1 hour ago
        Date.now() - 86400000,
      );

      // Simulate the early optimization check
      const possibleCacheKeys = [];
      if (identifiers.isbn) {
        possibleCacheKeys.push({ key: identifiers.isbn, type: 'isbn' });
      }

      let hasChanged = true;
      let cacheFoundEarly = false;

      for (const { key, type } of possibleCacheKeys) {
        const progressChanged = await bookCache.hasProgressChanged(
          userId,
          key,
          title,
          validatedProgress,
          type,
        );

        if (!progressChanged) {
          hasChanged = false;
          cacheFoundEarly = true;
          break;
        }
      }

      // Verify sync should proceed
      assert.strictEqual(hasChanged, true, 'Should detect changed progress');
      console.log(
        `✅ Progress change test passed - book would proceed with sync due to changed progress`,
      );
    } finally {
      await bookCache.clearCache();
      bookCache.close();
    }
  });
});
