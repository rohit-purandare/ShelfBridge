import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { CacheKeyGenerator } from '../src/sync/utils/CacheKeyGenerator.js';

/**
 * Comprehensive unit tests for CacheKeyGenerator
 *
 * Tests all extracted functionality from SyncManager:
 * - generatePossibleKeys() - extracted from multi-key cache lookup logic
 * - generateStorageKey() - extracted from storage key selection logic
 * - generateFallbackKey() - extracted from fallback identifier generation
 * - generateSyntheticKey() - extracted from title/author synthetic key logic
 * - Key validation and normalization methods
 *
 * Each test verifies the exact same behavior as the original SyncManager methods
 */

describe('CacheKeyGenerator', () => {
  let mockIdentifiers, mockHardcoverMatch;

  beforeEach(() => {
    mockIdentifiers = {
      isbn: '978-0123456789',
      asin: 'B001234567',
    };

    mockHardcoverMatch = {
      userBook: { id: 'user-book-123' },
      edition: { id: 'edition-456' },
    };
  });

  describe('generatePossibleKeys()', () => {
    it('should generate keys in correct priority order with all identifiers', () => {
      const keys = CacheKeyGenerator.generatePossibleKeys(
        mockIdentifiers,
        mockHardcoverMatch,
      );

      assert.strictEqual(keys.length, 3, 'Should generate 3 keys');

      // Check ASIN key (highest priority)
      assert.strictEqual(keys[0].key, 'B001234567', 'First key should be ASIN');
      assert.strictEqual(keys[0].type, 'asin', 'First key type should be asin');
      assert.strictEqual(keys[0].priority, 1, 'ASIN should have priority 1');

      // Check ISBN key (second priority)
      assert.strictEqual(
        keys[1].key,
        '978-0123456789',
        'Second key should be ISBN',
      );
      assert.strictEqual(
        keys[1].type,
        'isbn',
        'Second key type should be isbn',
      );
      assert.strictEqual(keys[1].priority, 2, 'ISBN should have priority 2');

      // Check title/author key (lowest priority)
      assert.strictEqual(
        keys[2].key,
        'title_author_user-book-123_edition-456',
        'Third key should be title/author',
      );
      assert.strictEqual(
        keys[2].type,
        'title_author',
        'Third key type should be title_author',
      );
      assert.strictEqual(
        keys[2].priority,
        3,
        'Title/author should have priority 3',
      );
    });

    it('should handle missing ASIN identifier', () => {
      const identifiersWithoutAsin = { isbn: '978-0123456789' };
      const keys = CacheKeyGenerator.generatePossibleKeys(
        identifiersWithoutAsin,
        mockHardcoverMatch,
      );

      assert.strictEqual(keys.length, 2, 'Should generate 2 keys without ASIN');
      assert.strictEqual(keys[0].type, 'isbn', 'First key should be ISBN');
      assert.strictEqual(
        keys[1].type,
        'title_author',
        'Second key should be title_author',
      );
    });

    it('should handle missing ISBN identifier', () => {
      const identifiersWithoutIsbn = { asin: 'B001234567' };
      const keys = CacheKeyGenerator.generatePossibleKeys(
        identifiersWithoutIsbn,
        mockHardcoverMatch,
      );

      assert.strictEqual(keys.length, 2, 'Should generate 2 keys without ISBN');
      assert.strictEqual(keys[0].type, 'asin', 'First key should be ASIN');
      assert.strictEqual(
        keys[1].type,
        'title_author',
        'Second key should be title_author',
      );
    });

    it('should handle missing hardcover match', () => {
      const keys = CacheKeyGenerator.generatePossibleKeys(
        mockIdentifiers,
        null,
      );

      assert.strictEqual(
        keys.length,
        2,
        'Should generate 2 keys without hardcover match',
      );
      assert.strictEqual(keys[0].type, 'asin', 'First key should be ASIN');
      assert.strictEqual(keys[1].type, 'isbn', 'Second key should be ISBN');
    });

    it('should handle completely empty inputs', () => {
      const keys = CacheKeyGenerator.generatePossibleKeys({}, null);

      assert.strictEqual(
        keys.length,
        0,
        'Should generate no keys with empty inputs',
      );
    });

    it('should handle malformed hardcover match', () => {
      const malformedMatch = { userBook: { id: null }, edition: null };
      const keys = CacheKeyGenerator.generatePossibleKeys(
        mockIdentifiers,
        malformedMatch,
      );

      assert.strictEqual(
        keys.length,
        2,
        'Should only generate identifier keys with malformed match',
      );
      assert.strictEqual(keys[0].type, 'asin', 'Should still include ASIN');
      assert.strictEqual(keys[1].type, 'isbn', 'Should still include ISBN');
    });
  });

  describe('generateStorageKey()', () => {
    it('should prefer ASIN over ISBN for storage', () => {
      const result = CacheKeyGenerator.generateStorageKey(
        mockIdentifiers,
        mockHardcoverMatch,
      );

      assert.strictEqual(result.identifier, 'B001234567', 'Should choose ASIN');
      assert.strictEqual(
        result.identifierType,
        'asin',
        'Should set type to asin',
      );
    });

    it('should use ISBN when ASIN is not available', () => {
      const identifiersWithoutAsin = { isbn: '978-0123456789' };
      const result = CacheKeyGenerator.generateStorageKey(
        identifiersWithoutAsin,
        mockHardcoverMatch,
      );

      assert.strictEqual(
        result.identifier,
        '978-0123456789',
        'Should choose ISBN',
      );
      assert.strictEqual(
        result.identifierType,
        'isbn',
        'Should set type to isbn',
      );
    });

    it('should fall back to title/author key when no identifiers available', () => {
      const result = CacheKeyGenerator.generateStorageKey(
        {},
        mockHardcoverMatch,
      );

      assert.strictEqual(
        result.identifier,
        'title_author_user-book-123_edition-456',
        'Should generate title/author key',
      );
      assert.strictEqual(
        result.identifierType,
        'title_author',
        'Should set type to title_author',
      );
    });

    it('should return null when no valid identifiers or match available', () => {
      const result = CacheKeyGenerator.generateStorageKey({}, null);

      assert.strictEqual(
        result,
        null,
        'Should return null with no valid inputs',
      );
    });

    it('should handle undefined/null identifiers gracefully', () => {
      const result = CacheKeyGenerator.generateStorageKey(
        null,
        mockHardcoverMatch,
      );

      assert.strictEqual(
        result.identifier,
        'title_author_user-book-123_edition-456',
        'Should fall back to title/author',
      );
      assert.strictEqual(
        result.identifierType,
        'title_author',
        'Should set correct type',
      );
    });
  });

  describe('generateFallbackKey()', () => {
    it('should create normalized fallback key from title and author', () => {
      const result = CacheKeyGenerator.generateFallbackKey(
        'The Great Gatsby',
        'F. Scott Fitzgerald',
      );

      // Should be lowercase, alphanumeric plus colon only
      assert.strictEqual(
        result,
        'thegreatgatsby:fscottfitzgerald',
        'Should normalize to clean format',
      );
    });

    it('should handle special characters and spaces', () => {
      const result = CacheKeyGenerator.generateFallbackKey(
        'A Book with Special!@#$ Characters',
        'An Author (with) brackets',
      );

      // Should strip special characters but keep colon separator
      const expected = 'abookwithspecialcharacters:anauthorwithbrackets';
      assert.strictEqual(result, expected, 'Should strip special characters');
    });

    it('should handle missing author', () => {
      const result = CacheKeyGenerator.generateFallbackKey('Solo Title', '');

      assert.strictEqual(
        result,
        'solotitle:',
        'Should handle missing author gracefully',
      );
    });

    it('should handle missing title', () => {
      const result = CacheKeyGenerator.generateFallbackKey('', 'Solo Author');

      assert.strictEqual(
        result,
        ':soloauthor',
        'Should handle missing title gracefully',
      );
    });

    it('should handle null/undefined inputs', () => {
      const result1 = CacheKeyGenerator.generateFallbackKey(null, null);
      const result2 = CacheKeyGenerator.generateFallbackKey(
        undefined,
        undefined,
      );

      assert.strictEqual(
        result1,
        'unknown:unknown',
        'Should handle null inputs',
      );
      assert.strictEqual(
        result2,
        'unknown:unknown',
        'Should handle undefined inputs',
      );
    });
  });

  describe('generateSyntheticKey()', () => {
    it('should create proper synthetic key from user book and edition IDs', () => {
      const result = CacheKeyGenerator.generateSyntheticKey(
        'user-123',
        'edition-456',
      );

      assert.strictEqual(
        result.identifierType,
        'title_author',
        'Should set correct type',
      );
      assert.strictEqual(
        result.identifierValue,
        'title_author_user-123_edition-456',
        'Should format correctly',
      );
    });

    it('should handle missing user book ID', () => {
      const result = CacheKeyGenerator.generateSyntheticKey(
        null,
        'edition-456',
      );

      assert.strictEqual(
        result.identifierValue,
        'title_author_unknown_edition-456',
        'Should handle missing user book ID',
      );
    });

    it('should handle missing edition ID', () => {
      const result = CacheKeyGenerator.generateSyntheticKey('user-123', null);

      assert.strictEqual(
        result.identifierValue,
        'title_author_user-123_unknown',
        'Should handle missing edition ID',
      );
    });

    it('should handle both IDs missing', () => {
      const result = CacheKeyGenerator.generateSyntheticKey(null, null);

      assert.strictEqual(
        result.identifierValue,
        'title_author_unknown_unknown',
        'Should handle both IDs missing',
      );
    });
  });

  describe('isValidCacheKey()', () => {
    it('should validate ASIN keys correctly', () => {
      assert.strictEqual(
        CacheKeyGenerator.isValidCacheKey('B001234567', 'asin'),
        true,
        'Valid ASIN should pass',
      );
      assert.strictEqual(
        CacheKeyGenerator.isValidCacheKey('123456789A', 'asin'),
        true,
        'Valid ASIN with numbers should pass',
      );
      assert.strictEqual(
        CacheKeyGenerator.isValidCacheKey('B00123456', 'asin'),
        false,
        'Short ASIN should fail',
      );
      assert.strictEqual(
        CacheKeyGenerator.isValidCacheKey('B001234567X', 'asin'),
        false,
        'Long ASIN should fail',
      );
      assert.strictEqual(
        CacheKeyGenerator.isValidCacheKey('B001234-67', 'asin'),
        false,
        'ASIN with special chars should fail',
      );
    });

    it('should validate ISBN keys correctly', () => {
      assert.strictEqual(
        CacheKeyGenerator.isValidCacheKey('1234567890', 'isbn'),
        true,
        'Valid ISBN-10 should pass',
      );
      assert.strictEqual(
        CacheKeyGenerator.isValidCacheKey('1234567890123', 'isbn'),
        true,
        'Valid ISBN-13 should pass',
      );
      assert.strictEqual(
        CacheKeyGenerator.isValidCacheKey('978-0123456789', 'isbn'),
        true,
        'ISBN with hyphens should pass',
      );
      assert.strictEqual(
        CacheKeyGenerator.isValidCacheKey('978 0123456789', 'isbn'),
        true,
        'ISBN with spaces should pass',
      );
      assert.strictEqual(
        CacheKeyGenerator.isValidCacheKey('123456789', 'isbn'),
        false,
        'Short ISBN should fail',
      );
      assert.strictEqual(
        CacheKeyGenerator.isValidCacheKey('12345678901234', 'isbn'),
        false,
        'Long ISBN should fail',
      );
      assert.strictEqual(
        CacheKeyGenerator.isValidCacheKey('123456789X', 'isbn'),
        false,
        'ISBN with letters should fail',
      );
    });

    it('should validate title_author keys correctly', () => {
      assert.strictEqual(
        CacheKeyGenerator.isValidCacheKey(
          'title_author_123_456',
          'title_author',
        ),
        true,
        'Valid title_author key should pass',
      );
      assert.strictEqual(
        CacheKeyGenerator.isValidCacheKey(
          'title_author_user-book-123_edition-456',
          'title_author',
        ),
        true,
        'Complex title_author key should pass',
      );
      assert.strictEqual(
        CacheKeyGenerator.isValidCacheKey('title_author_', 'title_author'),
        false,
        'Empty title_author key should fail',
      );
      assert.strictEqual(
        CacheKeyGenerator.isValidCacheKey(
          'wrong_prefix_123_456',
          'title_author',
        ),
        false,
        'Wrong prefix should fail',
      );
      assert.strictEqual(
        CacheKeyGenerator.isValidCacheKey('title_author', 'title_author'),
        false,
        'Too short title_author key should fail',
      );
    });

    it('should reject invalid keys', () => {
      assert.strictEqual(
        CacheKeyGenerator.isValidCacheKey('', 'asin'),
        false,
        'Empty string should fail',
      );
      assert.strictEqual(
        CacheKeyGenerator.isValidCacheKey(null, 'asin'),
        false,
        'Null should fail',
      );
      assert.strictEqual(
        CacheKeyGenerator.isValidCacheKey(undefined, 'asin'),
        false,
        'Undefined should fail',
      );
      assert.strictEqual(
        CacheKeyGenerator.isValidCacheKey('   ', 'asin'),
        false,
        'Whitespace only should fail',
      );
    });
  });

  describe('normalizeIdentifier()', () => {
    it('should normalize ASIN to uppercase', () => {
      const result = CacheKeyGenerator.normalizeIdentifier(
        'b001234567',
        'asin',
      );
      assert.strictEqual(result, 'B001234567', 'ASIN should be uppercase');
    });

    it('should normalize ISBN by removing hyphens and spaces', () => {
      const result1 = CacheKeyGenerator.normalizeIdentifier(
        '978-0-123-45678-9',
        'isbn',
      );
      const result2 = CacheKeyGenerator.normalizeIdentifier(
        '978 0 123 45678 9',
        'isbn',
      );

      assert.strictEqual(
        result1,
        '9780123456789',
        'Should remove hyphens from ISBN',
      );
      assert.strictEqual(
        result2,
        '9780123456789',
        'Should remove spaces from ISBN',
      );
    });

    it('should preserve title_author keys as-is', () => {
      const original = 'title_author_user-123_edition-456';
      const result = CacheKeyGenerator.normalizeIdentifier(
        original,
        'title_author',
      );

      assert.strictEqual(
        result,
        original,
        'Title/author keys should remain unchanged',
      );
    });

    it('should handle unknown types by trimming', () => {
      const result = CacheKeyGenerator.normalizeIdentifier(
        '  some_key  ',
        'unknown',
      );
      assert.strictEqual(result, 'some_key', 'Unknown types should be trimmed');
    });

    it('should handle invalid inputs gracefully', () => {
      assert.strictEqual(
        CacheKeyGenerator.normalizeIdentifier(null, 'asin'),
        null,
        'Null should return null',
      );
      assert.strictEqual(
        CacheKeyGenerator.normalizeIdentifier(undefined, 'asin'),
        undefined,
        'Undefined should return undefined',
      );
      assert.strictEqual(
        CacheKeyGenerator.normalizeIdentifier(123, 'asin'),
        123,
        'Non-string should return as-is',
      );
    });
  });

  describe('getKeyPriority()', () => {
    it('should return correct priorities', () => {
      assert.strictEqual(
        CacheKeyGenerator.getKeyPriority('asin'),
        1,
        'ASIN should have highest priority',
      );
      assert.strictEqual(
        CacheKeyGenerator.getKeyPriority('isbn'),
        2,
        'ISBN should have second priority',
      );
      assert.strictEqual(
        CacheKeyGenerator.getKeyPriority('title_author'),
        3,
        'Title/author should have third priority',
      );
      assert.strictEqual(
        CacheKeyGenerator.getKeyPriority('unknown'),
        999,
        'Unknown should have lowest priority',
      );
    });
  });

  describe('generateKeysFromBook()', () => {
    it('should extract identifiers and generate keys', () => {
      const mockBook = {
        id: 'book-123',
        media: {
          metadata: {
            isbn: '978-0123456789',
            asin: 'B001234567',
          },
        },
      };

      const keys = CacheKeyGenerator.generateKeysFromBook(
        mockBook,
        mockHardcoverMatch,
      );

      assert(keys.length > 0, 'Should generate keys from book data');
      assert(
        keys.some(k => k.type === 'asin'),
        'Should include ASIN key',
      );
      assert(
        keys.some(k => k.type === 'isbn'),
        'Should include ISBN key',
      );
    });

    it('should handle books without metadata', () => {
      const mockBook = { id: 'book-123' };

      const keys = CacheKeyGenerator.generateKeysFromBook(
        mockBook,
        mockHardcoverMatch,
      );

      // Should still generate title_author key if hardcover match exists
      assert(
        keys.some(k => k.type === 'title_author'),
        'Should generate title_author key as fallback',
      );
    });

    it('should handle null book gracefully', () => {
      const keys = CacheKeyGenerator.generateKeysFromBook(
        null,
        mockHardcoverMatch,
      );

      assert.strictEqual(
        keys.length,
        1,
        'Should generate only title_author key',
      );
      assert.strictEqual(
        keys[0].type,
        'title_author',
        'Should be title_author type',
      );
    });
  });

  describe('Integration with SyncManager patterns', () => {
    it('should match original SyncManager multi-key cache lookup behavior', () => {
      // This test replicates the exact logic from SyncManager._syncSingleBook
      const identifiers = { asin: 'B001234567', isbn: '978-0123456789' };
      const hardcoverMatch = {
        userBook: { id: 'user-123' },
        edition: { id: 'edition-456' },
      };

      // Original SyncManager logic (lines 768-783)
      const originalPossibleCacheKeys = [];
      if (identifiers.asin) {
        originalPossibleCacheKeys.push({ key: identifiers.asin, type: 'asin' });
      }
      if (identifiers.isbn) {
        originalPossibleCacheKeys.push({ key: identifiers.isbn, type: 'isbn' });
      }
      if (hardcoverMatch.userBook?.id && hardcoverMatch.edition?.id) {
        const titleAuthorKey = `title_author_${hardcoverMatch.userBook.id}_${hardcoverMatch.edition.id}`;
        originalPossibleCacheKeys.push({
          key: titleAuthorKey,
          type: 'title_author',
        });
      }

      // New CacheKeyGenerator logic
      const newKeys = CacheKeyGenerator.generatePossibleKeys(
        identifiers,
        hardcoverMatch,
      );

      // Verify same keys are generated (ignoring priority field which is new)
      assert.strictEqual(
        newKeys.length,
        originalPossibleCacheKeys.length,
        'Should generate same number of keys',
      );

      for (let i = 0; i < originalPossibleCacheKeys.length; i++) {
        const originalKey = originalPossibleCacheKeys[i];
        const newKey = newKeys.find(k => k.type === originalKey.type);

        assert(newKey, `Should find matching key of type ${originalKey.type}`);
        assert.strictEqual(
          newKey.key,
          originalKey.key,
          `Key content should match for type ${originalKey.type}`,
        );
      }
    });

    it('should match original SyncManager storage key selection behavior', () => {
      // This test replicates the exact logic from SyncManager._syncSingleBook lines 834-842
      const identifiers = { asin: 'B001234567', isbn: '978-0123456789' };
      const hardcoverMatch = {
        userBook: { id: 'user-123' },
        edition: { id: 'edition-456' },
      };

      // Original SyncManager logic
      let originalIdentifier = identifiers.asin || identifiers.isbn;
      let originalIdentifierType = identifiers.asin ? 'asin' : 'isbn';

      if (!originalIdentifier && hardcoverMatch) {
        originalIdentifier = `title_author_${hardcoverMatch.userBook?.id}_${hardcoverMatch.edition?.id}`;
        originalIdentifierType = 'title_author';
      }

      // New CacheKeyGenerator logic
      const newResult = CacheKeyGenerator.generateStorageKey(
        identifiers,
        hardcoverMatch,
      );

      assert.strictEqual(
        newResult.identifier,
        originalIdentifier,
        'Storage identifier should match original',
      );
      assert.strictEqual(
        newResult.identifierType,
        originalIdentifierType,
        'Storage type should match original',
      );
    });
  });
});
