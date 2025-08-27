/**
 * Sync Manager Two-Stage Integration Tests
 *
 * Tests to ensure sync-manager properly handles two-stage matching results
 * and integrates correctly with auto-add and existing book sync functionality.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { SyncManager } from '../src/sync-manager.js';

describe('Sync Manager Two-Stage Integration', () => {
  let mockUser;
  let mockGlobalConfig;
  let mockHardcover;
  let mockCache;
  let mockBookMatcher;
  let syncManager;

  beforeEach(() => {
    // Mock user configuration
    mockUser = {
      id: 'test-user',
      hardcover_token: 'test-token',
      audiobookshelf_url: 'http://test-abs.com',
      audiobookshelf_token: 'abs-token',
    };

    // Mock global configuration
    mockGlobalConfig = {
      auto_add_books: {
        enabled: true,
        min_progress_threshold: 20,
      },
      title_author_matching: {
        enabled: true,
        confidence_threshold: 0.7,
      },
    };

    // Mock HardcoverClient
    mockHardcover = {
      addBookToLibrary: jest.fn(),
      updateBookProgress: jest.fn(),
      getUserBooks: jest.fn(),
    };

    // Mock BookCache
    mockCache = {
      getCachedBookInfo: jest.fn(),
      storeEditionMapping: jest.fn(),
    };

    // Mock BookMatcher
    mockBookMatcher = {
      findMatch: jest.fn(),
    };

    // Create SyncManager instance
    syncManager = new SyncManager(mockUser, mockGlobalConfig, false, false);

    // Inject mocks
    syncManager.hardcover = mockHardcover;
    syncManager.cache = mockCache;
    syncManager.bookMatcher = mockBookMatcher;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Two-Stage Match Result Handling', () => {
    it('should handle two-stage match results in sync flow', async () => {
      const mockAudiobookshelfBook = {
        id: 'abs-book-1',
        title: 'Two Stage Test Book',
        author: 'Test Author',
        duration: 43200,
        progress: 0.5, // 50% progress
        libraryItem: {
          media: {
            metadata: {
              title: 'Two Stage Test Book',
              author: 'Test Author',
              narrator: 'Test Narrator',
            },
            duration: 43200,
          },
        },
      };

      const mockTwoStageMatch = {
        userBook: null, // Not in user's library yet
        edition: {
          id: 'edition_12345',
          asin: 'B123456789',
          isbn_10: null,
          isbn_13: '9781234567890',
          pages: null,
          audio_seconds: 43200,
          format: 'audiobook',
          users_count: 150,
        },
        book: {
          id: 'book_67890',
          title: 'Two Stage Test Book',
        },
        _matchType: 'title_author_two_stage',
        _tier: 3,
        _bookIdentificationScore: {
          totalScore: 75.5,
          breakdown: {
            title: { score: 85, weight: 0.35 },
            author: { score: 90, weight: 0.25 },
          },
          confidence: 'high',
          isBookMatch: true,
        },
        _editionSelectionResult: {
          bookId: 'book_67890',
          title: 'Two Stage Test Book',
          edition: {
            id: 'edition_12345',
            reading_format: { format: 'audiobook' },
            users_count: 150,
          },
          selectionReason: {
            format: { reason: 'Perfect audiobook format match' },
          },
        },
        _needsScoring: false,
      };

      mockBookMatcher.findMatch.mockResolvedValue(mockTwoStageMatch);
      mockHardcover.addBookToLibrary.mockResolvedValue({
        success: true,
        userBook: { id: 'new-user-book-id' },
      });

      // Execute sync for single book
      const result = await syncManager._syncSingleBook(
        mockAudiobookshelfBook,
        {},
      );

      expect(result.status).toBe('auto_added');
      expect(mockHardcover.addBookToLibrary).toHaveBeenCalledWith(
        'edition_12345',
        50, // 50% progress
      );
    });

    it('should extract progress correctly from two-stage matches', async () => {
      const mockEbookMatch = {
        userBook: {
          id: 'existing-user-book',
          book: { id: 'book_123', title: 'Existing Book' },
        },
        edition: {
          id: 'edition_ebook',
          format: 'ebook',
          pages: 300,
        },
        _matchType: 'title_author_two_stage',
        _tier: 3,
        _bookIdentificationScore: {
          totalScore: 82.1,
          confidence: 'high',
        },
        _needsScoring: false,
      };

      const mockEbookData = {
        id: 'abs-ebook-1',
        title: 'Existing Book',
        author: 'Test Author',
        progress: 0.75, // 75% progress
        libraryItem: {
          media: {
            metadata: {
              title: 'Existing Book',
              author: 'Test Author',
            },
          },
        },
      };

      mockBookMatcher.findMatch.mockResolvedValue(mockEbookMatch);
      mockHardcover.updateBookProgress.mockResolvedValue({ success: true });

      const result = await syncManager._syncSingleBook(mockEbookData, {});

      expect(result.status).toBe('synced');
      expect(mockHardcover.updateBookProgress).toHaveBeenCalledWith(
        'existing-user-book',
        75, // 75% progress
        expect.any(Object),
      );
    });

    it('should handle two-stage matches with missing edition gracefully', async () => {
      const mockIncompleteMatch = {
        userBook: null,
        edition: null, // Missing edition
        book: {
          id: 'book_incomplete',
          title: 'Incomplete Match',
        },
        _matchType: 'title_author_two_stage',
        _bookIdentificationScore: {
          totalScore: 70,
          confidence: 'medium',
        },
      };

      const mockAudiobookshelfBook = {
        id: 'abs-incomplete',
        title: 'Incomplete Match',
        author: 'Test Author',
        progress: 0.3,
      };

      mockBookMatcher.findMatch.mockResolvedValue(mockIncompleteMatch);

      const result = await syncManager._syncSingleBook(
        mockAudiobookshelfBook,
        {},
      );

      expect(result.status).toBe('error');
      expect(result.reason).toContain('edition');
    });

    it('should prioritize two-stage confidence reporting in logs', async () => {
      const mockHighConfidenceMatch = {
        userBook: null,
        edition: {
          id: 'edition_high_conf',
          format: 'audiobook',
        },
        book: {
          id: 'book_high_conf',
          title: 'High Confidence Book',
        },
        _matchType: 'title_author_two_stage',
        _bookIdentificationScore: {
          totalScore: 89.5,
          confidence: 'high',
        },
      };

      const mockBook = {
        id: 'abs-high-conf',
        title: 'High Confidence Book',
        author: 'Confident Author',
        progress: 0.4,
      };

      mockBookMatcher.findMatch.mockResolvedValue(mockHighConfidenceMatch);
      mockHardcover.addBookToLibrary.mockResolvedValue({
        success: true,
        userBook: { id: 'added-book' },
      });

      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      await syncManager._syncSingleBook(mockBook, {});

      // Should log two-stage confidence (89.5%)
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('89.5%'));

      logSpy.mockRestore();
    });
  });

  describe('Auto-Add Integration', () => {
    it('should handle auto-add with two-stage edition data', async () => {
      const mockAutoAddBook = {
        id: 'abs-auto-add',
        title: 'Auto Add Book',
        author: 'Auto Author',
        duration: 32400,
        progress: 0.25, // Above threshold
        libraryItem: {
          media: {
            metadata: {
              title: 'Auto Add Book',
              author: 'Auto Author',
            },
            duration: 32400,
          },
        },
      };

      const mockAutoAddMatch = {
        userBook: null,
        edition: {
          id: 'edition_auto_add',
          asin: 'B987654321',
          audio_seconds: 32400,
          format: 'audiobook',
        },
        book: {
          id: 'book_auto_add',
          title: 'Auto Add Book',
        },
        _matchType: 'title_author_two_stage',
        _bookIdentificationScore: {
          totalScore: 78.9,
          confidence: 'high',
        },
        _needsScoring: false,
      };

      mockBookMatcher.findMatch.mockResolvedValue(mockAutoAddMatch);
      mockHardcover.addBookToLibrary.mockResolvedValue({
        success: true,
        userBook: { id: 'auto-added-book' },
      });

      const result = await syncManager._syncSingleBook(mockAutoAddBook, {});

      expect(result.status).toBe('auto_added');
      expect(mockHardcover.addBookToLibrary).toHaveBeenCalledWith(
        'edition_auto_add',
        25, // 25% progress
      );
    });

    it('should not auto-add when progress below threshold', async () => {
      const mockLowProgressBook = {
        id: 'abs-low-progress',
        title: 'Low Progress Book',
        author: 'Test Author',
        progress: 0.1, // Below 20% threshold
        libraryItem: {
          media: {
            metadata: {
              title: 'Low Progress Book',
              author: 'Test Author',
            },
          },
        },
      };

      const mockMatch = {
        userBook: null,
        edition: {
          id: 'edition_low_progress',
          format: 'ebook',
        },
        _matchType: 'title_author_two_stage',
        _bookIdentificationScore: {
          totalScore: 85,
          confidence: 'high',
        },
      };

      mockBookMatcher.findMatch.mockResolvedValue(mockMatch);

      const result = await syncManager._syncSingleBook(mockLowProgressBook, {});

      expect(result.status).toBe('skipped');
      expect(result.reason).toContain('progress');
      expect(mockHardcover.addBookToLibrary).not.toHaveBeenCalled();
    });

    it('should handle auto-add failures gracefully', async () => {
      const mockFailAddBook = {
        id: 'abs-fail-add',
        title: 'Fail Add Book',
        author: 'Fail Author',
        progress: 0.5,
      };

      const mockMatch = {
        userBook: null,
        edition: {
          id: 'edition_fail_add',
          format: 'audiobook',
        },
        _matchType: 'title_author_two_stage',
      };

      mockBookMatcher.findMatch.mockResolvedValue(mockMatch);
      mockHardcover.addBookToLibrary.mockRejectedValue(new Error('Add failed'));

      const result = await syncManager._syncSingleBook(mockFailAddBook, {});

      expect(result.status).toBe('error');
      expect(result.reason).toContain('Add failed');
    });
  });

  describe('Cache Integration', () => {
    it('should cache two-stage match results correctly', async () => {
      const mockCacheBook = {
        id: 'abs-cache-test',
        title: 'Cache Test Book',
        author: 'Cache Author',
        progress: 0.6,
      };

      const mockCacheMatch = {
        userBook: null,
        edition: {
          id: 'edition_cache_test',
          format: 'ebook',
        },
        book: {
          id: 'book_cache_test',
          title: 'Cache Test Book',
        },
        _matchType: 'title_author_two_stage',
        _bookIdentificationScore: {
          totalScore: 73.4,
        },
      };

      mockBookMatcher.findMatch.mockResolvedValue(mockCacheMatch);
      mockHardcover.addBookToLibrary.mockResolvedValue({
        success: true,
        userBook: { id: 'cached-book' },
      });

      await syncManager._syncSingleBook(mockCacheBook, {});

      // Should cache the edition mapping
      expect(mockCache.storeEditionMapping).toHaveBeenCalledWith(
        'test-user',
        expect.any(String), // titleAuthorId
        'Cache Test Book',
        'edition_cache_test',
        'book_cache_test',
        'Cache Author',
      );
    });

    it('should handle cache errors without failing sync', async () => {
      const mockCacheErrorBook = {
        id: 'abs-cache-error',
        title: 'Cache Error Book',
        author: 'Cache Error Author',
        progress: 0.3,
      };

      const mockMatch = {
        userBook: null,
        edition: {
          id: 'edition_cache_error',
          format: 'audiobook',
        },
        _matchType: 'title_author_two_stage',
      };

      mockBookMatcher.findMatch.mockResolvedValue(mockMatch);
      mockHardcover.addBookToLibrary.mockResolvedValue({
        success: true,
        userBook: { id: 'cache-error-book' },
      });
      mockCache.storeEditionMapping.mockRejectedValue(new Error('Cache error'));

      const result = await syncManager._syncSingleBook(mockCacheErrorBook, {});

      // Should still succeed despite cache error
      expect(result.status).toBe('auto_added');
    });
  });

  describe('Backward Compatibility', () => {
    it('should handle legacy match results alongside two-stage results', async () => {
      const mockLegacyMatch = {
        userBook: {
          id: 'legacy-user-book',
          book: { id: 'legacy-book', title: 'Legacy Book' },
        },
        edition: {
          id: 'legacy-edition',
          format: 'audiobook',
        },
        _matchType: 'asin', // Legacy match type
        _tier: 1,
        _needsScoring: true, // Legacy flag
      };

      const mockLegacyBook = {
        id: 'abs-legacy',
        title: 'Legacy Book',
        author: 'Legacy Author',
        progress: 0.8,
      };

      mockBookMatcher.findMatch.mockResolvedValue(mockLegacyMatch);
      mockHardcover.updateBookProgress.mockResolvedValue({ success: true });

      const result = await syncManager._syncSingleBook(mockLegacyBook, {});

      expect(result.status).toBe('synced');
      expect(mockHardcover.updateBookProgress).toHaveBeenCalled();
    });

    it('should handle mixed match types in batch operations', async () => {
      const mockBooks = [
        {
          id: 'abs-two-stage',
          title: 'Two Stage Book',
          progress: 0.4,
        },
        {
          id: 'abs-legacy',
          title: 'Legacy Book',
          progress: 0.6,
        },
      ];

      const mockTwoStageMatch = {
        _matchType: 'title_author_two_stage',
        userBook: null,
        edition: { id: 'ts-edition' },
      };

      const mockLegacyMatch = {
        _matchType: 'isbn',
        userBook: { id: 'legacy-user-book' },
        edition: { id: 'legacy-edition' },
      };

      mockBookMatcher.findMatch
        .mockResolvedValueOnce(mockTwoStageMatch)
        .mockResolvedValueOnce(mockLegacyMatch);

      mockHardcover.addBookToLibrary.mockResolvedValue({
        success: true,
        userBook: { id: 'new-book' },
      });
      mockHardcover.updateBookProgress.mockResolvedValue({ success: true });

      const results = await Promise.all(
        mockBooks.map(book => syncManager._syncSingleBook(book, {})),
      );

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('auto_added'); // Two-stage
      expect(results[1].status).toBe('synced'); // Legacy
    });
  });
});
