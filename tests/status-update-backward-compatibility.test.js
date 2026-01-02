import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { HardcoverClient } from '../src/hardcover-client.js';
import { BookCache } from '../src/book-cache.js';
import fs from 'fs';

/**
 * Backward compatibility tests for status update feature
 * Ensures the new status-aware caching doesn't break existing functionality
 */
describe('Status Update - Backward Compatibility', () => {
  const testCacheFile = 'data/.test_backward_compat.db';
  const testUserId = 'test-user-789';
  const mockToken = 'test-token';
  let cache;
  let client;

  beforeEach(() => {
    if (fs.existsSync(testCacheFile)) {
      fs.unlinkSync(testCacheFile);
    }
    cache = new BookCache(testCacheFile);
    client = new HardcoverClient(mockToken);
  });

  afterEach(() => {
    if (cache && cache.db) {
      try {
        cache.db.close();
      } catch (err) {
        // Ignore
      }
    }
    if (fs.existsSync(testCacheFile)) {
      fs.unlinkSync(testCacheFile);
    }
  });

  it('should work with NULL status_id (migrated database)', async () => {
    const identifier = 'isbn-null-test';
    const title = 'Legacy Book';
    const progressPercent = 50;
    const editionId = 100;

    // Simulate old cache entry (before migration) with NULL status
    await cache.storeProgress(
      testUserId,
      identifier,
      title,
      progressPercent,
      'isbn',
      null,
      null,
      null, // NULL status (pre-migration)
      editionId,
    );

    // Should not trigger on status alone (NULL is not 1)
    const syncCheck = await cache.needsSyncCheck(
      testUserId,
      identifier,
      title,
      progressPercent,
      'isbn',
      editionId,
    );

    assert.strictEqual(
      syncCheck.needsSync,
      false,
      'NULL status should not trigger sync',
    );
    assert.strictEqual(
      syncCheck.changes.statusChanged,
      false,
      'NULL status should not be treated as Want to Read',
    );
  });

  it('should work with NULL hardcover_edition_id (pre-migration)', async () => {
    const identifier = 'isbn-no-edition';
    const title = 'Book Without Edition Cache';
    const progressPercent = 50;
    const currentEditionId = 200;

    // Old cache without edition_id
    await cache.storeProgress(
      testUserId,
      identifier,
      title,
      progressPercent,
      'isbn',
      null,
      null,
      2, // Status present
      null, // Edition NULL (pre-migration)
    );

    // Should not trigger on edition change if old value is NULL
    const syncCheck = await cache.needsSyncCheck(
      testUserId,
      identifier,
      title,
      progressPercent,
      'isbn',
      currentEditionId,
    );

    assert.strictEqual(
      syncCheck.needsSync,
      false,
      'Should not trigger when cached edition is NULL',
    );
    assert.strictEqual(
      syncCheck.changes.editionChanged,
      false,
      'NULL edition should not trigger edition change',
    );
  });

  it('should maintain existing behavior for Completed books', async () => {
    const userBookId = 300;
    const editionId = 300;

    // Mock completed book (status_id = 3)
    client.getBookCurrentProgress = mock.fn(async () => ({
      has_progress: true,
      latest_read: {
        id: 900,
        progress_pages: 300,
        edition: { id: editionId, pages: 300 },
        finished_at: '2024-01-10',
      },
      user_book: {
        id: userBookId,
        status_id: 3, // Completed/Read
      },
    }));

    client.updateBookStatus = mock.fn(async () => ({}));
    client._shouldCreateNewReadingSession = mock.fn(() => ({
      createNew: false,
      isRegression: false,
    }));

    client._executeQuery = mock.fn(async () => ({
      update_user_book_read: {
        user_book_read: {
          id: 900,
          progress_pages: 300,
        },
      },
    }));

    // Try to update progress on completed book
    const result = await client.updateReadingProgress(
      userBookId,
      300,
      100,
      editionId,
      false,
      '2024-01-01',
      null,
    );

    // Should NOT update status for completed books
    assert.strictEqual(
      client.updateBookStatus.mock.calls.length,
      0,
      'Should not update status for completed books',
    );
    assert.strictEqual(
      result._statusInfo.currentStatusId,
      3,
      'Status should remain 3 (Completed)',
    );
    assert.strictEqual(
      result._statusInfo.statusWasUpdated,
      false,
      'Status should not be updated',
    );
  });

  it('should handle undefined edition_id in needsSyncCheck gracefully', async () => {
    const identifier = 'test-undefined';
    const title = 'Test Book';
    const progressPercent = 50;

    await cache.storeProgress(
      testUserId,
      identifier,
      title,
      progressPercent,
      'isbn',
      null,
      null,
      2,
      100,
    );

    // Call with undefined edition (shouldn't crash)
    const syncCheck = await cache.needsSyncCheck(
      testUserId,
      identifier,
      title,
      progressPercent,
      'isbn',
      undefined, // undefined edition
    );

    // Should handle gracefully
    assert.strictEqual(
      syncCheck.changes.editionChanged,
      false,
      'Undefined edition should not trigger change',
    );
  });

  it('should preserve existing skip behavior for unchanged progress', async () => {
    const identifier = 'skip-test';
    const title = 'Skip Test Book';
    const progressPercent = 75;
    const editionId = 400;

    // Book in Currently Reading with no changes
    await cache.storeProgress(
      testUserId,
      identifier,
      title,
      progressPercent,
      'isbn',
      null,
      null,
      2, // Currently Reading
      editionId,
    );

    // Same everything
    const syncCheck = await cache.needsSyncCheck(
      testUserId,
      identifier,
      title,
      progressPercent, // Same
      'isbn',
      editionId, // Same
    );

    // Should skip as before
    assert.strictEqual(
      syncCheck.needsSync,
      false,
      'Should skip when nothing changed',
    );
    assert.strictEqual(
      syncCheck.reason,
      'No changes detected',
      'Reason should indicate no changes',
    );
  });

  it('should handle cache errors gracefully', async () => {
    // Force a cache error by passing invalid data
    const syncCheck = await cache.needsSyncCheck(
      testUserId,
      '', // Empty identifier
      '', // Empty title
      50,
      'isbn',
      100,
    );

    // Should default to "needs sync" on error
    assert.strictEqual(
      syncCheck.needsSync,
      true,
      'Should default to needs sync on error',
    );
  });

  it('should work with storeBookSyncData (used in actual sync flow)', async () => {
    const identifier = 'sync-data-test';
    const title = 'Sync Data Book';
    const editionId = 500;
    const author = 'Test Author';
    const progressPercent = 30;

    // Store using storeBookSyncData (includes edition mapping)
    await cache.storeBookSyncData(
      testUserId,
      identifier,
      title,
      editionId,
      'isbn',
      author,
      progressPercent,
      null,
      null,
      1, // Want to Read
      editionId,
    );

    // Check if sync is needed
    const syncCheck = await cache.needsSyncCheck(
      testUserId,
      identifier,
      title,
      progressPercent,
      'isbn',
      editionId,
    );

    // Should trigger on status
    assert.strictEqual(
      syncCheck.needsSync,
      true,
      'Should trigger sync for Want to Read',
    );
    assert.strictEqual(
      syncCheck.changes.statusChanged,
      true,
      'Status change should be detected',
    );
  });

  it('should work with storeBookCompletionData', async () => {
    const identifier = 'completion-test';
    const title = 'Completed Book';
    const identifierType = 'isbn';

    // Store completion (progress = 100%, status = 3)
    await cache.storeBookCompletionData(
      testUserId,
      identifier,
      title,
      identifierType,
      '2024-01-15T10:00:00Z',
      '2024-01-01T08:00:00Z',
      '2024-01-15T10:00:00Z',
      3, // Completed status
      600,
    );

    // Check sync for completed book
    const syncCheck = await cache.needsSyncCheck(
      testUserId,
      identifier,
      title,
      100, // 100% progress
      identifierType,
      600,
    );

    // Should not trigger (completed, no changes)
    assert.strictEqual(
      syncCheck.needsSync,
      false,
      'Should not sync completed book with no changes',
    );
  });

  it('should handle very small progress changes correctly', async () => {
    const identifier = 'small-change';
    const title = 'Small Change Book';
    const oldProgress = 50.005;
    const newProgress = 50.006; // Tiny change (0.001%)
    const editionId = 700;

    await cache.storeProgress(
      testUserId,
      identifier,
      title,
      oldProgress,
      'isbn',
      null,
      null,
      2,
      editionId,
    );

    const syncCheck = await cache.needsSyncCheck(
      testUserId,
      identifier,
      title,
      newProgress,
      'isbn',
      editionId,
    );

    // Should NOT trigger (below 0.01% threshold)
    assert.strictEqual(
      syncCheck.needsSync,
      false,
      'Should not trigger for changes below threshold',
    );
    assert.strictEqual(
      syncCheck.changes.progressChanged,
      false,
      'Progress change should be below threshold',
    );
  });

  it('should handle progress that crosses threshold', async () => {
    const identifier = 'threshold-test';
    const title = 'Threshold Book';
    const oldProgress = 50.0;
    const newProgress = 50.02; // 0.02% change (above 0.01% threshold)
    const editionId = 800;

    await cache.storeProgress(
      testUserId,
      identifier,
      title,
      oldProgress,
      'isbn',
      null,
      null,
      2,
      editionId,
    );

    const syncCheck = await cache.needsSyncCheck(
      testUserId,
      identifier,
      title,
      newProgress,
      'isbn',
      editionId,
    );

    // Should trigger (above threshold)
    assert.strictEqual(
      syncCheck.needsSync,
      true,
      'Should trigger for changes above threshold',
    );
    assert.strictEqual(
      syncCheck.changes.progressChanged,
      true,
      'Progress change should be detected',
    );
  });

  it('should return correct structure from updateReadingProgress even on errors', async () => {
    const userBookId = 999;
    const editionId = 999;

    // Mock to simulate error scenario
    client.getBookCurrentProgress = mock.fn(async () => {
      throw new Error('API Error');
    });

    try {
      await client.updateReadingProgress(
        userBookId,
        100,
        50,
        editionId,
        false,
        '2024-01-01',
        null,
      );
      assert.fail('Should have thrown error');
    } catch (err) {
      assert.ok(err.message.includes('API Error'), 'Should propagate error');
    }
  });

  it('should handle missing _statusInfo gracefully in sync-manager', async () => {
    // This tests the optional chaining in sync-manager: result?._statusInfo?.currentStatusId
    const identifier = 'status-info-test';
    const title = 'Status Info Test';
    const progressPercent = 50;

    // Simulate a result without _statusInfo (e.g., from old version or error)
    const mockResult = {
      id: 123,
      progress_pages: 100,
      // No _statusInfo property
    };

    // Extract status (this is what sync-manager does)
    const statusId = mockResult._statusInfo?.currentStatusId || null;

    // Should default to null gracefully
    assert.strictEqual(
      statusId,
      null,
      'Should handle missing _statusInfo gracefully',
    );

    // Store with null status (simulating this scenario)
    await cache.storeProgress(
      testUserId,
      identifier,
      title,
      progressPercent,
      'isbn',
      null,
      null,
      statusId, // null from above
      100,
    );

    // Should work fine
    const syncCheck = await cache.needsSyncCheck(
      testUserId,
      identifier,
      title,
      progressPercent,
      'isbn',
      100,
    );

    assert.strictEqual(
      syncCheck.needsSync,
      false,
      'Should work with null status from result',
    );
  });
});
