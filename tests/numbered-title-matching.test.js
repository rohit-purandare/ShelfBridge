import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateBookIdentificationScore } from '../src/matching/scoring/book-identification-scorer.js';
import { TitleAuthorMatcher } from '../src/matching/strategies/title-author-matcher.js';
import { normalizeAsin } from '../src/matching/utils/text-matching.js';

describe('Numbered title matching', () => {
  it('accepts numeric ISBN-10-style ASINs', () => {
    assert.equal(normalizeAsin('0593396960'), '0593396960');
  });

  it('preserves written numbers in Hardcover search queries', async () => {
    const searches = [];
    const hardcoverClient = {
      async searchBooksForMatching(...args) {
        searches.push(args);
        return [];
      },
    };
    const cache = {
      generateTitleAuthorIdentifier(title, author) {
        return `title_author:${title}|${author}`;
      },
      async getCachedBookInfo() {
        return null;
      },
    };
    const matcher = new TitleAuthorMatcher(hardcoverClient, cache, {});

    await matcher.findMatch(
      {
        title: 'Ready Player Two',
        subtitle: 'A Novel',
        author: 'Ernest Cline',
      },
      'test-user',
    );

    assert.equal(searches.length, 1);
    assert.equal(searches[0][0], 'ready player two');
  });

  it('rejects otherwise-similar titles with conflicting numbers', () => {
    const score = calculateBookIdentificationScore(
      {
        title: 'Ready Player One',
        author_names: ['Ernest Cline'],
        publication_year: 2008,
      },
      'Ready Player Two: A Novel',
      'Ernest Cline',
      { publicationYear: 2020 },
    );

    assert.equal(score.totalScore, 0);
    assert.equal(score.isBookMatch, false);
    assert.ok(score.breakdown.titleNumberMismatchPenalty);
  });

  it('allows equivalent written and numeric title numbers', () => {
    const score = calculateBookIdentificationScore(
      {
        title: 'Ready Player 2',
        author_names: ['Ernest Cline'],
        publication_year: 2020,
      },
      'Ready Player Two: A Novel',
      'Ernest Cline',
      { publicationYear: 2020 },
    );

    assert.equal(score.isBookMatch, true);
    assert.equal(score.breakdown.titleNumberMismatchPenalty, undefined);
  });
});
