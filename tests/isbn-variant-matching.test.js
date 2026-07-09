import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FailedBooksReporter } from '../src/failed-books-reporter.js';
import { HardcoverClient } from '../src/hardcover-client.js';
import { IsbnMatcher } from '../src/matching/strategies/isbn-matcher.js';
import { createIdentifierLookup } from '../src/matching/utils/identifier-lookup.js';
import { SyncManager } from '../src/sync-manager.js';
import {
  convertIsbn10To13,
  convertIsbn13To10,
  getIsbnVariants,
  normalizeIsbn,
} from '../src/matching/utils/text-matching.js';

describe('ISBN variant matching', () => {
  it('converts the ISBN pair reported in issue #181', () => {
    assert.equal(convertIsbn10To13('0575082011'), '9780575082014');
    assert.equal(convertIsbn13To10('9780575082014'), '0575082011');
    assert.deepEqual(getIsbnVariants('0575082011'), [
      '0575082011',
      '9780575082014',
    ]);
    assert.deepEqual(getIsbnVariants('978-0-575-08201-4'), [
      '9780575082014',
      '0575082011',
    ]);
  });

  it('normalizes numeric ISBN values returned by an API', () => {
    assert.equal(normalizeIsbn(9780575082014), '9780575082014');
  });

  it('does not invent equivalents for invalid checksums or 979 ISBNs', () => {
    assert.deepEqual(getIsbnVariants('9780575082015'), ['9780575082015']);
    assert.deepEqual(getIsbnVariants('0575082012'), ['0575082012']);
    assert.deepEqual(getIsbnVariants('9791234567896'), ['9791234567896']);
  });

  it('indexes an ISBN-10-only Hardcover edition by its ISBN-13 equivalent', () => {
    const userBook = {
      id: 'user-book-before-they-are-hanged',
      book: {
        editions: [
          {
            id: 'edition-isbn10-only',
            isbn_10: '0575082011',
            isbn_13: null,
          },
        ],
      },
    };

    const lookup = createIdentifierLookup([userBook]);

    assert.equal(lookup['0575082011'].edition.id, 'edition-isbn10-only');
    assert.equal(lookup['9780575082014'].edition.id, 'edition-isbn10-only');
  });

  it('matches an ABS ISBN-13 to a Hardcover ISBN-10 lookup entry', async () => {
    const matcher = new IsbnMatcher();
    const userBook = {
      id: 'user-book-before-they-are-hanged',
      book: { title: 'Before They Are Hanged' },
    };
    const edition = { id: 'edition-isbn10-only', isbn_10: '0575082011' };

    const match = await matcher.findMatch(
      { media: { metadata: { title: 'Before They Are Hanged' } } },
      { isbn: '9780575082014', asin: null },
      { '0575082011': { userBook, edition } },
    );

    assert.equal(match.userBook.id, userBook.id);
    assert.equal(match.edition.id, edition.id);
    assert.equal(match._matchType, 'isbn');
  });

  it('queries Hardcover with both equivalent ISBN forms', async () => {
    const client = new HardcoverClient('test-token');
    let capturedVariables;

    client._executeQuery = async (_query, variables) => {
      capturedVariables = variables;
      return { editions: [] };
    };

    try {
      await client.searchBooksByIsbn('9780575082014');
      assert.deepEqual(capturedVariables.isbnCandidates, [
        '9780575082014',
        '0575082011',
      ]);
    } finally {
      client.cleanup();
    }
  });

  it('reuses cache entries stored under the other ISBN form', async () => {
    const checkedKeys = [];
    const manager = Object.create(SyncManager.prototype);
    manager.userId = 'test-user';
    manager.cache = {
      generateTitleAuthorIdentifier: () => 'title-author-key',
      getCachedBookInfo: async (_userId, key) => {
        checkedKeys.push(key);
        return key === '0575082011'
          ? { exists: true, edition_id: 'edition-1' }
          : { exists: false };
      },
      hasProgressChanged: async () => false,
    };
    manager._findUserBookByEditionId = () => ({ id: 'user-book-1' });

    const priority = await manager._getDirectCachedSyncPriority({
      id: 'abs-book-1',
      progress_percentage: 50,
      media: {
        metadata: {
          title: 'Before They Are Hanged',
          authors: [{ name: 'Joe Abercrombie' }],
          isbn: '9780575082014',
        },
      },
    });

    assert.equal(priority, 1);
    assert.deepEqual(checkedKeys, ['9780575082014', '0575082011']);
  });

  it('shows both equivalent forms in failed-book reports', () => {
    const report = FailedBooksReporter._buildReport(
      [
        {
          title: 'Before They Are Hanged',
          author: 'Joe Abercrombie',
          identifiers: { isbn: '9780575082014' },
          category: 'NOT_FOUND',
          reason: 'Book not found',
          suggestions: [],
          details: {},
        },
      ],
      { books_not_found: 1 },
    );

    assert.match(
      report,
      /Identifiers: ISBN-13: 9780575082014, ISBN-10: 0575082011/,
    );
  });
});
