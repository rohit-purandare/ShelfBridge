import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BookCache } from '../src/book-cache.js';

/**
 * Debug Cache Identifier Mismatch
 *
 * This test checks if there's a mismatch between how books were previously
 * cached vs how we're now looking them up, which could cause cache misses.
 */

describe('Debug Cache Identifier Mismatch', () => {
  it('should check for identifier pattern mismatches in cache lookups', async () => {
    const bookCache = new BookCache();
    await bookCache.init();

    try {
      const userId = 'debug-mismatch-user';
      const title = 'Test Cache Mismatch';
      const author = 'Mismatch Author';

      console.log('\n🔍 DEBUGGING CACHE IDENTIFIER MISMATCH\n');

      // === Scenario 1: Old pattern (what might be in existing caches) ===
      console.log('📚 SCENARIO 1: Simulate old identifier pattern');

      const oldPatternIds = [
        `title_author_user123_edition456`, // Old userBook/edition pattern
        `${title}:${author}`, // Old completion pattern
        `${title.toLowerCase().replace(/[^a-z0-9:]/g, '')}:${author.toLowerCase().replace(/[^a-z0-9:]/g, '')}` // Old normalized pattern
      ];

      for (const oldId of oldPatternIds) {
        await bookCache.storeBookSyncData(
          userId,
          oldId,
          title,
          'old-edition',
          'title_author',
          author,
          45.0,
          Date.now() - 86400000,
          Date.now() - 172800000
        );

        console.log(`  Stored with old pattern: ${oldId}`);
      }

      // === Scenario 2: New pattern (what we're now looking for) ===
      console.log('\n📚 SCENARIO 2: Generate new identifier pattern');

      const newPatternId = bookCache.generateTitleAuthorIdentifier(title, author);
      console.log(`  New pattern: ${newPatternId}`);

      // === Scenario 3: Test cache lookups ===
      console.log('\n📚 SCENARIO 3: Test cache lookups');

      // Try to find using new pattern
      const newPatternLookup = await bookCache.getCachedBookInfo(
        userId,
        newPatternId,
        title,
        'title_author'
      );

      console.log(`  Lookup with new pattern: ${newPatternLookup.exists}`);

      if (!newPatternLookup.exists) {
        console.log(`  ❌ MISMATCH DETECTED: New pattern can't find old cached books!`);

        // Try finding with old patterns
        for (const oldId of oldPatternIds) {
          const oldLookup = await bookCache.getCachedBookInfo(
            userId,
            oldId,
            title,
            'title_author'
          );
          console.log(`    Old pattern (${oldId}): ${oldLookup.exists}`);
        }

        console.log(`\n  💡 SOLUTION: Need migration or multi-pattern lookup`);
      } else {
        console.log(`  ✅ NEW PATTERN WORKS: Can find cached books`);
      }

      // === Scenario 4: What happens during progress update ===
      console.log('\n📚 SCENARIO 4: Progress update simulation');

      // This simulates what happens in early optimization
      const possibleCacheKeys = [];

      // For books without identifiers, add title/author key
      if (!false && !false) { // No ASIN, No ISBN
        const titleAuthorKey = bookCache.generateTitleAuthorIdentifier(title, author);
        possibleCacheKeys.push({ key: titleAuthorKey, type: 'title_author' });
        console.log(`  Would check cache key: ${titleAuthorKey}`);
      }

      // Try cache lookup
      let cacheFound = false;
      for (const { key, type } of possibleCacheKeys) {
        const hasChanged = await bookCache.hasProgressChanged(
          userId,
          key,
          title,
          45.0, // Same progress
          type
        );

        console.log(`  Progress changed for ${key}: ${hasChanged}`);

        if (!hasChanged) {
          cacheFound = true;
          console.log(`  ✅ CACHE HIT: Would skip title/author search`);
          break;
        }
      }

      if (!cacheFound) {
        console.log(`  ❌ CACHE MISS: Would trigger title/author search`);
        console.log(`  🚨 This explains why you're still seeing searches!`);
      }

    } finally {
      await bookCache.clearCache();
      bookCache.close();
    }
  });

  it('should check what patterns are actually stored in a real cache', async () => {
    const bookCache = new BookCache();
    await bookCache.init();

    try {
      console.log('\n🔍 CHECKING REAL CACHE PATTERNS\n');

      // Query what's actually in the cache database
      const stmt = bookCache.db.prepare(`
        SELECT identifier, identifier_type, title, author
        FROM books
        WHERE identifier_type = 'title_author'
        LIMIT 5
      `);

      const results = stmt.all();

      console.log(`Found ${results.length} title/author cache entries:`);

      if (results.length === 0) {
        console.log('  (No title/author entries in cache - this is a clean test environment)');
      } else {
        results.forEach((row, index) => {
          console.log(`  ${index + 1}. "${row.title}" by "${row.author}"`);
          console.log(`     Identifier: ${row.identifier}`);
          console.log(`     Type: ${row.identifier_type}`);
        });

        // Analyze patterns
        const patterns = results.map(r => r.identifier);
        const hasOldPattern = patterns.some(p => p.includes('title_author_user') || p.includes(':'));
        const hasNewPattern = patterns.some(p => p.startsWith('title_author:') && p.includes('|'));

        console.log(`\n  📊 Pattern analysis:`);
        console.log(`    Has old patterns: ${hasOldPattern}`);
        console.log(`    Has new patterns: ${hasNewPattern}`);

        if (hasOldPattern && !hasNewPattern) {
          console.log(`    🚨 MIGRATION NEEDED: Only old patterns found`);
        } else if (hasNewPattern && hasOldPattern) {
          console.log(`    ⚠️  MIXED PATTERNS: Need compatibility layer`);
        } else if (hasNewPattern) {
          console.log(`    ✅ CONSISTENT: Only new patterns found`);
        }
      }

    } finally {
      bookCache.close();
    }
  });
});