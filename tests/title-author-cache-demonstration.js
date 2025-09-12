#!/usr/bin/env node
import { SyncManager } from '../src/sync-manager.js';
import logger from '../src/logger.js';

// Simple demonstration that title/author cache optimization is working
console.log('🧪 Demonstrating Title/Author Cache Optimization');
console.log('='.repeat(60));

const mockUser = {
  id: 'demo',
  abs_url: 'http://demo.com',
  abs_token: 'token',
  hardcover_token: 'hc',
};
const mockConfig = { workers: 1, parallel: false, force_sync: false };

// Test scenario: Cached title/author book with progress change
const syncManager = new SyncManager(mockUser, mockConfig, false, false);

let expensiveSearchTriggered = false;

// Mock cache with existing title/author book
syncManager.cache = {
  generateTitleAuthorIdentifier: (title, author) =>
    `${title.toLowerCase().replace(/\s+/g, '')}:${author.toLowerCase().replace(/\s+/g, '')}`,
  getCachedBookInfo: async (userId, identifier, title, identifierType) => {
    if (identifierType === 'title_author') {
      console.log(`📚 Cache hit for: ${title} (${identifierType})`);
      return {
        exists: true,
        edition_id: 'cached-edition-abc123',
        progress_percent: 60.0, // Old progress
        author: 'James S. A. Corey',
      };
    }
    return { exists: false };
  },
  hasProgressChanged: async (
    userId,
    identifier,
    title,
    progress,
    identifierType,
  ) => {
    console.log(`🔄 Progress check: ${title} - ${progress}% (was 60.0%)`);
    return progress !== 60.0; // Progress changed
  },
};

// Mock bookMatcher to detect expensive searches
syncManager.bookMatcher = {
  findMatch: async (absBook, userId) => {
    const title = absBook.media?.metadata?.title || 'Unknown';
    console.log(`❌ EXPENSIVE SEARCH TRIGGERED for: ${title}`);
    expensiveSearchTriggered = true;
    return {
      match: null,
      extractedMetadata: { title, author: 'Unknown', identifiers: {} },
    };
  },
};

// Book without identifiers (title/author book) with progress change
const testBook = {
  id: 'expanse-book-1',
  media: {
    metadata: {
      title: 'Leviathan Wakes',
      authors: [{ name: 'James S. A. Corey' }],
      // No ISBN/ASIN - requires title/author matching
    },
  },
  progress: 0.85, // Progress changed from 60% to 85%
  isFinished: false,
};

// Track optimization logs
const logs = [];
const originalDebug = logger.debug;
logger.debug = (msg, data) => {
  if (msg.includes('using cached edition')) {
    logs.push(msg);
    console.log(`✅ ${msg}`);
  }
  originalDebug(msg, data);
};

try {
  console.log('\n📖 Processing book with progress change...');
  console.log(
    `Book: "${testBook.media.metadata.title}" by ${testBook.media.metadata.authors[0].name}`,
  );
  console.log(`Progress: 60% → 85% (changed)`);
  console.log(`Identifiers: None (title/author book)\n`);

  await syncManager._syncSingleBook(testBook, null);

  console.log('\n📊 Results:');
  console.log(
    `Expensive search triggered: ${expensiveSearchTriggered ? '❌ YES (bad)' : '✅ NO (good)'}`,
  );
  console.log(
    `Cache optimization used: ${logs.length > 0 ? '✅ YES (good)' : '❌ NO (bad)'}`,
  );

  if (!expensiveSearchTriggered && logs.length > 0) {
    console.log('\n🎉 SUCCESS: Title/author cache optimization is working!');
    console.log('   - Progress update detected ✅');
    console.log('   - Used cached edition_id instead of expensive search ✅');
    console.log('   - No unnecessary API calls made ✅');
  } else {
    console.log('\n❌ ISSUE: Cache optimization not working as expected');
    if (expensiveSearchTriggered) {
      console.log('   - Expensive search was triggered (should be avoided)');
    }
    if (logs.length === 0) {
      console.log('   - Cache optimization log not found');
    }
  }
} catch (error) {
  console.log(`Error: ${error.message}`);
} finally {
  logger.debug = originalDebug;
}

console.log(
  '\n💡 This optimization prevents unnecessary title/author API searches',
);
console.log('   when processing progress updates on previously matched books.');
