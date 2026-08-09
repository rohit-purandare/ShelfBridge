import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { TitleAuthorMatcher } from '../src/matching/strategies/title-author-matcher.js';

const author = 'TheFirstDefier, JF Brink';

function createAbsBook(number, duration) {
  const numberedTitle = number ? ` ${number}` : '';
  const title = `Defiance of the Fall${numberedTitle}: A LitRPG Adventure`;
  return {
    id: `abs-defiance-${number || 1}`,
    title:
      number === 5
        ? `${title} (Defiance of the Fall, Book 5)`
        : title,
    author,
    narrator: 'Pavi Proczko',
    duration,
    mediaType: 'audiobook',
  };
}

function searchResult(book) {
  return {
    id: book.id,
    title: book.title,
    contributions: (book.authors || []).map(name => ({ author: { name } })),
    users_count: book.usersCount,
    ratings_count: book.ratingsCount,
  };
}

function createMatcher({ absBook, combinedResults, canonicalResults, books }) {
  const hardcoverClient = {
    searchBooksForMatching: mock.fn(async (_title, searchAuthor) =>
      (searchAuthor ? combinedResults : canonicalResults).map(searchResult),
    ),
    getBookDetailsWithEditions: mock.fn(async bookId => books.get(bookId)),
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
    {
      number: 2,
      duplicateBookId: 2636424,
      duplicateEditionId: 32941995,
      canonicalBookId: 545671,
      canonicalEditionId: 31145800,
      duration: 88226.78,
      editionDuration: 88200,
    },
    {
      number: 3,
      duplicateBookId: 2636426,
      duplicateEditionId: 32941997,
      canonicalBookId: 545669,
      canonicalEditionId: 31855844,
      duration: 88440,
      editionDuration: 88440,
    },
    {
      number: 5,
      duplicateBookId: 2636422,
      duplicateEditionId: 32941991,
      canonicalBookId: 637820,
      canonicalEditionId: 31862655,
      duration: 87120.2,
      editionDuration: 87060,
    },
  ]) {
    it(`expands Defiance of the Fall ${example.number} to the canonical work with a Listened edition`, async () => {
      const absBook = createAbsBook(example.number, example.duration);
      const duplicateBook = {
        id: example.duplicateBookId,
        title: absBook.title.replace(/ \(Defiance.*$/, ''),
        authors: [],
        usersCount: example.number === 2 ? 1 : 0,
        editions: [
          {
            id: example.duplicateEditionId,
            reading_format: { format: 'Read' },
            pages: 700,
            users_count: 0,
          },
        ],
      };
      const canonicalBook = {
        id: example.canonicalBookId,
        title: `Defiance of the Fall ${example.number}`,
        authors: ['TheFirstDefier'],
        usersCount: 200,
        ratingsCount: 100,
        editions: [
          {
            id: example.canonicalEditionId,
            asin: `canonical-asin-${example.number}`,
            reading_format: { format: 'Listened' },
            audio_seconds: example.editionDuration,
            users_count: 8,
            contributions: [
              {
                contribution: 'Narrator',
                author: { name: 'Pavi Proczko' },
              },
            ],
          },
        ],
      };
      const { hardcoverClient, matcher } = createMatcher({
        absBook,
        combinedResults: [duplicateBook],
        canonicalResults: [canonicalBook, duplicateBook],
        books: new Map([
          [duplicateBook.id, duplicateBook],
          [canonicalBook.id, canonicalBook],
        ]),
      });

      const result = await matcher.findMatch(absBook, 'test-user');

      assert.equal(result.book.id, example.canonicalBookId);
      assert.equal(result.edition.id, example.canonicalEditionId);
      assert.equal(result.edition.format, 'Listened');
      assert.equal(
        result._bookIdentificationScore.strongIdentityEvidence.matches,
        true,
      );
      assert.equal(
        matcher.config.title_author_matching.confidence_threshold,
        0.7,
      );
      assert.equal(
        hardcoverClient.searchBooksForMatching.mock.callCount(),
        2,
      );
      assert.equal(
        hardcoverClient.searchBooksForMatching.mock.calls[1].arguments[0],
        `defiance of the fall ${example.number}`,
      );
      assert.equal(
        hardcoverClient.searchBooksForMatching.mock.calls[1].arguments[1],
        null,
      );
      assert.equal(
        hardcoverClient.getBookDetailsWithEditions.mock.callCount(),
        2,
      );
      assert.equal(
        hardcoverClient.getBookDetailsWithEditions.mock.calls[0].arguments[0],
        example.duplicateBookId,
      );
      assert.equal(
        hardcoverClient.getBookDetailsWithEditions.mock.calls[1].arguments[0],
        example.canonicalBookId,
      );
    });
  }

  it('recovers unnumbered Defiance book 1 after unsafe combined-search results', async () => {
    const absBook = createAbsBook(null, 84609.8);
    const unsafeResults = [15, 17].map(number => ({
      id: `defiance-${number}`,
      title: `Defiance of the Fall ${number}`,
      authors: ['TheFirstDefier', 'JF Brink'],
      usersCount: number === 15 ? 82 : 18,
      editions: [],
    }));
    const canonicalBook = {
      id: 545665,
      title: 'Defiance of the Fall',
      authors: ['TheFirstDefier'],
      usersCount: 396,
      ratingsCount: 172,
      editions: [
        {
          id: 31145227,
          asin: 'B094JZYWLG',
          reading_format: { format: 'Listened' },
          audio_seconds: 84540,
          users_count: 8,
          contributions: [
            {
              contribution: 'Narrator',
              author: { name: 'Pavi Proczko' },
            },
          ],
        },
      ],
    };
    const { hardcoverClient, matcher } = createMatcher({
      absBook,
      combinedResults: unsafeResults,
      canonicalResults: [canonicalBook, ...unsafeResults],
      books: new Map([[canonicalBook.id, canonicalBook]]),
    });

    const result = await matcher.findMatch(absBook, 'test-user');

    assert.equal(result.book.id, 545665);
    assert.equal(result.edition.id, 31145227);
    assert.equal(result.edition.format, 'Listened');
    assert.equal(
      result._bookIdentificationScore.strongIdentityEvidence.matches,
      true,
    );
    assert.equal(
      matcher.config.title_author_matching.confidence_threshold,
      0.7,
    );
    assert.equal(
      hardcoverClient.searchBooksForMatching.mock.calls[1].arguments[0],
      'defiance of the fall',
    );
    assert.equal(
      hardcoverClient.getBookDetailsWithEditions.mock.callCount(),
      1,
    );
  });

  it('selects the duration-matched Listened edition for Defiance of the Fall 4', async () => {
    const absBook = createAbsBook(4, 82050.72);
    const canonicalBook = {
      id: 545679,
      title: 'Defiance of the Fall 4',
      authors: ['TheFirstDefier'],
      usersCount: 235,
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
    };
    const { hardcoverClient, matcher } = createMatcher({
      absBook,
      combinedResults: [canonicalBook],
      canonicalResults: [],
      books: new Map([[canonicalBook.id, canonicalBook]]),
    });

    const result = await matcher.findMatch(absBook, 'test-user');

    assert.equal(result.book.id, 545679);
    assert.equal(result.edition.id, 32201823);
    assert.equal(result.edition.format, 'Listened');
    assert.equal(
      result._editionSelectionResult.selectionReason.duration.score,
      100,
    );
    assert.equal(
      result._bookIdentificationScore.strongIdentityEvidence.matches,
      true,
    );
    assert.equal(
      matcher.config.title_author_matching.confidence_threshold,
      0.7,
    );
    assert.equal(
      hardcoverClient.searchBooksForMatching.mock.callCount(),
      1,
    );
  });
});
