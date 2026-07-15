import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateBookIdentificationScore } from '../src/matching/scoring/book-identification-scorer.js';
import { TitleAuthorMatcher } from '../src/matching/strategies/title-author-matcher.js';
import { normalizeTitle } from '../src/matching/utils/text-matching.js';

describe('Generic subtitle matching', () => {
  it('removes the generic "A Novel" suffix without removing real subtitles', () => {
    assert.equal(normalizeTitle('Counterfeit: A Novel'), 'counterfeit');
    assert.equal(normalizeTitle('Social Creature: A Novel'), 'social creature');
    assert.equal(
      normalizeTitle('Counterfeit: The Story of Money'),
      'counterfeit the story of money',
    );
  });

  it('searches Hardcover without the generic subtitle', async () => {
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
        title: 'Counterfeit: A Novel',
        author: 'Kirstin Chen',
      },
      'test-user',
    );

    assert.equal(searches.length, 1);
    assert.equal(searches[0][0], 'counterfeit');
    assert.equal(searches[0][1], 'Kirstin Chen');
  });

  it('accepts the reported Social Creature title variation', () => {
    const score = calculateBookIdentificationScore(
      {
        title: 'Social Creature',
        author_names: ['Tara Isabella Burton'],
        publication_year: 2018,
      },
      'Social Creature: A Novel',
      'Tara Isabella Burton',
      { publicationYear: 2018 },
    );

    assert.equal(score.breakdown.title.score, 100);
    assert.ok(score.totalScore >= 70);
    assert.equal(score.isBookMatch, true);
  });
});
