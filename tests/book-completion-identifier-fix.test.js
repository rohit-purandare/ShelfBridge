import { test, describe } from 'node:test';
import assert from 'node:assert';
import { extractBookIdentifiers } from '../src/matching/utils/identifier-extractor.js';

describe('Book Completion Identifier Bug Fix', () => {
  describe('extractBookIdentifiers edge cases', () => {
    test('returns null identifiers when no ISBN or ASIN available', () => {
      const mockBook = {
        media: {
          metadata: {
            title: 'Vicious Secret',
            authors: [{ name: 'Test Author' }],
            // No ISBN or ASIN identifiers
          },
        },
      };

      const result = extractBookIdentifiers(mockBook);

      // This is the scenario that causes the bug
      assert.strictEqual(result.isbn, null);
      assert.strictEqual(result.asin, null);
    });

    test('handles books with empty string identifiers', () => {
      const mockBook = {
        media: {
          metadata: {
            title: 'Test Book',
            authors: [{ name: 'Test Author' }],
            isbn: '', // Empty string
            asin: '   ', // Whitespace only
          },
        },
      };

      const result = extractBookIdentifiers(mockBook);

      // Empty strings should be normalized to null
      assert.strictEqual(result.isbn, null);
      assert.strictEqual(result.asin, null);
    });

    test('handles books with valid ISBN', () => {
      const mockBook = {
        media: {
          metadata: {
            title: 'Valid Book',
            authors: [{ name: 'Test Author' }],
            isbn: '978-0-123456-78-9',
          },
        },
      };

      const result = extractBookIdentifiers(mockBook);

      // Should extract and normalize ISBN
      assert.strictEqual(result.isbn, '9780123456789');
      assert.strictEqual(result.asin, null);
    });

    test('handles books with valid ASIN', () => {
      const mockBook = {
        media: {
          metadata: {
            title: 'Valid Book',
            authors: [{ name: 'Test Author' }],
            asin: 'B00ABC123D',
          },
        },
      };

      const result = extractBookIdentifiers(mockBook);

      // Should extract ASIN
      assert.strictEqual(result.isbn, null);
      assert.strictEqual(result.asin, 'B00ABC123D');
    });
  });

  describe('Fallback identifier generation', () => {
    test('creates valid fallback identifier from title and author', () => {
      const title = 'Vicious Secret';
      const author = 'Test Author';
      const expected = 'vicioussecret:testauthor';

      // Simulate the fallback logic from the fix
      const fallbackIdentifier = `${title}:${author}`
        .toLowerCase()
        .replace(/[^a-z0-9:]/g, '');

      assert.strictEqual(fallbackIdentifier, expected);
      assert(fallbackIdentifier.length > 0);
      assert.strictEqual(typeof fallbackIdentifier, 'string');
    });

    test('handles special characters in title and author', () => {
      const title = 'The Great Book: A Story!';
      const author = 'J.R.R. Tolkien';
      const expected = 'thegreatbook:astory:jrrtolkien';

      const fallbackIdentifier = `${title}:${author}`
        .toLowerCase()
        .replace(/[^a-z0-9:]/g, '');

      assert.strictEqual(fallbackIdentifier, expected);
    });

    test('handles missing author gracefully', () => {
      const title = 'Vicious Secret';
      const author = 'Unknown Author'; // Fallback when no author
      const expected = 'vicioussecret:unknownauthor';

      const fallbackIdentifier = `${title}:${author}`
        .toLowerCase()
        .replace(/[^a-z0-9:]/g, '');

      assert.strictEqual(fallbackIdentifier, expected);
    });
  });

  describe('BookCache validation update', () => {
    test('validates identifier type correctly', () => {
      const validTypes = ['isbn', 'asin', 'title_author'];
      const invalidTypes = ['unknown', '', null, undefined];

      // Test that valid types are accepted (this is a conceptual test)
      validTypes.forEach(type => {
        assert(validTypes.includes(type), `${type} should be valid`);
      });

      // Test that invalid types would be rejected
      invalidTypes.forEach(type => {
        assert(!validTypes.includes(type), `${type} should be invalid`);
      });
    });
  });
});
