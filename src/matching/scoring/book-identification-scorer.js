/**
 * Book Identification Scorer
 *
 * This module provides scoring focused specifically on book-level identification,
 * separate from edition-specific details. The goal is to determine if two books
 * represent the same work, regardless of format, publisher, or specific edition.
 */

import logger from '../../logger.js';
import {
  normalizeTitle,
  normalizeAuthor,
  normalizeSeries,
} from '../utils/normalization.js';
import { calculateTextSimilarity } from '../utils/similarity.js';
import {
  extractSeries,
  extractPublicationYear,
} from '../utils/audiobookshelf-extractor.js';
import {
  extractAuthorFromSearchResult,
  extractActivityFromSearchResult,
} from '../utils/hardcover-extractor.js';

/**
 * Calculate book identification confidence score
 *
 * This scorer focuses on core book identity factors and ignores edition-specific
 * details like format, duration, narrator, etc. The goal is to answer:
 * "Are these two entries referring to the same book/work?"
 *
 * @param {Object} searchResult - Hardcover search result
 * @param {string} targetTitle - Target title from Audiobookshelf
 * @param {string} targetAuthor - Target author from Audiobookshelf
 * @param {Object} targetMetadata - Additional metadata from Audiobookshelf
 * @returns {Object} - Book identification score and breakdown
 */
export function calculateBookIdentificationScore(
  searchResult,
  targetTitle,
  targetAuthor,
  targetMetadata = {},
) {
  if (!searchResult || typeof searchResult !== 'object') {
    return {
      totalScore: 0,
      breakdown: {},
      confidence: 'none',
      isBookMatch: false,
    };
  }

  let score = 0;
  const breakdown = {};

  // Extract data from search result
  const resultTitle = searchResult.title || '';
  const resultAuthor = extractAuthorFromSearchResult(
    searchResult,
    targetAuthor,
  );

  // Extract enhanced metadata for book-level comparison
  const targetSeries = extractSeries(targetMetadata);
  const targetYear = extractPublicationYear(targetMetadata);
  const resultSeries = extractSeries(searchResult);
  const resultYear = extractPublicationYear(searchResult);

  // Extract activity data (still relevant for book disambiguation)
  const resultActivity = extractActivityFromSearchResult(searchResult);

  // ============================================================================
  // BOOK IDENTIFICATION FACTORS (Edition-agnostic)
  // ============================================================================

  // 1. Title Similarity (35% weight) - PRIMARY book identification factor
  const titleScore =
    calculateTextSimilarity(
      normalizeTitle(targetTitle),
      normalizeTitle(resultTitle),
    ) * 100;
  score += titleScore * 0.35;
  breakdown.title = {
    score: titleScore,
    weight: 0.35,
    comparison: `"${targetTitle}" vs "${resultTitle}"`,
  };

  // 2. Author Similarity (25% weight) - SECONDARY book identification factor
  const authorScore =
    calculateTextSimilarity(
      normalizeAuthor(targetAuthor || ''),
      normalizeAuthor(resultAuthor || ''),
    ) * 100;
  score += authorScore * 0.25;
  breakdown.author = {
    score: authorScore,
    weight: 0.25,
    comparison: `"${targetAuthor || 'N/A'}" vs "${resultAuthor || 'N/A'}"`,
  };

  // 3. Series Match (15% weight) - Important for book disambiguation
  const seriesResult = calculateSeriesScore(targetSeries, resultSeries);
  score += seriesResult.score * 0.15;
  breakdown.series = {
    score: seriesResult.score,
    weight: 0.15,
    reason: seriesResult.reason,
    comparison: `"${targetSeries?.name || 'N/A'}" vs "${resultSeries?.name || 'N/A'}"`,
  };

  // 4. Activity/Popularity (10% weight) - Helps distinguish between similar titles
  const activityScore = calculateActivityScore(resultActivity);
  score += activityScore * 0.1;
  breakdown.activity = {
    score: activityScore,
    weight: 0.1,
    value: resultActivity || 0,
    reason: 'Popular books are more likely to be correct matches',
  };

  // 5. Publication Year (5% weight) - Minor book disambiguation
  const yearResult = calculateYearScore(targetYear, resultYear);
  score += yearResult.score * 0.05;
  breakdown.year = {
    score: yearResult.score,
    weight: 0.05,
    reason: yearResult.reason,
    comparison: `${targetYear || 'N/A'} vs ${resultYear || 'N/A'}`,
  };

  // ============================================================================
  // BONUSES AND PENALTIES
  // ============================================================================

  // Perfect Match Bonus for excellent title+author combinations
  if (titleScore >= 90 && authorScore >= 90) {
    const perfectMatchBonus = Math.min(titleScore, authorScore) * 0.1; // Up to 10 bonus points
    score += perfectMatchBonus;
    breakdown.perfectMatchBonus = {
      score: perfectMatchBonus,
      reason: `Excellent title+author match (title: ${titleScore.toFixed(1)}%, author: ${authorScore.toFixed(1)}%)`,
    };
    logger.debug(
      `Applied perfect match bonus: +${perfectMatchBonus.toFixed(1)} points`,
    );
  }

  // High Confidence Bonus for very good title+author matches
  else if (titleScore >= 80 && authorScore >= 80) {
    const highConfidenceBonus = Math.min(titleScore, authorScore) * 0.05; // Up to 5 bonus points
    score += highConfidenceBonus;
    breakdown.highConfidenceBonus = {
      score: highConfidenceBonus,
      reason: `Strong title+author match (title: ${titleScore.toFixed(1)}%, author: ${authorScore.toFixed(1)}%)`,
    };
    logger.debug(
      `Applied high-confidence bonus: +${highConfidenceBonus.toFixed(1)} points`,
    );
  }

  // Apply penalty for very short titles (higher chance of false matches)
  const normalizedTitle = normalizeTitle(targetTitle);
  if (normalizedTitle.length <= 10) {
    const penalty = Math.max(0, 10 - normalizedTitle.length) * 2; // Up to 20% penalty
    score -= penalty;
    breakdown.shortTitlePenalty = {
      score: -penalty,
      reason: `Short title penalty (${normalizedTitle.length} chars) - higher false positive risk`,
    };
  }

  // Apply penalty for very different authors on same/similar titles
  if (authorScore < 30 && titleScore > 80) {
    const penalty = (80 - authorScore) * 0.15; // Penalty for same title, very different author
    score -= penalty;
    breakdown.authorMismatchPenalty = {
      score: -penalty,
      reason: 'Similar title but very different author - likely different work',
    };
  }

  // ============================================================================
  // SCORE CAPPING AND CONFIDENCE DETERMINATION
  // ============================================================================

  // Ensure score is within 0-100 range
  const totalScore = Math.min(100, Math.max(0, score));

  // Determine book identification confidence
  let confidence = 'none';
  let isBookMatch = false;

  if (totalScore >= 75) {
    confidence = 'high';
    isBookMatch = true;
  } else if (totalScore >= 60) {
    confidence = 'medium';
    isBookMatch = true;
  } else if (totalScore >= 45) {
    confidence = 'low';
    isBookMatch = true;
  } else {
    confidence = 'none';
    isBookMatch = false;
  }

  return {
    totalScore,
    breakdown,
    confidence,
    isBookMatch,
    coreFactorsScore: titleScore * 0.35 + authorScore * 0.25, // Title + Author only
  };
}

/**
 * Calculate series matching score for book identification
 */
function calculateSeriesScore(targetSeries, resultSeries) {
  // If neither has series data, neutral score
  if (!targetSeries.name && !resultSeries.name) {
    return { score: 60, reason: 'No series data for comparison' };
  }

  // If only one has series data, slight negative
  if (!targetSeries.name || !resultSeries.name) {
    return { score: 45, reason: 'Series data missing on one side' };
  }

  // Compare series names using dedicated series normalization
  const seriesNameSimilarity =
    calculateTextSimilarity(
      normalizeSeries(targetSeries.name),
      normalizeSeries(resultSeries.name),
    ) * 100;

  // If series names don't match well, low score
  if (seriesNameSimilarity < 70) {
    return {
      score: Math.max(20, seriesNameSimilarity * 0.5),
      reason: 'Different series names',
    };
  }

  // Series names match well - check sequence numbers
  let sequenceBonus = 0;
  if (
    targetSeries.sequence &&
    resultSeries.sequence &&
    targetSeries.sequence === resultSeries.sequence
  ) {
    sequenceBonus = 20; // Exact sequence match
  } else if (targetSeries.sequence && resultSeries.sequence) {
    sequenceBonus = 5; // Both have sequences but different
  }

  const finalScore = Math.min(100, seriesNameSimilarity + sequenceBonus);

  return {
    score: finalScore,
    reason: `Series match: ${seriesNameSimilarity.toFixed(1)}% + sequence bonus: ${sequenceBonus}`,
  };
}

/**
 * Calculate publication year matching score for book identification
 */
function calculateYearScore(targetYear, resultYear) {
  // If neither has year data, neutral score
  if (!targetYear && !resultYear) {
    return { score: 60, reason: 'No publication year data' };
  }

  // If only one has year data, slight negative
  if (!targetYear || !resultYear) {
    return { score: 45, reason: 'Publication year missing on one side' };
  }

  const yearDiff = Math.abs(targetYear - resultYear);

  if (yearDiff === 0) {
    return { score: 100, reason: 'Exact year match' };
  } else if (yearDiff === 1) {
    return { score: 85, reason: '1 year difference' };
  } else if (yearDiff <= 3) {
    return { score: 70, reason: `${yearDiff} years difference` };
  } else if (yearDiff <= 5) {
    return { score: 50, reason: `${yearDiff} years difference` };
  } else {
    return { score: 20, reason: `${yearDiff} years difference (significant)` };
  }
}

/**
 * Calculate activity/popularity score (same as original)
 */
function calculateActivityScore(activity) {
  if (!activity || activity === 0) return 30; // Low score for no activity

  // Logarithmic scale for activity - more active books get higher scores
  const logActivity = Math.log10(activity + 1);

  // Scale to 30-100 range (never completely bad due to activity)
  const score = Math.min(100, 30 + logActivity * 20);

  return score;
}
