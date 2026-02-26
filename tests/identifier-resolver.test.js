import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveBookIdentifier } from '../src/utils/identifier-resolver.js';

describe('resolveBookIdentifier', () => {
  describe('priority: asin > isbn > title_author', () => {
    it('returns asin when asin is available', () => {
      const result = resolveBookIdentifier(
        { asin: 'B08XYZ1234', isbn: '9781234567890' },
        { titleAuthorId: 'title_author:book|author' },
      );
      assert.equal(result.identifierType, 'asin');
      assert.equal(result.identifierValue, 'B08XYZ1234');
    });

    it('returns isbn when isbn available but not asin', () => {
      const result = resolveBookIdentifier(
        { asin: null, isbn: '9781234567890' },
        { titleAuthorId: 'title_author:book|author' },
      );
      assert.equal(result.identifierType, 'isbn');
      assert.equal(result.identifierValue, '9781234567890');
    });

    it('returns title_author when neither asin nor isbn and titleAuthorId provided', () => {
      const result = resolveBookIdentifier(
        { asin: null, isbn: null },
        { titleAuthorId: 'title_author:the_book|the_author' },
      );
      assert.equal(result.identifierType, 'title_author');
      assert.equal(result.identifierValue, 'title_author:the_book|the_author');
    });

    it('returns null/null when nothing available and no titleAuthorId', () => {
      const result = resolveBookIdentifier({ asin: null, isbn: null });
      assert.equal(result.identifierType, null);
      assert.equal(result.identifierValue, null);
    });
  });

  describe('matchType override', () => {
    it('forces title_author when matchType is title_author even if asin exists', () => {
      const result = resolveBookIdentifier(
        { asin: 'B08XYZ1234', isbn: '9781234567890' },
        {
          titleAuthorId: 'title_author:book|author',
          matchType: 'title_author',
        },
      );
      assert.equal(result.identifierType, 'title_author');
      assert.equal(result.identifierValue, 'title_author:book|author');
    });

    it('forces title_author when matchType is title_author_two_stage', () => {
      const result = resolveBookIdentifier(
        { asin: 'B08XYZ1234', isbn: null },
        {
          titleAuthorId: 'title_author:book|author',
          matchType: 'title_author_two_stage',
        },
      );
      assert.equal(result.identifierType, 'title_author');
      assert.equal(result.identifierValue, 'title_author:book|author');
    });

    it('does NOT force title_author for matchType asin_search_result', () => {
      const result = resolveBookIdentifier(
        { asin: 'B08XYZ1234', isbn: null },
        {
          titleAuthorId: 'title_author:book|author',
          matchType: 'asin_search_result',
        },
      );
      assert.equal(result.identifierType, 'asin');
      assert.equal(result.identifierValue, 'B08XYZ1234');
    });

    it('does not force title_author when matchType is title_author but no titleAuthorId', () => {
      const result = resolveBookIdentifier(
        { asin: 'B08XYZ1234', isbn: null },
        { matchType: 'title_author' },
      );
      assert.equal(result.identifierType, 'asin');
      assert.equal(result.identifierValue, 'B08XYZ1234');
    });
  });

  describe('edge cases', () => {
    it('handles empty string asin (falls through to isbn)', () => {
      const result = resolveBookIdentifier({
        asin: '',
        isbn: '9781234567890',
      });
      assert.equal(result.identifierType, 'isbn');
      assert.equal(result.identifierValue, '9781234567890');
    });

    it('handles whitespace-only asin (falls through)', () => {
      const result = resolveBookIdentifier({
        asin: '   ',
        isbn: '9781234567890',
      });
      assert.equal(result.identifierType, 'isbn');
      assert.equal(result.identifierValue, '9781234567890');
    });

    it('handles empty string isbn (falls through to title_author)', () => {
      const result = resolveBookIdentifier(
        { asin: null, isbn: '' },
        { titleAuthorId: 'title_author:book|author' },
      );
      assert.equal(result.identifierType, 'title_author');
      assert.equal(result.identifierValue, 'title_author:book|author');
    });

    it('handles undefined identifiers object', () => {
      const result = resolveBookIdentifier(undefined);
      assert.equal(result.identifierType, null);
      assert.equal(result.identifierValue, null);
    });

    it('handles null identifiers object', () => {
      const result = resolveBookIdentifier(null);
      assert.equal(result.identifierType, null);
      assert.equal(result.identifierValue, null);
    });

    it('handles empty options object', () => {
      const result = resolveBookIdentifier({ asin: 'B123', isbn: null }, {});
      assert.equal(result.identifierType, 'asin');
      assert.equal(result.identifierValue, 'B123');
    });

    it('handles no options argument', () => {
      const result = resolveBookIdentifier({ asin: null, isbn: 'ISBN123' });
      assert.equal(result.identifierType, 'isbn');
      assert.equal(result.identifierValue, 'ISBN123');
    });

    it('handles whitespace-only isbn with no fallback', () => {
      const result = resolveBookIdentifier({ asin: null, isbn: '  ' });
      assert.equal(result.identifierType, null);
      assert.equal(result.identifierValue, null);
    });

    it('handles non-string asin (number) as no match', () => {
      const result = resolveBookIdentifier({ asin: 12345, isbn: 'ISBN123' });
      assert.equal(result.identifierType, 'isbn');
      assert.equal(result.identifierValue, 'ISBN123');
    });
  });
});
