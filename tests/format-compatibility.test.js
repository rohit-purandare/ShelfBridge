import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  mapHardcoverFormatToInternal,
  areFormatsCompatible,
  checkFormatCompatibility,
} from '../src/utils/format-compatibility.js';

describe('mapHardcoverFormatToInternal', () => {
  it('maps Listened to audiobook', () => {
    assert.equal(
      mapHardcoverFormatToInternal({ reading_format: { format: 'Listened' } }),
      'audiobook',
    );
  });

  it('maps Ebook to ebook', () => {
    assert.equal(
      mapHardcoverFormatToInternal({ reading_format: { format: 'Ebook' } }),
      'ebook',
    );
  });

  it('maps Read to book', () => {
    assert.equal(
      mapHardcoverFormatToInternal({ reading_format: { format: 'Read' } }),
      'book',
    );
  });

  it('maps Both to mixed', () => {
    assert.equal(
      mapHardcoverFormatToInternal({ reading_format: { format: 'Both' } }),
      'mixed',
    );
  });

  it('falls back to audiobook when edition has audio_seconds > 0', () => {
    assert.equal(
      mapHardcoverFormatToInternal({ audio_seconds: 36000 }),
      'audiobook',
    );
  });

  it('falls back to book when no reading_format and no audio_seconds', () => {
    assert.equal(mapHardcoverFormatToInternal({}), 'book');
  });

  it('falls back to book when audio_seconds is 0', () => {
    assert.equal(mapHardcoverFormatToInternal({ audio_seconds: 0 }), 'book');
  });

  it('handles missing reading_format gracefully', () => {
    assert.equal(
      mapHardcoverFormatToInternal({ reading_format: null }),
      'book',
    );
    assert.equal(mapHardcoverFormatToInternal({ reading_format: {} }), 'book');
  });

  it('handles unknown reading_format.format value', () => {
    assert.equal(
      mapHardcoverFormatToInternal({
        reading_format: { format: 'SomethingNew' },
      }),
      'book',
    );
  });

  it('prefers reading_format over audio_seconds', () => {
    assert.equal(
      mapHardcoverFormatToInternal({
        reading_format: { format: 'Read' },
        audio_seconds: 36000,
      }),
      'book',
    );
  });
});

describe('areFormatsCompatible', () => {
  it('exact matches are compatible', () => {
    assert.equal(areFormatsCompatible('audiobook', 'audiobook'), true);
    assert.equal(areFormatsCompatible('ebook', 'ebook'), true);
    assert.equal(areFormatsCompatible('book', 'book'), true);
  });

  it('audiobook and ebook are compatible (cross-digital)', () => {
    assert.equal(areFormatsCompatible('audiobook', 'ebook'), true);
    assert.equal(areFormatsCompatible('ebook', 'audiobook'), true);
  });

  it('audiobook and book are NOT compatible', () => {
    assert.equal(areFormatsCompatible('audiobook', 'book'), false);
  });

  it('ebook and book ARE compatible (physical fallback allowed)', () => {
    assert.equal(areFormatsCompatible('ebook', 'book'), true);
  });

  it('unknown formats default to compatible', () => {
    assert.equal(areFormatsCompatible('unknown', 'book'), true);
    assert.equal(areFormatsCompatible('audiobook', 'unknown'), true);
    assert.equal(areFormatsCompatible('foo', 'bar'), true);
  });

  it('book source with audiobook edition defaults to compatible', () => {
    // 'book' as source is not explicitly handled, so falls through to default true
    assert.equal(areFormatsCompatible('book', 'audiobook'), true);
  });
});

describe('checkFormatCompatibility', () => {
  it('returns true when no sourceFormat', () => {
    const editions = [{ reading_format: { format: 'Listened' } }];
    assert.equal(checkFormatCompatibility(editions, null), true);
    assert.equal(checkFormatCompatibility(editions, ''), true);
    assert.equal(checkFormatCompatibility(editions, undefined), true);
  });

  it('returns true when empty searchResults', () => {
    assert.equal(checkFormatCompatibility([], 'audiobook'), true);
  });

  it('returns true when at least one edition is compatible', () => {
    const editions = [
      { reading_format: { format: 'Read' } }, // 'book' - not compatible with audiobook
      { reading_format: { format: 'Listened' } }, // 'audiobook' - compatible
    ];
    assert.equal(checkFormatCompatibility(editions, 'audiobook'), true);
  });

  it('returns false when no editions are compatible', () => {
    const editions = [
      { reading_format: { format: 'Read' } }, // 'book'
      { audio_seconds: 0 }, // 'book' (fallback)
    ];
    assert.equal(checkFormatCompatibility(editions, 'audiobook'), false);
  });

  it('handles mix of compatible and incompatible editions', () => {
    const editions = [
      { reading_format: { format: 'Read' } }, // 'book' - incompatible with audiobook
      { reading_format: { format: 'Ebook' } }, // 'ebook' - compatible with audiobook
      { reading_format: { format: 'Read' } }, // 'book' - incompatible
    ];
    assert.equal(checkFormatCompatibility(editions, 'audiobook'), true);
  });

  it('works correctly with ebook source', () => {
    const editions = [
      { reading_format: { format: 'Read' } }, // 'book' - compatible with ebook (physical fallback)
    ];
    assert.equal(checkFormatCompatibility(editions, 'ebook'), true);
  });
});
