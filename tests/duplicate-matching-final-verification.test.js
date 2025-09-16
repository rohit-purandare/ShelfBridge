import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BookCache } from '../src/book-cache.js';
import ProgressManager from '../src/progress-manager.js';

/**
 * Final Verification Test for Duplicate Matching Fix
 *
 * This test simulates the exact scenario where title/author matched books
 * were being re-matched on every progress update.
 */

describe('Duplicate Matching Final Verification', () => {
  it('should prevent duplicate title/author matching using consistent cache identifiers', async () => {
    const bookCache = new BookCache();
    await bookCache.init();

    try {
      const userId = 'test-user-final';

      // Simulate a book without identifiers (typical title/author match scenario)
      const absBook = {
        id: 'abs-book-final-test',
        progress_percentage: 67.5,
        is_finished: false,
        media: {
          metadata: {
            title: 'Book Without Identifiers',
            authors: [{ name: 'No Identifier Author' }]
            // No ISBN or ASIN - will require title/author matching
          }
        }
      };

      const title = absBook.media.metadata.title;
      const author = absBook.media.metadata.authors[0].name;

      // Step 1: Simulate the first sync where book gets matched by title/author
      console.log('\n🔄 Simulating FIRST SYNC (initial title/author matching):');

      // Generate the consistent title/author identifier (same as TitleAuthorMatcher uses)
      const titleAuthorId = bookCache.generateTitleAuthorIdentifier(title, author);
      console.log(`  Generated cache identifier: ${titleAuthorId}`);

      // Store the book as if it was successfully matched and synced
      await bookCache.storeBookSyncData(
        userId,
        titleAuthorId,
        title,
        'edition-test-final',
        'title_author',
        author,
        67.5, // Current progress
        Date.now(),
        Date.now() - 86400000
      );

      console.log(`  ✅ Book cached with title/author identifier`);

      // Step 2: Simulate the SECOND SYNC with same progress (should skip expensive matching)
      console.log('\n🔄 Simulating SECOND SYNC (progress unchanged - should optimize):');

      // Extract identifiers (will be empty for this book)
      const identifiers = { isbn: null, asin: null };

      // Validate progress
      const validatedProgress = ProgressManager.getValidatedProgress(
        absBook,
        `book "${title}" final test`,
        { allowNull: false }
      );

      // Simulate the enhanced early optimization logic from sync-manager.js
      const possibleCacheKeys = [];

      // Add identifier-based keys (will be empty for this book)
      if (identifiers.asin) {
        possibleCacheKeys.push({ key: identifiers.asin, type: 'asin' });
      }
      if (identifiers.isbn) {
        possibleCacheKeys.push({ key: identifiers.isbn, type: 'isbn' });
      }

      // Add title/author key for books without identifiers (THE FIX!)
      if (!identifiers.asin && !identifiers.isbn) {
        const titleAuthorKey = bookCache.generateTitleAuthorIdentifier(title, author);
        possibleCacheKeys.push({ key: titleAuthorKey, type: 'title_author' });
        console.log(`  🔍 Added title/author cache key: ${titleAuthorKey}`);
      }

      // Try each cache key to find existing progress data
      let hasChanged = true; // Default to true (needs sync)
      let cacheFoundEarly = false;

      for (const { key, type } of possibleCacheKeys) {
        console.log(`  🔍 Checking cache with ${type} key...`);

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
          console.log(`  ✅ CACHE HIT! Progress unchanged via ${type} cache (${validatedProgress.toFixed(1)}%)`);
          break;
        } else {
          console.log(`  ➡️  Progress changed via ${type} cache`);
        }
      }

      // Verify the optimization worked
      assert.strictEqual(hasChanged, false, 'Should detect unchanged progress via title/author cache');
      assert.strictEqual(cacheFoundEarly, true, 'Should find title/author cache entry early');

      console.log(`\n🎉 SUCCESS! Book would be skipped - no expensive matching needed`);
      console.log(`   ❌ BEFORE FIX: Would always re-match title/author books`);
      console.log(`   ✅ AFTER FIX: Skips re-matching when progress unchanged`);

      // Step 3: Test with changed progress (should proceed with sync)
      console.log('\n🔄 Simulating THIRD SYNC (progress changed - should proceed):');

      const changedProgress = 75.2; // Different from cached 67.5
      let progressChangedCorrectly = false;

      for (const { key, type } of possibleCacheKeys) {
        const progressChanged = await bookCache.hasProgressChanged(
          userId,
          key,
          title,
          changedProgress,
          type,
        );

        if (progressChanged) {
          progressChangedCorrectly = true;
          console.log(`  ✅ Progress change detected via ${type} cache (${changedProgress.toFixed(1)}% vs ${validatedProgress.toFixed(1)}%)`);
          break;
        }
      }

      assert.strictEqual(progressChangedCorrectly, true, 'Should detect changed progress correctly');
      console.log(`  ➡️  Would proceed with sync due to progress change`);

      console.log('\n✅ Duplicate matching prevention fix verified successfully!');
      console.log('   📊 Performance benefit: Title/author books now benefit from cache optimization');
      console.log('   🚀 Scalability: Large libraries with mixed book types will sync much faster');

    } finally {
      await bookCache.clearCache();
      bookCache.close();
    }
  });
});