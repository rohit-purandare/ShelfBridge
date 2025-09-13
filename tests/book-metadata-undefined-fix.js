#!/usr/bin/env node
import { SyncManager } from '../src/sync-manager.js';

// Quick test for undefined book metadata access
const mockUser = {
  id: 'test',
  abs_url: 'http://test.com',
  abs_token: 'token',
  hardcover_token: 'hc',
};
const mockConfig = { auto_add_books: true, min_progress_threshold: 5.0 };

const syncManager = new SyncManager(mockUser, mockConfig, false, false);

// Mock the exact scenario: search result with missing book object
syncManager.cache = {
  generateTitleAuthorIdentifier: () => 'test:author',
  getCachedBookInfo: async () => ({ exists: false }),
};

syncManager.bookMatcher = {
  findMatch: async () => ({
    match: {
      userBook: null,
      book: { id: 'search-book-123', title: 'Test Book' },
      edition: { id: 'search-edition-456', format: 'Read' },
      _isSearchResult: true,
      _matchType: 'title_author_two_stage',
    },
    extractedMetadata: {
      title: 'Test Book',
      author: 'Test Author',
      identifiers: { asin: 'B0TEST123' },
    },
  }),
};

// Mock hardcover client that returns edition WITHOUT book object (like real API)
syncManager.hardcover = {
  searchBooksByAsin: async asin => [
    {
      id: 12345,
      format: 'Read',
      book_id: 67890, // Direct field instead of nested object
      // book: undefined (missing like in real API)
    },
  ],

  addBookToLibrary: async (bookId, statusId, editionId) => ({
    id: 'new-user-book-999',
  }),
  getUserBooks: () => Promise.resolve([]),
};

const testBook = {
  id: 'metadata-test',
  media: {
    metadata: {
      title: 'Test Book',
      authors: [{ name: 'Test Author' }],
      asin: 'B0TEST123',
    },
  },
  progress_percentage: 25.0,
  isFinished: false,
};

console.log('🧪 Testing book metadata undefined access fix...');

try {
  const result = await syncManager._syncSingleBook(testBook, null);
  console.log(`✅ SUCCESS: No undefined access errors`);
  console.log(`Status: ${result.status}`);
  console.log(`Reason: ${result.reason || 'N/A'}`);
} catch (error) {
  if (error.message.includes('Cannot read properties of undefined')) {
    console.log(`❌ STILL BROKEN: ${error.message}`);
  } else {
    console.log(`✅ Different error (not undefined access): ${error.message}`);
  }
}
