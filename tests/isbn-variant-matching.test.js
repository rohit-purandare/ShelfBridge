import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { HardcoverClient } from '../src/hardcover-client.js';
import { IsbnMatcher } from '../src/matching/strategies/isbn-matcher.js';
import { createIdentifierLookup } from '../src/matching/utils/identifier-lookup.js';
import {
  convertIsbn10To13,
  convertIsbn13To10,
  getIsbnVariants,
  normalizeIsbn,
} from '../src/matching/utils/text-matching.js';

describe('ISBN variant matching', () => {
  it('converts between equivalent ISBN-13 and ISBN-10 identifiers', () => {
    assert.equal(normalizeIsbn(9780593135211), '9780593135211');
    assert.equal(convertIsbn13To10('9780593135211'), '0593135210');
    assert.equal(convertIsbn10To13('0593135210'), '9780593135211');
    assert.deepEqual(getIsbnVariants('9780593135211'), [
      '9780593135211',
      '0593135210',
    ]);
    assert.deepEqual(getIsbnVariants('0593135210'), [
      '0593135210',
      '9780593135211',
    ]);
  });

  it('does not create equivalent ISBN variants when the checksum is invalid', () => {
    assert.equal(convertIsbn13To10('9780593135212'), null);
    assert.equal(convertIsbn10To13('0593135211'), null);
    assert.deepEqual(getIsbnVariants('9780593135212'), ['9780593135212']);
    assert.deepEqual(getIsbnVariants('0593135211'), ['0593135211']);
  });

  it('indexes Hardcover library ISBN-10 entries by their ISBN-13 equivalent', () => {
    const userBook = {
      id: 'user-book-project-hail-mary',
      book: {
        id: 'book-project-hail-mary',
        title: 'Project Hail Mary',
        editions: [
          {
            id: 'edition-isbn10-only',
            isbn_10: '0593135210',
            isbn_13: null,
          },
        ],
      },
    };

    const lookup = createIdentifierLookup([userBook]);

    assert.equal(lookup['0593135210'].edition.id, 'edition-isbn10-only');
    assert.equal(lookup['9780593135211'].edition.id, 'edition-isbn10-only');
  });

  it('matches an Audiobookshelf ISBN-13 against a Hardcover ISBN-10 lookup', async () => {
    const matcher = new IsbnMatcher();
    const userBook = {
      id: 'user-book-project-hail-mary',
      book: { title: 'Project Hail Mary' },
    };
    const edition = {
      id: 'edition-isbn10-only',
      isbn_10: '0593135210',
    };

    const match = await matcher.findMatch(
      { media: { metadata: { title: 'Project Hail Mary' } } },
      { isbn: '9780593135211', asin: null },
      { '0593135210': { userBook, edition } },
    );

    assert.equal(match.userBook.id, 'user-book-project-hail-mary');
    assert.equal(match.edition.id, 'edition-isbn10-only');
    assert.equal(match._matchType, 'isbn');
  });

  it('queries Hardcover with both ISBN variants', async () => {
    const client = new HardcoverClient('test-token');
    let capturedVariables = null;

    client._executeQuery = async (_query, variables) => {
      capturedVariables = variables;
      return { editions: [] };
    };
    client.searchBooksByTitle = async () => [];

    try {
      await client.searchBooksByIsbn('9780593135211');

      assert.deepEqual(capturedVariables.isbnCandidates, [
        '9780593135211',
        '0593135210',
      ]);
    } finally {
      client.cleanup();
      client.rateLimiter.destroy();
    }
  });

  it('uses search API fallback results when the edition payload has an equivalent ISBN', async () => {
    const client = new HardcoverClient('test-token');

    client._executeQuery = async () => ({ editions: [] });
    client.searchBooksByTitle = async () => [
      {
        id: 'book-project-hail-mary',
        title: 'Project Hail Mary',
        contributions: [{ author: { name: 'Andy Weir' } }],
        editions: [
          {
            id: 'edition-isbn10-only',
            isbn_10: '0593135210',
            isbn_13: null,
            reading_format: { format: 'audiobook' },
          },
        ],
      },
    ];

    try {
      const results = await client.searchBooksByIsbn('9780593135211');

      assert.equal(results.length, 1);
      assert.equal(results[0].id, 'edition-isbn10-only');
      assert.equal(results[0].book.id, 'book-project-hail-mary');
    } finally {
      client.cleanup();
      client.rateLimiter.destroy();
    }
  });
});
