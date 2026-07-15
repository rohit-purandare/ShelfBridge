import { describe, it } from 'node:test';
import assert from 'node:assert';
import { AudiobookshelfClient } from '../src/audiobookshelf-client.js';
import { detectUserBookFormat } from '../src/matching/utils/audiobookshelf-extractor.js';

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
  it('uses ebookProgress when audiobook progress is zero', () => {
    const client = new AudiobookshelfClient(
      'https://test.example',
      'test-token',
    );
    const item = {
      mediaType: 'book',
      media: {
        audioFiles: [],
        ebookFile: { path: 'book.epub' },
      },
    };

    try {
      client._applyProgressDataToItem(item, {
        progress: 0,
        ebookProgress: 0.3230769230769231,
        currentTime: 0,
        isFinished: false,
      });

      assert.strictEqual(item.progress_percentage, 32.30769230769231);
      assert.strictEqual(detectUserBookFormat(item), 'ebook');
    } finally {
      client.cleanup();
    }
  });

  it('keeps audiobook progress when ebookProgress is zero', () => {
    const client = new AudiobookshelfClient(
      'https://test.example',
      'test-token',
    );
    const item = {
      mediaType: 'book',
      media: {
        audioFiles: [{ path: 'audio.mp3' }],
        ebookFile: null,
      },
    };

    try {
      client._applyProgressDataToItem(item, {
        progress: 0.625,
        ebookProgress: 0,
        currentTime: 625,
        isFinished: false,
      });

      assert.strictEqual(item.progress_percentage, 62.5);
      assert.strictEqual(detectUserBookFormat(item), 'audiobook');
    } finally {
      client.cleanup();
    }
  });

  it('uses the progress field for hybrid items classified as audiobooks', () => {
    const client = new AudiobookshelfClient(
      'https://test.example',
      'test-token',
    );
    const item = {
      mediaType: 'book',
      media: {
        audioFiles: [{ path: 'audio.mp3' }],
        ebookFile: { path: 'book.epub' },
      },
    };

    try {
      client._applyProgressDataToItem(item, {
        progress: 0.25,
        ebookProgress: 0.4,
        currentTime: 250,
        isFinished: false,
      });

      assert.strictEqual(item.progress_percentage, 25);
      assert.strictEqual(detectUserBookFormat(item), 'audiobook');
    } finally {
      client.cleanup();
    }
  });

  it('detects an ebook-only Audiobookshelf book from its singular ebookFile', () => {
    const item = {
      mediaType: 'book',
      media: {
        audioFiles: [],
        ebookFile: { path: 'book.epub' },
      },
    };

    assert.strictEqual(detectUserBookFormat(item), 'ebook');
  });

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
});
