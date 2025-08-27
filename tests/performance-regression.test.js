/**
 * Performance Regression Tests
 *
 * Tests to ensure the two-stage matching system doesn't introduce
 * performance regressions compared to the original single-stage system.
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

describe('Performance Regression Tests', () => {
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

  describe('Scoring Performance', () => {
    const testSearchResult = {
      id: 'perf_book_123',
      title: 'Performance Test Book',
      author_names: ['Performance Author'],
      series: [{ name: 'Performance Series', sequence: 1 }],
      activity: 1000,
      publication_year: 2023,
    };

    const testMetadata = {
      title: 'Performance Test Book',
      author: 'Performance Author',
      series: [{ name: 'Performance Series', sequence: 1 }],
      publicationYear: 2023,
      duration: 43200,
    };

    it('should complete book identification scoring within performance limits', () => {
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        calculateBookIdentificationScore(
          testSearchResult,
          'Performance Test Book',
          'Performance Author',
          testMetadata,
        );
      }

      const endTime = performance.now();
      const averageTime = (endTime - startTime) / iterations;

      // Should average less than 1ms per scoring operation
      expect(averageTime).toBeLessThan(1);
    });

    it('should maintain consistent book identification scoring performance', () => {
      const iterations = 1000;

      // Test book identification scoring consistency
      const bookScoringStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        calculateBookIdentificationScore(
          testSearchResult,
          'Performance Test Book',
          'Performance Author',
          testMetadata,
        );
      }
      const bookScoringTime = performance.now() - bookScoringStart;
      const averageTime = bookScoringTime / iterations;

      // Book identification scoring should be fast and consistent
      expect(averageTime).toBeLessThan(1); // Less than 1ms per operation
    });
  });

  describe('Edition Selection Performance', () => {
    const mockBookWithManyEditions = {
      id: 'book_many_editions',
      title: 'Book with Many Editions',
      editions: Array.from({ length: 20 }, (_, i) => ({
        id: `edition_${i}`,
        reading_format: {
          format: i % 3 === 0 ? 'audiobook' : i % 3 === 1 ? 'ebook' : null,
        },
        physical_format: i % 3 === 2 ? 'paperback' : null,
        users_count: Math.floor(Math.random() * 1000),
        audio_seconds: i % 3 === 0 ? 43200 + i * 1000 : null,
        pages: i % 3 === 1 ? 300 + i * 10 : null,
        asin: `ASIN${i}`,
        isbn_13: `978${i}234567890`,
      })),
    };

    it('should select best edition efficiently with many options', () => {
      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        selectBestEdition(
          mockBookWithManyEditions,
          { duration: 43200 },
          'audiobook',
        );
      }

      const endTime = performance.now();
      const averageTime = (endTime - startTime) / iterations;

      // Should average less than 5ms per edition selection with 20 editions
      expect(averageTime).toBeLessThan(5);
    });

    it('should scale linearly with number of editions', () => {
      const smallBook = {
        id: 'small_book',
        title: 'Small Book',
        editions: Array.from({ length: 5 }, (_, i) => ({
          id: `small_edition_${i}`,
          reading_format: { format: 'audiobook' },
          users_count: 100,
          audio_seconds: 43200,
        })),
      };

      const largeBook = {
        id: 'large_book',
        title: 'Large Book',
        editions: Array.from({ length: 50 }, (_, i) => ({
          id: `large_edition_${i}`,
          reading_format: { format: 'audiobook' },
          users_count: 100,
          audio_seconds: 43200,
        })),
      };

      const iterations = 50;

      // Test small book
      const smallStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        selectBestEdition(smallBook, { duration: 43200 }, 'audiobook');
      }
      const smallTime = performance.now() - smallStart;

      // Test large book
      const largeStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        selectBestEdition(largeBook, { duration: 43200 }, 'audiobook');
      }
      const largeTime = performance.now() - largeStart;

      // Large book should not be more than 10x slower (linear scaling)
      const scalingFactor = largeTime / smallTime;
      expect(scalingFactor).toBeLessThan(10);
    });
  });

  describe('Format Detection Performance', () => {
    const complexMetadata = {
      id: 'complex_book',
      title: 'Very Complex Book with Lots of Metadata',
      author: 'Complex Author Name',
      narrator: 'Complex Narrator Name',
      duration: 43200,
      format: 'epub',
      pages: 500,
      media: {
        duration: 43200,
        audioFiles: Array.from({ length: 50 }, (_, i) => ({
          index: i,
          path: `/audiobooks/complex/chapter${i}.mp3`,
        })),
        ebookFiles: [
          { path: '/ebooks/complex/book.epub' },
          { path: '/ebooks/complex/book.pdf' },
        ],
        metadata: {
          title: 'Very Complex Book with Lots of Metadata',
          author: 'Complex Author Name',
          narrator: 'Complex Narrator Name',
          series: 'Complex Series',
          isbn: '9781234567890',
          asin: 'B123456789',
        },
      },
      libraryType: 'mixed_library',
      path: '/library/complex/author/Very Complex Book with Lots of Metadata',
      progress: {
        timeListened: 21600,
        pagesRead: 250,
        isFinished: false,
      },
    };

    it('should detect format efficiently with complex metadata', () => {
      const iterations = 10000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        detectUserBookFormat(complexMetadata);
      }

      const endTime = performance.now();
      const averageTime = (endTime - startTime) / iterations;

      // Should average less than 0.1ms per format detection
      expect(averageTime).toBeLessThan(0.1);
    });

    it('should handle varying metadata complexity efficiently', () => {
      const simpleMetadata = { duration: 43200 };
      const mediumMetadata = {
        duration: 43200,
        narrator: 'Test Narrator',
        media: { audioFiles: [{ path: 'test.mp3' }] },
      };

      const iterations = 5000;

      // Test simple metadata
      const simpleStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        detectUserBookFormat(simpleMetadata);
      }
      const simpleTime = performance.now() - simpleStart;

      // Test medium metadata
      const mediumStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        detectUserBookFormat(mediumMetadata);
      }
      const mediumTime = performance.now() - mediumStart;

      // Test complex metadata
      const complexStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        detectUserBookFormat(complexMetadata);
      }
      const complexTime = performance.now() - complexStart;

      // Performance should scale reasonably
      expect(mediumTime / simpleTime).toBeLessThan(3);
      expect(complexTime / simpleTime).toBeLessThan(5);
    });
  });

  describe('End-to-End Performance', () => {
    it('should complete two-stage matching within time limits', async () => {
      const mockSearchResults = [
        {
          id: 'e2e_book_123',
          title: 'End-to-End Test Book',
          author_names: ['E2E Author'],
          activity: 500,
          editions: [
            {
              id: 'e2e_edition_456',
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
      mockCache.storeEditionMapping.mockResolvedValue(true);

      const testBook = {
        title: 'End-to-End Test Book',
        author: 'E2E Author',
        duration: 43200,
      };

      const iterations = 10;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        await titleAuthorMatcher.findMatch(
          testBook,
          `e2e-user-${i}`,
          null,
          null,
        );
      }

      const endTime = performance.now();
      const averageTime = (endTime - startTime) / iterations;

      // Should average less than 100ms per complete two-stage match
      // (excluding network latency from mocked calls)
      expect(averageTime).toBeLessThan(100);
    });

    it('should handle batch processing efficiently', async () => {
      const batchSize = 20;
      const testBooks = Array.from({ length: batchSize }, (_, i) => ({
        title: `Batch Book ${i}`,
        author: `Batch Author ${i}`,
        duration: 43200 + i * 1000,
      }));

      const mockResults = testBooks.map((book, i) => ({
        id: `batch_book_${i}`,
        title: book.title,
        author_names: [book.author],
        activity: 100 + i,
        editions: [
          {
            id: `batch_edition_${i}`,
            reading_format: { format: 'audiobook' },
            users_count: 50 + i,
            audio_seconds: book.duration,
          },
        ],
      }));

      mockCache.getCachedBookInfo.mockResolvedValue(null);
      mockHardcoverClient.searchBooksForMatching.mockImplementation(
        (title, author) => {
          const index = testBooks.findIndex(book => book.title === title);
          return Promise.resolve([mockResults[index]]);
        },
      );
      mockCache.storeEditionMapping.mockResolvedValue(true);

      const startTime = performance.now();

      const results = await Promise.all(
        testBooks.map((book, i) =>
          titleAuthorMatcher.findMatch(book, `batch-user-${i}`, null, null),
        ),
      );

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageTimePerBook = totalTime / batchSize;

      expect(results).toHaveLength(batchSize);
      expect(results.every(result => result !== null)).toBe(true);

      // Batch processing should maintain reasonable per-book performance
      expect(averageTimePerBook).toBeLessThan(50);
    });
  });

  describe('Memory Usage', () => {
    it('should not accumulate excessive memory during repeated operations', async () => {
      const mockSearchResults = [
        {
          id: 'memory_book',
          title: 'Memory Test Book',
          author_names: ['Memory Author'],
          activity: 200,
          editions: [
            {
              id: 'memory_edition',
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

      const testBook = {
        title: 'Memory Test Book',
        author: 'Memory Author',
        duration: 43200,
      };

      // Get initial memory usage
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many operations
      const iterations = 100;
      for (let i = 0; i < iterations; i++) {
        await titleAuthorMatcher.findMatch(
          testBook,
          `memory-user-${i}`,
          null,
          null,
        );

        // Force garbage collection every 10 iterations if available
        if (i % 10 === 0 && global.gc) {
          global.gc();
        }
      }

      // Check final memory usage
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreasePerOperation = memoryIncrease / iterations;

      // Memory increase per operation should be minimal (<1KB)
      expect(memoryIncreasePerOperation).toBeLessThan(1024);
    });
  });

  describe('Concurrent Performance', () => {
    it('should handle concurrent matching requests efficiently', async () => {
      const concurrentRequests = 10;
      const mockSearchResults = [
        {
          id: 'concurrent_book',
          title: 'Concurrent Test Book',
          author_names: ['Concurrent Author'],
          activity: 300,
          editions: [
            {
              id: 'concurrent_edition',
              reading_format: { format: 'audiobook' },
              users_count: 80,
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

      const testBook = {
        title: 'Concurrent Test Book',
        author: 'Concurrent Author',
        duration: 43200,
      };

      const startTime = performance.now();

      // Create concurrent requests
      const concurrentPromises = Array.from(
        { length: concurrentRequests },
        (_, i) =>
          titleAuthorMatcher.findMatch(
            testBook,
            `concurrent-user-${i}`,
            null,
            null,
          ),
      );

      const results = await Promise.all(concurrentPromises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(results).toHaveLength(concurrentRequests);
      expect(results.every(result => result !== null)).toBe(true);

      // Concurrent processing should be efficient (not much slower than sequential)
      expect(totalTime).toBeLessThan(500); // 500ms for 10 concurrent requests
    });
  });
});
