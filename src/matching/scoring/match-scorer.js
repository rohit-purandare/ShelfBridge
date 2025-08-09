/**
 * Book matching score calculator
 *
 * This module provides sophisticated scoring algorithms for matching books
 * between Audiobookshelf and Hardcover using multiple weighted factors.
 */

import logger from '../../logger.js';
import {
  normalizeTitle,
  normalizeAuthor,
  normalizeNarrator,
} from '../utils/normalization.js';
import {
  calculateTextSimilarity,
  calculateDurationSimilarity,
} from '../utils/similarity.js';
import {
  extractSeries,
  extractPublicationYear,
  extractAudioDurationFromAudiobookshelf,
  detectUserBookFormat,
} from '../utils/audiobookshelf-extractor.js';
import {
  extractAuthorFromSearchResult,
  extractNarratorFromSearchResult,
  extractFormatFromSearchResult,
  extractActivityFromSearchResult,
  extractAudioDurationFromSearchResult,
} from '../utils/hardcover-extractor.js';

/**
 * Calculate confidence score for title/author/narrator matching
 * @param {Object} searchResult - Hardcover search result
 * @param {string} targetTitle - Target title from Audiobookshelf
 * @param {string} targetAuthor - Target author from Audiobookshelf
 * @param {string} targetNarrator - Target narrator from Audiobookshelf (optional)
 * @param {Object} targetMetadata - Additional metadata from Audiobookshelf
 * @returns {Object} - Confidence score and breakdown
 */
export function calculateMatchingScore(
  searchResult,
  targetTitle,
  targetAuthor,
  targetNarrator = null,
  targetMetadata = {},
) {
  // Handle null/undefined search results
  if (!searchResult || typeof searchResult !== 'object') {
    return {
      totalScore: 0,
      breakdown: {},
      confidence: 'low',
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
  const resultNarrator = extractNarratorFromSearchResult(searchResult);
  const resultFormat = extractFormatFromSearchResult(searchResult);

  // Extract enhanced metadata
  const targetSeries = extractSeries(targetMetadata);
  const targetYear = extractPublicationYear(targetMetadata);
  const resultSeries = extractSeries(searchResult);
  const resultYear = extractPublicationYear(searchResult);

  // Extract activity data
  const resultActivity = extractActivityFromSearchResult(searchResult);

  // Extract duration data for weight calculation
  const targetDuration = extractAudioDurationFromAudiobookshelf(targetMetadata);
  const resultDuration = extractAudioDurationFromSearchResult(searchResult);
  const isDurationRelevant = targetDuration || resultDuration;

  // 1. Title Similarity (25% weight) - PRIMARY matching factor
  const titleScore =
    calculateTextSimilarity(
      normalizeTitle(targetTitle),
      normalizeTitle(resultTitle),
    ) * 100;
  score += titleScore * 0.25;
  breakdown.title = {
    score: titleScore,
    weight: 0.25,
    comparison: `"${targetTitle}" vs "${resultTitle}"`,
  };

  // 2. Author Similarity (18% weight) - SECONDARY matching factor
  const authorScore =
    calculateTextSimilarity(
      normalizeAuthor(targetAuthor || ''),
      normalizeAuthor(resultAuthor || ''),
    ) * 100;
  score += authorScore * 0.18;
  breakdown.author = {
    score: authorScore,
    weight: 0.18,
    comparison: `"${targetAuthor || 'N/A'}" vs "${resultAuthor || 'N/A'}"`,
  };

  // 3. Series Match (12% weight) - Enhanced edition disambiguation
  const seriesResult = calculateSeriesScore(targetSeries, resultSeries);
  score += seriesResult.score * 0.12;
  breakdown.series = {
    score: seriesResult.score,
    weight: 0.12,
    reason: seriesResult.reason,
    comparison: `"${targetSeries?.name || 'N/A'}" vs "${resultSeries?.name || 'N/A'}"`,
  };

  // 4. Format Score (10% weight) - Relevant for audiobook matching
  const formatScore = calculateFormatScore(resultFormat);
  score += formatScore * 0.1;
  breakdown.format = {
    score: formatScore,
    weight: 0.1,
    value: resultFormat || 'unknown',
  };

  // 5. Activity/Popularity (18% weight) - Important for distinguishing between similar titles
  const activityScore = calculateActivityScore(resultActivity);
  score += activityScore * 0.18;
  breakdown.activity = {
    score: activityScore,
    weight: 0.18,
    value: resultActivity || 0,
  };

  // 6. Publication Year (7% weight) - Enhanced edition disambiguation
  const yearResult = calculateYearScore(targetYear, resultYear);
  score += yearResult.score * 0.07;
  breakdown.year = {
    score: yearResult.score,
    weight: 0.07,
    reason: yearResult.reason,
    comparison: `${targetYear || 'N/A'} vs ${resultYear || 'N/A'}`,
  };

  // 7. Duration Match (5% weight) - Small but helpful for audiobook edition matching
  const durationScore = calculateDurationSimilarity(
    targetDuration,
    resultDuration,
  );
  score += durationScore * 0.05;
  breakdown.duration = {
    score: durationScore,
    weight: 0.05,
    comparison: `${targetDuration ? Math.round(targetDuration / 60) + 'm' : 'N/A'} vs ${resultDuration ? Math.round(resultDuration / 60) + 'm' : 'N/A'}`,
    reason: isDurationRelevant
      ? 'Duration matching for audiobook edition'
      : 'No duration data available',
  };

  // 8. Narrator Match (3% weight) - Small tiebreaker for audiobooks
  let narratorScore = 60; // Neutral default
  if (targetNarrator && resultNarrator) {
    narratorScore =
      calculateTextSimilarity(
        normalizeNarrator(targetNarrator),
        normalizeNarrator(resultNarrator),
      ) * 100;
  } else if (targetNarrator && !resultNarrator) {
    narratorScore = 60; // Neutral - don't penalize missing narrator data
  } else if (!targetNarrator && resultNarrator) {
    narratorScore = 60; // Neutral
  }
  score += narratorScore * 0.03;
  breakdown.narrator = {
    score: narratorScore,
    weight: 0.03,
    comparison: `"${targetNarrator || 'N/A'}" vs "${resultNarrator || 'N/A'}"`,
  };

  // Apply penalty for very short titles (higher chance of false matches)
  const normalizedTitle = normalizeTitle(targetTitle);
  if (normalizedTitle.length <= 10) {
    // Very short titles
    const penalty = Math.max(0, 10 - normalizedTitle.length) * 2; // Up to 20% penalty
    score -= penalty;
    breakdown.shortTitlePenalty = {
      score: -penalty,
      reason: `Short title penalty (${normalizedTitle.length} chars)`,
    };
  }

  // Apply penalty for very different authors on same/similar titles
  if (authorScore < 30 && titleScore > 80) {
    const penalty = (80 - authorScore) * 0.2; // Penalty for same title, different author
    score -= penalty;
    breakdown.authorMismatchPenalty = {
      score: -penalty,
      reason: 'Same title, very different author',
    };
  }

  // NEW: Format Preference Bonus - strongly prefer matching format types
  const userFormat = detectUserBookFormat(targetMetadata);
  const resultFormatLower =
    extractFormatFromSearchResult(searchResult).toLowerCase();

  if (
    userFormat === 'audiobook' &&
    (resultFormatLower.includes('audiobook') ||
      resultFormatLower.includes('listened'))
  ) {
    const formatPreferenceBonus = 10; // Reduced from 20 - moderate bonus for audiobook match
    score += formatPreferenceBonus;
    breakdown.formatPreferenceBonus = {
      score: formatPreferenceBonus,
      reason:
        'User has audiobook, result is audiobook - format preference match',
    };
    logger.debug(
      `Applied audiobook preference bonus: +${formatPreferenceBonus} points`,
    );
  } else if (
    userFormat === 'ebook' &&
    (resultFormatLower.includes('ebook') ||
      resultFormatLower.includes('digital'))
  ) {
    const formatPreferenceBonus = 8; // Reduced from 15 - moderate bonus for ebook match
    score += formatPreferenceBonus;
    breakdown.formatPreferenceBonus = {
      score: formatPreferenceBonus,
      reason: 'User has ebook, result is ebook - format preference match',
    };
  } else if (
    userFormat === 'physical' &&
    (resultFormatLower.includes('physical') ||
      resultFormatLower.includes('paperback') ||
      resultFormatLower.includes('hardcover'))
  ) {
    const formatPreferenceBonus = 5; // Reduced from 10 - small bonus for physical match
    score += formatPreferenceBonus;
    breakdown.formatPreferenceBonus = {
      score: formatPreferenceBonus,
      reason:
        'User has physical book, result is physical - format preference match',
    };
  }

  // NEW: Perfect Match Bonus for high-confidence title+author combinations
  if (titleScore >= 90 && authorScore >= 90) {
    const perfectMatchBonus = Math.min(titleScore, authorScore) * 0.08; // Reduced from 0.15 to 0.08 - up to 8 bonus points
    score += perfectMatchBonus;
    breakdown.perfectMatchBonus = {
      score: perfectMatchBonus,
      reason: `Perfect title+author match bonus (title: ${titleScore.toFixed(1)}%, author: ${authorScore.toFixed(1)}%)`,
    };
    logger.debug(
      `Applied perfect match bonus: +${perfectMatchBonus.toFixed(1)} points`,
    );
  }

  // NEW: High-confidence bonus for very good title+author matches
  else if (titleScore >= 80 && authorScore >= 80) {
    const highConfidenceBonus = Math.min(titleScore, authorScore) * 0.04; // Reduced from 0.08 to 0.04 - up to 4 bonus points
    score += highConfidenceBonus;
    breakdown.highConfidenceBonus = {
      score: highConfidenceBonus,
      reason: `High-confidence title+author match bonus (title: ${titleScore.toFixed(1)}%, author: ${authorScore.toFixed(1)}%)`,
    };
    logger.debug(
      `Applied high-confidence bonus: +${highConfidenceBonus.toFixed(1)} points`,
    );
  }

  // Ensure score is within 0-100 range
  const totalScore = Math.min(100, Math.max(0, score));

  // Determine confidence level
  let confidence = 'low';
  if (totalScore >= 85) confidence = 'high';
  else if (totalScore >= 70) confidence = 'medium';

  return {
    totalScore,
    breakdown,
    confidence,
  };
}

/**
 * Calculate series matching score
 * @param {Object} targetSeries - Target series metadata
 * @param {Object} resultSeries - Result series metadata
 * @returns {Object} - Score and reasoning
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

  // Compare series names
  const seriesNameSimilarity =
    calculateTextSimilarity(
      normalizeTitle(targetSeries.name),
      normalizeTitle(resultSeries.name),
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
 * Calculate publication year matching score
 * @param {number} targetYear - Target publication year
 * @param {number} resultYear - Result publication year
 * @returns {Object} - Score and reasoning
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
 * Calculate format preference score
 * @param {string} format - Book format
 * @returns {number} - Format score (0-100)
 */
function calculateFormatScore(format) {
  if (!format) return 50; // Neutral if no format data

  const formatLower = format.toLowerCase();

  // Prefer audiobooks (primary use case)
  if (formatLower.includes('audiobook') || formatLower.includes('listened')) {
    return 90;
  }

  // Ebooks are good too
  if (formatLower.includes('ebook') || formatLower.includes('digital')) {
    return 75;
  }

  // Physical books
  if (
    formatLower.includes('physical') ||
    formatLower.includes('paperback') ||
    formatLower.includes('hardcover')
  ) {
    return 65;
  }

  // Unknown format
  return 50;
}

/**
 * Calculate activity/popularity score
 * @param {number} activity - Activity metric from Hardcover
 * @returns {number} - Activity score (0-100)
 */
function calculateActivityScore(activity) {
  if (!activity || activity === 0) return 30; // Low score for no activity

  // Logarithmic scale for activity - more active books get higher scores
  const logActivity = Math.log10(activity + 1);

  // Scale to 30-100 range (never completely bad due to activity)
  const score = Math.min(100, 30 + logActivity * 20);

  return score;
}
