import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BookMatcher } from '../src/matching/book-matcher.js';

function createMatcher(hardcoverClient) {
  const matcher = new BookMatcher(hardcoverClient, null, {});
  matcher.formatMapper = edition => {
    const format = edition.reading_format?.format;
    return format === 'Listened' ? 'audiobook' : 'ebook';
  };
  return matcher;
}

describe('Identifier search-result edition selection', () => {
  it('uses an ISBN to identify the work and selects the duration-matched audiobook edition', async () => {
    const exactIsbnEdition = {
      id: 30432880,
      pages: 624,
      reading_format: { format: 'Ebook' },
      book: { id: 427383, title: 'The Well of Ascension' },
    };
    const audiobookEdition = {
      id: 30616150,
      audio_seconds: 80084,
      reading_format: { format: 'Listened' },
      users_count: 3,
    };
    const matcher = createMatcher({
      getBookDetailsWithEditions: async () => ({
        id: 427383,
        title: 'The Well of Ascension',
        editions: [exactIsbnEdition, audiobookEdition],
      }),
    });

    const result = await matcher._enhanceIdentifierSearchResultEdition(
      {
        userBook: null,
        edition: exactIsbnEdition,
        _matchType: 'isbn_search_result',
        _isSearchResult: true,
      },
      {
        media: {
          duration: 80088.55,
          metadata: { narrator: 'Michael Kramer' },
        },
      },
      'audiobook',
      'isbn_search_result',
    );

    assert.equal(result.edition.id, 30616150);
    assert.equal(result.edition.book.id, 427383);
    assert.equal(result.edition.format, 'audiobook');
    assert.equal(result._editionUpgraded, true);
    assert.equal(result._originalEditionId, 30432880);
  });

  it('does not fetch alternatives for a usable exact audiobook result', async () => {
    let fetchCount = 0;
    const matcher = createMatcher({
      getBookDetailsWithEditions: async () => {
        fetchCount++;
        return null;
      },
    });
    const match = {
      edition: {
        id: 30404159,
        audio_seconds: 49560,
        reading_format: { format: 'Listened' },
        book: { id: 427565, title: 'Ready Player Two' },
      },
      _isSearchResult: true,
    };

    const result = await matcher._enhanceIdentifierSearchResultEdition(
      match,
      { media: { duration: 49560 } },
      'audiobook',
      'asin_search_result',
    );

    assert.strictEqual(result, match);
    assert.equal(fetchCount, 0);
  });
});
