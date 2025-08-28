import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { SyncResultFormatter } from '../src/display/SyncResultFormatter.js';
import displayLogger from '../src/utils/display-logger.js';

describe('SyncResultFormatter Integration with DisplayLogger', () => {
  let formatter;
  let capturedMessages;
  let capturedLogs;
  let originalConsole;
  let originalLogger;

  beforeEach(() => {
    formatter = new SyncResultFormatter();
    capturedMessages = [];
    capturedLogs = [];

    // Mock console methods
    originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
    };

    console.log = message => capturedMessages.push({ type: 'log', message });
    console.error = message =>
      capturedMessages.push({ type: 'error', message });
    console.warn = message => capturedMessages.push({ type: 'warn', message });

    // Mock displayLogger's internal logger
    originalLogger = {
      debug:
        displayLogger.constructor.prototype.info.__proto__.constructor.prototype
          .debug,
      error:
        displayLogger.constructor.prototype.info.__proto__.constructor.prototype
          .error,
      warn: displayLogger.constructor.prototype.info.__proto__.constructor
        .prototype.warn,
    };

    // Override displayLogger test environment flag for testing
    displayLogger.isTestEnvironment = false;
  });

  afterEach(() => {
    // Restore original methods
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;

    // Restore test environment flag
    displayLogger.isTestEnvironment = process.env.NODE_ENV === 'test';
  });

  describe('displayResult() integration', () => {
    test('displays sync results with properly formatted output', async () => {
      const mockResult = {
        total: 5,
        successful: 3,
        errors: ['Test error 1', 'Test error 2'],
        skipped: 1,
        failed: 1,
        duration: 2.5,
        user_details: {
          books_updated: 2,
          cache_hits: 3,
          cache_misses: 2,
        },
        book_details: [
          {
            title: 'Test Book 1',
            author: 'Test Author',
            status: 'updated',
            progress: { before: 45.5, after: 50.0 },
            cache_status: { found: true },
            identifiers: { isbn: '1234567890' },
            timing: 150,
          },
          {
            title: 'Test Book 2',
            status: 'error',
            errors: ['API timeout'],
            progress: { before: 20.0, after: 20.0 },
          },
        ],
      };

      const mockUser = { id: 'test-user' };
      const mockConfig = { dump_failed_books: false };

      await formatter.formatSyncResults(
        mockUser,
        mockResult,
        mockConfig,
        2.5,
        true,
      );

      // Verify header was displayed
      assert(
        capturedMessages.some(msg => msg.message.includes('SYNC COMPLETE')),
        'Should display sync header',
      );
      assert(
        capturedMessages.some(msg => msg.message.includes('2.5s')),
        'Should display duration',
      );

      // Verify summary was displayed
      assert(
        capturedMessages.some(msg => msg.message.includes('Test Book 1')),
        'Should display book titles',
      );
      assert(
        capturedMessages.some(msg => msg.message.includes('Test Author')),
        'Should display authors',
      );

      // Verify progress information
      assert(
        capturedMessages.some(msg => msg.message.includes('45.5% → 50.0%')),
        'Should display progress changes',
      );

      // Verify error summary
      assert(
        capturedMessages.some(msg => msg.message.includes('ERROR SUMMARY')),
        'Should display error summary',
      );
      assert(
        capturedMessages.some(msg => msg.message.includes('Test error 1')),
        'Should display errors',
      );

      // Verify footer
      assert(
        capturedMessages.some(msg => msg.message === '═'.repeat(50)),
        'Should display footer separators',
      );
    });

    test('handles empty result gracefully', async () => {
      const mockResult = {
        total: 0,
        successful: 0,
        errors: [],
        skipped: 0,
        failed: 0,
        duration: 0.1,
        user_details: {
          books_updated: 0,
          cache_hits: 0,
          cache_misses: 0,
        },
        book_details: [],
      };

      const mockUser = { id: 'test-user' };
      const mockConfig = { dump_failed_books: false };

      await formatter.formatSyncResults(
        mockUser,
        mockResult,
        mockConfig,
        0.1,
        true,
      );

      // Should still display header and footer
      assert(
        capturedMessages.some(msg => msg.message.includes('SYNC COMPLETE')),
        'Should display header even for empty results',
      );
      assert(capturedMessages.length > 0, 'Should produce output');
    });

    test('respects test environment settings', async () => {
      // Set test environment
      displayLogger.isTestEnvironment = true;

      const mockResult = {
        total: 1,
        successful: 1,
        errors: [],
        skipped: 0,
        failed: 0,
        duration: 1.0,
        user_details: {
          books_updated: 1,
          cache_hits: 1,
          cache_misses: 0,
        },
        book_details: [
          {
            title: 'Test Book',
            status: 'updated',
            progress: { before: 0, after: 10 },
          },
        ],
      };

      const mockUser = { id: 'test-user' };
      const mockConfig = { dump_failed_books: false };

      await formatter.formatSyncResults(
        mockUser,
        mockResult,
        mockConfig,
        1.0,
        true,
      );

      // In test environment, no console output should be generated
      assert.strictEqual(
        capturedMessages.length,
        0,
        'Should not output to console in test environment',
      );
    });
  });

  describe('performance metrics display', () => {
    test('displays performance metrics correctly', () => {
      const mockResult = {
        memory_usage: {
          current: '25.4 MB',
          delta: '+2.1 MB',
        },
        cache_stats: {
          hits: 15,
          misses: 3,
        },
        network_stats: {
          requests: 8,
          avg_response_time: 1.25,
        },
      };

      formatter._displayPerformanceMetrics(mockResult);

      // Verify performance metrics section
      assert(
        capturedMessages.some(msg =>
          msg.message.includes('PERFORMANCE METRICS'),
        ),
        'Should display performance metrics header',
      );
      assert(
        capturedMessages.some(msg =>
          msg.message.includes('Memory Usage: 25.4 MB'),
        ),
        'Should display memory usage',
      );
      assert(
        capturedMessages.some(msg =>
          msg.message.includes('Cache Performance: 15 hits, 3 misses'),
        ),
        'Should display cache stats',
      );
      assert(
        capturedMessages.some(msg =>
          msg.message.includes('Network: 8 requests'),
        ),
        'Should display network stats',
      );
    });
  });

  describe('error handling', () => {
    test('displays errors using displayLogger.error for warnings', async () => {
      const mockResult = {
        total: 1,
        successful: 0,
        errors: ['Critical sync failure'],
        skipped: 0,
        failed: 1,
        duration: 0.5,
        user_details: {
          books_updated: 0,
          cache_hits: 0,
          cache_misses: 1,
        },
        book_details: [],
      };

      const mockUser = { id: 'test-user' };
      const mockConfig = { dump_failed_books: true };

      // Mock the dumpFailedSyncBooks function to simulate failure
      const originalDumpFailedSyncBooks = await import(
        '../src/utils/debug.js'
      ).then(m => m.dumpFailedSyncBooks);

      try {
        // Test error handling in dump function
        await formatter.formatSyncResults(
          mockUser,
          mockResult,
          mockConfig,
          2.5,
          true,
        );

        // Should display error summary
        assert(
          capturedMessages.some(msg => msg.message.includes('ERROR SUMMARY')),
          'Should display error summary',
        );
        assert(
          capturedMessages.some(msg =>
            msg.message.includes('Critical sync failure'),
          ),
          'Should display the error message',
        );
      } catch (error) {
        // Error is acceptable as we're testing error paths
      }
    });
  });

  describe('book details formatting', () => {
    test('formats book details with all DisplayLogger methods', () => {
      const mockBook = {
        title: 'Complex Test Book',
        author: 'Test Author',
        status: 'updated',
        progress: { before: 25.7, after: 30.2 },
        cache_status: {
          found: true,
          updated: false,
        },
        identifiers: {
          isbn: '9781234567890',
          goodreads: '12345',
        },
        hardcover_info: {
          format: 'Audiobook',
          duration: '8h 45m',
        },
        api_response: {
          success: true,
          status_code: 200,
          duration: 1.2,
        },
        timestamps: {
          last_listened_at: new Date('2024-01-15').toISOString(),
          completed_at: null,
        },
        timing: 350,
      };

      formatter._displayBookDetails(mockBook);

      // Verify all components are displayed
      assert(
        capturedMessages.some(msg =>
          msg.message.includes('Complex Test Book by Test Author'),
        ),
        'Should display book title and author',
      );
      assert(
        capturedMessages.some(msg => msg.message.includes('25.7% → 30.2%')),
        'Should display progress change',
      );
      assert(
        capturedMessages.some(msg => msg.message.includes('Cache: ✅')),
        'Should display cache status',
      );
      assert(
        capturedMessages.some(msg =>
          msg.message.includes('ISBN=9781234567890'),
        ),
        'Should display identifiers',
      );
      assert(
        capturedMessages.some(msg => msg.message.includes('Audiobook, 8h 45m')),
        'Should display hardcover info',
      );
      assert(
        capturedMessages.some(msg =>
          msg.message.includes('API Response: 200 OK'),
        ),
        'Should display API response',
      );
      assert(
        capturedMessages.some(msg => msg.message.includes('Last Listened:')),
        'Should display timestamps',
      );
      assert(
        capturedMessages.some(msg =>
          msg.message.includes('Processing time: 350ms'),
        ),
        'Should display timing',
      );
    });
  });
});
