#!/usr/bin/env node
import { SyncManager } from '../src/sync-manager.js';
import logger from '../src/logger.js';

/**
 * Reproduce the exact Cleopatra and Frankenstein issue from the logs
 */

console.log('🔬 Reproducing Cleopatra and Frankenstein Silent Skip Issue');
console.log('='.repeat(60));

const mockUser = {
  id: 'rpurandare',
  abs_url: 'http://test.com',
  abs_token: 'token',
  hardcover_token: 'hc',
};

const mockConfig = {
  workers: 3,
  parallel: true,
  auto_add_books: true,
  force_sync: false,
  min_progress_threshold: 5.0,
};

const syncManager = new SyncManager(mockUser, mockConfig, false, false);

// Track all log messages to see what happens
const allLogs = [];
const originalDebug = logger.debug;
const originalInfo = logger.info;
const originalError = logger.error;

logger.debug = (msg, data) => {
  allLogs.push({ level: 'debug', msg, data });
  originalDebug(msg, data);
};

logger.info = (msg, data) => {
  allLogs.push({ level: 'info', msg, data });
  originalInfo(msg, data);
};

logger.error = (msg, data) => {
  allLogs.push({ level: 'error', msg, data });
  originalError(msg, data);
};

// Mock cache exactly from the logs
syncManager.cache = {
  generateTitleAuthorIdentifier: () => 'cleopatraandfrankenstein:author',
  getCachedBookInfo: async (userId, identifier, title, identifierType) => {
    console.log(`📚 Cache lookup: ${title} (${identifierType})`);
    if (title === 'Cleopatra and Frankenstein' && identifierType === 'asin') {
      return {
        exists: true,
        edition_id: 'cached-edition-asin',
        progress_percent: 18.85966697756357, // Old progress from logs
        author: 'Coco Chen',
        last_sync: '2025-09-12T03:02:10.711Z',
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
    console.log(`🔄 Progress check: ${title} - ${progress}% vs cached 18.86%`);
    return Math.abs(progress - 18.85966697756357) > 0.01; // Should be true for 20.829%
  },
};

// Mock bookMatcher
syncManager.bookMatcher = {
  findMatch: async absBook => {
    console.log(
      `❌ EXPENSIVE MATCHING CALLED (should not happen for cached book)`,
    );
    return { match: null, extractedMetadata: {} };
  },

  findUserBookByEditionId: editionId => {
    console.log(`🔍 Looking up userBook by editionId: ${editionId}`);
    if (editionId === 'cached-edition-asin') {
      return {
        id: 'user-book-123',
        book: { id: 'book-456', title: 'Cleopatra and Frankenstein' },
      };
    }
    return null;
  },
};

// Mock hardcover client
syncManager.hardcover = {
  updateBookProgress: async (userBookId, editionId, progress) => {
    console.log(
      `✅ UPDATE PROGRESS: userBookId=${userBookId}, progress=${progress}%`,
    );
    return { success: true };
  },
};

// Exact book data from logs (using correct Audiobookshelf format)
const cleopatraBook = {
  id: 'cleopatra-abs-id',
  media: {
    metadata: {
      title: 'Cleopatra and Frankenstein',
      authors: [{ name: 'Coco Chen' }],
      asin: 'B09RQ3RD3K',
      isbn: '9781635578362',
    },
  },
  progress_percentage: 20.829123773605563, // Correct field name for ProgressManager
  progress: 0.20829123773605563, // Also include decimal format
  isFinished: false,
  is_finished: false, // Audiobookshelf format
};

console.log('\n📖 Testing book with exact data from logs...');
console.log(`Title: ${cleopatraBook.media.metadata.title}`);
console.log(`Progress: ${(cleopatraBook.progress * 100).toFixed(3)}%`);
console.log(`ASIN: ${cleopatraBook.media.metadata.asin}`);
console.log(
  `Expected: Progress change detected, cache used, successful sync\n`,
);

try {
  const result = await syncManager._syncSingleBook(cleopatraBook, null);

  console.log('\n📊 RESULT:');
  console.log(`Status: ${result.status}`);
  console.log(`Reason: ${result.reason || 'N/A'}`);

  if (result.status === 'skipped') {
    console.log('\n❌ ISSUE: Book was still skipped');
    console.log('Analyzing logs to find where it went wrong...');

    const relevantLogs = allLogs.filter(
      log =>
        log.msg.includes('Cleopatra') ||
        log.msg.includes('threshold') ||
        log.msg.includes('skip') ||
        log.msg.includes('error'),
    );

    relevantLogs.forEach((log, i) => {
      console.log(`${i + 1}. [${log.level.toUpperCase()}] ${log.msg}`);
      if (log.data) console.log(`   Data:`, log.data);
    });
  } else {
    console.log('\n✅ SUCCESS: Book was not silently skipped');
    console.log(`Final status: ${result.status}`);
  }
} catch (error) {
  console.log(`\n❌ ERROR: ${error.message}`);
} finally {
  logger.debug = originalDebug;
  logger.info = originalInfo;
  logger.error = originalError;
}
