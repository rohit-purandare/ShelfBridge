/**
 * Book Identification Scorer Tests
 *
 * Tests for the Stage 1 book identification scoring logic that focuses on
 * core book identity factors while ignoring edition-specific details.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { calculateBookIdentificationScore } from '../src/matching/scoring/book-identification-scorer.js';

describe('BookIdentificationScorer', () => {
  describe('calculateBookIdentificationScore', () => {
    it('should return zero score for null/invalid search results', () => {
      const result = calculateBookIdentificationScore(
        null,
        'Test Title',
        'Test Author',
      );

      assert.strictEqual(result.totalScore, 0);
      assert.strictEqual(result.isBookMatch, false);
      assert.strictEqual(result.confidence, 'none');
    });

    it('should score perfect title and author matches highly', () => {
      const searchResult = {
        title: 'The Laws of the Skies',
        author_names: ['Gregoire Courtois'],
        activity: 100,
      };

      const result = calculateBookIdentificationScore(
        searchResult,
        'The Laws of the Skies',
        'Gregoire Courtois',
        {},
      );

      expect(result.totalScore).toBeGreaterThan(90);
      expect(result.isBookMatch).toBe(true);
      expect(result.confidence).toBe('high');
      expect(result.breakdown.perfectMatchBonus).toBeDefined();
    });

    it('should handle slight author variations gracefully', () => {
      const searchResult = {
        title: 'Foundation',
        author_names: ['Isaac Asimov'],
        activity: 1000,
      };

      const result = calculateBookIdentificationScore(
        searchResult,
        'Foundation',
        'I. Asimov',
        {},
      );

      expect(result.totalScore).toBeGreaterThan(60);
      expect(result.isBookMatch).toBe(true);
      expect(result.breakdown.title.score).toBeGreaterThan(90);
      expect(result.breakdown.author.score).toBeGreaterThan(70);
    });

    it('should properly weight series information', () => {
      const searchResult = {
        title: "Harry Potter and the Philosopher's Stone",
        author_names: ['J.K. Rowling'],
        series: [{ name: 'Harry Potter', sequence: 1 }],
        activity: 5000,
      };

      const targetMetadata = {
        series: [{ name: 'Harry Potter', sequence: 1 }],
      };

      const result = calculateBookIdentificationScore(
        searchResult,
        "Harry Potter and the Philosopher's Stone",
        'J.K. Rowling',
        targetMetadata,
      );

      expect(result.breakdown.series.score).toBeGreaterThan(90);
      expect(result.totalScore).toBeGreaterThan(85);
    });

    it('should apply activity/popularity scoring correctly', () => {
      const highActivityResult = {
        title: 'Popular Book',
        author_names: ['Famous Author'],
        activity: 10000,
      };

      const lowActivityResult = {
        title: 'Popular Book',
        author_names: ['Famous Author'],
        activity: 1,
      };

      const highActivityScore = calculateBookIdentificationScore(
        highActivityResult,
        'Popular Book',
        'Famous Author',
        {},
      );

      const lowActivityScore = calculateBookIdentificationScore(
        lowActivityResult,
        'Popular Book',
        'Famous Author',
        {},
      );

      expect(highActivityScore.breakdown.activity.score).toBeGreaterThan(
        lowActivityScore.breakdown.activity.score,
      );
    });

    it('should apply publication year scoring correctly', () => {
      const searchResult = {
        title: 'Recent Book',
        author_names: ['Modern Author'],
        publication_year: 2023,
        activity: 100,
      };

      const exactYearMatch = calculateBookIdentificationScore(
        searchResult,
        'Recent Book',
        'Modern Author',
        { publicationYear: 2023 },
      );

      const closeYearMatch = calculateBookIdentificationScore(
        searchResult,
        'Recent Book',
        'Modern Author',
        { publicationYear: 2022 },
      );

      const farYearMatch = calculateBookIdentificationScore(
        searchResult,
        'Recent Book',
        'Modern Author',
        { publicationYear: 2010 },
      );

      expect(exactYearMatch.breakdown.year.score).toBe(100);
      expect(closeYearMatch.breakdown.year.score).toBeGreaterThan(80);
      expect(farYearMatch.breakdown.year.score).toBeLessThan(30);
    });

    it('should apply short title penalty', () => {
      const shortTitleResult = {
        title: 'It',
        author_names: ['Stephen King'],
        activity: 1000,
      };

      const longTitleResult = {
        title: 'A Very Long and Descriptive Book Title',
        author_names: ['Stephen King'],
        activity: 1000,
      };

      const shortTitleScore = calculateBookIdentificationScore(
        shortTitleResult,
        'It',
        'Stephen King',
        {},
      );

      const longTitleScore = calculateBookIdentificationScore(
        longTitleResult,
        'A Very Long and Descriptive Book Title',
        'Stephen King',
        {},
      );

      expect(shortTitleScore.breakdown.shortTitlePenalty).toBeDefined();
      expect(shortTitleScore.breakdown.shortTitlePenalty.score).toBeLessThan(0);
      expect(longTitleScore.breakdown.shortTitlePenalty).toBeUndefined();
    });

    it('should apply author mismatch penalty for same title different author', () => {
      const searchResult = {
        title: 'Common Title',
        author_names: ['Completely Different Author'],
        activity: 100,
      };

      const result = calculateBookIdentificationScore(
        searchResult,
        'Common Title',
        'Original Author',
        {},
      );

      expect(result.breakdown.authorMismatchPenalty).toBeDefined();
      expect(result.breakdown.authorMismatchPenalty.score).toBeLessThan(0);
    });

    it('should cap scores at 100 to prevent overflow', () => {
      const extremeSearchResult = {
        title: 'Perfect Match',
        author_names: ['Perfect Author'],
        series: [{ name: 'Perfect Series', sequence: 1 }],
        activity: 100000,
        publication_year: 2023,
      };

      const result = calculateBookIdentificationScore(
        extremeSearchResult,
        'Perfect Match',
        'Perfect Author',
        {
          series: [{ name: 'Perfect Series', sequence: 1 }],
          publicationYear: 2023,
        },
      );

      expect(result.totalScore).toBeLessThanOrEqual(100);
      expect(result.totalScore).toBeGreaterThan(95);
    });

    it('should provide correct confidence classifications', () => {
      const highConfidenceResult = {
        title: 'High Confidence Book',
        author_names: ['High Confidence Author'],
        activity: 1000,
      };

      const mediumConfidenceResult = {
        title: 'Medium Book',
        author_names: ['Different Author'],
        activity: 100,
      };

      const lowConfidenceResult = {
        title: 'Different Title Entirely',
        author_names: ['Different Author'],
        activity: 10,
      };

      const highScore = calculateBookIdentificationScore(
        highConfidenceResult,
        'High Confidence Book',
        'High Confidence Author',
        {},
      );

      const mediumScore = calculateBookIdentificationScore(
        mediumConfidenceResult,
        'Medium Book Variation',
        'Similar Author',
        {},
      );

      const lowScore = calculateBookIdentificationScore(
        lowConfidenceResult,
        'Target Book',
        'Target Author',
        {},
      );

      expect(highScore.confidence).toBe('high');
      expect(highScore.totalScore).toBeGreaterThanOrEqual(75);

      expect(mediumScore.confidence).toBe('medium');
      expect(mediumScore.totalScore).toBeGreaterThanOrEqual(60);
      expect(mediumScore.totalScore).toBeLessThan(75);

      expect(lowScore.confidence).toBe('low');
      expect(lowScore.totalScore).toBeLessThan(60);
    });

    it('should calculate core factors score correctly', () => {
      const searchResult = {
        title: 'Test Book',
        author_names: ['Test Author'],
        activity: 100,
      };

      const result = calculateBookIdentificationScore(
        searchResult,
        'Test Book',
        'Test Author',
        {},
      );

      // Core factors = title (35%) + author (25%) = 60% of weight
      expect(result.coreFactorsScore).toBeDefined();
      expect(result.coreFactorsScore).toBeGreaterThan(50);
    });
  });
});
