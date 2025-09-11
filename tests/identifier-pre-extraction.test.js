import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SyncManager } from '../src/sync-manager.js';
import logger from '../src/logger.js';

// Mock dependencies
const mockUser = {
  id: 'test-user',
  abs_url: 'http://test-abs.com',
  abs_token: 'test-token',
  hardcover_token: 'test-hc-token',
};

const mockGlobalConfig = {
  workers: 1,
  parallel: false,
  force_sync: false,
};

test('Identifier Pre-Extraction Timing Fix', async t => {
  await t.test(
    'Pre-extraction prevents race condition timing window',
    async t => {
      const syncManager = new SyncManager(
        mockUser,
        mockGlobalConfig,
        false,
        false,
      );

      // Track the order of log messages to verify timing
      const logOrder = [];
      const originalInfo = logger.info;
      const originalWarn = logger.warn;
      const originalDebug = logger.debug;

      logger.info = (message, data) => {
        if (
          message.includes('Successfully marked') &&
          message.includes('as completed')
        ) {
          logOrder.push({ type: 'success', message, timestamp: Date.now() });
        }
        originalInfo(message, data);
      };

      logger.warn = (message, data) => {
        if (
          message.includes('No ISBN/ASIN found') &&
          message.includes('using fallback identifier')
        ) {
          logOrder.push({ type: 'fallback', message, timestamp: Date.now() });
        }
        originalWarn(message, data);
      };

      logger.debug = (message, data) => {
        if (message.includes('Caching completion data')) {
          logOrder.push({ type: 'cache', message, timestamp: Date.now() });
        }
        originalDebug(message, data);
      };

      // Mock book without ISBN/ASIN (requires fallback identifier)
      const absBook = {
        id: 'test-book-1',
        media: {
          metadata: {
            title: 'Test Book Without ISBN',
            authors: [{ name: 'Test Author' }],
          },
        },
        started_at: '2024-01-01T10:00:00Z',
        finished_at: '2024-01-01T12:00:00Z',
      };

      // Mock edition data
      const mockEdition = {
        id: 'edition-123',
        pages: 300,
      };

      // Mock successful Hardcover API call
      const mockHardcover = {
        markBookCompleted: async () => true,
      };

      // Mock cache that succeeds
      const mockCache = {
        storeBookCompletionData: async () => Promise.resolve(),
      };

      // Mock Transaction
      const mockTransaction = {
        add: () => {},
        commit: async () => Promise.resolve(),
        rollback: async () => Promise.resolve(),
      };

      syncManager.hardcover = mockHardcover;
      syncManager.cache = mockCache;

      await t.test('should extract identifiers before API call', async () => {
        logOrder.length = 0; // Clear log order

        // Call the completion handler directly
        const result = await syncManager._handleCompletionStatus(
          'user-book-123',
          mockEdition,
          'Test Book Without ISBN',
          100,
          absBook,
          true,
        );

        assert.strictEqual(
          result.status,
          'completed',
          'Should complete successfully',
        );

        // Verify log order: fallback warning should come BEFORE success message
        const fallbackLog = logOrder.find(log => log.type === 'fallback');
        const successLog = logOrder.find(log => log.type === 'success');

        assert.ok(fallbackLog, 'Should log fallback identifier warning');
        assert.ok(successLog, 'Should log successful completion');
        assert.ok(
          fallbackLog.timestamp <= successLog.timestamp,
          'Fallback warning should be logged before or at the same time as success message',
        );
      });

      // Restore original logger functions
      logger.info = originalInfo;
      logger.warn = originalWarn;
      logger.debug = originalDebug;
    },
  );

  await t.test('Cache update happens immediately after success', async t => {
    const syncManager = new SyncManager(
      mockUser,
      mockGlobalConfig,
      false,
      false,
    );

    // Track cache operations
    let cacheOperationTime = null;
    let apiSuccessTime = null;

    // Mock Hardcover client
    syncManager.hardcover = {
      markBookCompleted: async () => {
        apiSuccessTime = Date.now();
        return true;
      },
    };

    // Mock cache
    syncManager.cache = {
      storeBookCompletionData: async () => {
        cacheOperationTime = Date.now();
        return Promise.resolve();
      },
    };

    const absBook = {
      id: 'timing-test',
      media: {
        metadata: {
          title: 'Timing Test Book',
          authors: [{ name: 'Test Author' }],
        },
      },
      started_at: '2024-01-01T10:00:00Z',
      finished_at: '2024-01-01T12:00:00Z',
    };

    const mockEdition = { id: 'edition-123', pages: 200 };

    await t.test('should cache immediately after API success', async () => {
      const result = await syncManager._handleCompletionStatus(
        'user-book-456',
        mockEdition,
        'Timing Test Book',
        100,
        absBook,
        true,
      );

      assert.strictEqual(result.status, 'completed');
      assert.ok(apiSuccessTime, 'API success should be recorded');
      assert.ok(cacheOperationTime, 'Cache operation should be recorded');

      // Cache should happen within a reasonable time after API success (allow for some processing time)
      const timeDifference = cacheOperationTime - apiSuccessTime;
      assert.ok(
        timeDifference >= 0 && timeDifference < 100,
        `Cache should happen immediately after API success (difference: ${timeDifference}ms)`,
      );
    });
  });

  await t.test('Identifier types are handled correctly', async t => {
    const syncManager = new SyncManager(
      mockUser,
      mockGlobalConfig,
      true,
      false,
    ); // Dry run

    await t.test('should handle books with ISBN identifiers', async () => {
      const bookWithISBN = {
        id: 'isbn-book',
        media: {
          metadata: {
            title: 'Book With ISBN',
            authors: [{ name: 'ISBN Author' }],
            isbn: '9781234567890',
          },
        },
      };

      const mockEdition = { id: 'isbn-edition', pages: 250 };

      // In dry run mode, it should still process the identifier extraction
      const result = await syncManager._handleCompletionStatus(
        'isbn-user-book',
        mockEdition,
        'Book With ISBN',
        100,
        bookWithISBN,
        true,
      );

      assert.strictEqual(result.status, 'completed');
      assert.strictEqual(result.title, 'Book With ISBN');
    });

    await t.test('should handle books with ASIN identifiers', async () => {
      const bookWithASIN = {
        id: 'asin-book',
        media: {
          metadata: {
            title: 'Book With ASIN',
            authors: [{ name: 'ASIN Author' }],
            asin: 'B01234ASIN',
          },
        },
      };

      const mockEdition = { id: 'asin-edition', pages: 300 };

      const result = await syncManager._handleCompletionStatus(
        'asin-user-book',
        mockEdition,
        'Book With ASIN',
        100,
        bookWithASIN,
        true,
      );

      assert.strictEqual(result.status, 'completed');
      assert.strictEqual(result.title, 'Book With ASIN');
    });

    await t.test(
      'should create fallback identifiers consistently',
      async () => {
        const bookWithoutIdentifiers = {
          id: 'fallback-book',
          media: {
            metadata: {
              title: 'Book Without Identifiers!@#$%',
              authors: [{ name: 'Fallback Author!@#$%' }],
            },
          },
        };

        const mockEdition = { id: 'fallback-edition', pages: 150 };

        // Capture the warning message to verify fallback identifier creation
        let fallbackIdentifier = null;
        const originalWarn = logger.warn;
        logger.warn = (message, data) => {
          if (
            message.includes('using fallback identifier') &&
            data.fallbackIdentifier
          ) {
            fallbackIdentifier = data.fallbackIdentifier;
          }
          originalWarn(message, data);
        };

        const result = await syncManager._handleCompletionStatus(
          'fallback-user-book',
          mockEdition,
          'Book Without Identifiers!@#$%',
          100,
          bookWithoutIdentifiers,
          true,
        );

        logger.warn = originalWarn;

        assert.strictEqual(result.status, 'completed');
        assert.ok(fallbackIdentifier, 'Should create fallback identifier');

        // Verify fallback identifier format (should be clean: title:author with only alphanumeric + colon)
        const expectedPattern = /^[a-z0-9:]+$/;
        assert.ok(
          expectedPattern.test(fallbackIdentifier),
          `Fallback identifier should be clean alphanumeric: ${fallbackIdentifier}`,
        );

        assert.ok(
          fallbackIdentifier.includes(':'),
          'Should contain colon separator',
        );
      },
    );
  });
});
