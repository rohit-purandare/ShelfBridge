import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { HardcoverClient } from '../src/hardcover-client.js';

/**
 * Test suite for atomic book completion operations
 * Verifies that markBookCompleted either succeeds completely or fails completely
 */

describe('HardcoverClient - Atomic Book Completion', () => {
  // Mock configuration
  const mockToken = 'test-token';
  const mockUserBookId = 123;
  const mockEditionId = 456;
  const mockTotalValue = 300; // pages or seconds
  const mockReadId = 789;

  describe('markBookCompleted - Success Scenarios', () => {
    it('should succeed when both progress and status updates work', async () => {
      const client = new HardcoverClient(mockToken);
      
      // Mock successful getBookCurrentProgress
      client.getBookCurrentProgress = mock.fn(async () => ({
        latest_read: { id: mockReadId }
      }));

      // Mock successful progress update
      client._executeQuery = mock.fn(async (mutation, variables) => {
        if (mutation.includes('markBookCompleted')) {
          return {
            update_user_book_read: {
              user_book_read: {
                id: mockReadId,
                progress_pages: mockTotalValue,
                finished_at: '2024-01-15',
                started_at: '2024-01-01',
                edition_id: mockEditionId
              }
            }
          };
        }
        return null;
      });

      // Mock successful status update
      client.updateBookStatus = mock.fn(async () => ({
        id: mockUserBookId,
        status_id: 3
      }));

      // Execute the test
      const result = await client.markBookCompleted(
        mockUserBookId,
        mockEditionId,
        mockTotalValue,
        false, // useSeconds
        '2024-01-15', // finishedAt
        '2024-01-01'  // startedAt
      );

      // Verify success
      assert.ok(result, 'markBookCompleted should return truthy result');
      assert.strictEqual(result.progress_pages, mockTotalValue);
      assert.strictEqual(result.edition_id, mockEditionId);

      // Verify both operations were called
      assert.strictEqual(client._executeQuery.mock.calls.length, 1, 'Progress update should be called once');
      assert.strictEqual(client.updateBookStatus.mock.calls.length, 1, 'Status update should be called once');
      assert.deepStrictEqual(client.updateBookStatus.mock.calls[0].arguments, [mockUserBookId, 3]);
    });

    it('should succeed with audiobook (seconds) format', async () => {
      const client = new HardcoverClient(mockToken);
      const mockAudioSeconds = 25200; // 7 hours

      // Mock existing progress
      client.getBookCurrentProgress = mock.fn(async () => ({
        latest_read: { id: mockReadId }
      }));

      // Mock successful progress update with seconds
      client._executeQuery = mock.fn(async (mutation, variables) => {
        if (mutation.includes('markBookCompleted') && mutation.includes('progress_seconds')) {
          return {
            update_user_book_read: {
              user_book_read: {
                id: mockReadId,
                progress_seconds: mockAudioSeconds,
                finished_at: '2024-01-15',
                started_at: '2024-01-01',
                edition_id: mockEditionId
              }
            }
          };
        }
        return null;
      });

      // Mock successful status update
      client.updateBookStatus = mock.fn(async () => ({ id: mockUserBookId, status_id: 3 }));

      const result = await client.markBookCompleted(
        mockUserBookId,
        mockEditionId,
        mockAudioSeconds,
        true, // useSeconds
        '2024-01-15',
        '2024-01-01'
      );

      assert.ok(result);
      assert.strictEqual(result.progress_seconds, mockAudioSeconds);
      assert.strictEqual(client.updateBookStatus.mock.calls.length, 1);
    });

    it('should create new progress record when none exists', async () => {
      const client = new HardcoverClient(mockToken);

      // Mock no existing progress
      client.getBookCurrentProgress = mock.fn(async () => null);

      // Mock successful new record creation
      client.insertUserBookRead = mock.fn(async () => ({
        id: mockReadId
      }));

      // Mock successful progress update
      client._executeQuery = mock.fn(async () => ({
        update_user_book_read: {
          user_book_read: {
            id: mockReadId,
            progress_pages: mockTotalValue,
            edition_id: mockEditionId
          }
        }
      }));

      // Mock successful status update
      client.updateBookStatus = mock.fn(async () => ({ id: mockUserBookId, status_id: 3 }));

      const result = await client.markBookCompleted(
        mockUserBookId,
        mockEditionId,
        mockTotalValue
      );

      assert.ok(result);
      assert.strictEqual(client.insertUserBookRead.mock.calls.length, 1, 'Should create new progress record');
      assert.strictEqual(client.updateBookStatus.mock.calls.length, 1, 'Should update status');
    });
  });

  describe('markBookCompleted - Failure Scenarios (Atomic Behavior)', () => {
    it('should fail completely when progress update fails', async () => {
      const client = new HardcoverClient(mockToken);

      client.getBookCurrentProgress = mock.fn(async () => ({
        latest_read: { id: mockReadId }
      }));

      // Mock failed progress update
      client._executeQuery = mock.fn(async () => null);

      // Status update should not be called
      client.updateBookStatus = mock.fn(async () => ({ id: mockUserBookId, status_id: 3 }));

      const result = await client.markBookCompleted(
        mockUserBookId,
        mockEditionId,
        mockTotalValue
      );

      // Should fail completely
      assert.strictEqual(result, false, 'Should return false when progress update fails');
      assert.strictEqual(client._executeQuery.mock.calls.length, 1, 'Progress update should be attempted');
      assert.strictEqual(client.updateBookStatus.mock.calls.length, 0, 'Status update should NOT be called when progress fails');
    });

    it('should fail completely when status update fails', async () => {
      const client = new HardcoverClient(mockToken);

      client.getBookCurrentProgress = mock.fn(async () => ({
        latest_read: { id: mockReadId }
      }));

      // Mock successful progress update
      client._executeQuery = mock.fn(async () => ({
        update_user_book_read: {
          user_book_read: {
            id: mockReadId,
            progress_pages: mockTotalValue,
            edition_id: mockEditionId
          }
        }
      }));

      // Mock failed status update (this is the key test case)
      client.updateBookStatus = mock.fn(async () => false);

      const result = await client.markBookCompleted(
        mockUserBookId,
        mockEditionId,
        mockTotalValue
      );

      // Should fail completely even though progress update succeeded
      assert.strictEqual(result, false, 'Should return false when status update fails');
      assert.strictEqual(client._executeQuery.mock.calls.length, 1, 'Progress update should be attempted');
      assert.strictEqual(client.updateBookStatus.mock.calls.length, 1, 'Status update should be attempted');
    });

    it('should fail when new progress record creation fails', async () => {
      const client = new HardcoverClient(mockToken);

      // Mock no existing progress
      client.getBookCurrentProgress = mock.fn(async () => null);

      // Mock failed new record creation
      client.insertUserBookRead = mock.fn(async () => null);

      // Other methods should not be called
      client._executeQuery = mock.fn();
      client.updateBookStatus = mock.fn();

      const result = await client.markBookCompleted(
        mockUserBookId,
        mockEditionId,
        mockTotalValue
      );

      assert.strictEqual(result, false, 'Should fail when new record creation fails');
      assert.strictEqual(client.insertUserBookRead.mock.calls.length, 1);
      assert.strictEqual(client._executeQuery.mock.calls.length, 0, 'Progress update should not be attempted');
      assert.strictEqual(client.updateBookStatus.mock.calls.length, 0, 'Status update should not be attempted');
    });

    it('should handle exceptions gracefully', async () => {
      const client = new HardcoverClient(mockToken);

      client.getBookCurrentProgress = mock.fn(async () => ({
        latest_read: { id: mockReadId }
      }));

      // Mock exception during progress update
      client._executeQuery = mock.fn(async () => {
        throw new Error('Network error');
      });

      client.updateBookStatus = mock.fn();

      const result = await client.markBookCompleted(
        mockUserBookId,
        mockEditionId,
        mockTotalValue
      );

      assert.strictEqual(result, false, 'Should return false when exception occurs');
      assert.strictEqual(client.updateBookStatus.mock.calls.length, 0, 'Status update should not be called when exception occurs');
    });
  });

  describe('Regression Tests - Previous Behavior vs New Behavior', () => {
    it('OLD BEHAVIOR: would have returned success even with status failure', async () => {
      // This test documents what the old behavior was and ensures we've fixed it
      const client = new HardcoverClient(mockToken);

      client.getBookCurrentProgress = mock.fn(async () => ({
        latest_read: { id: mockReadId }
      }));

      // Progress update succeeds
      client._executeQuery = mock.fn(async () => ({
        update_user_book_read: {
          user_book_read: {
            id: mockReadId,
            progress_pages: mockTotalValue,
            edition_id: mockEditionId
          }
        }
      }));

      // Status update fails
      client.updateBookStatus = mock.fn(async () => false);

      const result = await client.markBookCompleted(
        mockUserBookId,
        mockEditionId,
        mockTotalValue
      );

      // NEW BEHAVIOR: Should fail completely (this is the fix)
      assert.strictEqual(result, false, 'NEW BEHAVIOR: Should fail when status update fails');
      
      // OLD BEHAVIOR would have returned the progress result here
      // This test ensures we've actually fixed the issue
    });
  });
});
