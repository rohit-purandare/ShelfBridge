import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AsinMatcher } from '../src/matching/strategies/asin-matcher.js';

/**
 * Tests for ASIN Cross-Edition Audiobook Fix
 *
 * This test suite verifies that when the ASIN matcher performs cross-edition matching
 * (finding a different edition of the same book), it returns the full edition object
 * including audio_seconds field, which is critical for proper format detection.
 *
 * Bug Context:
 * Previously, cross-edition matching returned a minimal edition object with only {id, format},
 * which caused the progress update logging to incorrectly show format="text" for audiobooks
 * because it checks edition.audio_seconds to determine if it's an audiobook.
 */

describe('ASIN Cross-Edition Audiobook Fix', () => {
  describe('Cross-Edition Match Returns Full Edition Object', () => {
    it('should return full edition object with audio_seconds for audiobook', async () => {
      // Mock Hardcover client that simulates ASIN search
      const mockHardcoverClient = {
        searchBooksByAsin: async asin => {
          if (asin === 'B00TEST123') {
            return [
              {
                book: {
                  id: 'book-123',
                  title: 'The Fellowship of the Ring',
                },
                id: 'edition-audiobook',
                asin: 'B00TEST123',
                audio_seconds: 45000, // This is critical!
                reading_format: { format: 'Listened' },
              },
            ];
          }
          return [];
        },
      };

      // Mock function to find user books by book ID
      const findUserBookByBookId = bookId => {
        if (bookId === 'book-123') {
          return {
            id: 'userbook-456',
            book: {
              id: 'book-123',
              title: 'The Fellowship of the Ring',
              editions: [
                {
                  id: 'edition-text',
                  asin: 'B00DIFFERENT',
                  pages: 500,
                  reading_format: { format: 'Read' },
                  // This edition has NO audio_seconds because it's a text edition
                },
                {
                  id: 'edition-audiobook',
                  asin: 'B00TEST123',
                  audio_seconds: 45000, // Full edition has this!
                  reading_format: { format: 'Listened' },
                },
              ],
            },
          };
        }
        return null;
      };

      const matcher = new AsinMatcher(mockHardcoverClient);

      const absBook = {
        media: {
          metadata: {
            title: 'The Fellowship of the Ring',
            asin: 'B00TEST123',
          },
        },
      };

      const identifiers = { asin: 'B00TEST123' };
      const identifierLookup = {}; // ASIN not in lookup, will trigger cross-edition search

      const result = await matcher.findMatch(
        absBook,
        identifiers,
        identifierLookup,
        findUserBookByBookId,
      );

      // Verify the result
      assert.ok(result, 'Should return a match');
      assert.strictEqual(result._matchType, 'asin_cross_edition');
      assert.strictEqual(result.userBook.id, 'userbook-456');

      // THE KEY FIX: Edition should have audio_seconds field
      assert.ok(result.edition, 'Should have edition object');
      assert.strictEqual(
        result.edition.id,
        'edition-audiobook',
        'Should match the audiobook edition',
      );
      assert.strictEqual(
        result.edition.audio_seconds,
        45000,
        'Should have audio_seconds from the full edition object',
      );

      // Should also have other edition fields
      assert.ok(result.edition.reading_format, 'Should have reading_format');
      assert.strictEqual(
        result.edition.reading_format.format,
        'Listened',
        'Should have the correct reading format',
      );
    });

    it('should return full edition object for text edition (no audio_seconds)', async () => {
      const mockHardcoverClient = {
        searchBooksByAsin: async asin => {
          if (asin === 'B00TEXT456') {
            return [
              {
                book: {
                  id: 'book-456',
                  title: 'The Two Towers',
                },
                id: 'edition-paperback',
                asin: 'B00TEXT456',
                pages: 400,
                reading_format: { format: 'Read' },
                // No audio_seconds for text edition
              },
            ];
          }
          return [];
        },
      };

      const findUserBookByBookId = bookId => {
        if (bookId === 'book-456') {
          return {
            id: 'userbook-789',
            book: {
              id: 'book-456',
              title: 'The Two Towers',
              editions: [
                {
                  id: 'edition-paperback',
                  asin: 'B00TEXT456',
                  pages: 400,
                  reading_format: { format: 'Read' },
                  // Text edition - no audio_seconds
                },
              ],
            },
          };
        }
        return null;
      };

      const matcher = new AsinMatcher(mockHardcoverClient);

      const absBook = {
        media: {
          metadata: {
            title: 'The Two Towers',
            asin: 'B00TEXT456',
          },
        },
      };

      const identifiers = { asin: 'B00TEXT456' };
      const identifierLookup = {};

      const result = await matcher.findMatch(
        absBook,
        identifiers,
        identifierLookup,
        findUserBookByBookId,
      );

      assert.ok(result, 'Should return a match');
      assert.strictEqual(result._matchType, 'asin_cross_edition');

      // Verify full edition object is returned
      assert.strictEqual(result.edition.id, 'edition-paperback');
      assert.strictEqual(result.edition.pages, 400);
      assert.strictEqual(result.edition.reading_format.format, 'Read');
      // Should NOT have audio_seconds (text edition)
      assert.strictEqual(result.edition.audio_seconds, undefined);
    });

    it('should handle edition with multiple fields correctly', async () => {
      const mockHardcoverClient = {
        searchBooksByAsin: async asin => {
          if (asin === 'B00FULL789') {
            return [
              {
                book: {
                  id: 'book-789',
                  title: 'A Complex Book',
                },
                id: 'edition-full',
                asin: 'B00FULL789',
              },
            ];
          }
          return [];
        },
      };

      const findUserBookByBookId = bookId => {
        if (bookId === 'book-789') {
          return {
            id: 'userbook-999',
            book: {
              id: 'book-789',
              title: 'A Complex Book',
              editions: [
                {
                  id: 'edition-full',
                  asin: 'B00FULL789',
                  isbn_10: '1234567890',
                  isbn_13: '9781234567890',
                  pages: 350,
                  audio_seconds: 38000,
                  reading_format: { format: 'Listened' },
                  release_date: '2024-01-15',
                  publisher: 'Test Publisher',
                  language: 'en',
                },
              ],
            },
          };
        }
        return null;
      };

      const matcher = new AsinMatcher(mockHardcoverClient);

      const absBook = {
        media: {
          metadata: {
            title: 'A Complex Book',
            asin: 'B00FULL789',
          },
        },
      };

      const identifiers = { asin: 'B00FULL789' };
      const identifierLookup = {};

      const result = await matcher.findMatch(
        absBook,
        identifiers,
        identifierLookup,
        findUserBookByBookId,
      );

      assert.ok(result, 'Should return a match');
      assert.strictEqual(result._matchType, 'asin_cross_edition');

      // Verify ALL fields from the full edition are present
      const edition = result.edition;
      assert.strictEqual(edition.id, 'edition-full');
      assert.strictEqual(edition.asin, 'B00FULL789');
      assert.strictEqual(edition.isbn_10, '1234567890');
      assert.strictEqual(edition.isbn_13, '9781234567890');
      assert.strictEqual(edition.pages, 350);
      assert.strictEqual(edition.audio_seconds, 38000);
      assert.strictEqual(edition.reading_format.format, 'Listened');
      assert.strictEqual(edition.release_date, '2024-01-15');
      assert.strictEqual(edition.publisher, 'Test Publisher');
      assert.strictEqual(edition.language, 'en');
    });
  });

  describe('Format Detection Logic Verification', () => {
    it('should allow correct format detection with audio_seconds present', async () => {
      // This test verifies that the format detection logic (used in progress logging)
      // will work correctly with our fix

      const mockHardcoverClient = {
        searchBooksByAsin: async asin => {
          return [
            {
              book: { id: 'book-001', title: 'Test Book' },
              id: 'edition-001',
            },
          ];
        },
      };

      const findUserBookByBookId = bookId => {
        return {
          id: 'userbook-001',
          book: {
            id: 'book-001',
            title: 'Test Book',
            editions: [
              {
                id: 'edition-001',
                asin: 'B00AUDIO001',
                audio_seconds: 50000,
              },
            ],
          },
        };
      };

      const matcher = new AsinMatcher(mockHardcoverClient);
      const result = await matcher.findMatch(
        { media: { metadata: { title: 'Test Book', asin: 'B00AUDIO001' } } },
        { asin: 'B00AUDIO001' },
        {},
        findUserBookByBookId,
      );

      // Simulate the format detection logic from sync-manager.js:2597
      const format = result.edition.audio_seconds ? 'audiobook' : 'text';

      assert.strictEqual(
        format,
        'audiobook',
        'Format should be detected as audiobook when audio_seconds is present',
      );
    });

    it('should allow correct format detection for text editions', async () => {
      const mockHardcoverClient = {
        searchBooksByAsin: async asin => {
          return [
            {
              book: { id: 'book-002', title: 'Text Book' },
              id: 'edition-002',
            },
          ];
        },
      };

      const findUserBookByBookId = bookId => {
        return {
          id: 'userbook-002',
          book: {
            id: 'book-002',
            title: 'Text Book',
            editions: [
              {
                id: 'edition-002',
                asin: 'B00TEXT002',
                pages: 300,
                // No audio_seconds
              },
            ],
          },
        };
      };

      const matcher = new AsinMatcher(mockHardcoverClient);
      const result = await matcher.findMatch(
        { media: { metadata: { title: 'Text Book', asin: 'B00TEXT002' } } },
        { asin: 'B00TEXT002' },
        {},
        findUserBookByBookId,
      );

      // Simulate the format detection logic
      const format = result.edition.audio_seconds ? 'audiobook' : 'text';

      assert.strictEqual(
        format,
        'text',
        'Format should be detected as text when audio_seconds is not present',
      );
    });
  });

  describe('Backwards Compatibility', () => {
    it('should still work when no cross-edition search is needed', async () => {
      // Test that direct ASIN matches still work as before
      const mockHardcoverClient = {
        searchBooksByAsin: async () => [],
      };

      const matcher = new AsinMatcher(mockHardcoverClient);

      // When ASIN is in the identifier lookup, it returns directly
      const identifierLookup = {
        B00DIRECT123: {
          userBook: { id: 'userbook-direct', book: { title: 'Direct Match' } },
          edition: {
            id: 'edition-direct',
            asin: 'B00DIRECT123',
            audio_seconds: 40000,
          },
        },
      };

      const result = await matcher.findMatch(
        {
          media: { metadata: { title: 'Direct Match', asin: 'B00DIRECT123' } },
        },
        { asin: 'B00DIRECT123' },
        identifierLookup,
        null,
      );

      assert.ok(result, 'Should return a match');
      assert.strictEqual(result._matchType, 'asin');
      assert.strictEqual(result.edition.audio_seconds, 40000);
    });

    it('should return null when no match is found', async () => {
      const mockHardcoverClient = {
        searchBooksByAsin: async () => [],
      };

      const findUserBookByBookId = () => null;

      const matcher = new AsinMatcher(mockHardcoverClient);

      const result = await matcher.findMatch(
        { media: { metadata: { title: 'No Match', asin: 'B00NOMATCH' } } },
        { asin: 'B00NOMATCH' },
        {},
        findUserBookByBookId,
      );

      assert.strictEqual(
        result,
        null,
        'Should return null when no match found',
      );
    });

    it('should handle missing ASIN gracefully', async () => {
      const matcher = new AsinMatcher();

      const result = await matcher.findMatch(
        { media: { metadata: { title: 'No ASIN Book' } } },
        { asin: null },
        {},
        null,
      );

      assert.strictEqual(
        result,
        null,
        'Should return null when ASIN is not available',
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle first edition when multiple editions exist', async () => {
      const mockHardcoverClient = {
        searchBooksByAsin: async () => [
          { book: { id: 'book-multi' }, id: 'edition-search' },
        ],
      };

      const findUserBookByBookId = () => ({
        id: 'userbook-multi',
        book: {
          id: 'book-multi',
          title: 'Multi Edition Book',
          editions: [
            {
              id: 'edition-first',
              asin: 'B00FIRST',
              audio_seconds: 30000,
              reading_format: { format: 'Listened' },
            },
            {
              id: 'edition-second',
              asin: 'B00SECOND',
              pages: 250,
              reading_format: { format: 'Read' },
            },
          ],
        },
      });

      const matcher = new AsinMatcher(mockHardcoverClient);
      const result = await matcher.findMatch(
        {
          media: {
            metadata: { title: 'Multi Edition Book', asin: 'B00SEARCH' },
          },
        },
        { asin: 'B00SEARCH' },
        {},
        findUserBookByBookId,
      );

      assert.ok(result, 'Should return a match');
      // Should return the FIRST edition (preferred)
      assert.strictEqual(result.edition.id, 'edition-first');
      assert.strictEqual(result.edition.audio_seconds, 30000);
    });

    it('should handle edition with undefined/null fields', async () => {
      const mockHardcoverClient = {
        searchBooksByAsin: async () => [
          { book: { id: 'book-sparse' }, id: 'edition-sparse' },
        ],
      };

      const findUserBookByBookId = () => ({
        id: 'userbook-sparse',
        book: {
          id: 'book-sparse',
          title: 'Sparse Edition',
          editions: [
            {
              id: 'edition-sparse',
              asin: 'B00SPARSE',
              // Only minimal fields
              pages: null,
              audio_seconds: undefined,
              reading_format: null,
            },
          ],
        },
      });

      const matcher = new AsinMatcher(mockHardcoverClient);
      const result = await matcher.findMatch(
        { media: { metadata: { title: 'Sparse Edition', asin: 'B00SPARSE' } } },
        { asin: 'B00SPARSE' },
        {},
        findUserBookByBookId,
      );

      assert.ok(result, 'Should return a match even with sparse data');
      assert.strictEqual(result.edition.id, 'edition-sparse');
      assert.strictEqual(result.edition.pages, null);
      assert.strictEqual(result.edition.audio_seconds, undefined);
    });
  });
});
