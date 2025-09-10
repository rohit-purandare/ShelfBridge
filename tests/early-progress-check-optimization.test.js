/**
 * Early Progress Check Optimization Tests
 *
 * Tests for the enhanced early progress check optimization that prevents
 * unnecessary hardcover searches for title/author matched books with unchanged progress.
 * 
 * This addresses the issue where title/author matched books were always triggering
 * hardcover API searches even when their progress hadn't changed.
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
import { BookCache } from '../src/book-cache.js';
import ProgressManager from '../src/progress-manager.js';

describe('Early Progress Check Optimization', () => {
  let mockUser;
  let mockGlobalConfig;
  let mockAudiobookshelf;
  let mockHardcover;
  let mockCache;
  let mockBookMatcher;
  let syncManager;

  beforeEach(() => {
    // Mock user configuration
    mockUser = {
      id: 'test-user',
      hardcover_token: 'test-token',
      abs_url: 'http://test-abs.com',
      abs_token: 'abs-token',
    };

    // Mock global configuration
    mockGlobalConfig = {
      force_sync: false,
      auto_add_books: true,
      min_progress_threshold: 5.0,
      title_author_matching: {
        enabled: true,
        confidence_threshold: 0.7,
      },
    };

    // Mock AudiobookshelfClient
    mockAudiobookshelf = {
      getReadingProgress: jest.fn(),
      cleanup: jest.fn(),
    };

    // Mock HardcoverClient
    mockHardcover = {
      getUserBooks: jest.fn(),
      searchBooksForMatching: jest.fn(), // This should NOT be called for unchanged progress
      addBookToLibrary: jest.fn(),
      updateReadingProgress: jest.fn(),
      cleanup: jest.fn(),
    };

    // Mock BookCache
    mockCache = {
      getCachedBookInfo: jest.fn(),
      hasProgressChanged: jest.fn(),
      generateTitleAuthorIdentifier: jest.fn(),
      storeBookSyncData: jest.fn(),
      incrementSyncCount: jest.fn(),
      close: jest.fn(),
    };

    // Mock BookMatcher
    mockBookMatcher = {
      findMatch: jest.fn(), // This should NOT be called for unchanged progress
      setUserLibrary: jest.fn(),
    };

    // Create SyncManager instance
    syncManager = new SyncManager(mockUser, mockGlobalConfig, false, false);

    // Inject mocks
    syncManager.audiobookshelf = mockAudiobookshelf;
    syncManager.hardcover = mockHardcover;
    syncManager.cache = mockCache;
    syncManager.bookMatcher = mockBookMatcher;

    // Mock cache increment
    mockCache.incrementSyncCount.mockResolvedValue({ total_syncs: 1 });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('ISBN/ASIN Books - Early Progress Check', () => {
    it('should skip expensive matching for ISBN books with unchanged progress', async () => {
      const mockIsbnBook = {
        id: 'abs-isbn-book',
        title: 'ISBN Test Book',
        author: 'Test Author',
        media: {
          metadata: {
            title: 'ISBN Test Book',
            authors: [{ name: 'Test Author' }],
            isbn: '9781234567890',
          },
        },
        userMediaProgress: {
          progress: 0.5, // 50% progress
          isFinished: false,
        },
      };

      // Mock progress validation
      jest.spyOn(ProgressManager, 'getValidatedProgress').mockReturnValue(50.0);
      
      // Mock cache says progress hasn't changed
      mockCache.hasProgressChanged.mockResolvedValue(false);

      const result = await syncManager._syncSingleBook(mockIsbnBook, null);

      // Should skip early without calling expensive operations
      expect(result.status).toBe('skipped');
      expect(result.reason).toBe('Progress unchanged (optimized early check)');
      expect(result.actions[0]).toContain('isbn');
      
      // Expensive operations should NOT be called
      expect(mockBookMatcher.findMatch).not.toHaveBeenCalled();
      expect(mockHardcover.searchBooksForMatching).not.toHaveBeenCalled();
      expect(mockHardcover.updateReadingProgress).not.toHaveBeenCalled();
    });

    it('should proceed with matching for ISBN books with changed progress', async () => {
      const mockIsbnBook = {
        id: 'abs-isbn-book',
        title: 'ISBN Test Book',
        author: 'Test Author', 
        media: {
          metadata: {
            title: 'ISBN Test Book',
            authors: [{ name: 'Test Author' }],
            isbn: '9781234567890',
          },
        },
        userMediaProgress: {
          progress: 0.7, // 70% progress (changed)
          isFinished: false,
        },
      };

      // Mock progress validation
      jest.spyOn(ProgressManager, 'getValidatedProgress').mockReturnValue(70.0);
      
      // Mock cache says progress HAS changed
      mockCache.hasProgressChanged.mockResolvedValue(true);

      // Mock successful match
      const mockMatch = {
        userBook: { id: 'user-book-123' },
        edition: { id: 'edition-456', format: 'audiobook' },
        _matchType: 'isbn',
      };
      mockBookMatcher.findMatch.mockResolvedValue(mockMatch);

      const result = await syncManager._syncSingleBook(mockIsbnBook, null);

      // Should proceed with expensive matching since progress changed
      expect(mockBookMatcher.findMatch).toHaveBeenCalled();
      expect(result.status).not.toBe('skipped');
    });
  });

  describe('Title/Author Books - Early Progress Check (NEW)', () => {
    it('should skip expensive matching for cached title/author books with unchanged progress', async () => {
      const mockTitleAuthorBook = {
        id: 'abs-title-author-book',
        title: 'Title Author Test Book',
        author: 'Test Author',
        media: {
          metadata: {
            title: 'Title Author Test Book', 
            authors: [{ name: 'Test Author' }],
            // No ISBN/ASIN - will use title/author matching
          },
        },
        userMediaProgress: {
          progress: 0.3, // 30% progress
          isFinished: false,
        },
      };

      // Mock title/author identifier generation
      const titleAuthorId = 'title_author:title_author_test_book|test_author';
      mockCache.generateTitleAuthorIdentifier.mockReturnValue(titleAuthorId);

      // Mock progress validation
      jest.spyOn(ProgressManager, 'getValidatedProgress').mockReturnValue(30.0);

      // Mock cache has data for this title/author combination
      mockCache.getCachedBookInfo.mockResolvedValue({
        exists: true,
        edition_id: 'cached-edition-123',
        progress_percent: 30.0,
        last_sync: '2024-01-01T00:00:00.000Z',
      });

      // Mock cache says progress hasn't changed
      mockCache.hasProgressChanged.mockResolvedValue(false);

      const result = await syncManager._syncSingleBook(mockTitleAuthorBook, null);

      // Should skip early without calling expensive operations
      expect(result.status).toBe('skipped');
      expect(result.reason).toBe('Progress unchanged (optimized early check)');
      expect(result.actions[0]).toContain('title_author');

      // Critical: These expensive operations should NOT be called
      expect(mockBookMatcher.findMatch).not.toHaveBeenCalled();
      expect(mockHardcover.searchBooksForMatching).not.toHaveBeenCalled();
      expect(mockHardcover.updateReadingProgress).not.toHaveBeenCalled();

      // Verify correct cache calls
      expect(mockCache.generateTitleAuthorIdentifier).toHaveBeenCalledWith(
        'Title Author Test Book',
        'Test Author'
      );
      expect(mockCache.getCachedBookInfo).toHaveBeenCalledWith(
        'test-user',
        titleAuthorId,
        'Title Author Test Book',
        'title_author'
      );
    });

    it('should proceed with expensive matching for title/author books with changed progress', async () => {
      const mockTitleAuthorBook = {
        id: 'abs-title-author-changed',
        title: 'Changed Progress Book',
        author: 'Changed Author',
        media: {
          metadata: {
            title: 'Changed Progress Book',
            authors: [{ name: 'Changed Author' }],
          },
        },
        userMediaProgress: {
          progress: 0.6, // 60% progress (changed)
          isFinished: false,
        },
      };

      // Mock title/author identifier generation
      const titleAuthorId = 'title_author:changed_progress_book|changed_author';
      mockCache.generateTitleAuthorIdentifier.mockReturnValue(titleAuthorId);

      // Mock progress validation
      jest.spyOn(ProgressManager, 'getValidatedProgress').mockReturnValue(60.0);

      // Mock cache has data but progress changed
      mockCache.getCachedBookInfo.mockResolvedValue({
        exists: true,
        edition_id: 'cached-edition-456',
        progress_percent: 45.0, // Previous progress was 45%
        last_sync: '2024-01-01T00:00:00.000Z',
      });

      // Mock cache says progress HAS changed
      mockCache.hasProgressChanged.mockResolvedValue(true);

      // Mock successful title/author match
      const mockTitleAuthorMatch = {
        userBook: { id: 'user-book-789' },
        edition: { id: 'edition-789', format: 'ebook' },
        _matchType: 'title_author_two_stage',
        _bookIdentificationScore: { totalScore: 85.5 },
      };
      mockBookMatcher.findMatch.mockResolvedValue(mockTitleAuthorMatch);

      const result = await syncManager._syncSingleBook(mockTitleAuthorBook, null);

      // Should proceed with expensive matching since progress changed
      expect(mockBookMatcher.findMatch).toHaveBeenCalled();
      expect(result.status).not.toBe('skipped');

      // Verify it used title_author identifier type
      expect(mockCache.hasProgressChanged).toHaveBeenCalledWith(
        'test-user',
        titleAuthorId,
        'Changed Progress Book',
        60.0,
        'title_author'
      );
    });

    it('should proceed with expensive matching for title/author books with no cache', async () => {
      const mockNewTitleAuthorBook = {
        id: 'abs-new-title-author',
        title: 'New Title Author Book',
        author: 'New Author',
        media: {
          metadata: {
            title: 'New Title Author Book',
            authors: [{ name: 'New Author' }],
          },
        },
        userMediaProgress: {
          progress: 0.4,
          isFinished: false,
        },
      };

      // Mock title/author identifier generation
      const titleAuthorId = 'title_author:new_title_author_book|new_author';
      mockCache.generateTitleAuthorIdentifier.mockReturnValue(titleAuthorId);

      // Mock progress validation
      jest.spyOn(ProgressManager, 'getValidatedProgress').mockReturnValue(40.0);

      // Mock cache has NO data for this book
      mockCache.getCachedBookInfo.mockResolvedValue({
        exists: false,
      });

      // Mock successful match that will trigger auto-add
      const mockNewMatch = {
        userBook: null, // Not in library yet
        edition: { id: 'new-edition-123', format: 'audiobook' },
        book: { id: 'new-book-123', title: 'New Title Author Book' },
        _matchType: 'title_author_two_stage',
        _isSearchResult: true,
      };
      mockBookMatcher.findMatch.mockResolvedValue(mockNewMatch);

      const result = await syncManager._syncSingleBook(mockNewTitleAuthorBook, null);

      // Should proceed with expensive matching since no cache exists
      expect(mockBookMatcher.findMatch).toHaveBeenCalled();
      expect(result.status).not.toBe('skipped');

      // Verify cache lookup was attempted
      expect(mockCache.getCachedBookInfo).toHaveBeenCalledWith(
        'test-user',
        titleAuthorId,
        'New Title Author Book',
        'title_author'
      );
    });
  });

  describe('Force Sync Behavior', () => {
    it('should bypass early progress check when force_sync is enabled', async () => {
      // Enable force sync
      syncManager.globalConfig.force_sync = true;

      const mockForceSyncBook = {
        id: 'abs-force-sync',
        title: 'Force Sync Book',
        author: 'Force Author',
        media: {
          metadata: {
            title: 'Force Sync Book',
            authors: [{ name: 'Force Author' }],
            isbn: '9781111111111',
          },
        },
        userMediaProgress: {
          progress: 0.5,
          isFinished: false,
        },
      };

      // Mock progress validation
      jest.spyOn(ProgressManager, 'getValidatedProgress').mockReturnValue(50.0);

      // Even though progress hasn't changed, force sync should proceed
      mockCache.hasProgressChanged.mockResolvedValue(false);

      // Mock successful match
      const mockMatch = {
        userBook: { id: 'force-user-book' },
        edition: { id: 'force-edition', format: 'audiobook' },
        _matchType: 'isbn',
      };
      mockBookMatcher.findMatch.mockResolvedValue(mockMatch);

      const result = await syncManager._syncSingleBook(mockForceSyncBook, null);

      // Should NOT skip - force sync overrides early optimization
      expect(result.status).not.toBe('skipped');
      expect(mockBookMatcher.findMatch).toHaveBeenCalled();

      // Cache progress check should not even be called with force_sync
      expect(mockCache.hasProgressChanged).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle cache errors gracefully and proceed with matching', async () => {
      const mockErrorBook = {
        id: 'abs-cache-error',
        title: 'Cache Error Book', 
        author: 'Error Author',
        media: {
          metadata: {
            title: 'Cache Error Book',
            authors: [{ name: 'Error Author' }],
          },
        },
        userMediaProgress: {
          progress: 0.5,
          isFinished: false,
        },
      };

      // Mock title/author identifier generation
      const titleAuthorId = 'title_author:cache_error_book|error_author';
      mockCache.generateTitleAuthorIdentifier.mockReturnValue(titleAuthorId);

      // Mock progress validation
      jest.spyOn(ProgressManager, 'getValidatedProgress').mockReturnValue(50.0);

      // Mock cache error
      mockCache.getCachedBookInfo.mockRejectedValue(new Error('Cache connection error'));

      // Mock successful match (fallback)
      const mockMatch = {
        userBook: { id: 'error-recovery-book' },
        edition: { id: 'error-recovery-edition', format: 'ebook' },
        _matchType: 'title_author_two_stage',
      };
      mockBookMatcher.findMatch.mockResolvedValue(mockMatch);

      const result = await syncManager._syncSingleBook(mockErrorBook, null);

      // Should proceed with matching despite cache error
      expect(mockBookMatcher.findMatch).toHaveBeenCalled();
      expect(result.status).not.toBe('error');
    });

    it('should handle invalid progress gracefully', async () => {
      const mockInvalidProgressBook = {
        id: 'abs-invalid-progress',
        title: 'Invalid Progress Book',
        author: 'Invalid Author',
        media: {
          metadata: {
            title: 'Invalid Progress Book',
            authors: [{ name: 'Invalid Author' }],
            isbn: '9782222222222',
          },
        },
        userMediaProgress: {
          progress: null, // Invalid progress
          isFinished: false,
        },
      };

      // Mock progress validation returns null (invalid)
      jest.spyOn(ProgressManager, 'getValidatedProgress').mockReturnValue(null);

      const result = await syncManager._syncSingleBook(mockInvalidProgressBook, null);

      // Should skip with appropriate error message
      expect(result.status).toBe('skipped');
      expect(result.reason).toContain('Invalid progress data');

      // No cache or matching operations should be attempted
      expect(mockCache.hasProgressChanged).not.toHaveBeenCalled();
      expect(mockBookMatcher.findMatch).not.toHaveBeenCalled();
    });
  });

  describe('Performance Impact', () => {
    it('should measure timing improvement for early skipped books', async () => {
      const mockTimedBook = {
        id: 'abs-timed-book',
        title: 'Timed Book',
        author: 'Timed Author',
        media: {
          metadata: {
            title: 'Timed Book',
            authors: [{ name: 'Timed Author' }],
          },
        },
        userMediaProgress: {
          progress: 0.8,
          isFinished: false,
        },
      };

      // Mock title/author identifier
      mockCache.generateTitleAuthorIdentifier.mockReturnValue('title_author:timed_book|timed_author');

      // Mock progress validation
      jest.spyOn(ProgressManager, 'getValidatedProgress').mockReturnValue(80.0);

      // Mock cache data exists and progress unchanged
      mockCache.getCachedBookInfo.mockResolvedValue({
        exists: true,
        edition_id: 'timed-edition',
        progress_percent: 80.0,
      });
      mockCache.hasProgressChanged.mockResolvedValue(false);

      const startTime = performance.now();
      const result = await syncManager._syncSingleBook(mockTimedBook, null);
      const endTime = performance.now();

      // Should complete very quickly (under 50ms for early skip)
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(50);

      expect(result.status).toBe('skipped');
      expect(result.timing).toBeDefined();
      expect(result.timing).toBeGreaterThan(0);
    });

    it('should avoid API calls for multiple unchanged title/author books in batch', async () => {
      const unchangedBooks = [
        { id: 'book1', title: 'Unchanged 1', progress: 0.3 },
        { id: 'book2', title: 'Unchanged 2', progress: 0.5 },
        { id: 'book3', title: 'Unchanged 3', progress: 0.7 },
      ].map(book => ({
        id: book.id,
        title: book.title,
        author: 'Batch Author',
        media: {
          metadata: {
            title: book.title,
            authors: [{ name: 'Batch Author' }],
          },
        },
        userMediaProgress: {
          progress: book.progress,
          isFinished: false,
        },
      }));

      // Mock all as cached with unchanged progress
      unchangedBooks.forEach((_, index) => {
        mockCache.generateTitleAuthorIdentifier.mockReturnValueOnce(`title_author:unchanged_${index+1}|batch_author`);
      });

      jest.spyOn(ProgressManager, 'getValidatedProgress')
        .mockReturnValueOnce(30.0)
        .mockReturnValueOnce(50.0)
        .mockReturnValueOnce(70.0);

      mockCache.getCachedBookInfo.mockResolvedValue({ exists: true, progress_percent: 30.0 });
      mockCache.hasProgressChanged.mockResolvedValue(false);

      // Process all books
      const results = await Promise.all(
        unchangedBooks.map(book => syncManager._syncSingleBook(book, null))
      );

      // All should be skipped
      results.forEach(result => {
        expect(result.status).toBe('skipped');
        expect(result.reason).toBe('Progress unchanged (optimized early check)');
      });

      // No expensive operations should be called at all
      expect(mockBookMatcher.findMatch).not.toHaveBeenCalled();
      expect(mockHardcover.searchBooksForMatching).not.toHaveBeenCalled();
      expect(mockHardcover.updateReadingProgress).not.toHaveBeenCalled();
    });
  });

  describe('Integration with Existing Early Check', () => {
    it('should work alongside existing ISBN/ASIN early check logic', async () => {
      const mixedBooks = [
        // ISBN book (existing logic)
        {
          id: 'isbn-book',
          title: 'ISBN Book',
          author: 'ISBN Author',
          media: {
            metadata: {
              title: 'ISBN Book',
              authors: [{ name: 'ISBN Author' }],
              isbn: '9783333333333',
            },
          },
          userMediaProgress: { progress: 0.4, isFinished: false },
        },
        // Title/Author book (new logic)
        {
          id: 'title-author-book',
          title: 'Title Author Book',
          author: 'Title Author',
          media: {
            metadata: {
              title: 'Title Author Book',
              authors: [{ name: 'Title Author' }],
              // No ISBN - will use title/author
            },
          },
          userMediaProgress: { progress: 0.6, isFinished: false },
        },
      ];

      // Mock progress validation
      jest.spyOn(ProgressManager, 'getValidatedProgress')
        .mockReturnValueOnce(40.0) // ISBN book
        .mockReturnValueOnce(60.0); // Title/Author book

      // Mock title/author identifier for second book
      mockCache.generateTitleAuthorIdentifier.mockReturnValue('title_author:title_author_book|title_author');

      // Mock cache - both books have unchanged progress
      mockCache.getCachedBookInfo.mockResolvedValue({ exists: true, progress_percent: 60.0 });
      mockCache.hasProgressChanged.mockResolvedValue(false);

      const results = await Promise.all(
        mixedBooks.map(book => syncManager._syncSingleBook(book, null))
      );

      // Both should be skipped via early optimization
      expect(results[0].status).toBe('skipped'); // ISBN book
      expect(results[0].actions[0]).toContain('isbn');
      
      expect(results[1].status).toBe('skipped'); // Title/Author book  
      expect(results[1].actions[0]).toContain('title_author');

      // No expensive operations for either book
      expect(mockBookMatcher.findMatch).not.toHaveBeenCalled();
      expect(mockHardcover.searchBooksForMatching).not.toHaveBeenCalled();
    });
  });
});