import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { HardcoverClient } from '../src/hardcover-client.js';
import { BookCache } from '../src/book-cache.js';
import fs from 'fs';

/**
 * End-to-end integration tests for the user's reported issue:
 * "Changing the book edition in Hardcover to match the ISBN and ASIN of my
 * Audiobookshelf metadata does not push it from Want to Read > Currently Reading"
 *
 * These tests verify the complete flow from edition matching through status updates.
 */
describe('Want to Read Status Update - Edition Change Integration', () => {
  const testCacheFile = 'data/.test_edition_integration.db';
  const testUserId = 'test-user-456';
  const mockToken = 'test-token';
  let cache;
  let client;

  beforeEach(() => {
    // Clean up any existing test cache
    if (fs.existsSync(testCacheFile)) {
      fs.unlinkSync(testCacheFile);
    }
    cache = new BookCache(testCacheFile);
    client = new HardcoverClient(mockToken);
  });

  afterEach(() => {
    // Clean up test cache
    if (cache && cache.db) {
      try {
        cache.db.close();
      } catch (err) {
        // Ignore close errors
      }
    }
    if (fs.existsSync(testCacheFile)) {
      fs.unlinkSync(testCacheFile);
    }
  });

  it('should update status when edition changes to match ASIN even with unchanged progress', async () => {
    const identifier = 'B08XYZABC1'; // ASIN
    const title = 'The Great Gatsby';
    const progressPercent = 35;
    const oldEditionId = 1001; // Edition without ASIN match
    const newEditionId = 1002; // Edition with matching ASIN

    // SCENARIO: User previously synced book with old edition, status is "Want to Read"
    await cache.storeProgress(
      testUserId,
      identifier,
      title,
      progressPercent,
      'asin',
      null,
      null,
      1, // Want to Read status
      oldEditionId,
    );

    // SCENARIO: User changes edition in Hardcover to match ASIN
    // ShelfBridge re-syncs with same progress but different edition
    const syncCheck = await cache.needsSyncCheck(
      testUserId,
      identifier,
      title,
      progressPercent, // Same progress!
      'asin',
      newEditionId, // Different edition!
    );

    // VERIFY: Sync should be triggered for TWO reasons
    assert.strictEqual(syncCheck.needsSync, true, 'Sync should be triggered');
    assert.strictEqual(
      syncCheck.changes.statusChanged,
      true,
      'Status change should be detected (Want to Read)',
    );
    assert.strictEqual(
      syncCheck.changes.editionChanged,
      true,
      'Edition change should be detected',
    );
    assert.strictEqual(
      syncCheck.changes.progressChanged,
      false,
      'Progress should be unchanged',
    );

    // Verify the reason includes both triggers
    assert.ok(
      syncCheck.reason.includes('Want to Read'),
      'Reason should mention Want to Read',
    );
    assert.ok(
      syncCheck.reason.includes('edition changed'),
      'Reason should mention edition change',
    );
  });

  it('should update status from Want to Read when progress is exactly the same', async () => {
    const userBookId = 123;
    const editionId = 456;
    const progressPercent = 50;

    // Mock getBookCurrentProgress to return Want to Read status
    client.getBookCurrentProgress = mock.fn(async () => ({
      has_progress: true,
      latest_read: {
        id: 789,
        progress_pages: 100,
        edition: { id: editionId, pages: 200 },
      },
      user_book: {
        id: userBookId,
        status_id: 1, // Want to Read
      },
    }));

    // Mock updateBookStatus to verify it's called
    client.updateBookStatus = mock.fn(async (bookId, statusId) => ({
      id: bookId,
      status_id: statusId,
    }));

    // Mock _shouldCreateNewReadingSession
    client._shouldCreateNewReadingSession = mock.fn(() => ({
      createNew: false,
      isRegression: false,
    }));

    // Mock progress update
    client._executeQuery = mock.fn(async () => ({
      update_user_book_read: {
        user_book_read: {
          id: 789,
          progress_pages: 100,
          edition_id: editionId,
          started_at: '2024-01-01',
        },
      },
    }));

    // Execute updateReadingProgress
    const result = await client.updateReadingProgress(
      userBookId,
      100, // current progress (pages)
      progressPercent,
      editionId,
      false, // not seconds
      '2024-01-01',
      null,
    );

    // VERIFY: Status update was called
    assert.strictEqual(
      client.updateBookStatus.mock.calls.length,
      1,
      'updateBookStatus should be called',
    );
    assert.deepStrictEqual(
      client.updateBookStatus.mock.calls[0].arguments,
      [userBookId, 2],
      'Should update to "Currently Reading" (status_id: 2)',
    );

    // VERIFY: Result includes status information
    assert.ok(result._statusInfo, 'Result should include status info');
    assert.strictEqual(
      result._statusInfo.currentStatusId,
      2,
      'Status should be updated to 2',
    );
    assert.strictEqual(
      result._statusInfo.statusWasUpdated,
      true,
      'Status update flag should be true',
    );
  });

  it('should NOT update status when already Currently Reading', async () => {
    const userBookId = 123;
    const editionId = 456;

    // Mock getBookCurrentProgress to return Currently Reading status
    client.getBookCurrentProgress = mock.fn(async () => ({
      has_progress: true,
      latest_read: {
        id: 789,
        progress_pages: 100,
        edition: { id: editionId, pages: 200 },
      },
      user_book: {
        id: userBookId,
        status_id: 2, // Currently Reading
      },
    }));

    // Mock updateBookStatus - should NOT be called
    client.updateBookStatus = mock.fn(async () => ({}));

    // Mock _shouldCreateNewReadingSession
    client._shouldCreateNewReadingSession = mock.fn(() => ({
      createNew: false,
      isRegression: false,
    }));

    // Mock progress update
    client._executeQuery = mock.fn(async () => ({
      update_user_book_read: {
        user_book_read: {
          id: 789,
          progress_pages: 100,
        },
      },
    }));

    // Execute updateReadingProgress
    const result = await client.updateReadingProgress(
      userBookId,
      100,
      50,
      editionId,
      false,
      '2024-01-01',
      null,
    );

    // VERIFY: Status update was NOT called
    assert.strictEqual(
      client.updateBookStatus.mock.calls.length,
      0,
      'updateBookStatus should NOT be called for Currently Reading',
    );

    // VERIFY: Result still includes status info showing no update
    assert.ok(result._statusInfo, 'Result should include status info');
    assert.strictEqual(
      result._statusInfo.currentStatusId,
      2,
      'Status should remain 2',
    );
    assert.strictEqual(
      result._statusInfo.statusWasUpdated,
      false,
      'Status update flag should be false',
    );
  });

  it('should handle ISBN to ASIN edition switch correctly', async () => {
    const title = 'Project Hail Mary';
    const oldIdentifier = '978-0593135204'; // ISBN
    const newIdentifier = 'B08FHBV4ZX'; // ASIN of same book
    const progressPercent = 42;
    const oldEditionId = 2001;
    const newEditionId = 2002;

    // SCENARIO: Book was first matched by ISBN
    await cache.storeProgress(
      testUserId,
      oldIdentifier,
      title,
      progressPercent,
      'isbn',
      null,
      null,
      1, // Want to Read
      oldEditionId,
    );

    // SCENARIO: User changes to audiobook edition (ASIN) in Hardcover
    // ShelfBridge now matches by ASIN instead
    const syncCheck = await cache.needsSyncCheck(
      testUserId,
      newIdentifier, // Different identifier!
      title,
      progressPercent,
      'asin', // Different type!
      newEditionId,
    );

    // VERIFY: This looks like a new book to cache (different identifier)
    // but that's expected - sync will proceed
    assert.strictEqual(
      syncCheck.needsSync,
      true,
      'Sync should be triggered for new identifier',
    );
    assert.strictEqual(
      syncCheck.reason,
      'No cached data',
      'Should be treated as new book with new identifier',
    );
  });

  it('should preserve status in cache after successful update', async () => {
    const identifier = 'test-isbn-999';
    const title = 'Test Book';
    const progressPercent = 25;
    const editionId = 999;

    // Store with Want to Read status
    await cache.storeProgress(
      testUserId,
      identifier,
      title,
      progressPercent,
      'isbn',
      null,
      null,
      1, // Want to Read
      editionId,
    );

    // Simulate sync updating status to Currently Reading
    await cache.storeProgress(
      testUserId,
      identifier,
      title,
      progressPercent,
      'isbn',
      null,
      null,
      2, // Now Currently Reading
      editionId,
    );

    // Check sync decision - should NOT trigger on status anymore
    const syncCheck = await cache.needsSyncCheck(
      testUserId,
      identifier,
      title,
      progressPercent,
      'isbn',
      editionId,
    );

    // VERIFY: No sync needed now that status is updated
    assert.strictEqual(
      syncCheck.needsSync,
      false,
      'Sync should not be triggered after status updated',
    );
    assert.strictEqual(
      syncCheck.changes.statusChanged,
      false,
      'Status should not trigger sync (now status_id = 2)',
    );
  });

  it('should handle complete user scenario: edition change + status update', async () => {
    const title = 'The Midnight Library';
    const asin = 'B08BAKQ6FD';
    const progressPercent = 60;
    const wrongEditionId = 3001; // User had wrong edition first
    const correctEditionId = 3002; // Then changed to match ASIN

    // STEP 1: Initial state - book in cache with wrong edition, Want to Read
    await cache.storeProgress(
      testUserId,
      asin,
      title,
      progressPercent,
      'asin',
      '2024-01-15T10:00:00Z',
      '2024-01-01T08:00:00Z',
      1, // Want to Read
      wrongEditionId,
    );

    // STEP 2: User changes edition in Hardcover to match ASIN
    // Sync runs again with same progress
    const syncCheck = await cache.needsSyncCheck(
      testUserId,
      asin,
      title,
      progressPercent, // SAME progress!
      'asin',
      correctEditionId, // DIFFERENT edition!
    );

    // VERIFY: Both conditions trigger sync
    assert.strictEqual(syncCheck.needsSync, true);
    assert.strictEqual(syncCheck.changes.statusChanged, true);
    assert.strictEqual(syncCheck.changes.editionChanged, true);
    assert.strictEqual(syncCheck.changes.progressChanged, false);

    // STEP 3: After sync completes, cache is updated
    await cache.storeProgress(
      testUserId,
      asin,
      title,
      progressPercent,
      'asin',
      '2024-01-15T10:00:00Z',
      '2024-01-01T08:00:00Z',
      2, // Status updated to Currently Reading
      correctEditionId, // Edition updated
    );

    // STEP 4: Next sync with small progress change should work normally
    const newProgress = 62;
    const nextSyncCheck = await cache.needsSyncCheck(
      testUserId,
      asin,
      title,
      newProgress,
      'asin',
      correctEditionId,
    );

    // VERIFY: Only progress triggers now
    assert.strictEqual(nextSyncCheck.needsSync, true);
    assert.strictEqual(nextSyncCheck.changes.progressChanged, true);
    assert.strictEqual(nextSyncCheck.changes.statusChanged, false);
    assert.strictEqual(nextSyncCheck.changes.editionChanged, false);
  });

  it('should not break existing progress updates for non-Want-to-Read books', async () => {
    const identifier = 'existing-book-001';
    const title = 'Normal Book';
    const oldProgress = 30;
    const newProgress = 35;
    const editionId = 4001;

    // SCENARIO: Normal book already in Currently Reading
    await cache.storeProgress(
      testUserId,
      identifier,
      title,
      oldProgress,
      'isbn',
      null,
      null,
      2, // Currently Reading
      editionId,
    );

    // Normal progress update
    const syncCheck = await cache.needsSyncCheck(
      testUserId,
      identifier,
      title,
      newProgress,
      'isbn',
      editionId,
    );

    // VERIFY: Works as before - triggers on progress change only
    assert.strictEqual(
      syncCheck.needsSync,
      true,
      'Should sync on progress change',
    );
    assert.strictEqual(
      syncCheck.changes.progressChanged,
      true,
      'Progress changed',
    );
    assert.strictEqual(
      syncCheck.changes.statusChanged,
      false,
      'Status not a factor',
    );
    assert.strictEqual(
      syncCheck.changes.editionChanged,
      false,
      'Edition unchanged',
    );
  });

  it('should handle audiobook format with Want to Read status', async () => {
    const userBookId = 200;
    const editionId = 500;
    const currentSeconds = 3600; // 1 hour
    const totalSeconds = 36000; // 10 hours
    const progressPercent = 10;

    // Mock audiobook with Want to Read status
    client.getBookCurrentProgress = mock.fn(async () => ({
      has_progress: true,
      latest_read: {
        id: 800,
        progress_seconds: 1800, // Previous: 30 minutes
        edition: { id: editionId, audio_seconds: totalSeconds },
      },
      user_book: {
        id: userBookId,
        status_id: 1, // Want to Read
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
          id: 800,
          progress_seconds: currentSeconds,
        },
      },
    }));

    // Update progress for audiobook
    const result = await client.updateReadingProgress(
      userBookId,
      currentSeconds,
      progressPercent,
      editionId,
      true, // useSeconds = true for audiobook
      '2024-01-01',
      null,
    );

    // VERIFY: Status update works for audiobooks too
    assert.strictEqual(
      client.updateBookStatus.mock.calls.length,
      1,
      'Should update status for audiobook',
    );
    assert.strictEqual(
      result._statusInfo.currentStatusId,
      2,
      'Status updated to Currently Reading',
    );
    assert.strictEqual(
      result._statusInfo.statusWasUpdated,
      true,
      'Status was updated',
    );
  });
});
