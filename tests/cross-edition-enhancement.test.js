/**
 * Tests for Cross-Edition Enhancement Feature
 *
 * Tests the enhancement of identifier matches (ASIN/ISBN) by finding
 * better editions with length data when the initial match lacks it.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { BookMatcher } from '../src/matching/book-matcher.js';

describe('Cross-Edition Enhancement', () => {
  let bookMatcher;
  let mockConfig;

  beforeEach(() => {
    mockConfig = {
      title_author_matching: {
        enabled: true,
      },
    };

    bookMatcher = new BookMatcher(null, null, mockConfig);
  });

  describe('_enhanceMatchWithLengthData() - Basic Functionality', () => {
    it('should return original match when it already has audio_seconds', () => {
      const match = {
        userBook: {
          book: {
            id: 'book-1',
            title: 'Test Book',
            editions: [
              {
                id: 'ed-1',
                audio_seconds: 36000,
                format: 'audiobook',
              },
            ],
          },
        },
        edition: {
          id: 'ed-1',
          audio_seconds: 36000,
          format: 'audiobook',
        },
        _matchType: 'asin',
      };

      const result = bookMatcher._enhanceMatchWithLengthData(
        match,
        'audiobook',
        'asin',
      );

      assert.strictEqual(result.edition.id, 'ed-1');
      assert.strictEqual(result._editionUpgraded, undefined);
    });

    it('should return original match when it already has pages', () => {
      const match = {
        userBook: {
          book: {
            id: 'book-1',
            editions: [
              {
                id: 'ed-1',
                pages: 300,
                format: 'ebook',
              },
            ],
          },
        },
        edition: {
          id: 'ed-1',
          pages: 300,
          format: 'ebook',
        },
        _matchType: 'isbn',
      };

      const result = bookMatcher._enhanceMatchWithLengthData(
        match,
        'ebook',
        'isbn',
      );

      assert.strictEqual(result.edition.id, 'ed-1');
      assert.strictEqual(result._editionUpgraded, undefined);
    });

    it('should return original match when no other editions exist', () => {
      const match = {
        userBook: {
          book: {
            id: 'book-1',
            editions: [
              {
                id: 'ed-1',
                format: 'audiobook',
                // No length data
              },
            ],
          },
        },
        edition: {
          id: 'ed-1',
          format: 'audiobook',
        },
        _matchType: 'asin',
      };

      const result = bookMatcher._enhanceMatchWithLengthData(
        match,
        'audiobook',
        'asin',
      );

      assert.strictEqual(result.edition.id, 'ed-1');
      assert.strictEqual(result._editionUpgraded, undefined);
    });

    it('should return original match when all editions lack length data', () => {
      const match = {
        userBook: {
          book: {
            id: 'book-1',
            editions: [
              { id: 'ed-1', format: 'audiobook' },
              { id: 'ed-2', format: 'audiobook' },
              { id: 'ed-3', format: 'ebook' },
            ],
          },
        },
        edition: {
          id: 'ed-1',
          format: 'audiobook',
        },
        _matchType: 'asin',
      };

      const result = bookMatcher._enhanceMatchWithLengthData(
        match,
        'audiobook',
        'asin',
      );

      assert.strictEqual(result.edition.id, 'ed-1');
      assert.strictEqual(result._editionUpgraded, undefined);
    });

    it('should upgrade to edition with length data when available', () => {
      const match = {
        userBook: {
          book: {
            id: 'book-1',
            editions: [
              { id: 'ed-1', format: 'audiobook' }, // Original, no length
              { id: 'ed-2', format: 'audiobook', audio_seconds: 36000 }, // Better option
            ],
          },
        },
        edition: {
          id: 'ed-1',
          format: 'audiobook',
        },
        _matchType: 'asin',
      };

      const result = bookMatcher._enhanceMatchWithLengthData(
        match,
        'audiobook',
        'asin',
      );

      assert.strictEqual(result.edition.id, 'ed-2');
      assert.strictEqual(result.edition.audio_seconds, 36000);
      assert.strictEqual(result._editionUpgraded, true);
      assert.strictEqual(result._upgradeReason, 'length_data_enrichment');
      assert.strictEqual(result._originalEditionId, 'ed-1');
      assert.strictEqual(result._matchType, 'asin_cross_edition_enriched');
    });

    it('should handle null match gracefully', () => {
      const result = bookMatcher._enhanceMatchWithLengthData(
        null,
        'audiobook',
        'asin',
      );

      assert.strictEqual(result, null);
    });

    it('should handle match without userBook', () => {
      const match = {
        edition: { id: 'ed-1' },
        _matchType: 'asin',
      };

      const result = bookMatcher._enhanceMatchWithLengthData(
        match,
        'audiobook',
        'asin',
      );

      assert.strictEqual(result.edition.id, 'ed-1');
      assert.strictEqual(result._editionUpgraded, undefined);
    });
  });

  describe('_enhanceMatchWithLengthData() - Format Matching', () => {
    it('should prefer edition matching source format', () => {
      const match = {
        userBook: {
          book: {
            id: 'book-1',
            editions: [
              { id: 'ed-1', format: 'audiobook' }, // Original, no length
              { id: 'ed-2', format: 'ebook', pages: 300 }, // Has length, wrong format
              { id: 'ed-3', format: 'audiobook', audio_seconds: 36000 }, // Has length, right format
            ],
          },
        },
        edition: {
          id: 'ed-1',
          format: 'audiobook',
        },
        _matchType: 'asin',
      };

      const result = bookMatcher._enhanceMatchWithLengthData(
        match,
        'audiobook',
        'asin',
      );

      assert.strictEqual(result.edition.id, 'ed-3'); // Prefers audiobook
      assert.strictEqual(result.edition.audio_seconds, 36000);
    });

    it('should accept different format if it has better data quality', () => {
      const match = {
        userBook: {
          book: {
            id: 'book-1',
            editions: [
              { id: 'ed-1', format: 'audiobook' }, // Original, no length
              {
                id: 'ed-2',
                format: 'ebook',
                pages: 300,
                audio_seconds: 36000,
                asin: 'B123',
                isbn_10: '1234567890',
                isbn_13: '9781234567890',
                users_count: 5000,
              }, // Complete data
              { id: 'ed-3', format: 'audiobook', audio_seconds: 36000 }, // Minimal data
            ],
          },
        },
        edition: {
          id: 'ed-1',
          format: 'audiobook',
        },
        _matchType: 'asin',
      };

      const result = bookMatcher._enhanceMatchWithLengthData(
        match,
        'audiobook',
        'asin',
      );

      // Format match gets 40 points, but complete data can overcome that
      // ed-2: 0 (format) + 30 (both lengths) + 20 (complete) + 6 (popularity) = 56
      // ed-3: 40 (format) + 15 (one length) + 4 (minimal) + 0 (no popularity) = 59
      assert.strictEqual(result.edition.id, 'ed-3'); // Format match wins
    });
  });

  describe('_enhanceMatchWithLengthData() - Data Quality Scoring', () => {
    it('should prefer edition with both audio_seconds and pages', () => {
      const match = {
        userBook: {
          book: {
            id: 'book-1',
            editions: [
              { id: 'ed-1', format: 'audiobook' }, // Original
              { id: 'ed-2', format: 'audiobook', audio_seconds: 36000 }, // Only audio
              {
                id: 'ed-3',
                format: 'audiobook',
                audio_seconds: 36000,
                pages: 300,
              }, // Both
            ],
          },
        },
        edition: { id: 'ed-1', format: 'audiobook' },
        _matchType: 'asin',
      };

      const result = bookMatcher._enhanceMatchWithLengthData(
        match,
        'audiobook',
        'asin',
      );

      assert.strictEqual(result.edition.id, 'ed-3');
      assert.strictEqual(result.edition.audio_seconds, 36000);
      assert.strictEqual(result.edition.pages, 300);
    });

    it('should prefer more complete edition metadata', () => {
      const match = {
        userBook: {
          book: {
            id: 'book-1',
            editions: [
              { id: 'ed-1', format: 'audiobook' }, // Original
              {
                id: 'ed-2',
                format: 'audiobook',
                audio_seconds: 36000,
                // Minimal metadata
              },
              {
                id: 'ed-3',
                format: 'audiobook',
                audio_seconds: 36000,
                asin: 'B123',
                isbn_10: '1234567890',
                isbn_13: '9781234567890',
                users_count: 100,
              },
            ],
          },
        },
        edition: { id: 'ed-1', format: 'audiobook' },
        _matchType: 'asin',
      };

      const result = bookMatcher._enhanceMatchWithLengthData(
        match,
        'audiobook',
        'asin',
      );

      assert.strictEqual(result.edition.id, 'ed-3'); // More complete
    });

    it('should use popularity as tiebreaker', () => {
      const match = {
        userBook: {
          book: {
            id: 'book-1',
            editions: [
              { id: 'ed-1', format: 'audiobook' }, // Original
              {
                id: 'ed-2',
                format: 'audiobook',
                audio_seconds: 36000,
                users_count: 10,
              },
              {
                id: 'ed-3',
                format: 'audiobook',
                audio_seconds: 36000,
                users_count: 10000,
              },
            ],
          },
        },
        edition: { id: 'ed-1', format: 'audiobook' },
        _matchType: 'asin',
      };

      const result = bookMatcher._enhanceMatchWithLengthData(
        match,
        'audiobook',
        'asin',
      );

      assert.strictEqual(result.edition.id, 'ed-3'); // More popular
    });
  });

  describe('_enhanceMatchWithLengthData() - Edge Cases', () => {
    it('should handle edition with zero pages gracefully', () => {
      const match = {
        userBook: {
          book: {
            id: 'book-1',
            editions: [
              { id: 'ed-1', format: 'ebook' },
              { id: 'ed-2', format: 'ebook', pages: 0 }, // Invalid
              { id: 'ed-3', format: 'ebook', pages: 300 }, // Valid
            ],
          },
        },
        edition: { id: 'ed-1', format: 'ebook' },
        _matchType: 'isbn',
      };

      const result = bookMatcher._enhanceMatchWithLengthData(
        match,
        'ebook',
        'isbn',
      );

      assert.strictEqual(result.edition.id, 'ed-3'); // Skips zero pages
    });

    it('should handle negative length values', () => {
      const match = {
        userBook: {
          book: {
            id: 'book-1',
            editions: [
              { id: 'ed-1', format: 'audiobook' },
              { id: 'ed-2', format: 'audiobook', audio_seconds: -1000 }, // Invalid
              { id: 'ed-3', format: 'audiobook', audio_seconds: 36000 }, // Valid
            ],
          },
        },
        edition: { id: 'ed-1', format: 'audiobook' },
        _matchType: 'asin',
      };

      const result = bookMatcher._enhanceMatchWithLengthData(
        match,
        'audiobook',
        'asin',
      );

      assert.strictEqual(result.edition.id, 'ed-3');
    });

    it('should handle many editions efficiently', () => {
      const editions = [{ id: 'ed-1', format: 'audiobook' }];

      // Create 49 more editions
      for (let i = 2; i <= 50; i++) {
        editions.push({
          id: `ed-${i}`,
          format: 'audiobook',
          audio_seconds: 36000 + i,
          users_count: i * 10,
        });
      }

      const match = {
        userBook: {
          book: {
            id: 'book-1',
            editions,
          },
        },
        edition: { id: 'ed-1', format: 'audiobook' },
        _matchType: 'asin',
      };

      const startTime = Date.now();
      const result = bookMatcher._enhanceMatchWithLengthData(
        match,
        'audiobook',
        'asin',
      );
      const duration = Date.now() - startTime;

      assert.notStrictEqual(result.edition.id, 'ed-1'); // Should upgrade
      assert.ok(
        duration < 100,
        `Enhancement took ${duration}ms, should be <100ms`,
      );
    });

    it('should handle missing book object', () => {
      const match = {
        userBook: {
          // Missing book property
        },
        edition: { id: 'ed-1' },
        _matchType: 'asin',
      };

      const result = bookMatcher._enhanceMatchWithLengthData(
        match,
        'audiobook',
        'asin',
      );

      assert.strictEqual(result.edition.id, 'ed-1');
    });

    it('should handle missing editions array', () => {
      const match = {
        userBook: {
          book: {
            id: 'book-1',
            // Missing editions array
          },
        },
        edition: { id: 'ed-1' },
        _matchType: 'asin',
      };

      const result = bookMatcher._enhanceMatchWithLengthData(
        match,
        'audiobook',
        'asin',
      );

      assert.strictEqual(result.edition.id, 'ed-1');
    });
  });

  describe('_enhanceMatchWithLengthData() - Format Mismatch with Length', () => {
    it('should upgrade when current edition has length but wrong format', () => {
      const match = {
        userBook: {
          book: {
            id: 'book-1',
            editions: [
              { id: 'ed-1', format: 'ebook', pages: 300 }, // Matched, has length, wrong format
              {
                id: 'ed-2',
                format: 'audiobook',
                audio_seconds: 36000,
                users_count: 1000,
              }, // Right format with length
            ],
          },
        },
        edition: { id: 'ed-1', format: 'ebook', pages: 300 },
        _matchType: 'isbn',
      };

      const result = bookMatcher._enhanceMatchWithLengthData(
        match,
        'audiobook', // Source is audiobook
        'isbn',
      );

      assert.strictEqual(result.edition.id, 'ed-2'); // Upgraded to audiobook
      assert.strictEqual(result.edition.audio_seconds, 36000);
      assert.strictEqual(result._editionUpgraded, true);
    });

    it('should keep current edition when it has length AND format matches', () => {
      const match = {
        userBook: {
          book: {
            id: 'book-1',
            editions: [
              {
                id: 'ed-1',
                format: 'audiobook',
                audio_seconds: 36000,
                users_count: 100,
              }, // Matched, has length, right format
              {
                id: 'ed-2',
                format: 'audiobook',
                audio_seconds: 38000,
                users_count: 5000,
              }, // Also audiobook but more popular
            ],
          },
        },
        edition: {
          id: 'ed-1',
          format: 'audiobook',
          audio_seconds: 36000,
          users_count: 100,
        },
        _matchType: 'isbn',
      };

      const result = bookMatcher._enhanceMatchWithLengthData(
        match,
        'audiobook', // Source is audiobook
        'isbn',
      );

      assert.strictEqual(result.edition.id, 'ed-1'); // Keeps original (optimization)
      assert.strictEqual(result._editionUpgraded, undefined);
    });

    it('should handle the user reported scenario: Physical matched for Audiobook source', () => {
      // Real-world scenario: ISBN matches Physical edition, but source is Audiobook
      const match = {
        userBook: {
          book: {
            id: 'book-iron-gold',
            title: 'Iron Gold',
            editions: [
              {
                id: 'ed-physical',
                isbn_13: '9781501959790',
                format: 'physical',
                pages: 624,
                users_count: 500,
              }, // ISBN matched this
              {
                id: 'ed-audio',
                asin: 'B074NGJ6NK',
                format: 'audiobook',
                audio_seconds: 62568, // ~17.4 hours
                users_count: 2000,
              }, // Should upgrade to this
            ],
          },
        },
        edition: {
          id: 'ed-physical',
          isbn_13: '9781501959790',
          format: 'physical',
          pages: 624,
          users_count: 500,
        },
        _matchType: 'isbn',
      };

      // Format mapper converts 'physical' to 'text'
      bookMatcher.formatMapper = edition => {
        if (edition.format === 'physical') return 'text';
        if (edition.format === 'audiobook') return 'audiobook';
        return edition.format;
      };

      const result = bookMatcher._enhanceMatchWithLengthData(
        match,
        'audiobook', // Source from ABS is audiobook
        'isbn',
      );

      assert.strictEqual(result.edition.id, 'ed-audio'); // Upgraded to audiobook
      assert.strictEqual(result.edition.format, 'audiobook');
      assert.strictEqual(result.edition.audio_seconds, 62568);
      assert.strictEqual(result._editionUpgraded, true);
      assert.strictEqual(result._matchType, 'isbn_cross_edition_enriched');
    });

    it('should still work when Physical edition has no length', () => {
      // Original use case: no length data at all
      const match = {
        userBook: {
          book: {
            id: 'book-1',
            editions: [
              { id: 'ed-1', format: 'ebook' }, // Matched, no length
              { id: 'ed-2', format: 'ebook', pages: 300 }, // Better option, same format
            ],
          },
        },
        edition: { id: 'ed-1', format: 'ebook' },
        _matchType: 'isbn',
      };

      const result = bookMatcher._enhanceMatchWithLengthData(
        match,
        'ebook',
        'isbn',
      );

      assert.strictEqual(result.edition.id, 'ed-2'); // Upgraded for length
      assert.strictEqual(result.edition.pages, 300);
    });

    it('should handle no source format provided', () => {
      const match = {
        userBook: {
          book: {
            id: 'book-1',
            editions: [
              { id: 'ed-1', format: 'ebook', pages: 300 },
              { id: 'ed-2', format: 'audiobook', audio_seconds: 36000 },
            ],
          },
        },
        edition: { id: 'ed-1', format: 'ebook', pages: 300 },
        _matchType: 'isbn',
      };

      const result = bookMatcher._enhanceMatchWithLengthData(
        match,
        null, // No source format
        'isbn',
      );

      // Without source format, can't determine if format matches
      // Should keep original since it has length
      assert.strictEqual(result.edition.id, 'ed-1');
    });
  });

  describe('_enhanceMatchWithLengthData() - Format Mapper Integration', () => {
    it('should apply format mapper when available', () => {
      // Create matcher with format mapper
      const formatMapper = edition => {
        if (edition.reading_format) return edition.reading_format;
        return edition.format || 'unknown';
      };

      const match = {
        userBook: {
          book: {
            id: 'book-1',
            editions: [
              { id: 'ed-1', format: 'audiobook' },
              {
                id: 'ed-2',
                reading_format: 'audiobook',
                audio_seconds: 36000,
              },
            ],
          },
        },
        edition: { id: 'ed-1', format: 'audiobook' },
        _matchType: 'asin',
      };

      bookMatcher.formatMapper = formatMapper;

      const result = bookMatcher._enhanceMatchWithLengthData(
        match,
        'audiobook',
        'asin',
      );

      assert.strictEqual(result.edition.id, 'ed-2');
      assert.strictEqual(result.edition.format, 'audiobook'); // Mapper applied
    });
  });
});
