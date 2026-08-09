import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SyncResultFormatter } from '../src/display/SyncResultFormatter.js';
import { SyncManager } from '../src/sync-manager.js';

describe('Post-add sync reporting', () => {
  it('counts a simulated add that continues to completion without double-counting updated books', () => {
    const manager = Object.create(SyncManager.prototype);
    const result = {
      books_processed: 0,
      books_synced: 0,
      books_completed: 0,
      books_auto_added: 0,
      books_skipped: 0,
      books_delayed: 0,
      errors: [],
      book_details: [],
    };

    manager._updateResult(result, {
      title: 'Ready Player Two',
      status: 'completed',
      actions: ['[DRY RUN] Would add matched book to library'],
      errors: [],
    });

    assert.equal(result.books_processed, 1);
    assert.equal(result.books_completed, 1);
    assert.equal(result.books_auto_added, 1);

    const formatter = new SyncResultFormatter();
    const output = formatter._buildHardcoverUpdatesColumn(result, {
      dry_run: true,
    });
    assert.ok(output.includes('├─ 1 would be updated'));
  });
});
