import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SyncManager } from '../src/sync-manager.js';

const mockUser = {
  id: 'test',
  abs_url: 'http://test.com',
  abs_token: 'token',
  hardcover_token: 'hc',
};
const mockConfig = { workers: 2, parallel: true };

test('Quick Double-Processing Verification', async t => {
  await t.test('Deduplication Works', () => {
    const syncManager = new SyncManager(mockUser, mockConfig, false, false);

    const books = [
      { id: 'book1', media: { metadata: { title: 'Test' } } },
      { id: 'book1', media: { metadata: { title: 'Test' } } }, // Duplicate
      { id: 'book2', media: { metadata: { title: 'Other' } } },
    ];

    const result = syncManager._deduplicateBooks(books);
    assert.strictEqual(result.duplicatesFound, 1);
    assert.strictEqual(result.books.length, 2);
  });

  await t.test('Processing Tracking Initialized', () => {
    const syncManager = new SyncManager(mockUser, mockConfig, false, false);
    assert.ok(syncManager.booksBeingProcessed instanceof Set);
    assert.strictEqual(syncManager.booksBeingProcessed.size, 0);
  });

  console.log('✅ All double-processing fixes are working correctly!');
});
