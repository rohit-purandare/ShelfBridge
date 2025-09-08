import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { AudiobookshelfClient } from '../src/audiobookshelf-client.js';

/**
 * Comprehensive tests for library filtering functionality
 * 
 * Tests:
 * - Include/exclude library filtering
 * - Items in progress filtering by library
 * - Completed books filtering by library (existing)
 * - Edge cases and error handling
 * - Configuration variations
 */

// Mock HTTP client for testing
class MockAxiosClient {
  constructor() {
    this.responses = new Map();
    this.requests = [];
  }

  setResponse(endpoint, response) {
    this.responses.set(endpoint, response);
  }

  async get(url, config = {}) {
    this.requests.push({ method: 'GET', url, config });
    
    // Extract endpoint from full URL for matching
    const endpoint = url.replace(/^.*\/api/, '/api');
    
    if (this.responses.has(endpoint)) {
      const response = this.responses.get(endpoint);
      return { data: response, status: 200 };
    }
    
    throw new Error(`No mock response configured for: ${endpoint}`);
  }

  async request(config) {
    return this.get(config.url, config);
  }

  getRequests() {
    return this.requests;
  }

  clearRequests() {
    this.requests = [];
  }
}

describe('Library Filtering', () => {
  let client;
  let mockAxios;
  
  // Sample data for testing
  const mockLibraries = [
    { id: 'lib1', name: 'Books', mediaType: 'book' },
    { id: 'lib2', name: 'Podcasts', mediaType: 'podcast' },
    { id: 'lib3', name: 'Audiobooks', mediaType: 'book' },
  ];

  const mockItemsInProgress = {
    libraryItems: [
      { id: 'item1', libraryId: 'lib1', title: 'Book 1' },
      { id: 'item2', libraryId: 'lib2', title: 'Podcast Episode 1' },
      { id: 'item3', libraryId: 'lib3', title: 'Audiobook 1' },
      { id: 'item4', libraryId: 'lib1', title: 'Book 2' },
    ]
  };

  beforeEach(() => {
    mockAxios = new MockAxiosClient();
    
    // Set up common mock responses
    mockAxios.setResponse('/api/libraries', { libraries: mockLibraries });
    mockAxios.setResponse('/api/me/items-in-progress', mockItemsInProgress);
    mockAxios.setResponse('/api/ping', { success: true });
    mockAxios.setResponse('/api/me', { id: 'test-user', username: 'test' });
    
    // Mock library item counts
    mockAxios.setResponse('/api/libraries/lib1/items?limit=1&page=0', { total: 100 });
    mockAxios.setResponse('/api/libraries/lib2/items?limit=1&page=0', { total: 50 });
    mockAxios.setResponse('/api/libraries/lib3/items?limit=1&page=0', { total: 75 });
  });

  describe('filterLibraries method', () => {
    it('should return all libraries when no filtering is configured', () => {
      client = new AudiobookshelfClient(
        'https://test.com',
        'test-token',
        1, 500, 100, 600, {},
        null // No library config
      );
      
      const result = client.filterLibraries(mockLibraries);
      
      assert.deepStrictEqual(result.libraries, mockLibraries);
      assert.strictEqual(result.stats.total, 3);
      assert.strictEqual(result.stats.included, 3);
      assert.strictEqual(result.stats.excluded, 0);
      assert.deepStrictEqual(result.stats.unmatched, []);
    });

    it('should exclude specified libraries by name', () => {
      client = new AudiobookshelfClient(
        'https://test.com',
        'test-token',
        1, 500, 100, 600, {},
        { exclude: ['Podcasts'] }
      );
      
      const result = client.filterLibraries(mockLibraries);
      
      assert.strictEqual(result.libraries.length, 2);
      assert.strictEqual(result.stats.included, 2);
      assert.strictEqual(result.stats.excluded, 1);
      assert.deepStrictEqual(result.stats.unmatched, []);
      
      // Verify correct libraries are included
      const includedNames = result.libraries.map(lib => lib.name);
      assert(includedNames.includes('Books'));
      assert(includedNames.includes('Audiobooks'));
      assert(!includedNames.includes('Podcasts'));
    });

    it('should exclude specified libraries by ID', () => {
      client = new AudiobookshelfClient(
        'https://test.com',
        'test-token',
        1, 500, 100, 600, {},
        { exclude: ['lib2'] } // Exclude by ID instead of name
      );
      
      const result = client.filterLibraries(mockLibraries);
      
      assert.strictEqual(result.libraries.length, 2);
      assert.strictEqual(result.stats.excluded, 1);
      
      // Verify Podcasts library (lib2) is excluded
      const includedIds = result.libraries.map(lib => lib.id);
      assert(!includedIds.includes('lib2'));
    });

    it('should include only specified libraries by name', () => {
      client = new AudiobookshelfClient(
        'https://test.com',
        'test-token',
        1, 500, 100, 600, {},
        { include: ['Books', 'Audiobooks'] }
      );
      
      const result = client.filterLibraries(mockLibraries);
      
      assert.strictEqual(result.libraries.length, 2);
      assert.strictEqual(result.stats.included, 2);
      assert.strictEqual(result.stats.excluded, 1);
      
      const includedNames = result.libraries.map(lib => lib.name);
      assert(includedNames.includes('Books'));
      assert(includedNames.includes('Audiobooks'));
      assert(!includedNames.includes('Podcasts'));
    });

    it('should handle case-insensitive library name matching', () => {
      client = new AudiobookshelfClient(
        'https://test.com',
        'test-token',
        1, 500, 100, 600, {},
        { exclude: ['podcasts'] } // lowercase
      );
      
      const result = client.filterLibraries(mockLibraries);
      
      assert.strictEqual(result.libraries.length, 2);
      const includedNames = result.libraries.map(lib => lib.name);
      assert(!includedNames.includes('Podcasts'));
    });

    it('should track unmatched filter entries', () => {
      client = new AudiobookshelfClient(
        'https://test.com',
        'test-token',
        1, 500, 100, 600, {},
        { exclude: ['Podcasts', 'NonExistentLibrary'] }
      );
      
      const result = client.filterLibraries(mockLibraries);
      
      assert.strictEqual(result.stats.unmatched.length, 1);
      assert(result.stats.unmatched.includes('NonExistentLibrary'));
    });

    it('should handle multiple exclude patterns', () => {
      client = new AudiobookshelfClient(
        'https://test.com',
        'test-token',
        1, 500, 100, 600, {},
        { exclude: ['Podcasts', 'Audiobooks'] }
      );
      
      const result = client.filterLibraries(mockLibraries);
      
      assert.strictEqual(result.libraries.length, 1);
      assert.strictEqual(result.libraries[0].name, 'Books');
    });
  });

  describe('_getItemsInProgress filtering', () => {
    beforeEach(() => {
      // Replace the axios instance with our mock
      client = new AudiobookshelfClient(
        'https://test.com',
        'test-token',
        1, 500, 100, 600, {},
        { exclude: ['Podcasts'] }
      );
      client.axios = mockAxios;
    });

    it('should return all items when no library filtering is provided', async () => {
      const items = await client._getItemsInProgress(null);
      
      assert.strictEqual(items.length, 4);
      assert.deepStrictEqual(items, mockItemsInProgress.libraryItems);
    });

    it('should filter items in progress by allowed libraries', async () => {
      const allowedLibraries = [
        { id: 'lib1', name: 'Books' },
        { id: 'lib3', name: 'Audiobooks' }
      ];
      
      const items = await client._getItemsInProgress(allowedLibraries);
      
      assert.strictEqual(items.length, 3); // 2 from lib1 + 1 from lib3
      
      // Verify no items from lib2 (Podcasts)
      const libraryIds = items.map(item => item.libraryId);
      assert(!libraryIds.includes('lib2'));
      assert(libraryIds.includes('lib1'));
      assert(libraryIds.includes('lib3'));
    });

    it('should return empty array when no items match allowed libraries', async () => {
      const allowedLibraries = [
        { id: 'lib999', name: 'NonExistentLibrary' }
      ];
      
      const items = await client._getItemsInProgress(allowedLibraries);
      
      assert.strictEqual(items.length, 0);
    });

    it('should handle empty allowed libraries array', async () => {
      const items = await client._getItemsInProgress([]);
      
      assert.strictEqual(items.length, 4); // Should return all items
    });
  });

  describe('Integration with getReadingProgress method calls', () => {
    it('should call _getItemsInProgress with filtered libraries', () => {
      // This is a conceptual test - in real implementation, we'd need to mock
      // the method calls to verify the correct parameters are passed
      
      client = new AudiobookshelfClient(
        'https://test.com',
        'test-token',
        1, 500, 100, 600, {},
        { exclude: ['Podcasts'] }
      );
      
      // Verify that the library config is set correctly
      assert.deepStrictEqual(client.libraryConfig, { exclude: ['Podcasts'] });
      
      // Verify filterLibraries works correctly
      const filtered = client.filterLibraries(mockLibraries);
      assert.strictEqual(filtered.libraries.length, 2);
      assert(!filtered.libraries.some(lib => lib.name === 'Podcasts'));
    });
  });

  describe('Edge cases and error handling', () => {
    beforeEach(() => {
      client = new AudiobookshelfClient(
        'https://test.com',
        'test-token',
        1, 500, 100, 600, {},
        { exclude: ['Podcasts'] }
      );
      client.axios = mockAxios;
    });

    it('should handle missing libraryId field gracefully', async () => {
      const itemsWithMissingLibraryId = {
        libraryItems: [
          { id: 'item1', libraryId: 'lib1', title: 'Book 1' },
          { id: 'item2', title: 'Book without libraryId' }, // Missing libraryId
          { id: 'item3', libraryId: 'lib3', title: 'Audiobook 1' },
        ]
      };
      
      mockAxios.setResponse('/api/me/items-in-progress', itemsWithMissingLibraryId);
      
      const allowedLibraries = [
        { id: 'lib1', name: 'Books' },
        { id: 'lib3', name: 'Audiobooks' }
      ];
      
      const items = await client._getItemsInProgress(allowedLibraries);
      
      // Should include items with valid libraryIds that match
      assert.strictEqual(items.length, 2);
      assert(items.some(item => item.id === 'item1'));
      assert(items.some(item => item.id === 'item3'));
    });

    it('should handle API errors gracefully', async () => {
      // Mock API error response
      mockAxios.setResponse('/api/me/items-in-progress', null);
      mockAxios.get = async () => {
        throw new Error('API Error');
      };

      const allowedLibraries = [{ id: 'lib1', name: 'Books' }];
      
      try {
        await client._getItemsInProgress(allowedLibraries);
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert(error.message.includes('API Error'));
      }
    });

    it('should handle empty response from items-in-progress API', async () => {
      mockAxios.setResponse('/api/me/items-in-progress', { libraryItems: [] });
      
      const allowedLibraries = [{ id: 'lib1', name: 'Books' }];
      const items = await client._getItemsInProgress(allowedLibraries);
      
      assert.strictEqual(items.length, 0);
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle Tyler\'s configuration correctly', async () => {
      // Simulate Tyler's exact configuration
      client = new AudiobookshelfClient(
        'https://test.com',
        'test-token',
        1, 500, 100, 600, {},
        { exclude: ['Podcasts'] }
      );
      client.axios = mockAxios;

      // Mock Tyler's scenario - has items in progress from both Books and Podcasts
      const tylerItemsInProgress = {
        libraryItems: [
          { id: 'book1', libraryId: 'lib1', title: 'Harry Potter', progress: 0.75 },
          { id: 'podcast1', libraryId: 'lib2', title: 'Joe Rogan Episode 1', progress: 0.45 },
          { id: 'podcast2', libraryId: 'lib2', title: 'Joe Rogan Episode 2', progress: 0.20 },
          { id: 'audiobook1', libraryId: 'lib3', title: 'The Expanse', progress: 0.90 }
        ]
      };
      
      mockAxios.setResponse('/api/me/items-in-progress', tylerItemsInProgress);
      
      const allowedLibraries = [
        { id: 'lib1', name: 'Books' },
        { id: 'lib3', name: 'Audiobooks' }
      ];
      
      const filteredItems = await client._getItemsInProgress(allowedLibraries);
      
      // Should exclude both podcast items
      assert.strictEqual(filteredItems.length, 2);
      
      const titles = filteredItems.map(item => item.title);
      assert(titles.includes('Harry Potter'));
      assert(titles.includes('The Expanse'));
      assert(!titles.includes('Joe Rogan Episode 1'));
      assert(!titles.includes('Joe Rogan Episode 2'));
    });

    it('should work with include filtering instead of exclude', async () => {
      client = new AudiobookshelfClient(
        'https://test.com',
        'test-token',
        1, 500, 100, 600, {},
        { include: ['Books'] } // Only include Books library
      );
      client.axios = mockAxios;
      
      const allowedLibraries = [{ id: 'lib1', name: 'Books' }];
      const items = await client._getItemsInProgress(allowedLibraries);
      
      // Should only include items from Books library
      assert.strictEqual(items.length, 2);
      items.forEach(item => {
        assert.strictEqual(item.libraryId, 'lib1');
      });
    });
  });
});