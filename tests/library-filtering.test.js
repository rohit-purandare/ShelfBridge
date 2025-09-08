import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AudiobookshelfClient } from '../src/audiobookshelf-client.js';

/**
 * Tests for library filtering functionality
 * Focus on core logic without complex mocking
 */

describe('Library Filtering', () => {
  const mockLibraries = [
    { id: 'lib1', name: 'Books' },
    { id: 'lib2', name: 'Podcasts' },
    { id: 'lib3', name: 'Audiobooks' },
  ];

  describe('filterLibraries method', () => {
    it('should exclude specified libraries by name', () => {
      const client = new AudiobookshelfClient(
        'https://test.com',
        'test-token',
        1,
        500,
        100,
        600,
        {},
        { exclude: ['Podcasts'] },
      );

      const result = client.filterLibraries(mockLibraries);

      assert.strictEqual(result.libraries.length, 2);
      assert.strictEqual(result.stats.excluded, 1);

      const includedNames = result.libraries.map(lib => lib.name);
      assert(includedNames.includes('Books'));
      assert(includedNames.includes('Audiobooks'));
      assert(!includedNames.includes('Podcasts'));
    });

    it('should include only specified libraries', () => {
      const client = new AudiobookshelfClient(
        'https://test.com',
        'test-token',
        1,
        500,
        100,
        600,
        {},
        { include: ['Books'] },
      );

      const result = client.filterLibraries(mockLibraries);

      assert.strictEqual(result.libraries.length, 1);
      assert.strictEqual(result.libraries[0].name, 'Books');
    });
  });

  describe('_getItemsInProgress method signature', () => {
    it('should accept allowedLibraries parameter', async () => {
      const client = new AudiobookshelfClient(
        'https://test.com',
        'test-token',
        1,
        500,
        100,
        600,
        {},
        { exclude: ['Podcasts'] },
      );

      // Mock the _makeRequest to avoid API calls
      client._makeRequest = async () => ({
        libraryItems: [
          { id: 'item1', libraryId: 'lib1', title: 'Book 1' },
          { id: 'item2', libraryId: 'lib2', title: 'Podcast 1' },
        ],
      });

      // Test filtering works
      const allowedLibraries = [{ id: 'lib1', name: 'Books' }];
      const items = await client._getItemsInProgress(allowedLibraries);

      assert.strictEqual(items.length, 1);
      assert.strictEqual(items[0].libraryId, 'lib1');
      assert.strictEqual(items[0].title, 'Book 1');
    });
  });

  describe('Real-world Tyler scenario', () => {
    it('should exclude Podcasts from items in progress', async () => {
      const client = new AudiobookshelfClient(
        'https://test.com',
        'test-token',
        1,
        500,
        100,
        600,
        {},
        { exclude: ['Podcasts'] },
      );

      client._makeRequest = async () => ({
        libraryItems: [
          { id: 'book1', libraryId: 'lib1', title: 'Harry Potter' },
          { id: 'podcast1', libraryId: 'lib2', title: 'Joe Rogan Episode' },
          { id: 'audiobook1', libraryId: 'lib3', title: 'The Expanse' },
        ],
      });

      const allowedLibraries = [
        { id: 'lib1', name: 'Books' },
        { id: 'lib3', name: 'Audiobooks' },
      ];

      const items = await client._getItemsInProgress(allowedLibraries);

      assert.strictEqual(items.length, 2);
      const titles = items.map(item => item.title);
      assert(titles.includes('Harry Potter'));
      assert(titles.includes('The Expanse'));
      assert(!titles.includes('Joe Rogan Episode'));
    });
  });
});
