import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { SyncManager } from '../src/sync-manager.js';

describe('SyncManager first-sync regression protection', () => {
  it('blocks an existing Hardcover book from being rolled back on first local sync', async () => {
    const title = 'Existing Hardcover Book';
    const selectedEdition = {
      id: 'edition-1',
      audio_seconds: 3600,
      reading_format: { format: 'Listened' },
    };

    const updateReadingProgress = mock.fn(async () => ({ id: 'read-1' }));
    const manager = {
      userId: 'test-user',
      globalConfig: {
        prevent_progress_regression: true,
        force_sync: false,
        reread_detection: {
          regression_block_threshold: 50,
          regression_warn_threshold: 15,
          high_progress_threshold: 85,
          reread_threshold: 30,
        },
      },
      cache: {
        getSyncTracking: mock.fn(async () => ({
          total_syncs: 1,
        })),
      },
      hardcover: {
        getBookCurrentProgress: mock.fn(async () => ({
          has_progress: true,
          latest_read: {
            id: 'current-read',
            progress_seconds: 3240,
            edition: {
              audio_seconds: 3600,
            },
          },
        })),
        updateReadingProgress,
      },
      _selectEditionWithCache: mock.fn(async () => selectedEdition),
      _handleProgressStatus: async (
        userBookId,
        edition,
        bookTitle,
        progressPercent,
      ) => {
        await updateReadingProgress(
          userBookId,
          1440,
          progressPercent,
          edition.id,
          true,
          null,
          manager.globalConfig.reread_detection,
        );
        return { status: 'synced', title: bookTitle };
      },
    };

    const result = await SyncManager.prototype._syncExistingBook.call(
      manager,
      {
        id: 'abs-1',
        progress_percentage: 40,
        media: {
          metadata: {
            asin: 'B000000001',
          },
        },
      },
      {
        userBook: {
          id: 'user-book-1',
          book: {
            title,
          },
        },
        edition: selectedEdition,
      },
      'asin',
      'B000000001',
      title,
      'Test Author',
    );

    assert.equal(result.status, 'skipped');
    assert.match(result.reason, /Progress regression protection/);
    assert.equal(updateReadingProgress.mock.callCount(), 0);
  });
});
