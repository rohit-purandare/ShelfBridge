import { describe, it } from 'node:test';
import assert from 'node:assert';
import { AudiobookshelfClient } from '../src/audiobookshelf-client.js';
import ProgressManager from '../src/progress-manager.js';

describe('Completion Detection Robustness', () => {
  describe('_getCompletedBooksFromLibraries', () => {
    it('should detect completion via API method', async () => {
      const client = new AudiobookshelfClient('https://test.com', 'test-token');

      // Mock dependencies
      client.semaphore = {
        acquire: () => Promise.resolve(),
        release: () => {},
      };

      const libraries = [
        {
          id: 'lib1',
          name: 'Test Library',
        },
      ];

      const libraryItem = {
        id: 'book1',
        media: {
          metadata: {
            title: 'Test Book',
          },
        },
        is_finished: false, // Metadata says not finished
      };

      // Mock getLibraryItems
      client.getLibraryItems = () => Promise.resolve([libraryItem]);

      // Mock _getUserProgress - API says finished
      client._getUserProgress = () =>
        Promise.resolve({
          isFinished: true,
          progress: 1.0,
        });

      const result = await client._getCompletedBooksFromLibraries(libraries);

      assert.strictEqual(result.length, 1);
      assert.deepStrictEqual(result[0], {
        id: 'book1',
        libraryId: 'lib1',
        title: 'Test Book',
        isCompleted: true,
      });
    });

    it('should detect completion via metadata fallback when API says not finished', async () => {
      const client = new AudiobookshelfClient('https://test.com', 'test-token');

      client.semaphore = {
        acquire: () => Promise.resolve(),
        release: () => {},
      };

      const libraries = [
        {
          id: 'lib1',
          name: 'Test Library',
        },
      ];

      const libraryItem = {
        id: 'book1',
        media: {
          metadata: {
            title: 'Test Book',
          },
        },
        is_finished: true, // Metadata says finished
      };

      client.getLibraryItems = () => Promise.resolve([libraryItem]);

      // API says not finished
      client._getUserProgress = () =>
        Promise.resolve({
          isFinished: false,
          progress: 0.95,
        });

      const result = await client._getCompletedBooksFromLibraries(libraries);

      assert.strictEqual(result.length, 1);
      assert.deepStrictEqual(result[0], {
        id: 'book1',
        libraryId: 'lib1',
        title: 'Test Book',
        isCompleted: true,
      });
    });

    it('should use metadata fallback when API throws error', async () => {
      const client = new AudiobookshelfClient('https://test.com', 'test-token');

      client.semaphore = {
        acquire: () => Promise.resolve(),
        release: () => {},
      };

      const libraries = [
        {
          id: 'lib1',
          name: 'Test Library',
        },
      ];

      const libraryItem = {
        id: 'book1',
        media: {
          metadata: {
            title: 'Test Book',
          },
        },
        is_finished: true, // Metadata says finished
      };

      client.getLibraryItems = () => Promise.resolve([libraryItem]);

      // API throws error
      client._getUserProgress = () => Promise.reject(new Error('API Error'));

      const result = await client._getCompletedBooksFromLibraries(libraries);

      assert.strictEqual(result.length, 1);
      assert.deepStrictEqual(result[0], {
        id: 'book1',
        libraryId: 'lib1',
        title: 'Test Book',
        isCompleted: true,
      });
    });

    it('should not return book when both API and metadata say not finished', async () => {
      const client = new AudiobookshelfClient('https://test.com', 'test-token');

      client.semaphore = {
        acquire: () => Promise.resolve(),
        release: () => {},
      };

      const libraries = [
        {
          id: 'lib1',
          name: 'Test Library',
        },
      ];

      const libraryItem = {
        id: 'book1',
        media: {
          metadata: {
            title: 'Test Book',
          },
        },
        is_finished: false, // Metadata says not finished
      };

      client.getLibraryItems = () => Promise.resolve([libraryItem]);

      // API also says not finished
      client._getUserProgress = () =>
        Promise.resolve({
          isFinished: false,
          progress: 0.5,
        });

      const result = await client._getCompletedBooksFromLibraries(libraries);

      assert.strictEqual(result.length, 0);
    });

    it('should not return book when API errors and metadata says not finished', async () => {
      const client = new AudiobookshelfClient('https://test.com', 'test-token');

      client.semaphore = {
        acquire: () => Promise.resolve(),
        release: () => {},
      };

      const libraries = [
        {
          id: 'lib1',
          name: 'Test Library',
        },
      ];

      const libraryItem = {
        id: 'book1',
        media: {
          metadata: {
            title: 'Test Book',
          },
        },
        is_finished: false, // Metadata says not finished
      };

      client.getLibraryItems = () => Promise.resolve([libraryItem]);

      // API throws error
      client._getUserProgress = () =>
        Promise.reject(new Error('Network Error'));

      const result = await client._getCompletedBooksFromLibraries(libraries);

      assert.strictEqual(result.length, 0);
    });

    it('should handle multiple detection methods correctly', async () => {
      const client = new AudiobookshelfClient('https://test.com', 'test-token');

      client.semaphore = {
        acquire: () => Promise.resolve(),
        release: () => {},
      };

      const libraries = [
        {
          id: 'lib1',
          name: 'Test Library',
        },
      ];

      const libraryItems = [
        {
          id: 'book1',
          media: { metadata: { title: 'API Finished Book' } },
          is_finished: false,
        },
        {
          id: 'book2',
          media: { metadata: { title: 'Metadata Finished Book' } },
          is_finished: true,
        },
        {
          id: 'book3',
          media: { metadata: { title: 'Both Finished Book' } },
          is_finished: true,
        },
        {
          id: 'book4',
          media: { metadata: { title: 'Neither Finished Book' } },
          is_finished: false,
        },
      ];

      client.getLibraryItems = () => Promise.resolve(libraryItems);

      // Mock different API responses
      let callCount = 0;
      client._getUserProgress = () => {
        const responses = [
          { isFinished: true, progress: 1.0 }, // book1: API finished
          { isFinished: false, progress: 0.8 }, // book2: API not finished
          { isFinished: true, progress: 1.0 }, // book3: API finished
          { isFinished: false, progress: 0.3 }, // book4: API not finished
        ];
        return Promise.resolve(responses[callCount++]);
      };

      const result = await client._getCompletedBooksFromLibraries(libraries);

      assert.strictEqual(result.length, 3);

      const titles = result.map(book => book.title).sort();
      assert.deepStrictEqual(titles, [
        'API Finished Book',
        'Both Finished Book',
        'Metadata Finished Book',
      ]);
    });
  });

  describe('ProgressManager.extractFinishedFlag edge cases', () => {
    it('should handle null/undefined bookData', () => {
      assert.strictEqual(ProgressManager.extractFinishedFlag(null), false);
      assert.strictEqual(ProgressManager.extractFinishedFlag(undefined), false);
    });

    it('should handle missing is_finished property', () => {
      assert.strictEqual(ProgressManager.extractFinishedFlag({}), false);
      assert.strictEqual(
        ProgressManager.extractFinishedFlag({ other: 'property' }),
        false,
      );
    });

    it('should handle various truthy values for is_finished', () => {
      assert.strictEqual(
        ProgressManager.extractFinishedFlag({ is_finished: true }),
        true,
      );
      assert.strictEqual(
        ProgressManager.extractFinishedFlag({ is_finished: 1 }),
        true,
      );
      assert.strictEqual(
        ProgressManager.extractFinishedFlag({ is_finished: 'true' }),
        false,
      ); // String should be false
      assert.strictEqual(
        ProgressManager.extractFinishedFlag({ is_finished: 2 }),
        false,
      ); // Only 1 should be true
    });

    it('should handle falsy values for is_finished', () => {
      assert.strictEqual(
        ProgressManager.extractFinishedFlag({ is_finished: false }),
        false,
      );
      assert.strictEqual(
        ProgressManager.extractFinishedFlag({ is_finished: 0 }),
        false,
      );
      assert.strictEqual(
        ProgressManager.extractFinishedFlag({ is_finished: null }),
        false,
      );
      assert.strictEqual(
        ProgressManager.extractFinishedFlag({ is_finished: undefined }),
        false,
      );
    });
  });
});
