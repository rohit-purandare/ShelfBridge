/**
 * Book data normalization utilities
 *
 * This module provides functions to normalize book identifiers and metadata
 * for consistent matching across different sources.
 */

/**
 * Normalize ISBN by removing hyphens and spaces
 * @param {string} isbn - The ISBN to normalize
 * @returns {string|null} - Normalized ISBN or null if invalid
 */
export function normalizeIsbn(isbn) {
  if (!isbn) return null;

  // Remove hyphens, spaces, and convert to uppercase
  const normalized = isbn.replace(/[-\s]/g, '').toUpperCase();

  // Validate ISBN-10 or ISBN-13 format
  if (normalized.length === 10) {
    return normalized;
  } else if (normalized.length === 13) {
    return normalized;
  }

  return null;
}

/**
 * Normalize ASIN by removing spaces and converting to uppercase
 * @param {string} asin - The ASIN to normalize
 * @returns {string|null} - Normalized ASIN or null if invalid
 */
export function normalizeAsin(asin) {
  if (!asin) return null;

  // Remove spaces and convert to uppercase
  const normalized = asin.replace(/\s/g, '').toUpperCase();

  // ASIN should be 10 characters and start with a letter (typically 'B')
  // Real ASINs are not purely numeric
  if (
    normalized.length === 10 &&
    /^[A-Z]/.test(normalized) &&
    !/^\d+$/.test(normalized)
  ) {
    return normalized;
  }

  return null;
}

/**
 * Normalize title for comparison using industry-standard practices
 * @param {string} title - Title to normalize
 * @returns {string} - Normalized title
 */
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

  // Convert standalone roman numerals at word boundaries
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

  // Convert written numbers at word boundaries
  return str.replace(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b/gi,
    match => numberMap[match.toLowerCase()] || match,
  );
}

export function normalizeTitle(title) {
  if (!title) return '';

  return (
    title
      .toLowerCase()
      // Remove leading articles in multiple languages (Library of Congress standard)
      .replace(
        /^(a|an|the|la|le|les|el|los|las|der|die|das|de|het|il|lo|gli|le)\s+/i,
        '',
      )
      // Remove subtitle separators and everything after
      .replace(/[:\-–—]\s*.*/g, '')
      // Remove edition indicators (both parenthetical and suffix)
      .replace(
        /\s*\(?(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|1st|2nd|3rd|4th|5th|6th|7th|8th|9th|10th|\d+(?:st|nd|rd|th)?)\s*(edition|ed\.?|revised|rev\.?|updated|unabridged|abridged|complete|expanded)\)?.*$/i,
        '',
      )
      .replace(
        /\s*\((revised|unabridged|abridged|complete|expanded|updated)\s*(edition|ed\.?)?\).*$/i,
        '',
      )
      // Remove volume/part indicators with number normalization
      .replace(
        /\s*\(?(volume|vol\.?|part|pt\.?|book|bk\.?)\s*(\d+|[ivx]+|one|two|three|four|five|six|seven|eight|nine|ten)\b.*$/i,
        '',
      )
      // Remove standalone volume indicators at the end (more aggressive)
      .replace(
        /\s+(book|part|vol\.?|volume)\s+(one|two|three|four|five|six|seven|eight|nine|ten|\d+|[ivx]+)(\s+.*)?$/i,
        '',
      )
      // Normalize numbers in series titles (convert roman numerals and written numbers)
      .replace(/./g, char => removeAccents(char))
      // Apply number normalization
      .replace(/\s+/g, ' ') // Normalize spaces first
      .trim()
      .split(' ')
      .map(word => {
        word = normalizeRomanNumerals(word);
        word = normalizeWrittenNumbers(word);
        return word;
      })
      .join(' ')
      // Normalize punctuation: remove quotes, apostrophes, and convert dashes to spaces
      .replace(/["''"""]/g, '') // Remove all quote types
      .replace(/['']/g, '') // Remove apostrophes
      .replace(/[-–—]/g, ' ') // Convert all dash types to spaces
      .replace(/[.,;:!?]/g, '') // Remove punctuation
      // Remove remaining special characters except spaces and numbers
      .replace(/[^\w\s\d]/g, '')
      // Replace multiple spaces with single space
      .replace(/\s+/g, ' ')
      // Normalize whitespace
      .trim()
  );
}

/**
 * Remove accents and diacritical marks from text
 * @param {string} str - String to normalize
 * @returns {string} - String without accents
 */
function removeAccents(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normalize author name for comparison using library science standards
 * @param {string} author - Author name to normalize
 * @returns {string} - Normalized author name
 */
export function normalizeAuthor(author) {
  if (!author) return '';

  return (
    author
      .toLowerCase()
      // Remove role descriptors and suffixes (extensive list for international publishing)
      .replace(
        /\s*[-–—]\s*(translator|editor|narrator|contributor|adapted by|foreword by|introduction by|translated by|afterword by|preface by|illustrator|co-author|with|and|et al|illustrated by|compiled by|selected by|retold by)\b.*$/i,
        '',
      )
      // Remove common academic/professional suffixes (AACR2/RDA standard)
      .replace(
        /\s+(jr\.?|sr\.?|iii?|iv|v|vi|vii|viii|ix|x|ph\.?d\.?|m\.?d\.?|esq\.?|b\.?a\.?|m\.?a\.?|m\.?s\.?|d\.?d\.?s\.?|r\.?n\.?|prof\.?|dr\.?)\s*$/i,
        '',
      )
      // Handle corporate authors and "by" prefixes
      .replace(/^(by|written by|authored by|from|from the)\s+/i, '')
      // Remove parenthetical birth/death dates
      .replace(/\s*\(\s*\d{4}\s*[-–—]?\s*\d{0,4}\s*\)/g, '')
      // Handle cultural name particles (von, de, van, etc.) - preserve but normalize
      .replace(
        /\b(von|van|de|del|della|delle|di|da|du|des|le|la|los|las|el|al|ibn|bin|ben|mac|mc|o'|saint|st\.?)\s+/gi,
        match => match.replace(/\s+/g, ' '),
      )
      // Remove accents and diacritical marks
      .replace(/./g, char => removeAccents(char))
      // Normalize punctuation: remove quotes, apostrophes, and convert dashes to spaces
      .replace(/["''"""]/g, '') // Remove all quote types
      .replace(/['']/g, '') // Remove smart quotes/apostrophes
      .replace(/[-–—]/g, ' ') // Convert all dash types to spaces
      .replace(/[.,;:]/g, '') // Remove common punctuation
      // Remove remaining special characters except spaces
      .replace(/[^\w\s]/g, '')
      // Replace multiple spaces with single space and normalize whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Normalize narrator name for comparison
 * @param {string} narrator - Narrator name to normalize
 * @returns {string} - Normalized narrator name
 */
export function normalizeNarrator(narrator) {
  if (!narrator) return '';

  return (
    narrator
      .toLowerCase()
      // Remove narrator role descriptors and prefixes
      .replace(/^(narrated by|read by|voiced by|performed by)\s+/i, '')
      .replace(
        /\s*[-–—]\s*(narrator|narrated by|read by|voiced by|performed by)\b.*$/i,
        '',
      )
      // Remove common suffixes
      .replace(/\s+(jr\.?|sr\.?|iii?|iv|ph\.?d\.?|m\.?d\.?|esq\.?)\s*$/i, '')
      // Remove accents and diacritical marks
      .replace(/./g, char => removeAccents(char))
      // Normalize punctuation: remove quotes, apostrophes, and convert dashes to spaces
      .replace(/["''"""]/g, '') // Remove all quote types
      .replace(/['']/g, '') // Remove apostrophes
      .replace(/[-–—]/g, ' ') // Convert all dash types to spaces
      .replace(/[.,;:]/g, '') // Remove punctuation
      // Remove remaining special characters except spaces
      .replace(/[^\w\s]/g, '')
      // Replace multiple spaces with single space
      .replace(/\s+/g, ' ')
      // Normalize whitespace
      .trim()
  );
}

/**
 * Normalize publisher name for comparison
 * @param {string} publisher - Publisher name to normalize
 * @returns {string} - Normalized publisher name
 */
export function normalizePublisher(publisher) {
  if (!publisher) return '';

  return (
    publisher
      .toLowerCase()
      // Remove common corporate suffixes (order matters - more specific first)
      .replace(
        /\s+(publishing\s+(group|house|company|co\.?)|publishers|books|press|imprint)\s*$/i,
        '',
      )
      .replace(
        /\s+(inc\.?|corp\.?|llc\.?|ltd\.?|limited|company|co\.?|group|publishing)\s*$/i,
        '',
      )
      // Remove accents and diacritical marks
      .replace(/./g, char => removeAccents(char))
      // Normalize punctuation
      .replace(/["''"""]/g, '') // Remove all quote types
      .replace(/['']/g, '') // Remove apostrophes
      .replace(/[-–—]/g, ' ') // Convert all dash types to spaces
      .replace(/[.,;:!?]/g, '') // Remove punctuation
      // Remove remaining special characters except spaces
      .replace(/[^\w\s]/g, '')
      // Replace multiple spaces with single space
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Normalize series name for comparison with advanced number handling
 * @param {string} series - Series name to normalize
 * @returns {string} - Normalized series name
 */
export function normalizeSeries(series) {
  if (!series) return '';

  return (
    series
      .toLowerCase()
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
      // Remove accents and diacritical marks
      .replace(/./g, char => removeAccents(char))
      // Apply number normalization
      .split(' ')
      .map(word => {
        word = normalizeRomanNumerals(word);
        word = normalizeWrittenNumbers(word);
        return word;
      })
      .join(' ')
      // Normalize punctuation
      .replace(/["''"""]/g, '') // Remove all quote types
      .replace(/['']/g, '') // Remove apostrophes
      .replace(/[-–—]/g, ' ') // Convert all dash types to spaces
      .replace(/[.,;:!?]/g, '') // Remove punctuation
      // Remove remaining special characters except spaces and numbers
      .replace(/[^\w\s\d]/g, '')
      // Replace multiple spaces with single space
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Normalize genre/category for comparison
 * @param {string} genre - Genre to normalize
 * @returns {string} - Normalized genre
 */
export function normalizeGenre(genre) {
  if (!genre) return '';

  return (
    genre
      .toLowerCase()
      // Normalize common genre variations
      .replace(/\bsci-fi\b/g, 'science fiction')
      .replace(/\blit fic\b/g, 'literary fiction')
      .replace(/\byoung adult\b/g, 'ya')
      .replace(/\bmiddle grade\b/g, 'mg')
      .replace(/\bnon-fiction\b/g, 'nonfiction')
      .replace(/\bself-help\b/g, 'selfhelp')
      // Remove accents
      .replace(/./g, char => removeAccents(char))
      // Normalize punctuation
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}
