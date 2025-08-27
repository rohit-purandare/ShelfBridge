/**
 * Edge Cases and Error Handling Tests
 *
 * Tests for edge cases, error conditions, and boundary scenarios
 * in the two-stage matching system to ensure robust error handling.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { TitleAuthorMatcher } from '../src/matching/strategies/title-author-matcher.js';
import { calculateBookIdentificationScore } from '../src/matching/scoring/book-identification-scorer.js';
import { selectBestEdition } from '../src/matching/edition-selector.js';
import { detectUserBookFormat } from '../src/matching/utils/audiobookshelf-extractor.js';

describe('Edge Cases and Error Handling', () => {
  let mockHardcoverClient;
  let mockCache;
  let mockConfig;
  let titleAuthorMatcher;

  beforeEach(() => {
    mockHardcoverClient = {
      searchBooksForMatching: jest.fn(),
      getPreferredEditionFromBookId: jest.fn(),
    };

    mockCache = {
      getCachedBookInfo: jest.fn(),
      storeEditionMapping: jest.fn(),
    };

    mockConfig = {
      title_author_matching: {
        confidence_threshold: 0.7,
        max_search_results: 5,
      },
    };

    titleAuthorMatcher = new TitleAuthorMatcher(
      mockHardcoverClient,
      mockCache,
      mockConfig,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Input Validation Edge Cases', () => {
    it('should handle null/undefined book input gracefully', async () => {
      const result1 = await titleAuthorMatcher.findMatch(
        null,
        'user-id',
        null,
        null,
      );
      expect(result1).toBeNull();

      const result2 = await titleAuthorMatcher.findMatch(
        undefined,
        'user-id',
        null,
        null,
      );
      expect(result2).toBeNull();
    });

    it('should handle empty book object', async () => {
      const emptyBook = {};
      const result = await titleAuthorMatcher.findMatch(
        emptyBook,
        'user-id',
        null,
        null,
      );
      expect(result).toBeNull();
    });

    it('should handle book with only title (no author)', async () => {
      const titleOnlyBook = { title: 'Title Only Book' };

      mockCache.getCachedBookInfo.mockResolvedValue(null);
      mockHardcoverClient.searchBooksForMatching.mockResolvedValue([]);

      const result = await titleAuthorMatcher.findMatch(
        titleOnlyBook,
        'user-id',
        null,
        null,
      );
      expect(result).toBeNull();
    });

    it('should handle book with empty/whitespace title', async () => {
      const whitespaceBook = { title: '   ', author: 'Valid Author' };
      const result = await titleAuthorMatcher.findMatch(
        whitespaceBook,
        'user-id',
        null,
        null,
      );
      expect(result).toBeNull();

      const emptyTitleBook = { title: '', author: 'Valid Author' };
      const result2 = await titleAuthorMatcher.findMatch(
        emptyTitleBook,
        'user-id',
        null,
        null,
      );
      expect(result2).toBeNull();
    });

    it('should handle extremely long titles and authors', async () => {
      const longTitleBook = {
        title: 'A'.repeat(10000), // 10k character title
        author: 'B'.repeat(5000), // 5k character author
      };

      mockCache.getCachedBookInfo.mockResolvedValue(null);
      mockHardcoverClient.searchBooksForMatching.mockResolvedValue([]);

      const result = await titleAuthorMatcher.findMatch(
        longTitleBook,
        'user-id',
        null,
        null,
      );
      expect(result).toBeNull();

      // Should still call the API (not crash)
      expect(mockHardcoverClient.searchBooksForMatching).toHaveBeenCalled();
    });

    it('should handle special characters in titles and authors', async () => {
      const specialCharBook = {
        title: '测试书籍 with émojis 📚 & symbols @#$%^&*()',
        author: 'Authör with àccents & 中文 characters',
      };

      mockCache.getCachedBookInfo.mockResolvedValue(null);
      mockHardcoverClient.searchBooksForMatching.mockResolvedValue([]);

      const result = await titleAuthorMatcher.findMatch(
        specialCharBook,
        'user-id',
        null,
        null,
      );
      expect(result).toBeNull();

      expect(mockHardcoverClient.searchBooksForMatching).toHaveBeenCalledWith(
        specialCharBook.title,
        specialCharBook.author,
        undefined,
        5,
      );
    });
  });

  describe('API Error Handling', () => {
    it('should handle search API network errors', async () => {
      const testBook = {
        title: 'Network Error Book',
        author: 'Network Author',
      };

      mockCache.getCachedBookInfo.mockResolvedValue(null);
      mockHardcoverClient.searchBooksForMatching.mockRejectedValue(
        new Error('Network error'),
      );

      const result = await titleAuthorMatcher.findMatch(
        testBook,
        'user-id',
        null,
        null,
      );
      expect(result).toBeNull();
    });

    it('should handle search API timeout errors', async () => {
      const testBook = { title: 'Timeout Book', author: 'Timeout Author' };

      mockCache.getCachedBookInfo.mockResolvedValue(null);
      mockHardcoverClient.searchBooksForMatching.mockRejectedValue(
        new Error('Request timeout'),
      );

      const result = await titleAuthorMatcher.findMatch(
        testBook,
        'user-id',
        null,
        null,
      );
      expect(result).toBeNull();
    });

    it('should handle edition lookup API errors', async () => {
      const testBook = {
        title: 'Edition Error Book',
        author: 'Edition Author',
      };

      const mockSearchResults = [
        {
          id: 'book_edition_error',
          title: 'Edition Error Book',
          author_names: ['Edition Author'],
          activity: 100,
          // No editions in search result
        },
      ];

      mockCache.getCachedBookInfo.mockResolvedValue(null);
      mockHardcoverClient.searchBooksForMatching.mockResolvedValue(
        mockSearchResults,
      );
      mockHardcoverClient.getPreferredEditionFromBookId.mockRejectedValue(
        new Error('Edition API error'),
      );

      const result = await titleAuthorMatcher.findMatch(
        testBook,
        'user-id',
        null,
        null,
      );
      expect(result).toBeNull();
    });

    it('should handle API returning malformed data', async () => {
      const testBook = {
        title: 'Malformed Data Book',
        author: 'Malformed Author',
      };

      // API returns malformed data
      const malformedResults = [
        {
          /* missing required fields */
        },
        { id: null, title: null, author_names: null },
        'not an object',
        null,
      ];

      mockCache.getCachedBookInfo.mockResolvedValue(null);
      mockHardcoverClient.searchBooksForMatching.mockResolvedValue(
        malformedResults,
      );

      const result = await titleAuthorMatcher.findMatch(
        testBook,
        'user-id',
        null,
        null,
      );
      expect(result).toBeNull();
    });

    it('should handle API returning empty arrays', async () => {
      const testBook = { title: 'Empty Results Book', author: 'Empty Author' };

      mockCache.getCachedBookInfo.mockResolvedValue(null);
      mockHardcoverClient.searchBooksForMatching.mockResolvedValue([]);

      const result = await titleAuthorMatcher.findMatch(
        testBook,
        'user-id',
        null,
        null,
      );
      expect(result).toBeNull();
    });
  });

  describe('Cache Error Handling', () => {
    it('should handle cache read errors gracefully', async () => {
      const testBook = {
        title: 'Cache Read Error Book',
        author: 'Cache Author',
      };

      mockCache.getCachedBookInfo.mockRejectedValue(
        new Error('Cache read error'),
      );
      mockHardcoverClient.searchBooksForMatching.mockResolvedValue([]);

      const result = await titleAuthorMatcher.findMatch(
        testBook,
        'user-id',
        null,
        null,
      );
      expect(result).toBeNull();

      // Should still attempt API search despite cache error
      expect(mockHardcoverClient.searchBooksForMatching).toHaveBeenCalled();
    });

    it('should handle cache write errors gracefully', async () => {
      const testBook = {
        title: 'Cache Write Error Book',
        author: 'Cache Write Author',
      };

      const mockSearchResults = [
        {
          id: 'cache_write_error_book',
          title: 'Cache Write Error Book',
          author_names: ['Cache Write Author'],
          activity: 200,
          editions: [
            {
              id: 'cache_write_edition',
              reading_format: { format: 'audiobook' },
              users_count: 100,
              audio_seconds: 43200,
            },
          ],
        },
      ];

      mockCache.getCachedBookInfo.mockResolvedValue(null);
      mockHardcoverClient.searchBooksForMatching.mockResolvedValue(
        mockSearchResults,
      );
      mockCache.storeEditionMapping.mockRejectedValue(
        new Error('Cache write error'),
      );

      const result = await titleAuthorMatcher.findMatch(
        testBook,
        'user-id',
        null,
        null,
      );

      // Should still return successful match despite cache write error
      expect(result).not.toBeNull();
      expect(result._matchType).toBe('title_author_two_stage');
    });

    it('should handle corrupted cache data', async () => {
      const testBook = {
        title: 'Corrupted Cache Book',
        author: 'Corrupted Author',
      };

      // Simulate corrupted cache data
      const corruptedCacheData = {
        edition_id: null,
        book_id: undefined,
        title: '',
        author: 123, // Wrong type
      };

      mockCache.getCachedBookInfo.mockResolvedValue(corruptedCacheData);

      const result = await titleAuthorMatcher.findMatch(
        testBook,
        'user-id',
        null,
        null,
      );

      // Should handle corrupted cache and fall back to API search
      expect(mockHardcoverClient.searchBooksForMatching).toHaveBeenCalled();
    });
  });

  describe('Scoring Edge Cases', () => {
    it('should handle division by zero in scoring calculations', () => {
      const zeroActivityResult = {
        id: 'zero_activity_book',
        title: 'Zero Activity Book',
        author_names: ['Zero Author'],
        activity: 0, // Zero activity
      };

      const result = calculateBookIdentificationScore(
        zeroActivityResult,
        'Zero Activity Book',
        'Zero Author',
        {},
      );

      expect(result.totalScore).toBeGreaterThanOrEqual(0);
      expect(result.totalScore).toBeLessThanOrEqual(100);
      expect(isNaN(result.totalScore)).toBe(false);
    });

    it('should handle extremely high activity values', () => {
      const highActivityResult = {
        id: 'high_activity_book',
        title: 'High Activity Book',
        author_names: ['Popular Author'],
        activity: Number.MAX_SAFE_INTEGER,
      };

      const result = calculateBookIdentificationScore(
        highActivityResult,
        'High Activity Book',
        'Popular Author',
        {},
      );

      expect(result.totalScore).toBeGreaterThanOrEqual(0);
      expect(result.totalScore).toBeLessThanOrEqual(100);
      expect(isFinite(result.totalScore)).toBe(true);
    });

    it('should handle negative values in metadata', () => {
      const negativeMetadata = {
        publication_year: -2023, // Negative year
        activity: -100, // Negative activity
        users_count: -50, // Negative users
      };

      const result = calculateBookIdentificationScore(
        {
          id: 'negative_book',
          title: 'Negative Values Book',
          author_names: ['Negative Author'],
          ...negativeMetadata,
        },
        'Negative Values Book',
        'Negative Author',
        { publicationYear: -2020 },
      );

      expect(result.totalScore).toBeGreaterThanOrEqual(0);
      expect(result.totalScore).toBeLessThanOrEqual(100);
    });

    it('should handle NaN and Infinity values', () => {
      const invalidResult = {
        id: 'invalid_book',
        title: 'Invalid Book',
        author_names: ['Invalid Author'],
        activity: NaN,
        publication_year: Infinity,
        users_count: -Infinity,
      };

      const result = calculateBookIdentificationScore(
        invalidResult,
        'Invalid Book',
        'Invalid Author',
        { publicationYear: NaN },
      );

      expect(isNaN(result.totalScore)).toBe(false);
      expect(isFinite(result.totalScore)).toBe(true);
      expect(result.totalScore).toBeGreaterThanOrEqual(0);
      expect(result.totalScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Edition Selection Edge Cases', () => {
    it('should handle book with no editions gracefully', () => {
      const bookWithoutEditions = {
        id: 'no_editions_book',
        title: 'No Editions Book',
        editions: [],
      };

      const result = selectBestEdition(bookWithoutEditions, {}, 'audiobook');
      expect(result).toBeNull();
    });

    it('should handle editions with missing data', () => {
      const bookWithIncompleteEditions = {
        id: 'incomplete_editions_book',
        title: 'Incomplete Editions Book',
        editions: [
          { id: 'edition_1' }, // Missing all other data
          { id: 'edition_2', reading_format: null },
          { id: 'edition_3', users_count: undefined },
          null, // Null edition
          undefined, // Undefined edition
        ],
      };

      const result = selectBestEdition(
        bookWithIncompleteEditions,
        {},
        'audiobook',
      );

      // Should still select an edition (the first valid one)
      expect(result).not.toBeNull();
      expect(['edition_1', 'edition_2', 'edition_3']).toContain(
        result.edition.id,
      );
    });

    it('should handle editions with extreme values', () => {
      const bookWithExtremeEditions = {
        id: 'extreme_editions_book',
        title: 'Extreme Editions Book',
        editions: [
          {
            id: 'extreme_edition_1',
            users_count: Number.MAX_SAFE_INTEGER,
            audio_seconds: Number.MAX_SAFE_INTEGER,
            pages: Number.MAX_SAFE_INTEGER,
          },
          {
            id: 'extreme_edition_2',
            users_count: 0,
            audio_seconds: 0,
            pages: 0,
          },
        ],
      };

      const result = selectBestEdition(
        bookWithExtremeEditions,
        {},
        'audiobook',
      );

      expect(result).not.toBeNull();
      expect(result.edition._editionScore.totalScore).toBeGreaterThanOrEqual(0);
      expect(result.edition._editionScore.totalScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Format Detection Edge Cases', () => {
    it('should handle deeply nested metadata structures', () => {
      const deeplyNestedMetadata = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  duration: 43200,
                  format: 'audiobook',
                },
              },
            },
          },
        },
      };

      // Should default to ebook for unrecognized structure
      const result = detectUserBookFormat(deeplyNestedMetadata);
      expect(['audiobook', 'ebook']).toContain(result);
    });

    it('should handle circular references in metadata', () => {
      const circularMetadata = { duration: 43200 };
      circularMetadata.self = circularMetadata; // Create circular reference

      const result = detectUserBookFormat(circularMetadata);
      expect(result).toBe('audiobook');
    });

    it('should handle metadata with functions and symbols', () => {
      const weirdMetadata = {
        duration: 43200,
        someFunction: () => 'test',
        someSymbol: Symbol('test'),
        [Symbol.iterator]: function* () {
          yield 'test';
        },
      };

      const result = detectUserBookFormat(weirdMetadata);
      expect(result).toBe('audiobook');
    });

    it('should handle very large metadata objects', () => {
      const largeMetadata = {
        duration: 43200,
        largeArray: new Array(10000).fill('test'),
        largeObject: {},
      };

      // Add many properties to large object
      for (let i = 0; i < 1000; i++) {
        largeMetadata.largeObject[`prop${i}`] = `value${i}`;
      }

      const startTime = performance.now();
      const result = detectUserBookFormat(largeMetadata);
      const endTime = performance.now();

      expect(result).toBe('audiobook');
      expect(endTime - startTime).toBeLessThan(100); // Should complete quickly
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle missing configuration gracefully', () => {
      const matcherWithoutConfig = new TitleAuthorMatcher(
        mockHardcoverClient,
        mockCache,
        {}, // Empty config
      );

      mockCache.getCachedBookInfo.mockResolvedValue(null);
      mockHardcoverClient.searchBooksForMatching.mockResolvedValue([]);

      expect(async () => {
        await matcherWithoutConfig.findMatch(
          { title: 'Test', author: 'Author' },
          'user-id',
          null,
          null,
        );
      }).not.toThrow();
    });

    it('should handle invalid configuration values', () => {
      const invalidConfig = {
        title_author_matching: {
          confidence_threshold: 'invalid', // String instead of number
          max_search_results: -5, // Negative number
        },
      };

      const matcherWithInvalidConfig = new TitleAuthorMatcher(
        mockHardcoverClient,
        mockCache,
        invalidConfig,
      );

      mockCache.getCachedBookInfo.mockResolvedValue(null);
      mockHardcoverClient.searchBooksForMatching.mockResolvedValue([]);

      expect(async () => {
        await matcherWithInvalidConfig.findMatch(
          { title: 'Test', author: 'Author' },
          'user-id',
          null,
          null,
        );
      }).not.toThrow();
    });

    it('should handle extreme configuration values', () => {
      const extremeConfig = {
        title_author_matching: {
          confidence_threshold: 999, // Way above 1.0
          max_search_results: 0, // Zero results
        },
      };

      const matcherWithExtremeConfig = new TitleAuthorMatcher(
        mockHardcoverClient,
        mockCache,
        extremeConfig,
      );

      mockCache.getCachedBookInfo.mockResolvedValue(null);
      mockHardcoverClient.searchBooksForMatching.mockResolvedValue([]);

      expect(async () => {
        await matcherWithExtremeConfig.findMatch(
          { title: 'Test', author: 'Author' },
          'user-id',
          null,
          null,
        );
      }).not.toThrow();
    });
  });

  describe('Concurrency and Race Conditions', () => {
    it('should handle concurrent requests for same book', async () => {
      const testBook = {
        title: 'Concurrent Book',
        author: 'Concurrent Author',
      };

      const mockSearchResults = [
        {
          id: 'concurrent_book',
          title: 'Concurrent Book',
          author_names: ['Concurrent Author'],
          activity: 150,
          editions: [
            {
              id: 'concurrent_edition',
              reading_format: { format: 'audiobook' },
              users_count: 75,
              audio_seconds: 43200,
            },
          ],
        },
      ];

      mockCache.getCachedBookInfo.mockResolvedValue(null);
      mockHardcoverClient.searchBooksForMatching.mockResolvedValue(
        mockSearchResults,
      );
      mockCache.storeEditionMapping.mockResolvedValue(true);

      // Make concurrent requests
      const promises = Array.from({ length: 10 }, (_, i) =>
        titleAuthorMatcher.findMatch(
          testBook,
          `concurrent-user-${i}`,
          null,
          null,
        ),
      );

      const results = await Promise.all(promises);

      // All should succeed
      expect(results.every(result => result !== null)).toBe(true);
      expect(
        results.every(result => result._matchType === 'title_author_two_stage'),
      ).toBe(true);
    });

    it('should handle cache race conditions', async () => {
      const testBook = { title: 'Race Condition Book', author: 'Race Author' };

      let cacheCallCount = 0;
      mockCache.getCachedBookInfo.mockImplementation(() => {
        cacheCallCount++;
        if (cacheCallCount === 1) {
          return Promise.resolve(null); // First call: cache miss
        } else {
          return Promise.resolve({
            // Subsequent calls: cache hit
            edition_id: 'cached_edition',
            book_id: 'cached_book',
            title: 'Race Condition Book',
            author: 'Race Author',
          });
        }
      });

      mockHardcoverClient.searchBooksForMatching.mockResolvedValue([
        {
          id: 'race_book',
          title: 'Race Condition Book',
          author_names: ['Race Author'],
          activity: 100,
          editions: [
            {
              id: 'race_edition',
              reading_format: { format: 'audiobook' },
              users_count: 50,
            },
          ],
        },
      ]);

      // Make two concurrent requests
      const [result1, result2] = await Promise.all([
        titleAuthorMatcher.findMatch(testBook, 'race-user-1', null, null),
        titleAuthorMatcher.findMatch(testBook, 'race-user-2', null, null),
      ]);

      // Both should succeed (one from API, one from cache)
      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
    });
  });
});
