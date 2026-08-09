import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { TitleAuthorMatcher } from '../src/matching/strategies/title-author-matcher.js';

const author = 'TheFirstDefier, JF Brink';

function createAbsBook(number, duration) {
  return {
    id: `abs-defiance-${number}`,
    title: `Defiance of the Fall ${number}: A LitRPG Adventure`,
    author,
    narrator: 'Pavi Proczko',
    duration,
    mediaType: 'audiobook',
  };
}

function createMatcher(absBook, bookDetails) {
  const hardcoverClient = {
    searchBooksForMatching: mock.fn(async () => [
      {
        id: bookDetails.id,
        title: absBook.title,
        author_names: [author],
        activity: 100,
      },
    ]),
    getBookDetailsWithEditions: mock.fn(async () => bookDetails),
  };
  const cache = {
    generateTitleAuthorIdentifier: (title, bookAuthor) =>
      `title_author:${title.toLowerCase()}|${bookAuthor.toLowerCase()}`,
    getCachedBookInfo: mock.fn(async () => ({ exists: false })),
    storeEditionMapping: mock.fn(async () => {}),
  };

  return {
    hardcoverClient,
    matcher: new TitleAuthorMatcher(hardcoverClient, cache, {
      title_author_matching: {
        confidence_threshold: 0.7,
        max_search_results: 5,
      },
    }),
  };
}

describe('Title/author Stage 2 edition selection', () => {
  for (const example of [
    { number: 2, bookId: 2636424, editionId: 32941995, duration: 88226.78 },
    { number: 3, bookId: 2636426, editionId: 32941997, duration: 82104.4 },
    { number: 5, bookId: 2636422, editionId: 32941991, duration: 87120.2 },
  ]) {
    it(`keeps Defiance of the Fall ${example.number} matched when the identified work only has a Read edition`, async () => {
      const absBook = createAbsBook(example.number, example.duration);
      const { hardcoverClient, matcher } = createMatcher(absBook, {
        id: example.bookId,
        title: absBook.title,
        editions: [
          {
            id: example.editionId,
            reading_format: { format: 'Read' },
            pages: 700,
            score: 280,
            users_count: 0,
          },
        ],
      });

      const result = await matcher.findMatch(absBook, 'test-user');

      assert.equal(result.book.id, example.bookId);
      assert.equal(result.edition.id, example.editionId);
      assert.equal(result.edition.format, 'Read');
      assert.ok(result._bookIdentificationScore.totalScore >= 70);
      assert.equal(
        hardcoverClient.getBookDetailsWithEditions.mock.callCount(),
        1,
      );
    });
  }

  it('selects the duration-matched Listened edition for Defiance of the Fall 4', async () => {
    const absBook = createAbsBook(4, 82050.72);
    const { matcher } = createMatcher(absBook, {
      id: 545679,
      title: 'Defiance of the Fall 4',
      editions: [
        {
          id: 31476151,
          reading_format: { format: 'Listened' },
          audio_seconds: 40000,
          score: 1900,
          users_count: 100,
        },
        {
          id: 32201823,
          reading_format: { format: 'Listened' },
          audio_seconds: 82050,
          score: 1570,
          users_count: 0,
        },
        {
          id: 99999999,
          reading_format: { format: 'Read' },
          pages: 700,
          score: 2000,
          users_count: 100000,
        },
      ],
    });

    const result = await matcher.findMatch(absBook, 'test-user');

    assert.equal(result.book.id, 545679);
    assert.equal(result.edition.id, 32201823);
    assert.equal(result.edition.format, 'Listened');
    assert.equal(
      result._editionSelectionResult.selectionReason.duration.score,
      100,
    );
    assert.ok(result._bookIdentificationScore.totalScore >= 70);
  });
});
