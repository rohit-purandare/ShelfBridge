import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import { HardcoverClient } from '../src/hardcover-client.js';

/**
 * Test suite for Want to Read status update feature
 * Verifies that books in "Want to Read" status (status_id = 1) are automatically
 * updated to "Currently Reading" (status_id = 2) when their reading progress is synced.
 *
 * Status IDs:
 * 1 = Want to Read
 * 2 = Currently Reading
 * 3 = Read (Completed)
 */

describe('HardcoverClient - Want to Read Status Update', () => {
  const mockToken = 'test-token';
  const mockUserBookId = 123;
  const mockEditionId = 456;
  const mockReadId = 789;
  const mockCurrentProgress = 50; // pages or seconds
  const mockProgressPercentage = 25.5;

  describe('updateReadingProgress - Status Transition Tests', () => {
    it('should update status from Want to Read (1) to Currently Reading (2)', async () => {
      const client = new HardcoverClient(mockToken);

      // Mock book with Want to Read status
      client.getBookCurrentProgress = mock.fn(async () => ({
        has_progress: true,
        latest_read: {
          id: mockReadId,
          progress_pages: 10,
          edition: { id: mockEditionId, pages: 200 },
        },
        user_book: {
          id: mockUserBookId,
          status_id: 1, // Want to Read
        },
      }));

      // Mock updateBookStatus to verify it's called
      client.updateBookStatus = mock.fn(async (userBookId, statusId) => ({
        id: userBookId,
        status_id: statusId,
      }));

      // Mock _shouldCreateNewReadingSession to return false
      client._shouldCreateNewReadingSession = mock.fn(() => ({
        createNew: false,
        isRegression: false,
      }));

      // Mock progress update
      client._executeQuery = mock.fn(async () => ({
        update_user_book_read: {
          user_book_read: {
            id: mockReadId,
            progress_pages: mockCurrentProgress,
          },
        },
      }));

      // Execute the test
      await client.updateReadingProgress(
        mockUserBookId,
        mockCurrentProgress,
        mockProgressPercentage,
        mockEditionId,
        false, // useSeconds
        '2024-01-01',
      );

      // Verify updateBookStatus was called with correct parameters
      assert.strictEqual(
        client.updateBookStatus.mock.calls.length,
        1,
        'updateBookStatus should be called once',
      );
      assert.deepStrictEqual(
        client.updateBookStatus.mock.calls[0].arguments,
        [mockUserBookId, 2],
        'updateBookStatus should be called with status_id = 2',
      );
    });

    it('should NOT update status when already Currently Reading (2)', async () => {
      const client = new HardcoverClient(mockToken);

      // Mock book with Currently Reading status
      client.getBookCurrentProgress = mock.fn(async () => ({
        has_progress: true,
        latest_read: {
          id: mockReadId,
          progress_pages: 50,
          edition: { id: mockEditionId, pages: 200 },
        },
        user_book: {
          id: mockUserBookId,
          status_id: 2, // Currently Reading
        },
      }));

      // Mock updateBookStatus (should not be called)
      client.updateBookStatus = mock.fn(async (userBookId, statusId) => ({
        id: userBookId,
        status_id: statusId,
      }));

      client._shouldCreateNewReadingSession = mock.fn(() => ({
        createNew: false,
        isRegression: false,
      }));

      client._executeQuery = mock.fn(async () => ({
        update_user_book_read: {
          user_book_read: {
            id: mockReadId,
            progress_pages: mockCurrentProgress,
          },
        },
      }));

      // Execute the test
      await client.updateReadingProgress(
        mockUserBookId,
        mockCurrentProgress,
        mockProgressPercentage,
        mockEditionId,
        false,
        '2024-01-01',
      );

      // Verify updateBookStatus was NOT called
      assert.strictEqual(
        client.updateBookStatus.mock.calls.length,
        0,
        'updateBookStatus should NOT be called for status_id = 2',
      );
    });

    it('should NOT update status when already Read/Completed (3)', async () => {
      const client = new HardcoverClient(mockToken);

      // Mock book with Read status
      client.getBookCurrentProgress = mock.fn(async () => ({
        has_progress: true,
        latest_read: {
          id: mockReadId,
          progress_pages: 200,
          edition: { id: mockEditionId, pages: 200 },
        },
        user_book: {
          id: mockUserBookId,
          status_id: 3, // Read (Completed)
        },
      }));

      client.updateBookStatus = mock.fn(async (userBookId, statusId) => ({
        id: userBookId,
        status_id: statusId,
      }));

      client._shouldCreateNewReadingSession = mock.fn(() => ({
        createNew: false,
        isRegression: false,
      }));

      client._executeQuery = mock.fn(async () => ({
        update_user_book_read: {
          user_book_read: {
            id: mockReadId,
            progress_pages: mockCurrentProgress,
          },
        },
      }));

      // Execute the test
      await client.updateReadingProgress(
        mockUserBookId,
        mockCurrentProgress,
        mockProgressPercentage,
        mockEditionId,
        false,
        '2024-01-01',
      );

      // Verify updateBookStatus was NOT called
      assert.strictEqual(
        client.updateBookStatus.mock.calls.length,
        0,
        'updateBookStatus should NOT be called for status_id = 3',
      );
    });

    it('should update status for audiobooks with seconds', async () => {
      const client = new HardcoverClient(mockToken);
      const mockAudioSeconds = 3600; // 1 hour

      // Mock book with Want to Read status (audiobook)
      client.getBookCurrentProgress = mock.fn(async () => ({
        has_progress: true,
        latest_read: {
          id: mockReadId,
          progress_seconds: 1000,
          edition: { id: mockEditionId, audio_seconds: 10000 },
        },
        user_book: {
          id: mockUserBookId,
          status_id: 1, // Want to Read
        },
      }));

      client.updateBookStatus = mock.fn(async (userBookId, statusId) => ({
        id: userBookId,
        status_id: statusId,
      }));

      client._shouldCreateNewReadingSession = mock.fn(() => ({
        createNew: false,
        isRegression: false,
      }));

      client._executeQuery = mock.fn(async () => ({
        update_user_book_read: {
          user_book_read: {
            id: mockReadId,
            progress_seconds: mockAudioSeconds,
          },
        },
      }));

      // Execute the test with useSeconds = true
      await client.updateReadingProgress(
        mockUserBookId,
        mockAudioSeconds,
        36.0, // progress percentage
        mockEditionId,
        true, // useSeconds
        '2024-01-01',
      );

      // Verify updateBookStatus was called
      assert.strictEqual(
        client.updateBookStatus.mock.calls.length,
        1,
        'updateBookStatus should be called for audiobooks',
      );
      assert.deepStrictEqual(client.updateBookStatus.mock.calls[0].arguments, [
        mockUserBookId,
        2,
      ]);
    });
  });

  describe('updateReadingProgress - Edge Cases', () => {
    it('should handle missing user_book gracefully', async () => {
      const client = new HardcoverClient(mockToken);

      // Mock progress without user_book data
      client.getBookCurrentProgress = mock.fn(async () => ({
        has_progress: true,
        latest_read: {
          id: mockReadId,
          progress_pages: 10,
          edition: { id: mockEditionId, pages: 200 },
        },
        user_book: null, // No user_book data
      }));

      client.updateBookStatus = mock.fn(async (userBookId, statusId) => ({
        id: userBookId,
        status_id: statusId,
      }));

      client._shouldCreateNewReadingSession = mock.fn(() => ({
        createNew: false,
        isRegression: false,
      }));

      client._executeQuery = mock.fn(async () => ({
        update_user_book_read: {
          user_book_read: {
            id: mockReadId,
            progress_pages: mockCurrentProgress,
          },
        },
      }));

      // Should not throw an error
      await client.updateReadingProgress(
        mockUserBookId,
        mockCurrentProgress,
        mockProgressPercentage,
        mockEditionId,
        false,
        '2024-01-01',
      );

      // Verify updateBookStatus was NOT called (no status to check)
      assert.strictEqual(
        client.updateBookStatus.mock.calls.length,
        0,
        'updateBookStatus should NOT be called when user_book is null',
      );
    });

    it('should handle missing status_id gracefully', async () => {
      const client = new HardcoverClient(mockToken);

      // Mock user_book without status_id
      client.getBookCurrentProgress = mock.fn(async () => ({
        has_progress: true,
        latest_read: {
          id: mockReadId,
          progress_pages: 10,
          edition: { id: mockEditionId, pages: 200 },
        },
        user_book: {
          id: mockUserBookId,
          // No status_id field
        },
      }));

      client.updateBookStatus = mock.fn(async (userBookId, statusId) => ({
        id: userBookId,
        status_id: statusId,
      }));

      client._shouldCreateNewReadingSession = mock.fn(() => ({
        createNew: false,
        isRegression: false,
      }));

      client._executeQuery = mock.fn(async () => ({
        update_user_book_read: {
          user_book_read: {
            id: mockReadId,
            progress_pages: mockCurrentProgress,
          },
        },
      }));

      // Should not throw an error
      await client.updateReadingProgress(
        mockUserBookId,
        mockCurrentProgress,
        mockProgressPercentage,
        mockEditionId,
        false,
        '2024-01-01',
      );

      // Verify updateBookStatus was NOT called
      assert.strictEqual(
        client.updateBookStatus.mock.calls.length,
        0,
        'updateBookStatus should NOT be called when status_id is missing',
      );
    });

    it('should handle status_id = 0 (edge case)', async () => {
      const client = new HardcoverClient(mockToken);

      // Mock book with status_id = 0 (unknown status)
      client.getBookCurrentProgress = mock.fn(async () => ({
        has_progress: true,
        latest_read: {
          id: mockReadId,
          progress_pages: 10,
          edition: { id: mockEditionId, pages: 200 },
        },
        user_book: {
          id: mockUserBookId,
          status_id: 0, // Edge case: status 0
        },
      }));

      client.updateBookStatus = mock.fn(async (userBookId, statusId) => ({
        id: userBookId,
        status_id: statusId,
      }));

      client._shouldCreateNewReadingSession = mock.fn(() => ({
        createNew: false,
        isRegression: false,
      }));

      client._executeQuery = mock.fn(async () => ({
        update_user_book_read: {
          user_book_read: {
            id: mockReadId,
            progress_pages: mockCurrentProgress,
          },
        },
      }));

      // Execute the test
      await client.updateReadingProgress(
        mockUserBookId,
        mockCurrentProgress,
        mockProgressPercentage,
        mockEditionId,
        false,
        '2024-01-01',
      );

      // status_id = 0 is falsy, so updateBookStatus should NOT be called
      assert.strictEqual(
        client.updateBookStatus.mock.calls.length,
        0,
        'updateBookStatus should NOT be called when status_id = 0',
      );
    });

    it('should update status for other unknown status IDs (4, 5, etc)', async () => {
      const client = new HardcoverClient(mockToken);

      // Mock book with unknown status_id
      client.getBookCurrentProgress = mock.fn(async () => ({
        has_progress: true,
        latest_read: {
          id: mockReadId,
          progress_pages: 10,
          edition: { id: mockEditionId, pages: 200 },
        },
        user_book: {
          id: mockUserBookId,
          status_id: 4, // Unknown status
        },
      }));

      client.updateBookStatus = mock.fn(async (userBookId, statusId) => ({
        id: userBookId,
        status_id: statusId,
      }));

      client._shouldCreateNewReadingSession = mock.fn(() => ({
        createNew: false,
        isRegression: false,
      }));

      client._executeQuery = mock.fn(async () => ({
        update_user_book_read: {
          user_book_read: {
            id: mockReadId,
            progress_pages: mockCurrentProgress,
          },
        },
      }));

      // Execute the test
      await client.updateReadingProgress(
        mockUserBookId,
        mockCurrentProgress,
        mockProgressPercentage,
        mockEditionId,
        false,
        '2024-01-01',
      );

      // Verify updateBookStatus WAS called (status 4 should be updated)
      assert.strictEqual(
        client.updateBookStatus.mock.calls.length,
        1,
        'updateBookStatus should be called for unknown status_id',
      );
      assert.deepStrictEqual(client.updateBookStatus.mock.calls[0].arguments, [
        mockUserBookId,
        2,
      ]);
    });

    it('should handle new reading session creation with Want to Read status', async () => {
      const client = new HardcoverClient(mockToken);

      // Mock book with Want to Read status but should create new session
      client.getBookCurrentProgress = mock.fn(async () => ({
        has_progress: false,
        latest_read: null,
        user_book: {
          id: mockUserBookId,
          status_id: 1, // Want to Read
        },
      }));

      client.updateBookStatus = mock.fn(async (userBookId, statusId) => ({
        id: userBookId,
        status_id: statusId,
      }));

      // Mock _shouldCreateNewReadingSession to return true
      client._shouldCreateNewReadingSession = mock.fn(() => ({
        createNew: true,
        reason: 'No existing progress',
      }));

      // Mock insertUserBookRead for new session
      client.insertUserBookRead = mock.fn(async () => ({
        id: mockReadId,
        progress_pages: mockCurrentProgress,
      }));

      // Execute the test
      await client.updateReadingProgress(
        mockUserBookId,
        mockCurrentProgress,
        mockProgressPercentage,
        mockEditionId,
        false,
        '2024-01-01',
      );

      // Verify updateBookStatus was called BEFORE creating new session
      assert.strictEqual(
        client.updateBookStatus.mock.calls.length,
        1,
        'updateBookStatus should be called before creating new session',
      );

      // Verify new session was created
      assert.strictEqual(
        client.insertUserBookRead.mock.calls.length,
        1,
        'insertUserBookRead should be called for new session',
      );
    });
  });

  describe('Integration with existing progress update flow', () => {
    it('should update status before updating progress', async () => {
      const client = new HardcoverClient(mockToken);
      const callOrder = [];

      // Mock book with Want to Read status
      client.getBookCurrentProgress = mock.fn(async () => ({
        has_progress: true,
        latest_read: {
          id: mockReadId,
          progress_pages: 10,
          edition: { id: mockEditionId, pages: 200 },
        },
        user_book: {
          id: mockUserBookId,
          status_id: 1, // Want to Read
        },
      }));

      // Track call order
      client.updateBookStatus = mock.fn(async (userBookId, statusId) => {
        callOrder.push('updateBookStatus');
        return { id: userBookId, status_id: statusId };
      });

      client._shouldCreateNewReadingSession = mock.fn(() => ({
        createNew: false,
        isRegression: false,
      }));

      client._executeQuery = mock.fn(async () => {
        callOrder.push('updateProgress');
        return {
          update_user_book_read: {
            user_book_read: {
              id: mockReadId,
              progress_pages: mockCurrentProgress,
            },
          },
        };
      });

      // Execute the test
      await client.updateReadingProgress(
        mockUserBookId,
        mockCurrentProgress,
        mockProgressPercentage,
        mockEditionId,
        false,
        '2024-01-01',
      );

      // Verify status is updated before progress
      assert.deepStrictEqual(
        callOrder,
        ['updateBookStatus', 'updateProgress'],
        'Status should be updated before progress',
      );
    });
  });
});
