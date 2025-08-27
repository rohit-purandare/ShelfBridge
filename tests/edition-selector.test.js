/**
 * Edition Selector Tests
 *
 * Tests for the Stage 2 edition selection logic that picks the best edition
 * based on format preferences, popularity, and other edition-specific factors.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { selectBestEdition } from '../src/matching/edition-selector.js';

describe('EditionSelector', () => {
  let mockBookResult;

  beforeEach(() => {
    mockBookResult = {
      id: 'book123',
      title: 'Test Book',
      editions: [
        {
          id: 'edition_audiobook',
          reading_format: { format: 'audiobook' },
          users_count: 150,
          audio_seconds: 43200, // 12 hours
          asin: 'B123456789',
          isbn_13: null,
          pages: null,
        },
        {
          id: 'edition_ebook',
          reading_format: { format: 'ebook' },
          users_count: 300,
          audio_seconds: null,
          asin: null,
          isbn_13: '9781234567890',
          pages: 350,
        },
        {
          id: 'edition_physical',
          physical_format: 'paperback',
          users_count: 100,
          audio_seconds: null,
          asin: null,
          isbn_13: '9781234567890',
          pages: 350,
        },
      ],
    };
  });

  describe('selectBestEdition', () => {
    it('should return null for books with no editions', () => {
      const emptyBookResult = {
        id: 'book123',
        title: 'Empty Book',
        editions: [],
      };

      const result = selectBestEdition(emptyBookResult, {}, 'audiobook');
      expect(result).toBeNull();
    });

    it('should prefer audiobook edition for audiobook users', () => {
      const audiobookMetadata = {
        duration: 43200,
        narrator: 'Test Narrator',
      };

      const result = selectBestEdition(
        mockBookResult,
        audiobookMetadata,
        'audiobook',
      );

      expect(result).not.toBeNull();
      expect(result.edition.id).toBe('edition_audiobook');
      expect(result.edition._editionScore.breakdown.format.reason).toContain(
        'Perfect audiobook format match',
      );
    });

    it('should prefer ebook edition for ebook users', () => {
      const ebookMetadata = {
        pages: 350,
        format: 'epub',
      };

      const result = selectBestEdition(mockBookResult, ebookMetadata, 'ebook');

      expect(result).not.toBeNull();
      expect(result.edition.id).toBe('edition_ebook');
      expect(result.edition._editionScore.breakdown.format.reason).toContain(
        'Perfect ebook format match',
      );
    });

    it('should fall back to ebook when audiobook user has no audiobook edition', () => {
      const bookWithoutAudiobook = {
        ...mockBookResult,
        editions: mockBookResult.editions.filter(
          e => e.id !== 'edition_audiobook',
        ),
      };

      const result = selectBestEdition(
        bookWithoutAudiobook,
        { duration: 43200 },
        'audiobook',
      );

      expect(result).not.toBeNull();
      expect(result.edition.id).toBe('edition_ebook');
      expect(result.edition._editionScore.breakdown.format.reason).toContain(
        'Good fallback',
      );
    });

    it('should fall back to audiobook when ebook user has no ebook edition', () => {
      const bookWithoutEbook = {
        ...mockBookResult,
        editions: mockBookResult.editions.filter(e => e.id !== 'edition_ebook'),
      };

      const result = selectBestEdition(
        bookWithoutEbook,
        { pages: 350 },
        'ebook',
      );

      expect(result).not.toBeNull();
      expect(result.edition.id).toBe('edition_audiobook');
      expect(result.edition._editionScore.breakdown.format.reason).toContain(
        'Good fallback',
      );
    });

    it('should consider popularity in edition selection', () => {
      const bookWithVariablePopularity = {
        id: 'book123',
        title: 'Popularity Test',
        editions: [
          {
            id: 'popular_audiobook',
            reading_format: { format: 'audiobook' },
            users_count: 1000,
            audio_seconds: 43200,
          },
          {
            id: 'unpopular_audiobook',
            reading_format: { format: 'audiobook' },
            users_count: 10,
            audio_seconds: 43200,
          },
        ],
      };

      const result = selectBestEdition(
        bookWithVariablePopularity,
        { duration: 43200 },
        'audiobook',
      );

      expect(result.edition.id).toBe('popular_audiobook');
      expect(result.edition._editionScore.breakdown.popularity.usersCount).toBe(
        1000,
      );
    });

    it('should score duration matching for audiobooks', () => {
      const audiobookMetadata = {
        duration: 43200, // 12 hours
      };

      const result = selectBestEdition(
        mockBookResult,
        audiobookMetadata,
        'audiobook',
      );

      expect(result.edition._editionScore.breakdown.duration).toBeDefined();
      expect(result.edition._editionScore.breakdown.duration.reason).toContain(
        'Excellent duration match',
      );
    });

    it('should score data completeness correctly', () => {
      const completeEdition = {
        id: 'complete_edition',
        reading_format: { format: 'audiobook' },
        users_count: 100,
        audio_seconds: 43200,
        asin: 'B123456789',
        isbn_13: '9781234567890',
        pages: 350,
      };

      const incompleteEdition = {
        id: 'incomplete_edition',
        reading_format: { format: 'audiobook' },
        users_count: 100,
        audio_seconds: 43200,
        // Missing ASIN, ISBN, pages
      };

      const bookWithCompleteness = {
        id: 'book123',
        title: 'Completeness Test',
        editions: [completeEdition, incompleteEdition],
      };

      const result = selectBestEdition(
        bookWithCompleteness,
        { duration: 43200 },
        'audiobook',
      );

      expect(result.edition.id).toBe('complete_edition');
      expect(
        result.edition._editionScore.breakdown.completeness.reason,
      ).toContain('Very complete');
    });

    it('should apply perfect format match bonus', () => {
      const result = selectBestEdition(
        mockBookResult,
        { duration: 43200 },
        'audiobook',
      );

      expect(
        result.edition._editionScore.breakdown.perfectFormatBonus,
      ).toBeDefined();
      expect(
        result.edition._editionScore.breakdown.perfectFormatBonus.score,
      ).toBeGreaterThan(0);
    });

    it('should apply high popularity bonus for very popular editions', () => {
      const veryPopularBook = {
        id: 'book123',
        title: 'Very Popular Book',
        editions: [
          {
            id: 'very_popular_edition',
            reading_format: { format: 'audiobook' },
            users_count: 5000,
            audio_seconds: 43200,
          },
        ],
      };

      const result = selectBestEdition(
        veryPopularBook,
        { duration: 43200 },
        'audiobook',
      );

      expect(
        result.edition._editionScore.breakdown.popularityBonus,
      ).toBeDefined();
      expect(
        result.edition._editionScore.breakdown.popularityBonus.score,
      ).toBeGreaterThan(0);
    });

    it('should cap edition scores at 100 to prevent overflow', () => {
      const extremeEdition = {
        id: 'extreme_edition',
        reading_format: { format: 'audiobook' },
        users_count: 100000, // Very high
        audio_seconds: 43200,
        asin: 'B123456789',
        isbn_13: '9781234567890',
        pages: 500,
      };

      const extremeBook = {
        id: 'book123',
        title: 'Extreme Book',
        editions: [extremeEdition],
      };

      const result = selectBestEdition(
        extremeBook,
        { duration: 43200 },
        'audiobook',
      );

      expect(result.edition._editionScore.totalScore).toBeLessThanOrEqual(100);
      expect(result.edition._editionScore.totalScore).toBeGreaterThan(90);
    });

    it('should provide selection reasoning and alternatives', () => {
      const result = selectBestEdition(
        mockBookResult,
        { duration: 43200 },
        'audiobook',
      );

      expect(result.selectionReason).toBeDefined();
      expect(result.alternativeEditions).toBeInstanceOf(Array);
      expect(result.alternativeEditions.length).toBeGreaterThan(0);
      expect(result.alternativeEditions.length).toBeLessThanOrEqual(2);
    });

    it('should handle missing format information gracefully', () => {
      const bookWithMissingFormat = {
        id: 'book123',
        title: 'Missing Format Book',
        editions: [
          {
            id: 'unknown_format_edition',
            users_count: 100,
            audio_seconds: 43200,
            // No format information
          },
        ],
      };

      const result = selectBestEdition(
        bookWithMissingFormat,
        { duration: 43200 },
        'audiobook',
      );

      expect(result).not.toBeNull();
      expect(result.edition._editionScore.breakdown.format.reason).toContain(
        'No format information',
      );
    });

    it('should handle physical format as last resort', () => {
      const physicalOnlyBook = {
        id: 'book123',
        title: 'Physical Only Book',
        editions: [
          {
            id: 'physical_edition',
            physical_format: 'hardcover',
            users_count: 100,
            pages: 350,
          },
        ],
      };

      const result = selectBestEdition(
        physicalOnlyBook,
        { duration: 43200 },
        'audiobook',
      );

      expect(result).not.toBeNull();
      expect(result.edition.id).toBe('physical_edition');
      expect(result.edition._editionScore.breakdown.format.reason).toContain(
        'Acceptable fallback',
      );
    });

    it('should sort alternatives by score', () => {
      const result = selectBestEdition(
        mockBookResult,
        { duration: 43200 },
        'audiobook',
      );

      expect(result.alternativeEditions.length).toBeGreaterThan(0);

      // Check that alternatives are sorted by score (descending)
      for (let i = 1; i < result.alternativeEditions.length; i++) {
        expect(
          result.alternativeEditions[i - 1]._editionScore.totalScore,
        ).toBeGreaterThanOrEqual(
          result.alternativeEditions[i]._editionScore.totalScore,
        );
      }
    });
  });
});
