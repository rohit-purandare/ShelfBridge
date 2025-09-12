import { SyncManager } from '../src/sync-manager.js';
import logger from '../src/logger.js';

// Quick demo to show the timing fix in action
const mockUser = {
  id: 'test',
  abs_url: 'http://test.com',
  abs_token: 'token',
  hardcover_token: 'hc',
};
const mockConfig = { workers: 1, parallel: false };

const syncManager = new SyncManager(mockUser, mockConfig, true, false); // Dry run

// Track log order
const logs = [];
const originalInfo = logger.info;
const originalWarn = logger.warn;

logger.info = (msg, data) => {
  if (msg.includes('Successfully marked') && msg.includes('as completed')) {
    logs.push({ type: 'SUCCESS', time: Date.now(), msg });
  }
  originalInfo(msg, data);
};

logger.warn = (msg, data) => {
  if (msg.includes('No ISBN/ASIN found')) {
    logs.push({ type: 'FALLBACK', time: Date.now(), msg });
  }
  originalWarn(msg, data);
};

// Test completion with fallback identifier
const mockBook = {
  id: 'test',
  media: { metadata: { title: 'Test Book', authors: [{ name: 'Author' }] } },
};

const mockEdition = { id: 'ed1', pages: 100 };

console.log('🧪 Testing log timing fix...');

try {
  await syncManager._handleCompletionStatus(
    'ub1',
    mockEdition,
    'Test Book',
    100,
    mockBook,
    true,
  );

  console.log('\n📊 Log Order Analysis:');
  logs.forEach((log, i) => {
    console.log(`${i + 1}. [${log.type}] ${log.msg.substring(0, 60)}...`);
  });

  if (logs.length >= 2) {
    const fallbackLog = logs.find(l => l.type === 'FALLBACK');
    const successLog = logs.find(l => l.type === 'SUCCESS');

    if (fallbackLog && successLog) {
      if (fallbackLog.time <= successLog.time) {
        console.log(
          '\n✅ FIXED: Fallback warning now comes BEFORE success message!',
        );
        console.log('   This prevents the race condition timing window.');
      } else {
        console.log(
          '\n❌ Issue: Success message still comes before fallback warning',
        );
      }
    }
  }
} catch (error) {
  console.log(`Error: ${error.message}`);
}

logger.info = originalInfo;
logger.warn = originalWarn;
