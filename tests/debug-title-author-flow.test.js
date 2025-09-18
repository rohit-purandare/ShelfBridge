import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BookCache } from '../src/book-cache.js';
import ProgressManager from '../src/progress-manager.js';

/**
 * Debug Title/Author Flow Test
 *
 * This test traces the exact flow to understand why title/author searches
 * are still happening for previously matched books during progress updates.
 */

describe('Debug Title/Author Flow', () => {
  it('should trace the exact early optimization flow for title/author books', async () => {
    const bookCache = new BookCache();
    await bookCache.init();

    try {
      const userId = 'debug-user';

      console.log('\n🔍 DEBUGGING TITLE/AUTHOR PROGRESS UPDATE FLOW\n');

      // Simulate a book that was previously matched by title/author
      const absBook = {
        id: 'debug-book-123',
        progress_percentage: 67.5,
        is_finished: false,
        media: {
          metadata: {
            title: 'Debug Book Title',
            authors: [{ name: 'Debug Author' }],
            // NO identifiers - this is key
          },
        },
      };

      const title = absBook.media.metadata.title;
      const author = absBook.media.metadata.authors[0].name;

      console.log('📚 Book Details:');
      console.log(`  Title: "${title}"`);
      console.log(`  Author: "${author}"`);
      console.log(`  Progress: ${absBook.progress_percentage}%`);
      console.log(`  Has ISBN: false`);
      console.log(`  Has ASIN: false`);

      // Step 1: Pre-cache this book as if it was previously matched
      console.log(
        '\n🔄 STEP 1: Pre-cache book (simulating previous successful match)',
      );

      const titleAuthorId = bookCache.generateTitleAuthorIdentifier(
        title,
        author,
      );
      await bookCache.storeBookSyncData(
        userId,
        titleAuthorId,
        title,
        'debug-edition-456',
        'title_author',
        author,
        67.5, // Same progress as current
        Date.now() - 3600000, // 1 hour ago
        Date.now() - 86400000, // Started yesterday
      );

      console.log(`  Generated cache ID: ${titleAuthorId}`);
      console.log(`  Stored progress: 67.5%`);
      console.log(`  Edition ID: debug-edition-456`);

      // Step 2: Simulate extracting identifiers (sync-manager.js line 537)
      console.log('\n🔄 STEP 2: Extract identifiers (sync-manager.js logic)');

      const identifiers = {
        isbn: null, // No ISBN
        asin: null, // No ASIN
      };

      console.log(`  Extracted identifiers: ${JSON.stringify(identifiers)}`);
      console.log(
        `  Has identifiers: ${!!(identifiers.isbn || identifiers.asin)}`,
      );

      // Step 3: Early optimization check (sync-manager.js lines 542-671)
      console.log('\n🔄 STEP 3: Early optimization check');

      // Check if force_sync would bypass optimization
      const forceSync = false; // Assume normal operation
      console.log(`  Force sync: ${forceSync}`);

      if (!forceSync) {
        // Validate progress
        const validatedProgress = ProgressManager.getValidatedProgress(
          absBook,
          `book "${title}" debug test`,
          { allowNull: false },
        );

        console.log(`  Validated progress: ${validatedProgress}%`);

        if (validatedProgress !== null) {
          // Multi-key cache lookup
          const possibleCacheKeys = [];

          // Add identifier-based keys (will be empty for this book)
          if (identifiers.asin) {
            possibleCacheKeys.push({ key: identifiers.asin, type: 'asin' });
          }
          if (identifiers.isbn) {
            possibleCacheKeys.push({ key: identifiers.isbn, type: 'isbn' });
          }

          console.log(
            `  Identifier-based cache keys: ${possibleCacheKeys.length}`,
          );

          // Add title/author key for books without identifiers (THE CRITICAL FIX)
          if (!identifiers.asin && !identifiers.isbn) {
            const titleAuthorKey = bookCache.generateTitleAuthorIdentifier(
              title,
              author,
            );
            possibleCacheKeys.push({
              key: titleAuthorKey,
              type: 'title_author',
            });
            console.log(`  ✅ Added title/author cache key: ${titleAuthorKey}`);
          }

          console.log(`  Total cache keys to try: ${possibleCacheKeys.length}`);

          // Try each cache key
          let hasChanged = true;
          let cacheFoundEarly = false;

          for (const { key, type } of possibleCacheKeys) {
            console.log(`  🔍 Checking ${type} cache key: ${key}`);

            const progressChanged = await bookCache.hasProgressChanged(
              userId,
              key,
              title,
              validatedProgress,
              type,
            );

            console.log(`    Progress changed: ${progressChanged}`);

            if (!progressChanged) {
              hasChanged = false;
              cacheFoundEarly = true;
              console.log(`    ✅ CACHE HIT! Should skip expensive matching`);
              break;
            }
          }

          console.log(`\n  📊 Early optimization result:`);
          console.log(`    Progress changed: ${hasChanged}`);
          console.log(`    Cache found early: ${cacheFoundEarly}`);
          console.log(
            `    Should skip expensive matching: ${!hasChanged && cacheFoundEarly}`,
          );

          if (!hasChanged && cacheFoundEarly) {
            console.log(
              `\n  🎉 SUCCESS: Book would be skipped - no title/author search!`,
            );
            assert.strictEqual(
              hasChanged,
              false,
              'Should detect unchanged progress',
            );
            assert.strictEqual(
              cacheFoundEarly,
              true,
              'Should find cache early',
            );
          } else {
            console.log(
              `\n  ❌ FAILURE: Book would proceed to expensive matching`,
            );
            console.log(
              `     This means title/author search would still happen!`,
            );

            // Let's debug why the cache lookup failed
            console.log(`\n  🔬 DEBUG: Why did cache lookup fail?`);

            for (const { key, type } of possibleCacheKeys) {
              const cachedInfo = await bookCache.getCachedBookInfo(
                userId,
                key,
                title,
                type,
              );
              console.log(`    ${type} cache (${key}):`);
              console.log(`      Exists: ${cachedInfo.exists}`);
              console.log(
                `      Edition ID: ${cachedInfo.edition_id || 'null'}`,
              );
              console.log(
                `      Progress: ${cachedInfo.progress_percent || 'null'}`,
              );
              console.log(`      Last sync: ${cachedInfo.last_sync || 'null'}`);
            }
          }
        }
      }
    } finally {
      await bookCache.clearCache();
      bookCache.close();
    }
  });
});
