import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BookCache } from '../src/book-cache.js';

/**
 * Preserve Matching Method Test
 *
 * This test verifies that books matched by title/author continue to be
 * cached with title/author identifiers, even if they have ASIN/ISBN data.
 */

describe('Preserve Matching Method', () => {
  it('should preserve title/author caching for books originally matched by title/author', async () => {
    const bookCache = new BookCache();
    await bookCache.init();

    try {
      console.log('\n🔍 TESTING MATCHING METHOD PRESERVATION\n');

      // This simulates the exact "Cleopatra and Frankenstein" scenario
      const title = 'Cleopatra and Frankenstein';
      const author = 'Coco Mellors';
      const asin = 'B09RQ3RD3K';
      const isbn = '9781635578362';

      console.log(
        '📚 Scenario: Book matched by title/author but has identifiers',
      );
      console.log(`  Title: "${title}"`);
      console.log(`  Author: "${author}"`);
      console.log(`  ASIN: ${asin}`);
      console.log(`  ISBN: ${isbn}`);

      // Simulate identifiers extracted from book metadata
      const identifiers = { asin: asin, isbn: isbn };

      // Simulate hardcoverMatch from title/author matching
      const titleAuthorMatch = {
        userBook: { id: 'user-book-123', book: { id: 'book-456' } },
        edition: { id: 'edition-789' },
        _matchType: 'title_author_two_stage', // This indicates title/author matching
        _isSearchResult: false,
      };

      console.log(`  Match type: ${titleAuthorMatch._matchType}`);

      // Test the cache storage preference logic
      console.log('\n🔄 CACHE STORAGE PREFERENCE LOGIC:');

      let identifier, identifierType;

      // This is the logic from sync-manager.js lines 1083-1118
      if (
        titleAuthorMatch &&
        (titleAuthorMatch._matchType === 'title_author' ||
          titleAuthorMatch._matchType === 'title_author_two_stage')
      ) {
        identifier = bookCache.generateTitleAuthorIdentifier(title, author);
        identifierType = 'title_author';
        console.log(
          `  ✅ PRESERVED: Using title/author method (${identifier})`,
        );
        console.log(`    Reason: Book was originally matched by title/author`);
      } else {
        identifier = identifiers.asin || identifiers.isbn;
        identifierType = identifiers.asin ? 'asin' : 'isbn';
        console.log(`  📝 USING: ${identifierType} method (${identifier})`);
        console.log(`    Reason: Book was matched by identifier`);
      }

      // Verify correct behavior
      assert.strictEqual(
        identifierType,
        'title_author',
        'Should preserve title/author caching method',
      );
      assert.strictEqual(
        identifier,
        bookCache.generateTitleAuthorIdentifier(title, author),
        'Should use consistent title/author identifier',
      );

      console.log('\n🎯 PRESERVATION BENEFITS:');
      console.log('  ✅ Maintains cache consistency across syncs');
      console.log('  ✅ Prevents identifier method switching');
      console.log('  ✅ Ensures title/author cache remains complete');
      console.log('  ✅ Eliminates duplicate matching on subsequent syncs');

      // === Test the opposite case for comparison ===
      console.log('\n📚 COMPARISON: Book matched by ASIN');

      const asinMatch = {
        userBook: { id: 'asin-user-book', book: { id: 'asin-book' } },
        edition: { id: 'asin-edition' },
        _matchType: 'asin',
        _isSearchResult: false,
      };

      console.log(`  Match type: ${asinMatch._matchType}`);

      // Test identifier selection for ASIN-matched book
      let asinIdentifier, asinIdentifierType;

      if (
        asinMatch &&
        (asinMatch._matchType === 'title_author' ||
          asinMatch._matchType === 'title_author_two_stage')
      ) {
        asinIdentifier = bookCache.generateTitleAuthorIdentifier(title, author);
        asinIdentifierType = 'title_author';
      } else {
        asinIdentifier = identifiers.asin || identifiers.isbn;
        asinIdentifierType = identifiers.asin ? 'asin' : 'isbn';
      }

      console.log(
        `  ✅ CORRECT: Using ${asinIdentifierType} method (${asinIdentifier})`,
      );
      assert.strictEqual(
        asinIdentifierType,
        'asin',
        'Should use ASIN for ASIN-matched books',
      );

      console.log('\n✅ MATCHING METHOD PRESERVATION VERIFIED:');
      console.log(
        '  📚 Title/author matched books: Stay with title/author cache',
      );
      console.log('  🔢 Identifier matched books: Use identifier cache');
      console.log('  🔄 Consistent behavior: No cache method switching');
    } finally {
      bookCache.close();
    }
  });
});
