/**
 * Hardcover data extraction utilities
 *
 * This module provides functions to extract book metadata
 * from Hardcover search results and book objects.
 */

/**
 * Extract author from Hardcover search result, optionally finding best match for target author
 * @param {Object} searchResult - Hardcover search result
 * @param {string} targetAuthor - Optional target author to find best match for
 * @returns {string} - Author name
 */
export function extractAuthorFromSearchResult(
  searchResult,
  targetAuthor = null,
) {
  let availableAuthors = [];

  // Priority 1: Edition-level contributions (most specific for different editions)
  if (searchResult.contributions && searchResult.contributions.length > 0) {
    const authorContribs = searchResult.contributions.filter(
      c =>
        c.role === 'author' ||
        c.role === 'Author' ||
        !c.role || // Default to author if no role specified
        c.role.toLowerCase().includes('author'),
    );

    if (authorContribs.length > 0) {
      availableAuthors = authorContribs.map(c => c.person.name);
    }
  }

  // Priority 2: Book-level authors (fallback)
  if (
    availableAuthors.length === 0 &&
    searchResult.book &&
    searchResult.book.contributions &&
    searchResult.book.contributions.length > 0
  ) {
    const authorContribs = searchResult.book.contributions.filter(
      c =>
        c.role === 'author' ||
        c.role === 'Author' ||
        !c.role ||
        c.role.toLowerCase().includes('author'),
    );

    if (authorContribs.length > 0) {
      availableAuthors = authorContribs.map(c => c.person.name);
    }
  }

  // Priority 3: Direct author field (fallback for older data)
  if (availableAuthors.length === 0 && searchResult.author) {
    availableAuthors = [searchResult.author];
  }

  if (availableAuthors.length === 0) {
    return null;
  }

  // If we have a target author, find the best match
  if (targetAuthor && availableAuthors.length > 1) {
    let bestMatch = availableAuthors[0];
    let bestSimilarity = 0;

    for (const author of availableAuthors) {
      // Simple similarity check - could be enhanced with text similarity algorithm
      const similarity = calculateSimpleStringSimilarity(
        targetAuthor.toLowerCase(),
        author.toLowerCase(),
      );
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = author;
      }
    }

    return bestMatch;
  }

  // Return first author or join multiple authors
  return availableAuthors.length === 1
    ? availableAuthors[0]
    : availableAuthors.join(', ');
}

/**
 * Extract narrator from Hardcover search result
 * @param {Object} searchResult - Hardcover search result
 * @returns {string|null} - Narrator name or null
 */
export function extractNarratorFromSearchResult(searchResult) {
  let availableNarrators = [];

  // Priority 1: Edition-level contributions
  if (searchResult.contributions && searchResult.contributions.length > 0) {
    const narratorContribs = searchResult.contributions.filter(
      c =>
        c.role === 'narrator' ||
        c.role === 'Narrator' ||
        c.role?.toLowerCase().includes('narrator') ||
        c.role?.toLowerCase().includes('voice'),
    );

    if (narratorContribs.length > 0) {
      availableNarrators = narratorContribs.map(c => c.person.name);
    }
  }

  // Priority 2: Book-level contributions (fallback)
  if (
    availableNarrators.length === 0 &&
    searchResult.book &&
    searchResult.book.contributions &&
    searchResult.book.contributions.length > 0
  ) {
    const narratorContribs = searchResult.book.contributions.filter(
      c =>
        c.role === 'narrator' ||
        c.role === 'Narrator' ||
        c.role?.toLowerCase().includes('narrator') ||
        c.role?.toLowerCase().includes('voice'),
    );

    if (narratorContribs.length > 0) {
      availableNarrators = narratorContribs.map(c => c.person.name);
    }
  }

  if (availableNarrators.length === 0) {
    return null;
  }

  return availableNarrators.length === 1
    ? availableNarrators[0]
    : availableNarrators.join(', ');
}

/**
 * Extract format from Hardcover search result
 * @param {Object} searchResult - Hardcover search result
 * @returns {string} - Format string
 */
export function extractFormatFromSearchResult(searchResult) {
  // Try different format fields
  if (searchResult.format) {
    return searchResult.format;
  }

  if (searchResult.reading_format) {
    return searchResult.reading_format;
  }

  if (searchResult.book && searchResult.book.format) {
    return searchResult.book.format;
  }

  // Check if it's an audiobook based on contributions
  if (searchResult.contributions) {
    const hasNarrator = searchResult.contributions.some(
      c =>
        c.role === 'narrator' ||
        c.role === 'Narrator' ||
        c.role?.toLowerCase().includes('narrator'),
    );
    if (hasNarrator) {
      return 'audiobook';
    }
  }

  return 'unknown';
}

/**
 * Extract activity score from Hardcover search result
 * @param {Object} searchResult - Hardcover search result
 * @returns {number} - Activity score
 */
export function extractActivityFromSearchResult(searchResult) {
  // Try different activity fields
  if (searchResult.activity !== undefined) {
    return Number(searchResult.activity) || 0;
  }

  if (searchResult.popularity !== undefined) {
    return Number(searchResult.popularity) || 0;
  }

  if (searchResult.rating_count !== undefined) {
    return Number(searchResult.rating_count) || 0;
  }

  // Check book-level activity
  if (searchResult.book) {
    if (searchResult.book.activity !== undefined) {
      return Number(searchResult.book.activity) || 0;
    }

    if (searchResult.book.popularity !== undefined) {
      return Number(searchResult.book.popularity) || 0;
    }

    if (searchResult.book.rating_count !== undefined) {
      return Number(searchResult.book.rating_count) || 0;
    }
  }

  return 0;
}

/**
 * Extract audio duration from Hardcover search result
 * @param {Object} searchResult - Hardcover search result
 * @returns {number|null} - Duration in seconds or null
 */
export function extractAudioDurationFromSearchResult(searchResult) {
  // Try different duration fields
  const durationFields = ['duration', 'length', 'runtime', 'duration_seconds'];

  for (const field of durationFields) {
    if (searchResult[field] && typeof searchResult[field] === 'number') {
      return searchResult[field];
    }
  }

  // Check if duration is in string format (e.g., "10h 30m")
  if (searchResult.duration && typeof searchResult.duration === 'string') {
    return parseDurationString(searchResult.duration);
  }

  return null;
}

/**
 * Parse duration string like "10h 30m" to seconds
 * @param {string} durationStr - Duration string
 * @returns {number|null} - Duration in seconds or null
 */
function parseDurationString(durationStr) {
  if (!durationStr) return null;

  const hourMatch = durationStr.match(/(\d+)h/);
  const minuteMatch = durationStr.match(/(\d+)m/);
  const secondMatch = durationStr.match(/(\d+)s/);

  let totalSeconds = 0;

  if (hourMatch) {
    totalSeconds += parseInt(hourMatch[1]) * 3600;
  }
  if (minuteMatch) {
    totalSeconds += parseInt(minuteMatch[1]) * 60;
  }
  if (secondMatch) {
    totalSeconds += parseInt(secondMatch[1]);
  }

  return totalSeconds > 0 ? totalSeconds : null;
}

/**
 * Simple string similarity calculation
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Similarity score (0-1)
 */
function calculateSimpleStringSimilarity(str1, str2) {
  if (str1 === str2) return 1;

  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Edit distance
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1, // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}
