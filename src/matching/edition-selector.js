/**
 * Edition Selection Logic
 *
 * This module handles the second stage of matching: selecting the best edition
 * of a book once we've confirmed the book identity. It considers format preferences,
 * user activity, duration matching, and other edition-specific factors.
 */

import logger from '../logger.js';
import {
  extractAudioDurationFromAudiobookshelf,
  detectUserBookFormat,
} from './utils/audiobookshelf-extractor.js';
import {
  extractAudioDurationFromSearchResult,
  extractFormatFromSearchResult,
} from './utils/hardcover-extractor.js';
import { calculateDurationSimilarity } from './utils/similarity.js';

/**
 * Select the best edition from available options
 *
 * @param {Object} bookResult - Book-level search result with multiple editions
 * @param {Object} targetMetadata - Metadata from Audiobookshelf book
 * @param {string} userFormat - User's detected format (audiobook/ebook)
 * @returns {Object} - Selected edition with scoring details
 */
export function selectBestEdition(
  bookResult,
  targetMetadata = {},
  userFormat = null,
) {
  if (!bookResult || !bookResult.editions || bookResult.editions.length === 0) {
    logger.warn('No editions available for selection', {
      bookTitle: bookResult?.title,
      bookId: bookResult?.id,
    });
    return null;
  }

  const editions = bookResult.editions;
  const detectedFormat = userFormat || detectUserBookFormat(targetMetadata);
  const targetDuration = extractAudioDurationFromAudiobookshelf(targetMetadata);

  logger.debug(`Selecting best edition from ${editions.length} options`, {
    bookTitle: bookResult.title,
    detectedFormat,
    targetDuration: targetDuration
      ? Math.round(targetDuration / 60) + 'm'
      : 'N/A',
  });

  // Score each edition
  const scoredEditions = editions.map(edition => {
    const score = calculateEditionScore(
      edition,
      detectedFormat,
      targetDuration,
    );
    return {
      ...edition,
      _editionScore: score,
    };
  });

  // Sort by score (highest first)
  const sortedEditions = scoredEditions.sort(
    (a, b) => b._editionScore.totalScore - a._editionScore.totalScore,
  );

  const bestEdition = sortedEditions[0];

  logger.debug(`Selected edition for "${bookResult.title}"`, {
    editionId: bestEdition.id,
    format:
      bestEdition.reading_format?.format ||
      bestEdition.physical_format ||
      'unknown',
    usersCount: bestEdition.users_count,
    score: bestEdition._editionScore.totalScore.toFixed(1),
    scoreBreakdown: bestEdition._editionScore.breakdown,
    totalEditions: editions.length,
  });

  return {
    bookId: bookResult.id,
    title: bookResult.title,
    edition: bestEdition,
    selectionReason: bestEdition._editionScore.breakdown,
    alternativeEditions: sortedEditions.slice(1, 3), // Top 2 alternatives
  };
}

/**
 * Calculate edition selection score
 *
 * @param {Object} edition - Edition to score
 * @param {string} userFormat - User's book format (audiobook, ebook)
 * @param {number} targetDuration - Target duration in seconds (for audiobooks)
 * @returns {Object} - Edition score and breakdown
 */
function calculateEditionScore(edition, userFormat, targetDuration) {
  let score = 0;
  const breakdown = {};

  // Extract edition data
  const editionFormat = extractFormatFromSearchResult(edition);
  const editionDuration = extractAudioDurationFromSearchResult(edition);
  const usersCount = edition.users_count || 0;

  // ============================================================================
  // FORMAT PREFERENCE (40% weight) - Primary edition factor
  // ============================================================================

  const formatScore = calculateFormatScore(userFormat, editionFormat);
  score += formatScore * 0.4;
  breakdown.format = {
    score: formatScore,
    weight: 0.4,
    userFormat,
    editionFormat,
    reason: getFormatMatchReason(userFormat, editionFormat),
  };

  // ============================================================================
  // POPULARITY/USAGE (25% weight) - More users = better edition
  // ============================================================================

  const popularityScore = calculatePopularityScore(usersCount);
  score += popularityScore * 0.25;
  breakdown.popularity = {
    score: popularityScore,
    weight: 0.25,
    usersCount,
    reason: `${usersCount} users - ${getPopularityReason(usersCount)}`,
  };

  // ============================================================================
  // DURATION MATCHING (20% weight) - For audiobooks only
  // ============================================================================

  let durationScore = 50; // Neutral default
  if (userFormat === 'audiobook' && targetDuration && editionDuration) {
    durationScore = calculateDurationSimilarity(
      targetDuration,
      editionDuration,
    );
  } else if (userFormat === 'audiobook' && !editionDuration) {
    durationScore = 30; // Slight penalty for missing duration on audiobooks
  } else if (userFormat !== 'audiobook') {
    durationScore = 60; // Neutral for non-audiobooks
  }

  score += durationScore * 0.2;
  breakdown.duration = {
    score: durationScore,
    weight: 0.2,
    targetDuration: targetDuration
      ? Math.round(targetDuration / 60) + 'm'
      : 'N/A',
    editionDuration: editionDuration
      ? Math.round(editionDuration / 60) + 'm'
      : 'N/A',
    reason: getDurationMatchReason(userFormat, targetDuration, editionDuration),
  };

  // ============================================================================
  // AVAILABILITY/COMPLETENESS (15% weight) - Complete data is better
  // ============================================================================

  const completenessScore = calculateCompletenessScore(edition);
  score += completenessScore * 0.15;
  breakdown.completeness = {
    score: completenessScore,
    weight: 0.15,
    reason: getCompletenessReason(edition),
  };

  // ============================================================================
  // BONUSES
  // ============================================================================

  // Perfect format match bonus
  if (formatScore >= 95) {
    const perfectFormatBonus = 3; // Reduced to prevent overflow
    score += perfectFormatBonus;
    breakdown.perfectFormatBonus = {
      score: perfectFormatBonus,
      reason: 'Perfect format match bonus',
    };
  }

  // High popularity bonus
  if (usersCount >= 1000) {
    const popularityBonus = Math.min(2, Math.log10(usersCount / 1000)); // Reduced to prevent overflow
    score += popularityBonus;
    breakdown.popularityBonus = {
      score: popularityBonus,
      reason: `High popularity bonus (${usersCount} users)`,
    };
  }

  // ============================================================================
  // SCORE CAPPING
  // ============================================================================

  // Ensure score is within 0-100 range
  const totalScore = Math.min(100, Math.max(0, score));

  return {
    totalScore,
    breakdown,
  };
}

/**
 * Calculate format matching score with preference hierarchy
 */
function calculateFormatScore(userFormat, editionFormat) {
  if (!editionFormat || typeof editionFormat !== 'string') {
    return 20; // Penalty for missing format data
  }

  const formatLower = editionFormat.toLowerCase();

  // Perfect match with user's format (+40 points from weight)
  if (
    userFormat === 'audiobook' &&
    (formatLower.includes('audiobook') || formatLower.includes('listened'))
  ) {
    return 100; // Perfect match
  }
  if (
    userFormat === 'ebook' &&
    (formatLower.includes('ebook') || formatLower.includes('digital'))
  ) {
    return 100; // Perfect match
  }

  // Good fallback (+25 points from weight)
  if (
    userFormat === 'audiobook' &&
    (formatLower.includes('ebook') || formatLower.includes('digital'))
  ) {
    return 62.5; // 25/40 * 100 = good fallback
  }
  if (
    userFormat === 'ebook' &&
    (formatLower.includes('audiobook') || formatLower.includes('listened'))
  ) {
    return 62.5; // 25/40 * 100 = good fallback
  }

  // Acceptable fallback (+15 points from weight)
  if (
    formatLower.includes('physical') ||
    formatLower.includes('paperback') ||
    formatLower.includes('hardcover')
  ) {
    return 37.5; // 15/40 * 100 = acceptable fallback
  }

  // Last resort (+5 points from weight)
  return 12.5; // 5/40 * 100 = last resort
}

/**
 * Calculate popularity score based on user count
 */
function calculatePopularityScore(usersCount) {
  if (!usersCount || usersCount === 0) return 20; // Low score for no users

  // Logarithmic scale - popular editions get higher scores
  const logUsers = Math.log10(usersCount + 1);

  // Scale to 20-100 range
  const score = Math.min(100, 20 + logUsers * 25);

  return score;
}

/**
 * Calculate completeness score based on available data
 */
function calculateCompletenessScore(edition) {
  let score = 0;
  let factors = 0;

  // Check for important fields
  if (edition.asin) {
    score += 20;
    factors++;
  }
  if (edition.isbn_10 || edition.isbn_13) {
    score += 20;
    factors++;
  }
  if (edition.pages && edition.pages > 0) {
    score += 15;
    factors++;
  }
  if (edition.audio_seconds && edition.audio_seconds > 0) {
    score += 15;
    factors++;
  }
  if (edition.reading_format || edition.physical_format) {
    score += 15;
    factors++;
  }
  if (edition.users_count && edition.users_count > 0) {
    score += 15;
    factors++;
  }

  // Base score for having an edition at all
  if (factors === 0) return 30;

  // Average the scores, with a minimum baseline
  return Math.max(40, (score / factors) * (factors / 6)); // Normalize to 6 total factors
}

/**
 * Helper functions for generating human-readable reasons
 */
function getFormatMatchReason(userFormat, editionFormat) {
  if (!editionFormat) return 'No format information available';

  const formatLower = (editionFormat || '').toLowerCase();

  if (
    userFormat === 'audiobook' &&
    (formatLower.includes('audiobook') || formatLower.includes('listened'))
  ) {
    return 'Perfect audiobook format match';
  }
  if (
    userFormat === 'ebook' &&
    (formatLower.includes('ebook') || formatLower.includes('digital'))
  ) {
    return 'Perfect ebook format match';
  }
  if (
    userFormat === 'audiobook' &&
    (formatLower.includes('ebook') || formatLower.includes('digital'))
  ) {
    return 'Good fallback: ebook edition for audiobook user';
  }
  if (
    userFormat === 'ebook' &&
    (formatLower.includes('audiobook') || formatLower.includes('listened'))
  ) {
    return 'Good fallback: audiobook edition for ebook user';
  }
  if (
    formatLower.includes('physical') ||
    formatLower.includes('paperback') ||
    formatLower.includes('hardcover')
  ) {
    return 'Acceptable fallback: physical edition';
  }

  return `Format mismatch: user has ${userFormat}, edition is ${editionFormat}`;
}

function getPopularityReason(usersCount) {
  if (usersCount >= 10000) return 'extremely popular';
  if (usersCount >= 1000) return 'very popular';
  if (usersCount >= 100) return 'popular';
  if (usersCount >= 10) return 'moderately popular';
  if (usersCount >= 1) return 'some users';
  return 'no users yet';
}

function getDurationMatchReason(userFormat, targetDuration, editionDuration) {
  if (userFormat !== 'audiobook') {
    return 'Duration not relevant for non-audiobook';
  }

  if (!targetDuration) {
    return 'No target duration available';
  }

  if (!editionDuration) {
    return 'Edition duration not available';
  }

  const similarity = calculateDurationSimilarity(
    targetDuration,
    editionDuration,
  );
  if (similarity >= 95) return 'Excellent duration match';
  if (similarity >= 85) return 'Very good duration match';
  if (similarity >= 70) return 'Good duration match';
  if (similarity >= 50) return 'Acceptable duration match';
  return 'Poor duration match';
}

function getCompletenessReason(edition) {
  const hasAsin = !!edition.asin;
  const hasIsbn = !!(edition.isbn_10 || edition.isbn_13);
  const hasPages = !!(edition.pages && edition.pages > 0);
  const hasAudio = !!(edition.audio_seconds && edition.audio_seconds > 0);
  const hasFormat = !!(edition.reading_format || edition.physical_format);
  const hasUsers = !!(edition.users_count && edition.users_count > 0);

  const completeness = [
    hasAsin,
    hasIsbn,
    hasPages,
    hasAudio,
    hasFormat,
    hasUsers,
  ].filter(Boolean).length;

  if (completeness >= 5) return 'Very complete edition data';
  if (completeness >= 4) return 'Good edition data';
  if (completeness >= 3) return 'Decent edition data';
  if (completeness >= 2) return 'Limited edition data';
  return 'Minimal edition data';
}
