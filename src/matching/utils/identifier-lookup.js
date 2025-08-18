/**
 * Identifier lookup utilities
 *
 * This module provides functions to create lookup tables for book matching
 * based on identifiers (ISBN, ASIN) from user library data.
 */

import { normalizeIsbn, normalizeAsin } from './text-matching.js';

/**
 * Create identifier lookup table from Hardcover user library
 * @param {Array} hardcoverBooks - Array of user books from Hardcover
 * @param {Function} formatMapper - Function to map edition formats (optional)
 * @returns {Object} - Lookup table mapping identifiers to book/edition pairs
 */
export function createIdentifierLookup(hardcoverBooks, formatMapper = null) {
  const lookup = {};

  for (const userBook of hardcoverBooks) {
    const book = userBook.book;
    if (!book || !book.editions) continue;

    for (const edition of book.editions) {
      // Apply format mapping if provided
      const editionWithFormat = formatMapper
        ? {
            ...edition,
            format: formatMapper(edition),
          }
        : edition;

      // Add ISBN-10
      if (edition.isbn_10) {
        const normalizedIsbn = normalizeIsbn(edition.isbn_10);
        if (normalizedIsbn) {
          lookup[normalizedIsbn] = { userBook, edition: editionWithFormat };
        }
      }

      // Add ISBN-13
      if (edition.isbn_13) {
        const normalizedIsbn = normalizeIsbn(edition.isbn_13);
        if (normalizedIsbn) {
          lookup[normalizedIsbn] = { userBook, edition: editionWithFormat };
        }
      }

      // Add ASIN
      if (edition.asin) {
        const normalizedAsin = normalizeAsin(edition.asin);
        if (normalizedAsin) {
          lookup[normalizedAsin] = { userBook, edition: editionWithFormat };
        }
      }
    }
  }

  return lookup;
}
