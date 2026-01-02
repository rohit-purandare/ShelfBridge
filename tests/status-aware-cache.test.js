import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { BookCache } from '../src/book-cache.js';
import fs from 'fs';
import path from 'path';

/**
 * Integration test for status-aware cache bypass feature
 * Tests that books with "Want to Read" status trigger sync even when progress is unchanged
 */
describe('BookCache - Status-Aware Sync Check', () => {
  const testCacheFile = 'data/.test_status_cache.db';
  const testUserId = 'test-user-123';
  let cache;

  beforeEach(() => {
    // Clean up any existing test cache
    if (fs.existsSync(testCacheFile)) {
      fs.unlinkSync(testCacheFile);
    }
    cache = new BookCache(testCacheFile);
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

  it('should trigger sync when status is Want to Read even if progress unchanged', async () => {
    const identifier = 'test-isbn-001';
    const title = 'Test Book';
    const progressPercent = 50;
    const editionId = 100;

    // Store initial progress with "Want to Read" status (status_id = 1)
    await cache.storeProgress(
      testUserId,
      identifier,
      title,
      progressPercent,
      'isbn',
      null,
      null,
      1, // Want to Read status
      editionId,
    );

    // Check if sync is needed with SAME progress but status is "Want to Read"
    const syncCheck = await cache.needsSyncCheck(
      testUserId,
      identifier,
      title,
      progressPercent,
      'isbn',
      editionId,
    );

    // Should trigger sync because status is "Want to Read"
    assert.strictEqual(
      syncCheck.needsSync,
      true,
      'Sync should be triggered for Want to Read status',
    );
    assert.strictEqual(
      syncCheck.changes.statusChanged,
      true,
      'Status change should be detected',
    );
    assert.strictEqual(
      syncCheck.changes.progressChanged,
      false,
      'Progress should be unchanged',
    );
    assert.ok(
      syncCheck.reason.includes('Want to Read'),
      'Reason should mention Want to Read status',
    );
  });

  it('should NOT trigger sync when status is Currently Reading and progress unchanged', async () => {
    const identifier = 'test-isbn-002';
    const title = 'Test Book 2';
    const progressPercent = 50;
    const editionId = 200;

    // Store progress with "Currently Reading" status (status_id = 2)
    await cache.storeProgress(
      testUserId,
      identifier,
      title,
      progressPercent,
      'isbn',
      null,
      null,
      2, // Currently Reading status
      editionId,
    );

    // Check if sync is needed with SAME progress
    const syncCheck = await cache.needsSyncCheck(
      testUserId,
      identifier,
      title,
      progressPercent,
      'isbn',
      editionId,
    );

    // Should NOT trigger sync - progress unchanged and status is not "Want to Read"
    assert.strictEqual(
      syncCheck.needsSync,
      false,
      'Sync should not be triggered',
    );
    assert.strictEqual(
      syncCheck.changes.statusChanged,
      false,
      'Status change should not be detected',
    );
    assert.strictEqual(
      syncCheck.changes.progressChanged,
      false,
      'Progress should be unchanged',
    );
  });

  it('should trigger sync when edition changes even if progress unchanged', async () => {
    const identifier = 'test-isbn-003';
    const title = 'Test Book 3';
    const progressPercent = 50;
    const oldEditionId = 300;
    const newEditionId = 301;

    // Store progress with old edition
    await cache.storeProgress(
      testUserId,
      identifier,
      title,
      progressPercent,
      'isbn',
      null,
      null,
      2, // Currently Reading status
      oldEditionId,
    );

    // Check if sync is needed with SAME progress but DIFFERENT edition
    const syncCheck = await cache.needsSyncCheck(
      testUserId,
      identifier,
      title,
      progressPercent,
      'isbn',
      newEditionId, // Different edition
    );

    // Should trigger sync because edition changed
    assert.strictEqual(
      syncCheck.needsSync,
      true,
      'Sync should be triggered for edition change',
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
    assert.ok(
      syncCheck.reason.includes('edition changed'),
      'Reason should mention edition change',
    );
  });

  it('should trigger sync on first cache miss', async () => {
    const identifier = 'test-isbn-004';
    const title = 'Test Book 4';
    const progressPercent = 50;
    const editionId = 400;

    // Check if sync is needed without any cached data
    const syncCheck = await cache.needsSyncCheck(
      testUserId,
      identifier,
      title,
      progressPercent,
      'isbn',
      editionId,
    );

    // Should trigger sync - no cached data
    assert.strictEqual(
      syncCheck.needsSync,
      true,
      'Sync should be triggered for cache miss',
    );
    assert.strictEqual(
      syncCheck.changes.progressChanged,
      true,
      'Progress should be considered changed on first sync',
    );
    assert.ok(
      syncCheck.reason.includes('No cached data'),
      'Reason should mention no cached data',
    );
  });

  it('should trigger sync when multiple conditions are met', async () => {
    const identifier = 'test-isbn-005';
    const title = 'Test Book 5';
    const oldProgress = 40;
    const newProgress = 50;
    const oldEditionId = 500;
    const newEditionId = 501;

    // Store progress with Want to Read status and old edition
    await cache.storeProgress(
      testUserId,
      identifier,
      title,
      oldProgress,
      'isbn',
      null,
      null,
      1, // Want to Read status
      oldEditionId,
    );

    // Check if sync is needed with changed progress, changed edition, AND Want to Read status
    const syncCheck = await cache.needsSyncCheck(
      testUserId,
      identifier,
      title,
      newProgress,
      'isbn',
      newEditionId,
    );

    // Should trigger sync for multiple reasons
    assert.strictEqual(
      syncCheck.needsSync,
      true,
      'Sync should be triggered',
    );
    assert.strictEqual(
      syncCheck.changes.progressChanged,
      true,
      'Progress change should be detected',
    );
    assert.strictEqual(
      syncCheck.changes.statusChanged,
      true,
      'Status check should be detected',
    );
    assert.strictEqual(
      syncCheck.changes.editionChanged,
      true,
      'Edition change should be detected',
    );
    assert.ok(
      syncCheck.reason.includes('progress changed'),
      'Reason should mention progress change',
    );
    assert.ok(
      syncCheck.reason.includes('Want to Read'),
      'Reason should mention Want to Read',
    );
    assert.ok(
      syncCheck.reason.includes('edition changed'),
      'Reason should mention edition change',
    );
  });

  it('should handle null status gracefully', async () => {
    const identifier = 'test-isbn-006';
    const title = 'Test Book 6';
    const progressPercent = 50;
    const editionId = 600;

    // Store progress with NULL status (not yet synced to Hardcover)
    await cache.storeProgress(
      testUserId,
      identifier,
      title,
      progressPercent,
      'isbn',
      null,
      null,
      null, // No status yet
      editionId,
    );

    // Check if sync is needed - should not trigger on status alone
    const syncCheck = await cache.needsSyncCheck(
      testUserId,
      identifier,
      title,
      progressPercent,
      'isbn',
      editionId,
    );

    // Should NOT trigger sync - progress unchanged, no status issue
    assert.strictEqual(
      syncCheck.needsSync,
      false,
      'Sync should not be triggered',
    );
    assert.strictEqual(
      syncCheck.changes.statusChanged,
      false,
      'Status change should not be detected for null status',
    );
  });
});
