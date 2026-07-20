import { describe, it } from 'node:test';
import assert from 'node:assert';
import { AudiobookshelfClient } from '../src/audiobookshelf-client.js';

function createMediaProgress(id, overrides = {}) {
  return {
    id,
    libraryItemId: id,
    episodeId: null,
    duration: 1000,
    progress: 0.5,
    currentTime: 500,
    isFinished: false,
    hideFromContinueListening: false,
    lastUpdate: 1710000000000,
    startedAt: 1709000000000,
    finishedAt: null,
    ...overrides,
  };
}

describe('Audiobookshelf mediaProgress handling', () => {
  it('uses /api/me mediaProgress as the authoritative source for completed counts', async () => {
    const client = new AudiobookshelfClient(
      'https://test.example',
      'test-token',
      1,
      500,
      100,
      600,
      {},
      { include: ['Included Library'] },
    );

    const itemLibraries = new Map();
    const mediaProgress = [];

    for (let index = 0; index < 100; index++) {
      const id = `completed-${index}`;
      itemLibraries.set(id, 'included');
      mediaProgress.push(
        createMediaProgress(id, {
          progress: 1,
          currentTime: 1000,
          isFinished: true,
          finishedAt: 1710000000000 + index,
        }),
      );
    }

    for (let index = 0; index < 10; index++) {
      const id = `reading-${index}`;
      itemLibraries.set(id, 'included');
      mediaProgress.push(
        createMediaProgress(id, {
          progress: 0.25,
          currentTime: 250,
          isFinished: false,
        }),
      );
    }

    for (let index = 0; index < 5; index++) {
      const id = `excluded-${index}`;
      itemLibraries.set(id, 'excluded');
      mediaProgress.push(
        createMediaProgress(id, {
          progress: 1,
          currentTime: 1000,
          isFinished: true,
          finishedAt: 1710000000000 + index,
        }),
      );
    }

    client._getCurrentUser = async () => ({ mediaProgress });
    client.getLibraries = async () => [
      { id: 'included', name: 'Included Library' },
      { id: 'excluded', name: 'Excluded Library' },
    ];

    let progressEndpointCalls = 0;
    client._getUserProgress = async () => {
      progressEndpointCalls++;
      return null;
    };

    client._makeRequest = async (_method, endpoint) => {
      if (endpoint === '/api/libraries/included/items?limit=1&page=0') {
        return { total: 9646 };
      }

      if (endpoint.startsWith('/api/items/')) {
        const id = endpoint.replace('/api/items/', '');
        return {
          id,
          libraryId: itemLibraries.get(id),
          media: {
            metadata: {
              title: id,
            },
          },
        };
      }

      throw new Error(`Unexpected endpoint: ${endpoint}`);
    };

    try {
      const books = await client.getReadingProgress();
      const stats = books[0]._filteringStats;

      assert.strictEqual(progressEndpointCalls, 0);
      assert.strictEqual(
        books.filter(book => !book._isMetadataOnly).length,
        110,
      );
      assert.strictEqual(stats.totalBooksInLibrary, 9646);
      assert.strictEqual(stats.totalWithProgress, 110);
      assert.strictEqual(stats.inProgressBooks, 10);
      assert.strictEqual(stats.allCompletedBooks, 100);
      assert.strictEqual(stats.booksNeverStarted, 9536);
    } finally {
      client.cleanup();
    }
  });

  it('treats explicit null getLibraryItems limit as no limit', async () => {
    const client = new AudiobookshelfClient(
      'https://test.example',
      'test-token',
      1,
      2,
      2,
    );

    const pages = [
      [{ id: 'book-1' }, { id: 'book-2' }],
      [{ id: 'book-3' }, { id: 'book-4' }],
      [{ id: 'book-5' }],
    ];

    client._makeRequest = async (_method, endpoint) => {
      const page = Number(
        new URL(`https://test.example${endpoint}`).searchParams.get('page'),
      );
      return {
        total: 5,
        results: pages[page] || [],
      };
    };

    try {
      const cappedItems = await client.getLibraryItems('library');
      const uncappedItems = await client.getLibraryItems('library', null);

      assert.strictEqual(cappedItems.length, 2);
      assert.strictEqual(uncappedItems.length, 5);
    } finally {
      client.cleanup();
    }
  });

  it('limits mediaProgress item detail fetches', async () => {
    const client = new AudiobookshelfClient(
      'https://test.example',
      'test-token',
      1,
      5,
      100,
    );
    const mediaProgress = Array.from({ length: 21 }, (_, index) =>
      createMediaProgress(`book-${index}`),
    );
    let detailFetches = 0;

    client._getCurrentUser = async () => ({ mediaProgress });
    client.getLibraries = async () => [{ id: 'library', name: 'Library' }];
    client._makeRequest = async (_method, endpoint) => {
      if (endpoint === '/api/libraries/library/items?limit=1&page=0') {
        return { total: 21 };
      }

      if (endpoint.startsWith('/api/items/')) {
        detailFetches++;
        return {
          id: endpoint.replace('/api/items/', ''),
          libraryId: 'library',
          media: { metadata: { title: endpoint } },
        };
      }

      throw new Error(`Unexpected endpoint: ${endpoint}`);
    };

    try {
      const books = await client.getReadingProgress();

      assert.equal(detailFetches, 5);
      assert.equal(books.filter(book => !book._isMetadataOnly).length, 5);
    } finally {
      client.cleanup();
    }
  });

  it('does not let a page exceed maxBooksToFetch', async () => {
    const client = new AudiobookshelfClient(
      'https://test.example',
      'test-token',
      1,
      5,
      100,
    );
    let requestedEndpoint;

    client._makeRequest = async (_method, endpoint) => {
      requestedEndpoint = endpoint;
      return {
        total: 21,
        results: Array.from({ length: 21 }, (_, index) => ({
          id: `book-${index}`,
        })),
      };
    };

    try {
      const books = await client.getLibraryItems('library');

      assert.equal(
        requestedEndpoint,
        '/api/libraries/library/items?limit=5&page=0',
      );
      assert.equal(books.length, 5);
    } finally {
      client.cleanup();
    }
  });

  it('uses a stable page size while enforcing maxBooksToFetch', async () => {
    const client = new AudiobookshelfClient(
      'https://test.example',
      'test-token',
      1,
      3,
      2,
    );
    const requestedEndpoints = [];
    const pages = [
      [{ id: 'book-1' }, { id: 'book-2' }],
      [{ id: 'book-3' }, { id: 'book-4' }],
    ];

    client._makeRequest = async (_method, endpoint) => {
      requestedEndpoints.push(endpoint);
      const page = Number(
        new URL(`https://test.example${endpoint}`).searchParams.get('page'),
      );
      return { total: 4, results: pages[page] || [] };
    };

    try {
      const books = await client.getLibraryItems('library');

      assert.deepEqual(requestedEndpoints, [
        '/api/libraries/library/items?limit=2&page=0',
        '/api/libraries/library/items?limit=2&page=1',
      ]);
      assert.deepEqual(
        books.map(book => book.id),
        ['book-1', 'book-2', 'book-3'],
      );
    } finally {
      client.cleanup();
    }
  });
});
