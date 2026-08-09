import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { TitleAuthorMatcher } from '../src/matching/strategies/title-author-matcher.js';
import { SyncManager } from '../src/sync-manager.js';

function createResult() {
  return {
    failed_books: [],
    books_not_found: 0,
    books_match_rejected: 0,
    books_already_in_library: 0,
  };
}

describe('Failed match classification', () => {
  it('retains rejection details for an unsafe title/author candidate', async () => {
    const absBook = {
      title: 'Defiance of the Fall: A LitRPG Adventure',
      author: 'TheFirstDefier, JF Brink',
    };
    const matcher = new TitleAuthorMatcher(
      {
        searchBooksForMatching: mock.fn(async () => [
          {
            id: 'defiance-15',
            title: 'Defiance of the Fall 15',
            contributions: [
              { author: { name: 'TheFirstDefier' } },
              { author: { name: 'JF Brink' } },
            ],
          },
        ]),
      },
      {
        generateTitleAuthorIdentifier: () => 'title-author-key',
        getCachedBookInfo: mock.fn(async () => null),
      },
      { title_author_matching: { confidence_threshold: 0.7 } },
    );

    assert.equal(await matcher.findMatch(absBook, 'test-user'), null);
    const failure = matcher.getMatchFailure(absBook);
    assert.equal(failure.outcome, 'MATCH_REJECTED');
    assert.match(failure.reason, /^Best candidate scored \d+\.\d%/);
    assert.equal(failure.candidateTitle, 'Defiance of the Fall 15');
    assert.equal(failure.candidateBookId, 'defiance-15');
    assert.ok(failure.candidateScore >= 60 && failure.candidateScore < 70);
  });

  it('reports rejected candidates separately from books that were not found', async () => {
    const absBook = {
      media: {
        metadata: {
          title: 'Defiance of the Fall: A LitRPG Adventure',
          author: 'TheFirstDefier, JF Brink',
        },
      },
    };
    const failure = {
      outcome: 'MATCH_REJECTED',
      reason: 'Best candidate scored 63.3% below the configured threshold',
      candidateTitle: 'Defiance of the Fall 15',
      candidateBookId: 'defiance-15',
      candidateScore: 63.3,
    };
    const result = createResult();
    const manager = {
      dryRun: true,
      userId: 'test-user',
      globalConfig: { force_sync: false },
      hardcover: {
        searchBooksByAsin: mock.fn(async () => []),
      },
      cache: {
        generateTitleAuthorIdentifier: () => 'title-author-key',
        getCachedBookInfo: mock.fn(async () => null),
      },
      bookMatcher: {
        findMatchByTitleAuthor: mock.fn(async () => null),
        getTitleAuthorMatchFailure: mock.fn(() => failure),
      },
      _trackFailedBook: SyncManager.prototype._trackFailedBook,
    };

    await SyncManager.prototype._tryAutoAddBook.call(
      manager,
      absBook,
      { asin: 'B094JZMCJX' },
      'Defiance of the Fall: A LitRPG Adventure',
      'TheFirstDefier, JF Brink',
      result,
    );

    assert.equal(result.books_match_rejected, 1);
    assert.equal(result.books_not_found, 0);
    assert.equal(result.failed_books[0].category, 'MATCH_REJECTED');
    assert.deepEqual(result.failed_books[0].details.rejectedCandidate, {
      title: 'Defiance of the Fall 15',
      bookId: 'defiance-15',
      score: 63.3,
    });
  });
});
