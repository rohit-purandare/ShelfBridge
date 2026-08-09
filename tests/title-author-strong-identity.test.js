import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { calculateBookIdentificationScore } from '../src/matching/scoring/book-identification-scorer.js';
import { TitleAuthorMatcher } from '../src/matching/strategies/title-author-matcher.js';

function searchResult(title, authors = []) {
  return {
    id: `book-${title}`,
    title,
    contributions: authors.map(name => ({ author: { name } })),
  };
}

const observedSafeMatches = [
  {
    source: 'Defiance of the Fall 2: A LitRPG Adventure',
    candidate: 'Defiance of the Fall 2: A LitRPG Adventure',
    author: 'TheFirstDefier, JF Brink',
    candidateAuthors: [],
  },
  {
    source: 'Defiance of the Fall 3: A LitRPG Adventure',
    candidate: 'Defiance of the Fall 3: A LitRPG Adventure',
    author: 'TheFirstDefier, JF Brink',
    candidateAuthors: [],
  },
  {
    source: 'Defiance of the Fall 4: A LitRPG Adventure',
    candidate: 'Defiance of the Fall 4',
    author: 'TheFirstDefier, JF Brink',
    candidateAuthors: ['TheFirstDefier'],
  },
  {
    source:
      'Defiance of the Fall 5: A LitRPG Adventure (Defiance of the Fall, Book 5)',
    candidate: 'Defiance of the Fall 5: A LitRPG Adventure',
    author: 'TheFirstDefier, JF Brink',
    candidateAuthors: [],
  },
  {
    source: 'He Who Fights with Monsters 12: A LitRPG Adventure: He Who Fights with Monsters, Book 12',
    candidate: 'He Who Fights with Monsters 12',
    author: 'Shirtaloon, Travis Deverell',
    candidateAuthors: ['Shirtaloon', 'Travis Deverell'],
  },
  {
    source:
      'He Who Fights with Monsters 4: A LitRPG Adventure (He Who Fights with Monsters, Book 4)',
    candidate: 'He Who Fights with Monsters 4',
    author: 'Shirtaloon, Travis Deverell',
    candidateAuthors: ['Shirtaloon', 'Travis Deverell'],
  },
  {
    source:
      'He Who Fights with Monsters 9: A LitRPG Adventure (He Who Fights with Monsters, Book 9)',
    candidate: 'He Who Fights With Monsters 9',
    author: 'Shirtaloon, Travis Deverell',
    candidateAuthors: ['Shirtaloon', 'Travis Deverell'],
  },
  {
    source:
      'He Who Fights with Monsters 11: A LitRPG Adventure: He Who Fights with Monsters, Book 11',
    candidate: 'He Who Fights with Monsters 11',
    author: 'Shirtaloon, Travis Deverell',
    candidateAuthors: ['Shirtaloon', 'Travis Deverell'],
  },
  {
    source: 'New Spring: The Wheel of Time Prequel',
    candidate: 'New Spring',
    author: 'Robert Jordan',
    candidateAuthors: ['Robert Jordan'],
  },
  {
    source: 'The Way of Kings: The Stormlight Archive, Book 1',
    candidate: 'The Way of Kings',
    author: 'Brandon Sanderson',
    candidateAuthors: ['Brandon Sanderson'],
  },
  {
    source: 'The Bands of Mourning (1 of 2): Mistborn Book 6',
    candidate: 'The Bands of Mourning',
    author: 'Brandon Sanderson, Graphic Audio',
    candidateAuthors: ['Brandon Sanderson'],
  },
  {
    source: "The Emperor's Soul [Dramatized Adaptation]: Elantris",
    candidate: "The Emperor's Soul",
    author: 'Brandon Sanderson',
    candidateAuthors: ['Brandon Sanderson'],
  },
  {
    source: 'American Gods: The Tenth Anniversary Edition (A Full Cast Production)',
    candidate: 'American Gods',
    author: 'Neil Gaiman',
    candidateAuthors: ['Neil Gaiman'],
  },
  {
    source: 'The Sandman: Act III',
    candidate: 'The Sandman: Act III',
    author: 'Neil Gaiman, Dirk Maggs',
    candidateAuthors: ['Neil Gaiman', 'Dirk Maggs', 'James McAvoy'],
  },
  {
    source: 'The Sandman: Act II',
    candidate: 'The Sandman: Act II',
    author: 'Neil Gaiman, Dirk Maggs',
    candidateAuthors: ['Dirk Maggs', 'Neil Gaiman', 'James McAvoy'],
  },
  {
    source: 'The Sandman',
    candidate: 'The Sandman',
    author: 'Neil Gaiman, Dirk Maggs',
    candidateAuthors: ['Neil Gaiman', 'Dirk Maggs', 'James McAvoy'],
  },
  {
    source: 'Edgedancer: Stormlight Archive',
    candidate: 'Edgedancer',
    author: 'Brandon Sanderson',
    candidateAuthors: ['Brandon Sanderson'],
  },
];

describe('Strong title/author identity evidence', () => {
  for (const example of observedSafeMatches) {
    it(`accepts ${example.source} as ${example.candidate}`, () => {
      const score = calculateBookIdentificationScore(
        searchResult(example.candidate, example.candidateAuthors),
        example.source,
        example.author,
      );

      assert.equal(score.strongIdentityEvidence.matches, true);
    });
  }

  it('keeps the configured threshold while accepting an exact Defiance title with missing author metadata', async () => {
    const result = searchResult(
      'Defiance of the Fall 2: A LitRPG Adventure',
    );
    const rawScore = calculateBookIdentificationScore(
      result,
      'Defiance of the Fall 2: A LitRPG Adventure',
      'TheFirstDefier, JF Brink',
    );
    assert.ok(rawScore.totalScore < 70);

    const hardcoverClient = {
      searchBooksForMatching: mock.fn(async () => [result]),
      getPreferredEditionFromBookId: mock.fn(async bookId => ({
        bookId,
        title: result.title,
        edition: {
          id: 'defiance-2-audio',
          audio_seconds: 80400,
          reading_format: { format: 'Listened' },
        },
      })),
    };
    const cache = {
      generateTitleAuthorIdentifier: () => 'title-author-key',
      getCachedBookInfo: mock.fn(async () => null),
      storeEditionMapping: mock.fn(async () => true),
    };
    const matcher = new TitleAuthorMatcher(hardcoverClient, cache, {
      title_author_matching: { confidence_threshold: 0.7 },
    });

    const match = await matcher.findMatch(
      {
        title: 'Defiance of the Fall 2: A LitRPG Adventure',
        author: 'TheFirstDefier, JF Brink',
        media: { duration: 80400 },
      },
      'test-user',
      () => null,
      () => null,
    );

    assert.equal(match.book.id, result.id);
    assert.equal(match.edition.id, 'defiance-2-audio');
  });

  it('rejects a Fourth Wing multi-book candidate below the threshold', () => {
    const score = calculateBookIdentificationScore(
      searchResult('Fourth Wing, Iron Flame', ['Rebecca Yarros']),
      'Fourth Wing: Empyrean, Book 1',
      'Rebecca Yarros',
    );

    assert.equal(score.strongIdentityEvidence.matches, false);
    assert.ok(score.totalScore < 70);
  });

  it('rejects Defiance book 15 for an unnumbered Defiance book 1 title', () => {
    const score = calculateBookIdentificationScore(
      searchResult('Defiance of the Fall 15', [
        'TheFirstDefier',
        'JF Brink',
      ]),
      'Defiance of the Fall: A LitRPG Adventure',
      'TheFirstDefier, JF Brink',
    );

    assert.equal(score.strongIdentityEvidence.matches, false);
    assert.ok(score.totalScore < 70);
  });

  it('selects a lower-scoring exact title instead of a higher-scoring unsafe candidate', async () => {
    const unsafe = searchResult('Fourth Wing, Iron Flame', [
      'Rebecca Yarros',
    ]);
    const correct = searchResult('Fourth Wing: Empyrean, Book 1');
    const unsafeScore = calculateBookIdentificationScore(
      unsafe,
      'Fourth Wing: Empyrean, Book 1',
      'Rebecca Yarros',
    );
    const correctScore = calculateBookIdentificationScore(
      correct,
      'Fourth Wing: Empyrean, Book 1',
      'Rebecca Yarros',
    );
    assert.ok(unsafeScore.totalScore > correctScore.totalScore);
    assert.equal(unsafeScore.strongIdentityEvidence.matches, false);
    assert.equal(correctScore.strongIdentityEvidence.matches, true);

    const hardcoverClient = {
      searchBooksForMatching: mock.fn(async () => [unsafe, correct]),
      getPreferredEditionFromBookId: mock.fn(async bookId => ({
        bookId,
        title: correct.title,
        edition: {
          id: 'fourth-wing-audio',
          reading_format: { format: 'Listened' },
        },
      })),
    };
    const cache = {
      generateTitleAuthorIdentifier: () => 'title-author-key',
      getCachedBookInfo: mock.fn(async () => null),
      storeEditionMapping: mock.fn(async () => true),
    };
    const matcher = new TitleAuthorMatcher(hardcoverClient, cache, {
      title_author_matching: { confidence_threshold: 0.7 },
    });

    const match = await matcher.findMatch(
      {
        title: 'Fourth Wing: Empyrean, Book 1',
        author: 'Rebecca Yarros',
      },
      'test-user',
      () => null,
      () => null,
    );

    assert.equal(match.book.id, correct.id);
    assert.equal(match.edition.id, 'fourth-wing-audio');
  });

  it('rejects an exact title when the known author conflicts', () => {
    const score = calculateBookIdentificationScore(
      searchResult('American Gods', ['Unrelated Author']),
      'American Gods',
      'Neil Gaiman',
    );

    assert.equal(score.strongIdentityEvidence.matches, false);
  });
});
