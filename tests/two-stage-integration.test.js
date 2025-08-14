/**
 * Two-Stage Integration Tests
 * 
 * Tests for the complete two-stage matching system integration,
 * including TitleAuthorMatcher with both stages working together.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TitleAuthorMatcher } from '../src/matching/strategies/title-author-matcher.js';

describe('Two-Stage Integration', () => {
  let mockHardcoverClient;
  let mockCache;
  let mockConfig;
  let titleAuthorMatcher;

  beforeEach(() => {
    // Mock HardcoverClient
    mockHardcoverClient = {
      searchBooksForMatching: jest.fn(),
      getPreferredEditionFromBookId: jest.fn()
    };

    // Mock BookCache  
    mockCache = {
      getCachedBookInfo: jest.fn(),
      storeEditionMapping: jest.fn()
    };

    // Mock Config
    mockConfig = {
      title_author_matching: {
        confidence_threshold: 0.7,
        max_search_results: 5
      }
    };

    titleAuthorMatcher = new TitleAuthorMatcher(mockHardcoverClient, mockCache, mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Two-Stage Flow', () => {
    it('should successfully complete two-stage matching for audiobook', async () => {
      // Setup test data
      const mockAudiobookshelfBook = {
        title: 'The Laws of the Skies',
        author: 'Gregoire Courtois',
        duration: 43200,
        narrator: 'Test Narrator',
        mediaType: 'audiobook'
      };

      const mockSearchResults = [
        {
          id: 'book_511122',
          title: 'The Laws of the Skies',
          author_names: ['Gregoire Courtois'],
          activity: 45,
          editions: [
            {
              id: 'edition_audiobook',
              reading_format: { format: 'audiobook' },
              users_count: 45,
              audio_seconds: 43200,
              asin: 'B123456789'
            },
            {
              id: 'edition_ebook', 
              reading_format: { format: 'ebook' },
              users_count: 30,
              pages: 350,
              isbn_13: '9781234567890'
            }
          ]
        }
      ];

      // Mock cache miss
      mockCache.getCachedBookInfo.mockResolvedValue(null);

      // Mock search API success
      mockHardcoverClient.searchBooksForMatching.mockResolvedValue(mockSearchResults);

      // Mock cache storage
      mockCache.storeEditionMapping.mockResolvedValue(true);

      // Execute two-stage matching
      const result = await titleAuthorMatcher.findMatch(
        mockAudiobookshelfBook,
        'test-user-id',
        null, // findUserBookByEditionId
        null  // findUserBookByBookId
      );

      // Verify Stage 1: Book Identification
      expect(result).not.toBeNull();
      expect(result._matchType).toBe('title_author_two_stage');
      expect(result._tier).toBe(3);
      expect(result._bookIdentificationScore).toBeDefined();
      expect(result._bookIdentificationScore.totalScore).toBeGreaterThan(70);
      expect(result._bookIdentificationScore.isBookMatch).toBe(true);

      // Verify Stage 2: Edition Selection
      expect(result.edition).toBeDefined();
      expect(result.edition.id).toBe('edition_audiobook'); // Should prefer audiobook
      expect(result.edition.format).toBe('audiobook');
      expect(result._editionSelectionResult).toBeDefined();
      expect(result._editionSelectionResult.selectionReason).toBeDefined();

      // Verify integration
      expect(result.book.id).toBe('book_511122');
      expect(result.book.title).toBe('The Laws of the Skies');
      expect(result._needsScoring).toBe(false); // Already scored in two stages

      // Verify API calls
      expect(mockHardcoverClient.searchBooksForMatching).toHaveBeenCalledWith(
        'The Laws of the Skies',
        'Gregoire Courtois',
        'Test Narrator',
        5
      );
      expect(mockCache.storeEditionMapping).toHaveBeenCalled();
    });

    it('should use getPreferredEditionFromBookId when editions not in search results', async () => {
      const mockAudiobookshelfBook = {
        title: 'Book Without Editions',
        author: 'Test Author',
        duration: 36000
      };

      const mockSearchResults = [
        {
          id: 'book_123',
          title: 'Book Without Editions',
          author_names: ['Test Author'],
          activity: 100
          // No editions array
        }
      ];

      const mockEditionData = {
        bookId: 'book_123',
        title: 'Book Without Editions',
        edition: {
          id: 'edition_selected',
          reading_format: { format: 'audiobook' },
          users_count: 50,
          audio_seconds: 36000,
          asin: 'B987654321'
        }
      };

      mockCache.getCachedBookInfo.mockResolvedValue(null);
      mockHardcoverClient.searchBooksForMatching.mockResolvedValue(mockSearchResults);
      mockHardcoverClient.getPreferredEditionFromBookId.mockResolvedValue(mockEditionData);
      mockCache.storeEditionMapping.mockResolvedValue(true);

      const result = await titleAuthorMatcher.findMatch(
        mockAudiobookshelfBook,
        'test-user-id',
        null,
        null
      );

      expect(result).not.toBeNull();
      expect(result.edition.id).toBe('edition_selected');
      expect(mockHardcoverClient.getPreferredEditionFromBookId).toHaveBeenCalledWith(
        'book_123',
        'audiobook'
      );
    });

    it('should handle ebook users correctly', async () => {
      const mockEbookUser = {
        title: 'Digital Book',
        author: 'Digital Author',
        format: 'epub',
        pages: 250
      };

      const mockSearchResults = [
        {
          id: 'book_digital',
          title: 'Digital Book', 
          author_names: ['Digital Author'],
          activity: 200,
          editions: [
            {
              id: 'edition_ebook',
              reading_format: { format: 'ebook' },
              users_count: 150,
              pages: 250,
              isbn_13: '9781234567890'
            },
            {
              id: 'edition_audiobook',
              reading_format: { format: 'audiobook' },
              users_count: 100,
              audio_seconds: 32400
            }
          ]
        }
      ];

      mockCache.getCachedBookInfo.mockResolvedValue(null);
      mockHardcoverClient.searchBooksForMatching.mockResolvedValue(mockSearchResults);
      mockCache.storeEditionMapping.mockResolvedValue(true);

      const result = await titleAuthorMatcher.findMatch(mockEbookUser, 'test-user-id', null, null);

      expect(result).not.toBeNull();
      expect(result.edition.id).toBe('edition_ebook'); // Should prefer ebook for ebook user
      expect(result.edition.format).toBe('ebook');
    });

    it('should fall back gracefully when preferred format not available', async () => {
      const mockAudiobookUser = {
        title: 'Ebook Only Book',
        author: 'Test Author',
        duration: 0, // Indicates audiobook user
        narrator: 'Test Narrator'
      };

      const mockSearchResults = [
        {
          id: 'book_ebook_only',
          title: 'Ebook Only Book',
          author_names: ['Test Author'],
          activity: 150,
          editions: [
            {
              id: 'edition_ebook_only',
              reading_format: { format: 'ebook' },
              users_count: 150,
              pages: 300,
              isbn_13: '9781234567890'
            }
            // No audiobook edition available
          ]
        }
      ];

      mockCache.getCachedBookInfo.mockResolvedValue(null);
      mockHardcoverClient.searchBooksForMatching.mockResolvedValue(mockSearchResults);
      mockCache.storeEditionMapping.mockResolvedValue(true);

      const result = await titleAuthorMatcher.findMatch(mockAudiobookUser, 'test-user-id', null, null);

      expect(result).not.toBeNull();
      expect(result.edition.id).toBe('edition_ebook_only'); // Should fall back to ebook
      expect(result._editionSelectionResult.selectionReason.format.reason).toContain('fallback');
    });

    it('should handle cache hits correctly', async () => {
      const mockCachedInfo = {
        edition_id: 'cached_edition_123',
        book_id: 'cached_book_123',
        title: 'Cached Book'
      };

      mockCache.getCachedBookInfo.mockResolvedValue(mockCachedInfo);

      const mockAudiobookshelfBook = {
        title: 'Cached Book',
        author: 'Cached Author'
      };

      const result = await titleAuthorMatcher.findMatch(
        mockAudiobookshelfBook,
        'test-user-id',
        null,
        null
      );

      expect(result).not.toBeNull();
      expect(mockHardcoverClient.searchBooksForMatching).not.toHaveBeenCalled();
      expect(mockCache.getCachedBookInfo).toHaveBeenCalled();
    });

    it('should return null when no suitable edition found', async () => {
      const mockAudiobookshelfBook = {
        title: 'No Edition Book',
        author: 'Test Author'
      };

      const mockSearchResults = [
        {
          id: 'book_no_editions',
          title: 'No Edition Book',
          author_names: ['Test Author'],
          activity: 50
          // No editions
        }
      ];

      mockCache.getCachedBookInfo.mockResolvedValue(null);
      mockHardcoverClient.searchBooksForMatching.mockResolvedValue(mockSearchResults);
      mockHardcoverClient.getPreferredEditionFromBookId.mockResolvedValue(null);

      const result = await titleAuthorMatcher.findMatch(
        mockAudiobookshelfBook,
        'test-user-id',
        null,
        null
      );

      expect(result).toBeNull();
    });

    it('should return null when book identification score below threshold', async () => {
      const mockAudiobookshelfBook = {
        title: 'Poor Match Book',
        author: 'Different Author'
      };

      const mockSearchResults = [
        {
          id: 'book_poor_match',
          title: 'Completely Different Book',
          author_names: ['Completely Different Author'],
          activity: 10,
          editions: [
            {
              id: 'edition_poor',
              reading_format: { format: 'ebook' },
              users_count: 10
            }
          ]
        }
      ];

      mockCache.getCachedBookInfo.mockResolvedValue(null);
      mockHardcoverClient.searchBooksForMatching.mockResolvedValue(mockSearchResults);

      const result = await titleAuthorMatcher.findMatch(
        mockAudiobookshelfBook,
        'test-user-id',
        null,
        null
      );

      expect(result).toBeNull();
    });

    it('should preserve legacy score for comparison', async () => {
      const mockAudiobookshelfBook = {
        title: 'Legacy Test Book',
        author: 'Legacy Author',
        duration: 43200
      };

      const mockSearchResults = [
        {
          id: 'book_legacy',
          title: 'Legacy Test Book',
          author_names: ['Legacy Author'],
          activity: 100,
          editions: [
            {
              id: 'edition_legacy',
              reading_format: { format: 'audiobook' },
              users_count: 100,
              audio_seconds: 43200
            }
          ]
        }
      ];

      mockCache.getCachedBookInfo.mockResolvedValue(null);
      mockHardcoverClient.searchBooksForMatching.mockResolvedValue(mockSearchResults);
      mockCache.storeEditionMapping.mockResolvedValue(true);

      const result = await titleAuthorMatcher.findMatch(
        mockAudiobookshelfBook,
        'test-user-id',
        null,
        null
      );

      expect(result).not.toBeNull();
      expect(result._bookIdentificationScore).toBeDefined();
      expect(result._bookIdentificationScore.totalScore).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const mockAudiobookshelfBook = {
        title: 'Error Test Book',
        author: 'Error Author'
      };

      mockCache.getCachedBookInfo.mockResolvedValue(null);
      mockHardcoverClient.searchBooksForMatching.mockRejectedValue(new Error('API Error'));

      const result = await titleAuthorMatcher.findMatch(
        mockAudiobookshelfBook,
        'test-user-id',
        null,
        null
      );

      expect(result).toBeNull();
    });

    it('should handle edition lookup failures gracefully', async () => {
      const mockAudiobookshelfBook = {
        title: 'Edition Lookup Error',
        author: 'Test Author'
      };

      const mockSearchResults = [
        {
          id: 'book_edition_error',
          title: 'Edition Lookup Error',
          author_names: ['Test Author'],
          activity: 100
          // No editions
        }
      ];

      mockCache.getCachedBookInfo.mockResolvedValue(null);
      mockHardcoverClient.searchBooksForMatching.mockResolvedValue(mockSearchResults);
      mockHardcoverClient.getPreferredEditionFromBookId.mockRejectedValue(new Error('Edition API Error'));

      const result = await titleAuthorMatcher.findMatch(
        mockAudiobookshelfBook,
        'test-user-id',
        null,
        null
      );

      expect(result).toBeNull();
    });

    it('should handle scoring errors gracefully', async () => {
      const mockAudiobookshelfBook = {
        title: 'Scoring Error Book',
        author: 'Test Author'
      };

      const mockSearchResults = [
        {
          // Malformed result that might cause scoring errors
          id: null,
          title: null,
          author_names: null
        }
      ];

      mockCache.getCachedBookInfo.mockResolvedValue(null);
      mockHardcoverClient.searchBooksForMatching.mockResolvedValue(mockSearchResults);

      const result = await titleAuthorMatcher.findMatch(
        mockAudiobookshelfBook,
        'test-user-id',
        null,
        null
      );

      expect(result).toBeNull();
    });
  });

  describe('Configuration Compatibility', () => {
    it('should respect custom confidence threshold', async () => {
      // Lower confidence threshold
      const customConfig = {
        title_author_matching: {
          confidence_threshold: 0.5, // Lower threshold
          max_search_results: 5
        }
      };

      const customMatcher = new TitleAuthorMatcher(mockHardcoverClient, mockCache, customConfig);

      const mockAudiobookshelfBook = {
        title: 'Medium Match Book',
        author: 'Similar Author'
      };

      const mockSearchResults = [
        {
          id: 'book_medium',
          title: 'Medium Match Book Variation',
          author_names: ['Similar Author Name'],
          activity: 50,
          editions: [
            {
              id: 'edition_medium',
              reading_format: { format: 'ebook' },
              users_count: 50
            }
          ]
        }
      ];

      mockCache.getCachedBookInfo.mockResolvedValue(null);
      mockHardcoverClient.searchBooksForMatching.mockResolvedValue(mockSearchResults);
      mockCache.storeEditionMapping.mockResolvedValue(true);

      const result = await customMatcher.findMatch(
        mockAudiobookshelfBook,
        'test-user-id',
        null,
        null
      );

      // Should succeed with lower threshold
      expect(result).not.toBeNull();
    });

    it('should respect max search results configuration', async () => {
      const customConfig = {
        title_author_matching: {
          confidence_threshold: 0.7,
          max_search_results: 3 // Custom limit
        }
      };

      const customMatcher = new TitleAuthorMatcher(mockHardcoverClient, mockCache, customConfig);

      mockCache.getCachedBookInfo.mockResolvedValue(null);
      mockHardcoverClient.searchBooksForMatching.mockResolvedValue([]);

      await customMatcher.findMatch(
        { title: 'Test', author: 'Author' },
        'test-user-id',
        null,
        null
      );

      expect(mockHardcoverClient.searchBooksForMatching).toHaveBeenCalledWith(
        'Test',
        'Author',
        undefined,
        3 // Should use custom limit
      );
    });
  });
});
