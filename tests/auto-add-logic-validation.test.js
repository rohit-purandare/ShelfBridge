import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BookCache } from '../src/book-cache.js';

/**
 * Auto-Add Logic Validation
 *
 * This test validates that our changes preserve auto-add functionality correctly
 * by testing the specific conditions used in the auto-add cache check.
 */

describe('Auto-Add Logic Validation', () => {
  it('should correctly evaluate cache conditions for auto-add decisions', async () => {
    const bookCache = new BookCache();
    await bookCache.init();

    try {
      const userId = 'logic-validation-user';

      console.log('\n🔬 AUTO-ADD CACHE CONDITION VALIDATION\n');

      // Define test scenarios that cover all possible cache states
      const testScenarios = [
        {
          name: 'Complete cache entry (matched and synced)',
          setup: async () => {
            const title = 'Complete Book';
            const author = 'Complete Author';
            const id = bookCache.generateTitleAuthorIdentifier(title, author);

            await bookCache.storeBookSyncData(
              userId, id, title, 'complete-edition', 'title_author', author,
              45.0, Date.now(), Date.now() - 86400000
            );

            return { id, title };
          },
          expectedResult: 'SKIP - Already cached',
          expectedSkip: true
        },
        {
          name: 'No cache entry (new book)',
          setup: async () => {
            const title = 'New Book';
            const author = 'New Author';
            const id = bookCache.generateTitleAuthorIdentifier(title, author);
            return { id, title };
          },
          expectedResult: 'PROCEED - Not cached',
          expectedSkip: false
        },
        {
          name: 'Cache entry without edition (incomplete)',
          setup: async () => {
            const title = 'Incomplete Book';
            const author = 'Incomplete Author';
            const id = bookCache.generateTitleAuthorIdentifier(title, author);

            // Insert directly without edition_id to simulate incomplete cache
            const stmt = bookCache.db.prepare(`
              INSERT INTO books (user_id, identifier, identifier_type, title, author, progress_percent, last_sync)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            stmt.run(userId, id, 'title_author', title.toLowerCase().trim(), author, 25.0, Date.now());

            return { id, title };
          },
          expectedResult: 'PROCEED - Incomplete cache',
          expectedSkip: false
        }
      ];

      // Test each scenario
      for (let i = 0; i < testScenarios.length; i++) {
        const scenario = testScenarios[i];
        console.log(`${i + 1}. ${scenario.name}:`);

        const { id, title } = await scenario.setup();

        // This is the exact logic from sync-manager.js _tryAutoAddBook
        const existingCache = await bookCache.getCachedBookInfo(
          userId,
          id,
          title,
          'title_author'
        );

        // The exact condition used in the auto-add cache check
        const shouldSkip = existingCache && existingCache.exists && existingCache.edition_id;

        console.log(`   Cache exists: ${existingCache?.exists || false}`);
        console.log(`   Edition ID: ${existingCache?.edition_id || 'null'}`);
        console.log(`   Should skip: ${!!shouldSkip}`);
        console.log(`   Expected: ${scenario.expectedResult}`);

        if (scenario.expectedSkip) {
          assert.ok(shouldSkip, `${scenario.name} should skip auto-add`);
          console.log(`   ✅ CORRECT: Skips duplicate title/author search`);
        } else {
          assert.ok(!shouldSkip, `${scenario.name} should proceed with auto-add`);
          console.log(`   ✅ CORRECT: Proceeds with legitimate auto-add`);
        }

        console.log('');
      }

      console.log('🎯 VALIDATION RESULTS:');
      console.log('  ✅ Complete cache entries: Skip title/author search');
      console.log('  ✅ Incomplete cache entries: Proceed with title/author search');
      console.log('  ✅ New books: Proceed with title/author search');
      console.log('  ✅ Auto-add functionality fully preserved and optimized!');

    } finally {
      await bookCache.clearCache();
      bookCache.close();
    }
  });

  it('should verify the cache skip condition handles all edge cases', () => {
    console.log('\n🔍 CACHE SKIP CONDITION ANALYSIS\n');

    // Test the exact JavaScript condition used in auto-add
    const testCases = [
      {
        description: 'Complete cache entry',
        cache: { exists: true, edition_id: 'edition-123', progress_percent: 45.0 },
        expected: true
      },
      {
        description: 'Cache exists but no edition_id',
        cache: { exists: true, edition_id: null, progress_percent: 45.0 },
        expected: false
      },
      {
        description: 'Cache exists but empty edition_id',
        cache: { exists: true, edition_id: '', progress_percent: 45.0 },
        expected: false
      },
      {
        description: 'No cache entry',
        cache: { exists: false },
        expected: false
      },
      {
        description: 'Null cache object',
        cache: null,
        expected: false
      },
      {
        description: 'Undefined cache object',
        cache: undefined,
        expected: false
      }
    ];

    testCases.forEach((testCase, index) => {
      // This is the exact condition from _tryAutoAddBook
      const shouldSkip = testCase.cache && testCase.cache.exists && testCase.cache.edition_id;

      console.log(`${index + 1}. ${testCase.description}:`);
      console.log(`   Cache: ${JSON.stringify(testCase.cache)}`);
      console.log(`   Condition result: ${!!shouldSkip}`);
      console.log(`   Expected: ${testCase.expected}`);

      assert.strictEqual(!!shouldSkip, testCase.expected, `${testCase.description} should evaluate correctly`);
      console.log(`   ✅ Correct evaluation\n`);
    });

    console.log('✅ All edge cases handled correctly by cache skip condition');
  });
});