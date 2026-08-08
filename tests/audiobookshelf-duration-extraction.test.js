import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { extractAudioDurationFromAudiobookshelf } from '../src/matching/utils/audiobookshelf-extractor.js';

describe('Audiobookshelf duration extraction', () => {
  it('sums audio-file durations from a standard item response', () => {
    const duration = extractAudioDurationFromAudiobookshelf({
      media: {
        audioFiles: [
          { duration: 1200.5 },
          { duration: 1800.25 },
          { duration: null },
        ],
      },
    });

    assert.equal(duration, 3000.75);
  });

  it('prefers the aggregate media duration when ABS supplies it', () => {
    const duration = extractAudioDurationFromAudiobookshelf({
      media: {
        duration: 3000,
        audioFiles: [{ duration: 2999.5 }],
      },
    });

    assert.equal(duration, 3000);
  });

  it('returns null when no positive duration is available', () => {
    const duration = extractAudioDurationFromAudiobookshelf({
      media: {
        audioFiles: [{ duration: 0 }, { duration: 'unknown' }],
      },
    });

    assert.equal(duration, null);
  });
});
