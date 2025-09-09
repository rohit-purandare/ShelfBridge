import logger from '../../logger.js';

/**
 * CacheKeyGenerator - Centralized cache key generation utility
 *
 * Extracted from SyncManager to follow DRY principles and Single Responsibility Principle.
 * Handles all cache key generation operations for sync operations.
 *
 * Key functions:
 * - Multi-key cache lookup generation
 * - Identifier-based key generation
 * - Title/author-based key generation for fallback scenarios
 * - Consistent key prioritization (ASIN > ISBN > title_author)
 */
export class CacheKeyGenerator {
  /**
   * Generate all possible cache keys for a book
   * Extracted from SyncManager._syncSingleBook() lines 766-783
   *
   * @param {Object} identifiers - Book identifiers (isbn, asin)
   * @param {Object} hardcoverMatch - Hardcover match object
   * @returns {Array<{key: string, type: string}>} - Array of cache keys in priority order
   */
  static generatePossibleKeys(identifiers, hardcoverMatch) {
    const possibleCacheKeys = [];

    try {
      // Add identifier-based keys (highest priority)
      if (identifiers?.asin) {
        possibleCacheKeys.push({
          key: identifiers.asin,
          type: 'asin',
          priority: 1,
        });
      }

      if (identifiers?.isbn) {
        possibleCacheKeys.push({
          key: identifiers.isbn,
          type: 'isbn',
          priority: 2,
        });
      }

      // Add title/author key if we have a match (fallback)
      if (hardcoverMatch?.userBook?.id && hardcoverMatch?.edition?.id) {
        const titleAuthorKey = `title_author_${hardcoverMatch.userBook.id}_${hardcoverMatch.edition.id}`;
        possibleCacheKeys.push({
          key: titleAuthorKey,
          type: 'title_author',
          priority: 3,
        });
      }

      // Sort by priority to ensure consistent ordering
      possibleCacheKeys.sort((a, b) => a.priority - b.priority);

      logger.debug('Generated cache keys', {
        totalKeys: possibleCacheKeys.length,
        keys: possibleCacheKeys.map(
          k => `${k.type}:${k.key.substring(0, 20)}...`,
        ),
      });
    } catch (error) {
      logger.error('Error generating cache keys', {
        error: error.message,
        identifiers: identifiers,
        hasMatch: !!hardcoverMatch,
      });
      return [];
    }

    return possibleCacheKeys;
  }

  /**
   * Generate cache key for storage operations
   * Determines the best identifier in priority order: ASIN > ISBN > title_author
   * Extracted from SyncManager._syncSingleBook() lines 834-842
   *
   * @param {Object} identifiers - Book identifiers
   * @param {Object} hardcoverMatch - Hardcover match object
   * @returns {Object} - {identifier: string, identifierType: string} or null if no valid identifiers
   */
  static generateStorageKey(identifiers, hardcoverMatch) {
    try {
      // Use the best available identifier in priority order: ASIN > ISBN > title_author
      let identifier = identifiers?.asin || identifiers?.isbn;
      let identifierType = identifiers?.asin ? 'asin' : 'isbn';

      if (!identifier && hardcoverMatch) {
        // Generate cache key for title/author matches without identifiers
        identifier = `title_author_${hardcoverMatch.userBook?.id}_${hardcoverMatch.edition?.id}`;
        identifierType = 'title_author';

        logger.debug('Generated title/author storage key', {
          identifier,
          userBookId: hardcoverMatch.userBook?.id,
          editionId: hardcoverMatch.edition?.id,
        });
      }

      if (!identifier) {
        logger.warn('No valid identifiers found for storage key generation', {
          identifiers: identifiers,
          hasMatch: !!hardcoverMatch,
        });
        return null;
      }

      return { identifier, identifierType };
    } catch (error) {
      logger.error('Error generating storage key', {
        error: error.message,
        identifiers: identifiers,
        hasMatch: !!hardcoverMatch,
      });
      return null;
    }
  }

  /**
   * Generate cache key for books without identifiers (fallback scenario)
   * Extracted from SyncManager._handleCompletionStatus() lines 2161-2185
   *
   * @param {string} title - Book title
   * @param {string} author - Book author
   * @returns {string} - Fallback cache key
   */
  static generateFallbackKey(title, author) {
    try {
      // Convert null/undefined to 'unknown' upfront
      const safeTitle =
        title === null || title === undefined ? 'unknown' : title;
      const safeAuthor =
        author === null || author === undefined ? 'unknown' : author;

      const fallbackIdentifier = `${safeTitle}:${safeAuthor}`
        .toLowerCase()
        .replace(/[^a-z0-9:]/g, '');

      logger.debug('Generated fallback cache key', {
        title,
        author,
        fallbackIdentifier,
      });

      return fallbackIdentifier;
    } catch (error) {
      logger.error('Error generating fallback key', {
        error: error.message,
        title,
        author,
      });
      return 'unknown:unknown';
    }
  }

  /**
   * Generate synthetic identifier for title/author matches
   * Used when we have a Hardcover match but no ISBN/ASIN
   * Extracted from SyncManager._selectEditionWithCache() lines 1971-1982
   *
   * @param {string} userBookId - User book ID from Hardcover
   * @param {string} editionId - Edition ID from Hardcover
   * @returns {Object} - {identifierType: string, identifierValue: string}
   */
  static generateSyntheticKey(userBookId, editionId) {
    try {
      // Convert null/undefined to 'unknown' upfront
      const safeUserBookId =
        userBookId === null || userBookId === undefined
          ? 'unknown'
          : userBookId;
      const safeEditionId =
        editionId === null || editionId === undefined ? 'unknown' : editionId;

      const identifierType = 'title_author';
      const identifierValue = `title_author_${safeUserBookId}_${safeEditionId}`;

      logger.debug('Generated synthetic identifier for title/author match', {
        identifierValue,
        userBookId,
        editionId,
      });

      return { identifierType, identifierValue };
    } catch (error) {
      logger.error('Error generating synthetic key', {
        error: error.message,
        userBookId,
        editionId,
      });
      return {
        identifierType: 'title_author',
        identifierValue: 'title_author_unknown_unknown',
      };
    }
  }

  /**
   * Validate cache key for database operations
   * Ensures key is suitable for database storage
   *
   * @param {string} key - Cache key to validate
   * @param {string} type - Key type ('asin', 'isbn', 'title_author')
   * @returns {boolean} - True if valid for database storage
   */
  static isValidCacheKey(key, type) {
    try {
      if (!key || typeof key !== 'string' || key.trim() === '') {
        return false;
      }

      // Basic validation rules
      switch (type) {
        case 'asin':
          // ASIN should be 10 characters, alphanumeric
          return /^[A-Z0-9]{10}$/i.test(key.trim());

        case 'isbn': {
          // ISBN can be ISBN-10 or ISBN-13, with or without hyphens
          const cleanIsbn = key.replace(/[-\s]/g, '');
          return /^(?:\d{10}|\d{13})$/.test(cleanIsbn);
        }

        case 'title_author':
          // Title/author keys should have the expected prefix
          return key.startsWith('title_author_') && key.length > 15;

        default:
          // For unknown types, just check it's a non-empty string
          return key.trim().length > 0;
      }
    } catch (error) {
      logger.error('Error validating cache key', {
        error: error.message,
        key,
        type,
      });
      return false;
    }
  }

  /**
   * Normalize identifier for consistent caching
   * Handles variations in identifier formatting
   *
   * @param {string} identifier - Raw identifier
   * @param {string} type - Identifier type
   * @returns {string} - Normalized identifier
   */
  static normalizeIdentifier(identifier, type) {
    if (!identifier || typeof identifier !== 'string') {
      return identifier;
    }

    try {
      switch (type) {
        case 'asin':
          // ASINs should be uppercase
          return identifier.trim().toUpperCase();

        case 'isbn':
          // Remove hyphens and spaces from ISBNs
          return identifier.replace(/[-\s]/g, '').trim();

        case 'title_author':
          // Title/author keys should remain as-is
          return identifier.trim();

        default:
          return identifier.trim();
      }
    } catch (error) {
      logger.error('Error normalizing identifier', {
        error: error.message,
        identifier,
        type,
      });
      return identifier;
    }
  }

  /**
   * Get cache key priority for sorting
   * Higher priority keys are preferred for lookup
   *
   * @param {string} type - Key type
   * @returns {number} - Priority number (lower = higher priority)
   */
  static getKeyPriority(type) {
    switch (type) {
      case 'asin':
        return 1;
      case 'isbn':
        return 2;
      case 'title_author':
        return 3;
      default:
        return 999;
    }
  }

  /**
   * Extract and generate keys from Audiobookshelf book data
   * Convenience method that combines identifier extraction with key generation
   *
   * @param {Object} absBook - Audiobookshelf book data
   * @param {Object} hardcoverMatch - Hardcover match object
   * @returns {Array<Object>} - Generated cache keys with metadata
   */
  static generateKeysFromBook(absBook, hardcoverMatch) {
    try {
      // This would typically import from identifier extraction utility
      // For now, we'll do basic extraction
      const identifiers = this._extractBasicIdentifiers(absBook);

      return this.generatePossibleKeys(identifiers, hardcoverMatch);
    } catch (error) {
      logger.error('Error generating keys from book data', {
        error: error.message,
        bookId: absBook?.id,
        hasMatch: !!hardcoverMatch,
      });
      return [];
    }
  }

  /**
   * Basic identifier extraction (placeholder)
   * In the full implementation, this would delegate to identifier extraction utility
   *
   * @param {Object} absBook - Audiobookshelf book data
   * @returns {Object} - Extracted identifiers
   * @private
   */
  static _extractBasicIdentifiers(absBook) {
    const identifiers = {};

    try {
      // Extract ISBN
      if (absBook?.media?.metadata?.isbn) {
        identifiers.isbn = absBook.media.metadata.isbn;
      }

      // Extract ASIN
      if (absBook?.media?.metadata?.asin) {
        identifiers.asin = absBook.media.metadata.asin;
      }
    } catch (error) {
      logger.debug('Error extracting basic identifiers', {
        error: error.message,
        bookId: absBook?.id,
      });
    }

    return identifiers;
  }
}
