/**
 * Unified Edition Scorer
 *
 * Comprehensive edition scoring utility that consolidates all edition selection logic.
 * Includes ALL sophisticated features from edition-selector.js:
 * - 5-tier format hierarchy with partial credit
 * - Narrator matching with text similarity (for audiobooks)
 * - Duration similarity scoring (bonus for close matches)
 * - Configurable weight profiles for different contexts
 *
 * This scorer supports multiple use cases:
 * - Auto-add flow (identifier-based and title/author-based)
 * - Cross-edition enhancement (ASIN/ISBN matches)
 * - Edition lookup (by book ID)
 * - Future: Title/author matcher (via TITLE_AUTHOR profile)
 */

import logger from '../../logger.js';
import {
  calculateDurationSimilarity,
  calculateTextSimilarity,
  normalizeNarrator,
} from './text-matching.js';

/**
 * Scoring Profiles
 *
 * Different contexts require different scoring strategies:
 */
export const PROFILES = {
  /**
   * DEFAULT: Simplified scoring for basic edition selection
   * - Used as fallback profile
   * - Balanced weights
   */
  DEFAULT: {
    name: 'DEFAULT',
    weights: {
      format: 0.4, // 40% - format match most important
      lengthData: 0.25, // 25% - having duration/pages data
      popularity: 0.15, // 15% - user count
      completeness: 0.1, // 10% - metadata completeness
      dataScore: 0.1, // 10% - Hardcover data quality score
    },
    minImprovement: 0, // No minimum threshold
    requireLengthData: false, // Don't filter out editions without length
  },

  /**
   * TITLE_AUTHOR: Sophisticated scoring matching edition-selector.js exactly
   * - Used by title/author matcher
   * - Used by auto-add (for consistency)
   * - Includes narrator and duration similarity
   */
  TITLE_AUTHOR: {
    name: 'TITLE_AUTHOR',
    weights: {
      format: 0.4, // 40% - format match
      popularity: 0.2, // 20% - user count
      duration: 0.17, // 17% - duration similarity (audiobooks)
      completeness: 0.13, // 13% - metadata completeness
      dataScore: 0.07, // 7% - Hardcover data quality score
      narrator: 0.03, // 3% - narrator match (audiobooks)
    },
    bonuses: {
      perfectFormat: 3, // +3 for perfect format match (>= 95 score)
      highPopularity: true, // +up to 2 for >= 1000 users (log scale)
    },
    minImprovement: 0, // No minimum threshold
    requireLengthData: false, // Don't filter out editions without length
  },

  /**
   * STRICT: For cross-edition enhancement
   * - Requires significant improvement to upgrade
   * - Used when we already have a match
   */
  STRICT: {
    name: 'STRICT',
    weights: {
      format: 0.4,
      lengthData: 0.25,
      popularity: 0.15,
      completeness: 0.1,
      dataScore: 0.1,
    },
    minImprovement: 5, // Require 5-point improvement to upgrade
    requireLengthData: false,
  },
};

/**
 * Check if edition has valid length data
 *
 * @param {Object} edition - Edition to check
 * @returns {boolean} - True if has positive audio_seconds or pages
 */
export function hasLengthData(edition) {
  if (!edition) return false;
  return !!(
    (edition.audio_seconds && edition.audio_seconds > 0) ||
    (edition.pages && edition.pages > 0)
  );
}

/**
 * Score an edition based on format match, data quality, and popularity
 *
 * @param {Object} edition - Edition object to score
 * @param {Object} context - Scoring context
 * @param {string} context.sourceFormat - Format from source book (audiobook/ebook/etc)
 * @param {number} context.sourceDuration - Duration from source book (seconds)
 * @param {string} context.sourceNarrator - Narrator from source book
 * @param {Object} context.profile - Scoring profile (from PROFILES)
 * @param {Function} context.formatMapper - Optional function to map edition formats
 * @returns {Object} - { edition, score, breakdown }
 */
export function scoreEdition(edition, context = {}) {
  const {
    sourceFormat = null,
    sourceDuration = null,
    sourceNarrator = null,
    profile = PROFILES.DEFAULT,
    formatMapper = null,
  } = context;

  let score = 0;
  const breakdown = {};

  // Apply format mapping if available
  const editionFormat = formatMapper
    ? formatMapper(edition)
    : edition.format || edition.reading_format?.format;

  // ==========================================================================
  // FORMAT MATCHING
  // ==========================================================================

  const formatScore = calculateFormatScore(editionFormat, sourceFormat);
  const formatWeight = profile.weights.format || 0;
  score += formatScore * formatWeight;
  breakdown.format = {
    score: formatScore,
    weight: formatWeight,
    sourceFormat: sourceFormat || 'N/A',
    editionFormat: editionFormat || 'N/A',
  };

  // ==========================================================================
  // LENGTH DATA (for DEFAULT/STRICT profiles)
  // ==========================================================================

  if (profile.weights.lengthData) {
    const lengthScore = calculateLengthDataScore(edition);
    const lengthWeight = profile.weights.lengthData;
    score += lengthScore * lengthWeight;
    breakdown.lengthData = {
      score: lengthScore,
      weight: lengthWeight,
      hasAudio: !!(edition.audio_seconds && edition.audio_seconds > 0),
      hasPages: !!(edition.pages && edition.pages > 0),
    };
  }

  // ==========================================================================
  // DURATION SIMILARITY (for TITLE_AUTHOR profile, audiobooks only)
  // ==========================================================================

  if (profile.weights.duration) {
    const durationScore = calculateDurationScore(
      edition,
      sourceDuration,
      sourceFormat,
    );
    const durationWeight = profile.weights.duration;
    score += durationScore * durationWeight;
    breakdown.duration = {
      score: durationScore,
      weight: durationWeight,
      sourceDuration: sourceDuration
        ? Math.round(sourceDuration / 60) + 'm'
        : 'N/A',
      editionDuration:
        edition.audio_seconds && edition.audio_seconds > 0
          ? Math.round(edition.audio_seconds / 60) + 'm'
          : 'N/A',
    };
  }

  // ==========================================================================
  // POPULARITY
  // ==========================================================================

  const popularityScore = calculatePopularityScore(edition.users_count || 0);
  const popularityWeight = profile.weights.popularity || 0;
  score += popularityScore * popularityWeight;
  breakdown.popularity = {
    score: popularityScore,
    weight: popularityWeight,
    usersCount: edition.users_count || 0,
  };

  // ==========================================================================
  // COMPLETENESS
  // ==========================================================================

  const completenessScore = calculateCompletenessScore(edition);
  const completenessWeight = profile.weights.completeness || 0;
  score += completenessScore * completenessWeight;
  breakdown.completeness = {
    score: completenessScore,
    weight: completenessWeight,
  };

  // ==========================================================================
  // DATA SCORE (Hardcover data quality metric)
  // ==========================================================================

  if (profile.weights.dataScore) {
    const dataScoreValue = calculateDataScore(edition);
    const dataScoreWeight = profile.weights.dataScore;
    score += dataScoreValue * dataScoreWeight;
    breakdown.dataScore = {
      score: dataScoreValue,
      weight: dataScoreWeight,
      value: edition.score || 'N/A',
    };
  }

  // ==========================================================================
  // NARRATOR MATCHING (for TITLE_AUTHOR profile, audiobooks only)
  // ==========================================================================

  if (profile.weights.narrator) {
    const narratorScore = calculateNarratorScore(
      edition,
      sourceNarrator,
      sourceFormat,
    );
    const narratorWeight = profile.weights.narrator;
    score += narratorScore * narratorWeight;
    breakdown.narrator = {
      score: narratorScore,
      weight: narratorWeight,
      sourceNarrator: sourceNarrator || 'N/A',
      editionNarrator: extractNarrator(edition) || 'N/A',
    };
  }

  // ==========================================================================
  // BONUSES (for TITLE_AUTHOR profile)
  // ==========================================================================

  if (profile.bonuses) {
    // Perfect format match bonus
    if (profile.bonuses.perfectFormat && formatScore >= 95) {
      const bonus = profile.bonuses.perfectFormat;
      score += bonus;
      breakdown.perfectFormatBonus = {
        score: bonus,
        reason: 'Perfect format match',
      };
    }

    // High popularity bonus
    if (
      profile.bonuses.highPopularity &&
      edition.users_count &&
      edition.users_count >= 1000
    ) {
      const bonus = Math.min(2, Math.log10(edition.users_count / 1000));
      score += bonus;
      breakdown.popularityBonus = {
        score: bonus,
        reason: `High popularity (${edition.users_count} users)`,
      };
    }
  }

  // ==========================================================================
  // SCORE CAPPING
  // ==========================================================================

  const totalScore = Math.min(100, Math.max(0, score));

  return {
    edition: {
      ...edition,
      format: editionFormat, // Use mapped format
    },
    score: totalScore,
    breakdown,
  };
}

/**
 * Select the best edition from a list based on format match and data quality
 *
 * @param {Array} editions - Array of edition objects
 * @param {Object} context - Scoring context (same as scoreEdition)
 * @param {Object} context.currentEdition - Optional current edition to compare against
 * @returns {Object|null} - { edition, score, breakdown, shouldUpgrade, improvement, alternatives } or null
 */
export function selectBestEdition(editions, context = {}) {
  const { profile = PROFILES.DEFAULT, currentEdition = null } = context;

  // Validate input
  if (!Array.isArray(editions) || editions.length === 0) {
    logger.warn('selectBestEdition: No editions provided', {
      editionsType: typeof editions,
      editionsLength: editions?.length,
      profile: profile.name,
    });
    return null;
  }

  // Filter out malformed editions
  const validEditions = editions.filter(
    edition => edition && typeof edition === 'object',
  );

  if (validEditions.length === 0) {
    logger.debug('selectBestEdition: No valid editions found', {
      totalEditions: editions.length,
      profile: profile.name,
    });
    return null;
  }

  // Optionally filter by length data requirement
  let candidateEditions = validEditions;
  if (profile.requireLengthData) {
    candidateEditions = validEditions.filter(hasLengthData);

    if (candidateEditions.length === 0) {
      logger.debug(
        'selectBestEdition: No editions with length data found (required by profile)',
        {
          totalEditions: validEditions.length,
          profile: profile.name,
        },
      );
      return null;
    }
  }

  // Score all candidate editions
  const scoredEditions = candidateEditions.map(edition =>
    scoreEdition(edition, context),
  );

  // Sort by score descending, with Hardcover score as tie-breaker
  scoredEditions.sort((a, b) => {
    // Primary sort: by overall score
    if (Math.abs(a.score - b.score) > 0.01) {
      return b.score - a.score;
    }

    // Tie-breaker 1: Hardcover score (higher is better)
    const aDataScore = a.edition.score || 0;
    const bDataScore = b.edition.score || 0;
    if (aDataScore !== bDataScore) {
      return bDataScore - aDataScore;
    }

    // Tie-breaker 2: popularity (higher is better)
    const aUsers = a.edition.users_count || 0;
    const bUsers = b.edition.users_count || 0;
    return bUsers - aUsers;
  });

  const bestScoredEdition = scoredEditions[0];

  // Check minimum improvement threshold if we have a current edition
  let shouldUpgrade = true;
  let improvement = 0;

  if (currentEdition && profile.minImprovement > 0) {
    const currentScore = scoreEdition(currentEdition, context).score;
    improvement = bestScoredEdition.score - currentScore;

    if (improvement < profile.minImprovement) {
      logger.debug('selectBestEdition: Best edition not significantly better', {
        currentScore: currentScore.toFixed(2),
        bestScore: bestScoredEdition.score.toFixed(2),
        improvement: improvement.toFixed(2),
        minRequired: profile.minImprovement,
        profile: profile.name,
      });
      shouldUpgrade = false;
      return null; // Not good enough to upgrade
    }
  }

  logger.debug('selectBestEdition: Selected best edition', {
    editionId: bestScoredEdition.edition.id,
    score: bestScoredEdition.score.toFixed(2),
    breakdown: Object.entries(bestScoredEdition.breakdown).reduce(
      (acc, [key, value]) => {
        acc[key] =
          typeof value.score === 'number' ? value.score.toFixed(2) : value;
        return acc;
      },
      {},
    ),
    format: bestScoredEdition.edition.format,
    sourceFormat: context.sourceFormat,
    totalCandidates: editions.length,
    validCandidates: candidateEditions.length,
    profile: profile.name,
  });

  // Also log key selection info at INFO level
  logger.info('Edition selected by unified scorer', {
    editionId: bestScoredEdition.edition.id,
    score: bestScoredEdition.score.toFixed(1),
    formatMatch: `${context.sourceFormat || 'N/A'} → ${bestScoredEdition.edition.format || 'N/A'}`,
    scoringProfile: profile.name,
    totalEditions: editions.length,
    breakdown: {
      format: bestScoredEdition.breakdown.format?.score?.toFixed(1) || 'N/A',
      popularity:
        bestScoredEdition.breakdown.popularity?.score?.toFixed(1) || 'N/A',
      duration:
        bestScoredEdition.breakdown.duration?.score?.toFixed(1) || 'N/A',
      narrator:
        bestScoredEdition.breakdown.narrator?.score?.toFixed(1) || 'N/A',
      completeness:
        bestScoredEdition.breakdown.completeness?.score?.toFixed(1) || 'N/A',
      lengthData:
        bestScoredEdition.breakdown.lengthData?.score?.toFixed(1) || 'N/A',
    },
  });

  return {
    edition: bestScoredEdition.edition,
    score: bestScoredEdition.score,
    breakdown: bestScoredEdition.breakdown,
    shouldUpgrade,
    improvement,
    alternatives: scoredEditions.slice(1, 3).map(se => ({
      edition: se.edition,
      score: se.score,
    })),
  };
}

/**
 * Compare two editions to determine if upgrade is worthwhile
 *
 * @param {Object} currentEdition - Current edition
 * @param {Object} newEdition - New edition to compare
 * @param {Object} context - Scoring context
 * @returns {Object} - { shouldUpgrade, improvement, currentScore, newScore, reason }
 */
export function compareEditions(currentEdition, newEdition, context = {}) {
  if (!currentEdition || !newEdition) {
    return {
      shouldUpgrade: false,
      improvement: 0,
      reason: 'Missing edition for comparison',
    };
  }

  const currentScored = scoreEdition(currentEdition, context);
  const newScored = scoreEdition(newEdition, context);

  const improvement = newScored.score - currentScored.score;
  const minImprovement = context.profile?.minImprovement || 0;

  const shouldUpgrade = improvement >= minImprovement;

  return {
    shouldUpgrade,
    improvement,
    currentScore: currentScored.score,
    newScore: newScored.score,
    reason: shouldUpgrade
      ? `Upgrade recommended (+${improvement.toFixed(1)} points)`
      : `Insufficient improvement (${improvement.toFixed(1)} < ${minImprovement})`,
  };
}

// ============================================================================
// Helper Functions: Format Scoring
// ============================================================================

/**
 * Calculate format matching score with 5-tier hierarchy
 * (Matches edition-selector.js logic exactly)
 */
function calculateFormatScore(editionFormat, sourceFormat) {
  if (!editionFormat || typeof editionFormat !== 'string') {
    return 20; // Penalty for missing format data
  }

  if (!sourceFormat) {
    return 60; // Neutral when no source format to compare
  }

  const formatLower = editionFormat.toLowerCase();
  const sourceLower = sourceFormat.toLowerCase();

  // Perfect match
  if (
    sourceLower === 'audiobook' &&
    (formatLower.includes('audiobook') || formatLower.includes('listened'))
  ) {
    return 100;
  }
  if (
    sourceLower === 'ebook' &&
    (formatLower.includes('ebook') || formatLower.includes('digital'))
  ) {
    return 100;
  }

  // Good fallback (cross-format but both digital)
  if (
    sourceLower === 'audiobook' &&
    (formatLower.includes('ebook') || formatLower.includes('digital'))
  ) {
    return 62.5; // 25/40 * 100
  }
  if (
    sourceLower === 'ebook' &&
    (formatLower.includes('audiobook') || formatLower.includes('listened'))
  ) {
    return 62.5; // 25/40 * 100
  }

  // Acceptable fallback (physical)
  if (
    formatLower.includes('physical') ||
    formatLower.includes('paperback') ||
    formatLower.includes('hardcover') ||
    formatLower.includes('text')
  ) {
    return 37.5; // 15/40 * 100
  }

  // Last resort
  return 12.5; // 5/40 * 100
}

// ============================================================================
// Helper Functions: Length Data Scoring
// ============================================================================

/**
 * Calculate length data completeness score
 * - Both audio_seconds AND pages: 100% (complete)
 * - Either type: 60% (partial)
 * - Neither: 20% (neutral/minimum)
 */
function calculateLengthDataScore(edition) {
  const hasAudio = !!(edition.audio_seconds && edition.audio_seconds > 0);
  const hasPages = !!(edition.pages && edition.pages > 0);

  if (hasAudio && hasPages) {
    return 100; // Complete data
  } else if (hasAudio || hasPages) {
    return 60; // Partial data
  } else {
    return 20; // Minimum/neutral
  }
}

// ============================================================================
// Helper Functions: Duration Similarity Scoring
// ============================================================================

/**
 * Calculate duration similarity score (for audiobooks)
 * (Matches edition-selector.js logic exactly)
 */
function calculateDurationScore(edition, sourceDuration, sourceFormat) {
  const editionDuration = edition.audio_seconds;

  // Not relevant for non-audiobooks
  if (sourceFormat !== 'audiobook') {
    return 60; // Neutral
  }

  // No target duration to compare
  if (!sourceDuration || sourceDuration <= 0) {
    return 50; // Neutral
  }

  // No edition duration available
  if (!editionDuration || editionDuration <= 0) {
    return 30; // Slight penalty for missing duration
  }

  // Calculate similarity using existing utility
  const similarity = calculateDurationSimilarity(
    sourceDuration,
    editionDuration,
  );
  return similarity; // Already 0-100 scale
}

// ============================================================================
// Helper Functions: Popularity Scoring
// ============================================================================

/**
 * Calculate popularity score based on user count
 * (Matches edition-selector.js logic exactly)
 *
 * Uses logarithmic scale to prevent single-edition dominance
 */
function calculatePopularityScore(usersCount) {
  if (!usersCount || usersCount === 0) return 20; // Low score for no users

  // Logarithmic scale - popular editions get higher scores
  const logUsers = Math.log10(usersCount + 1);

  // Scale to 20-100 range
  const score = Math.min(100, 20 + logUsers * 25);

  return score;
}

// ============================================================================
// Helper Functions: Completeness Scoring
// ============================================================================

/**
 * Calculate completeness score based on available metadata
 * (Matches edition-selector.js logic exactly)
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
  if (edition.reading_format || edition.physical_format || edition.format) {
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

// ============================================================================
// Helper Functions: Data Score
// ============================================================================

/**
 * Calculate score based on Hardcover's score field
 * score is Hardcover's internal quality metric (integer, can exceed 100)
 * Higher scores indicate more complete and accurate metadata
 *
 * @param {Object} edition - Edition to score
 * @returns {number} - Normalized score (0-100 for our scoring system)
 */
function calculateDataScore(edition) {
  // If score is not available, return a neutral score
  if (!edition.score && edition.score !== 0) {
    return 50; // Neutral score when unavailable
  }

  // Normalize to 0-100 scale for our scoring system
  // Higher Hardcover scores get mapped to higher normalized scores
  // Using logarithmic scale to handle scores that can exceed 100
  const rawScore = Math.max(0, edition.score);

  // Normalize: scores typically range 0-200+, map to 0-100
  // Use a formula that gives good distribution:
  // score 0 = 0, score 50 = 50, score 100 = 75, score 200+ = 100
  const normalized = Math.min(100, (rawScore / (rawScore + 100)) * 150);

  return normalized;
}

// ============================================================================
// Helper Functions: Narrator Scoring
// ============================================================================

/**
 * Calculate narrator matching score (for audiobooks)
 * (Matches edition-selector.js logic exactly)
 */
function calculateNarratorScore(edition, sourceNarrator, sourceFormat) {
  const editionNarrator = extractNarrator(edition);

  // Not relevant for non-audiobooks
  if (sourceFormat !== 'audiobook') {
    return 60; // Neutral
  }

  // No narrator information available
  if (!sourceNarrator && !editionNarrator) {
    return 50; // Neutral
  }

  // No target narrator to compare
  if (!sourceNarrator) {
    return 40; // Slight penalty
  }

  // No edition narrator available
  if (!editionNarrator) {
    return 30; // Slight penalty
  }

  // Calculate text similarity
  const similarity =
    calculateTextSimilarity(
      normalizeNarrator(sourceNarrator),
      normalizeNarrator(editionNarrator),
    ) * 100;

  return similarity; // 0-100 scale
}

/**
 * Extract narrator from edition object
 * Handles both search result and user book formats
 */
function extractNarrator(edition) {
  if (!edition) return null;

  // Try different narrator field locations
  const narrator =
    edition.narrator ||
    edition.narrators ||
    edition.contributors?.find(c => c.role === 'narrator')?.name ||
    null;

  if (Array.isArray(narrator)) {
    return narrator.join(', ');
  }

  return narrator;
}
