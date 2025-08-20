/**
 * Comprehensive Text Matching Utilities
 *
 * This module consolidates all text processing, normalization, and similarity
 * algorithms into a single source of truth. It replaces the previous
 * normalization.js, similarity.js, and fuzzy-matching.js files.
 *
 * Architecture:
 * 1. Basic text normalization functions
 * 2. Advanced similarity algorithms (Levenshtein, Jaro-Winkler)
 * 3. Domain-specific matching (titles, authors, series)
 * 4. High-level matching API
 */

// ============================================================================
// BASIC NORMALIZATION UTILITIES
// ============================================================================

/**
 * Remove accents and diacritical marks from text
 * @param {string} str - String to normalize
 * @returns {string} - String without accents
 */
function removeAccents(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Convert roman numerals to arabic numbers
 * @param {string} str - String potentially containing roman numerals
 * @returns {string} - String with roman numerals converted to numbers
 */
function normalizeRomanNumerals(str) {
  const romanMap = {
    i: '1',
    ii: '2',
    iii: '3',
    iv: '4',
    v: '5',
    vi: '6',
    vii: '7',
    viii: '8',
    ix: '9',
    x: '10',
    xi: '11',
    xii: '12',
    xiii: '13',
    xiv: '14',
    xv: '15',
    xvi: '16',
    xvii: '17',
    xviii: '18',
    xix: '19',
    xx: '20',
  };

  return str.replace(/\b([ivx]+)\b/g, (match, roman) => {
    const lower = roman.toLowerCase();
    return romanMap[lower] || match;
  });
}

/**
 * Convert written numbers to digits
 * @param {string} str - String potentially containing written numbers
 * @returns {string} - String with written numbers converted to digits
 */
function normalizeWrittenNumbers(str) {
  const numberMap = {
    one: '1',
    two: '2',
    three: '3',
    four: '4',
    five: '5',
    six: '6',
    seven: '7',
    eight: '8',
    nine: '9',
    ten: '10',
    eleven: '11',
    twelve: '12',
    thirteen: '13',
    fourteen: '14',
    fifteen: '15',
    sixteen: '16',
    seventeen: '17',
    eighteen: '18',
    nineteen: '19',
    twenty: '20',
  };

  return str.replace(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b/gi,
    match => numberMap[match.toLowerCase()] || match,
  );
}

/**
 * Basic text normalization for consistent processing
 * @param {string} text - Text to normalize
 * @returns {string} - Normalized text
 */
function basicNormalize(text) {
  if (!text) return '';

  return text
    .toLowerCase()
    .trim()
    .replace(/./g, char => removeAccents(char)) // Remove accents
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

// ============================================================================
// ADVANCED SIMILARITY ALGORITHMS
// ============================================================================

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Minimum number of edits needed
 */
function levenshteinDistance(str1, str2) {
  if (!str1 || !str2) {
    return Math.max(str1?.length || 0, str2?.length || 0);
  }

  const len1 = str1.length;
  const len2 = str2.length;

  if (len1 === 0) return len2;
  if (len2 === 0) return len1;
  if (str1 === str2) return 0;

  const matrix = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;

      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost, // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate normalized Levenshtein similarity (0-1 scale)
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Similarity score between 0 and 1
 */
function levenshteinSimilarity(str1, str2) {
  if (!str1 && !str2) return 1.0;
  if (!str1 || !str2) return 0.0;
  if (str1 === str2) return 1.0;

  const maxLength = Math.max(str1.length, str2.length);
  const distance = levenshteinDistance(str1, str2);

  return 1 - distance / maxLength;
}

/**
 * Calculate Jaro similarity between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Jaro similarity score between 0 and 1
 */
function jaroSimilarity(str1, str2) {
  if (!str1 && !str2) return 1.0;
  if (!str1 || !str2) return 0.0;
  if (str1 === str2) return 1.0;

  const len1 = str1.length;
  const len2 = str2.length;

  const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
  if (matchWindow < 0) return 0.0;

  const str1Matches = new Array(len1).fill(false);
  const str2Matches = new Array(len2).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matches
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, len2);

    for (let j = start; j < end; j++) {
      if (str2Matches[j] || str1[i] !== str2[j]) continue;

      str1Matches[i] = true;
      str2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  // Count transpositions
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!str1Matches[i]) continue;

    while (!str2Matches[k]) k++;

    if (str1[i] !== str2[k]) transpositions++;
    k++;
  }

  return (
    (matches / len1 +
      matches / len2 +
      (matches - transpositions / 2) / matches) /
    3
  );
}

/**
 * Calculate Jaro-Winkler similarity with prefix bonus
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @param {number} prefixScale - Scaling factor for prefix bonus (default: 0.1)
 * @returns {number} - Jaro-Winkler similarity score between 0 and 1
 */
function jaroWinklerSimilarity(str1, str2, prefixScale = 0.1) {
  if (!str1 && !str2) return 1.0;
  if (!str1 || !str2) return 0.0;

  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  const jaroSim = jaroSimilarity(s1, s2);

  if (jaroSim < 0.7) return jaroSim;

  let prefixLength = 0;
  const maxPrefix = Math.min(4, Math.min(s1.length, s2.length));

  for (let i = 0; i < maxPrefix; i++) {
    if (s1[i] === s2[i]) {
      prefixLength++;
    } else {
      break;
    }
  }

  return jaroSim + prefixLength * prefixScale * (1 - jaroSim);
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

// ============================================================================
// DOMAIN-SPECIFIC NORMALIZATION
// ============================================================================

/**
 * Normalize title for matching
 * @param {string} title - Title to normalize
 * @returns {string} - Normalized title
 */
export function normalizeTitle(title) {
  if (!title) return '';

  return (
    title
      .toLowerCase()
      .trim()
      // Remove leading articles in multiple languages
      .replace(
        /^(a|an|the|la|le|les|el|los|las|der|die|das|de|het|il|lo|gli|le)\s+/i,
        '',
      )
      // Remove edition indicators first
      .replace(
        /\s*\(?(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|1st|2nd|3rd|4th|5th|6th|7th|8th|9th|10th|\d+(?:st|nd|rd|th)?)\s*(edition|ed\.?|revised|rev\.?|updated|unabridged|abridged|complete|expanded)\)?.*$/i,
        '',
      )
      // Remove parenthetical content
      .replace(/\s*\([^)]*\)/g, '')
      // Remove volume/part indicators with number normalization
      .replace(
        /\s*\(?(volume|vol\.?|part|pt\.?|book|bk\.?)\s*(\d+|[ivx]+|one|two|three|four|five|six|seven|eight|nine|ten)\b.*$/i,
        '',
      )
      // Apply number normalization
      .split(' ')
      .map(word => {
        word = normalizeRomanNumerals(word);
        word = normalizeWrittenNumbers(word);
        return word;
      })
      .join(' ')
      // Remove accents
      .replace(/./g, char => removeAccents(char))
      // Clean punctuation and normalize spaces
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Normalize author for matching
 * @param {string} author - Author name to normalize
 * @returns {string} - Normalized author name
 */
export function normalizeAuthor(author) {
  if (!author) return '';

  return (
    author
      .toLowerCase()
      .trim()
      // Remove role descriptors and suffixes
      .replace(
        /\s*[-–—]\s*(translator|editor|narrator|contributor|adapted by|foreword by|introduction by|translated by|afterword by|preface by|illustrator|co-author|with|and|et al|illustrated by|compiled by|selected by|retold by)\b.*$/i,
        '',
      )
      // Remove academic/professional suffixes
      .replace(
        /\s+(jr\.?|sr\.?|iii?|iv|v|vi|vii|viii|ix|x|ph\.?d\.?|m\.?d\.?|esq\.?|b\.?a\.?|m\.?a\.?|m\.?s\.?|d\.?d\.?s\.?|r\.?n\.?|prof\.?|dr\.?)\s*$/i,
        '',
      )
      // Handle corporate authors and "by" prefixes
      .replace(/^(by|written by|authored by|from|from the)\s+/i, '')
      // Remove parenthetical birth/death dates
      .replace(/\s*\(\s*\d{4}\s*[-–—]?\s*\d{0,4}\s*\)/g, '')
      // Remove accents
      .replace(/./g, char => removeAccents(char))
      // Clean punctuation and normalize spaces
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Normalize narrator name
 * Handles narrator name variations and formatting
 * @param {string} narrator - Narrator name to normalize
 * @returns {string} - Normalized narrator name
 */
export function normalizeNarrator(narrator) {
  if (!narrator || typeof narrator !== 'string') {
    return '';
  }

  return normalizeAuthor(narrator); // Use same logic as author normalization
}

/**
 * Normalize series name for matching
 * @param {string} series - Series name to normalize
 * @returns {string} - Normalized series name
 */
export function normalizeSeries(series) {
  if (!series) return '';

  return (
    series
      .toLowerCase()
      .trim()
      // Remove leading articles
      .replace(
        /^(a|an|the|la|le|les|el|los|las|der|die|das|de|het|il|lo|gli|le)\s+/i,
        '',
      )
      // Remove series indicators and numbering
      .replace(
        /\s*(series|saga|cycle|trilogy|quartet|chronicles|collection|anthology)\s*$/i,
        '',
      )
      // Remove book/volume numbers at the end
      .replace(
        /\s*(book|vol\.?|volume|part|pt\.?)\s*(\d+|[ivx]+|one|two|three|four|five|six|seven|eight|nine|ten).*$/i,
        '',
      )
      // Apply number normalization
      .split(' ')
      .map(word => {
        word = normalizeRomanNumerals(word);
        word = normalizeWrittenNumbers(word);
        return word;
      })
      .join(' ')
      // Remove accents
      .replace(/./g, char => removeAccents(char))
      // Clean punctuation and normalize spaces
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

// ============================================================================
// ADVANCED FUZZY MATCHING
// ============================================================================

/**
 * Enhanced fuzzy string matching with multiple algorithms
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @param {Object} options - Configuration options
 * @returns {number} - Combined similarity score between 0 and 1
 */
function fuzzyStringMatch(str1, str2, options = {}) {
  const {
    levenshteinWeight = 0.4,
    jaroWinklerWeight = 0.6,
    caseSensitive = false,
    trimWhitespace = true,
  } = options;

  if (!str1 && !str2) return 1.0;
  if (!str1 || !str2) return 0.0;

  let s1 = str1;
  let s2 = str2;

  if (trimWhitespace) {
    s1 = s1.trim();
    s2 = s2.trim();
  }

  if (!caseSensitive) {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();
  }

  if (s1 === s2) return 1.0;

  const levenshteinSim = levenshteinSimilarity(s1, s2);
  const jaroWinklerSim = jaroWinklerSimilarity(s1, s2);

  return (
    levenshteinSim * levenshteinWeight + jaroWinklerSim * jaroWinklerWeight
  );
}

/**
 * Specialized fuzzy matching for author names
 * @param {string} author1 - First author string
 * @param {string} author2 - Second author string
 * @returns {number} - Author similarity score between 0 and 1
 */
function fuzzyAuthorMatch(author1, author2) {
  if (!author1 && !author2) return 1.0;
  if (!author1 || !author2) return 0.0;

  const norm1 = basicNormalize(author1);
  const norm2 = basicNormalize(author2);

  // Calculate standard fuzzy match
  const standardMatch = fuzzyStringMatch(norm1, norm2, {
    levenshteinWeight: 0.3,
    jaroWinklerWeight: 0.7,
  });

  // Try name reordering for "Smith, John" vs "John Smith"
  const words1 = norm1.split(/\s+/).filter(w => w.length > 0);
  const words2 = norm2.split(/\s+/).filter(w => w.length > 0);

  let reorderedMatch = 0;
  if (words1.length >= 2 && words2.length >= 2) {
    const reversed1 = words1.slice().reverse().join(' ');
    const reversed2 = words2.slice().reverse().join(' ');

    const reverseMatch1 = fuzzyStringMatch(reversed1, norm2, {
      levenshteinWeight: 0.3,
      jaroWinklerWeight: 0.7,
    });

    const reverseMatch2 = fuzzyStringMatch(norm1, reversed2, {
      levenshteinWeight: 0.3,
      jaroWinklerWeight: 0.7,
    });

    reorderedMatch = Math.max(reverseMatch1, reverseMatch2);
  }

  return Math.max(standardMatch, reorderedMatch);
}

/**
 * Specialized fuzzy matching for book titles
 * @param {string} title1 - First title string
 * @param {string} title2 - Second title string
 * @returns {number} - Title similarity score between 0 and 1
 */
function fuzzyTitleMatch(title1, title2) {
  if (!title1 && !title2) return 1.0;
  if (!title1 || !title2) return 0.0;

  // Use lighter normalization that preserves subtitle content
  const normalize = str =>
    str
      .toLowerCase()
      .trim()
      .replace(
        /^(a|an|the|la|le|les|el|los|las|der|die|das|de|het|il|lo|gli|le)\s+/i,
        '',
      )
      .replace(/\s*\([^)]*\)/g, '')
      .replace(/[:\-–—]/g, ' ')
      .replace(/[^\w\s']/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const norm1 = normalize(title1);
  const norm2 = normalize(title2);

  return fuzzyStringMatch(norm1, norm2, {
    levenshteinWeight: 0.6,
    jaroWinklerWeight: 0.4,
  });
}

/**
 * Fuzzy matching for series names
 * @param {string} series1 - First series string
 * @param {string} series2 - Second series string
 * @returns {number} - Series similarity score between 0 and 1
 */
function fuzzySeriesMatch(series1, series2) {
  if (!series1 && !series2) return 1.0;
  if (!series1 || !series2) return 0.0;

  const norm1 = basicNormalize(series1);
  const norm2 = basicNormalize(series2);

  return fuzzyStringMatch(norm1, norm2, {
    levenshteinWeight: 0.5,
    jaroWinklerWeight: 0.5,
  });
}

// ============================================================================
// HIGH-LEVEL MATCHING API
// ============================================================================

/**
 * Calculate text similarity using appropriate algorithm based on content type
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @param {string} type - Type of text ('title', 'author', 'series', 'general')
 * @returns {number} - Similarity score (0-1)
 */
export function calculateTextSimilarity(str1, str2, type = 'general') {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;

  switch (type) {
    case 'title':
      return fuzzyTitleMatch(str1, str2);
    case 'author':
      return fuzzyAuthorMatch(str1, str2);
    case 'series':
      return fuzzySeriesMatch(str1, str2);
    case 'general':
    default: {
      const fuzzyScore = fuzzyStringMatch(str1, str2);
      const tokenScore = tokenSetSimilarity(str1, str2);
      return Math.max(fuzzyScore * 0.7 + tokenScore * 0.3, 0);
    }
  }
}

/**
 * Calculate duration similarity for audiobooks
 * @param {number} duration1 - First duration in seconds
 * @param {number} duration2 - Second duration in seconds
 * @returns {number} - Similarity score (0-100)
 */
export function calculateDurationSimilarity(duration1, duration2) {
  if (!duration1 || !duration2) return 50;

  const hours1 = duration1 / 3600;
  const hours2 = duration2 / 3600;

  const maxHours = Math.max(hours1, hours2);
  const minHours = Math.min(hours1, hours2);
  const percentageDiff = ((maxHours - minHours) / maxHours) * 100;

  if (percentageDiff <= 3) return 100;
  if (percentageDiff <= 5) return 95;
  if (percentageDiff <= 10) return 85;
  if (percentageDiff <= 20) return 70;
  if (percentageDiff <= 30) return 50;
  return 20;
}

// ============================================================================
// LEGACY COMPATIBILITY (for gradual migration)
// ============================================================================

// Export individual algorithms for direct use if needed
export {
  levenshteinDistance,
  levenshteinSimilarity,
  jaroSimilarity,
  jaroWinklerSimilarity,
  fuzzyStringMatch,
  fuzzyAuthorMatch,
  fuzzyTitleMatch,
  fuzzySeriesMatch,
};

// Export normalization functions for existing ISBN/ASIN processing
export function normalizeIsbn(isbn) {
  if (!isbn) return null;
  const normalized = isbn.replace(/[-\s]/g, '').toUpperCase();
  if (normalized.length === 10 || normalized.length === 13) {
    return normalized;
  }
  return null;
}

export function normalizeAsin(asin) {
  if (!asin) return null;
  const normalized = asin.replace(/\s/g, '').toUpperCase();
  if (
    normalized.length === 10 &&
    /^[A-Z]/.test(normalized) &&
    !/^\d+$/.test(normalized)
  ) {
    return normalized;
  }
  return null;
}
