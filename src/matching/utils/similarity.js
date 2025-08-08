/**
 * Text and data similarity calculation utilities
 *
 * This module provides various similarity calculation algorithms
 * for comparing book metadata between different sources.
 */

/**
 * Calculate text similarity using multiple algorithms
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Similarity score (0-1)
 */
export function calculateTextSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;

  // Exact match after normalization
  if (str1.toLowerCase().trim() === str2.toLowerCase().trim()) return 1;

  // Levenshtein distance similarity
  const levenshtein = levenshteinSimilarity(str1, str2);

  // Token set similarity (words in common)
  const tokenSet = tokenSetSimilarity(str1, str2);

  // Weighted combination (token set is more forgiving for books)
  return Math.max(levenshtein * 0.4 + tokenSet * 0.6, 0);
}

/**
 * Calculate Levenshtein distance similarity
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Similarity score (0-1)
 */
function levenshteinSimilarity(str1, str2) {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  if (s1.length === 0) return s2.length === 0 ? 1 : 0;
  if (s2.length === 0) return 0;

  const matrix = Array(s2.length + 1)
    .fill()
    .map(() => Array(s1.length + 1).fill(0));

  for (let i = 0; i <= s1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= s2.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= s2.length; j++) {
    for (let i = 1; i <= s1.length; i++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j - 1][i] + 1, // deletion
        matrix[j][i - 1] + 1, // insertion
        matrix[j - 1][i - 1] + cost, // substitution
      );
    }
  }

  const maxLength = Math.max(s1.length, s2.length);
  const distance = matrix[s2.length][s1.length];
  return 1 - distance / maxLength;
}

/**
 * Calculate token set similarity (Jaccard index)
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Similarity score (0-1)
 */
function tokenSetSimilarity(str1, str2) {
  const tokens1 = new Set(
    str1
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(token => token.length > 2),
  );

  const tokens2 = new Set(
    str2
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(token => token.length > 2),
  );

  const intersection = new Set(
    [...tokens1].filter(token => tokens2.has(token)),
  );
  const union = new Set([...tokens1, ...tokens2]);

  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Calculate duration similarity for audiobooks
 * @param {number} duration1 - First duration in seconds
 * @param {number} duration2 - Second duration in seconds
 * @returns {number} - Similarity score (0-100)
 */
export function calculateDurationSimilarity(duration1, duration2) {
  // Handle null/undefined durations
  if (!duration1 || !duration2) return 50; // Neutral score

  // Convert to hours for easier comparison
  const hours1 = duration1 / 3600;
  const hours2 = duration2 / 3600;

  // Calculate percentage difference
  const maxHours = Math.max(hours1, hours2);
  const minHours = Math.min(hours1, hours2);
  const percentageDiff = ((maxHours - minHours) / maxHours) * 100;

  // Convert to similarity score (0-100)
  if (percentageDiff <= 3) return 100; // Within 3% - essentially the same
  if (percentageDiff <= 5) return 95; // Very close
  if (percentageDiff <= 10) return 85; // Close enough
  if (percentageDiff <= 20) return 70; // Somewhat close
  if (percentageDiff <= 30) return 50; // Different but possible
  return 20; // Very different
}
