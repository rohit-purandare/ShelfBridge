/**
 * Book identifier extraction utilities
 *
 * This module provides functions to extract and normalize book identifiers
 * (ISBN, ASIN) from Audiobookshelf book data.
 */

import logger from '../../logger.js';
import {
  extractIsbn,
  extractAsin,
  extractTitle,
} from './audiobookshelf-extractor.js';
import { normalizeIsbn, normalizeAsin } from './normalization.js';

/**
 * Extract book identifiers from Audiobookshelf book data
 * @param {Object} absBook - Audiobookshelf book object
 * @returns {Object} - Object containing normalized ISBN and ASIN
 */
export function extractBookIdentifiers(absBook) {
  const identifiers = {
    isbn: null,
    asin: null,
  };

  try {
    // Extract ISBN
    const isbn = extractIsbn(absBook);
    if (isbn) {
      const normalizedIsbn = normalizeIsbn(isbn);
      if (normalizedIsbn) {
        identifiers.isbn = normalizedIsbn;
      }
    }

    // Extract ASIN
    const asin = extractAsin(absBook);
    if (asin) {
      const normalizedAsin = normalizeAsin(asin);
      if (normalizedAsin) {
        identifiers.asin = normalizedAsin;
      }
    }

    logger.debug('Extracted book identifiers', {
      title: extractTitle(absBook),
      isbn: identifiers.isbn,
      asin: identifiers.asin,
    });
  } catch (error) {
    logger.error('Error extracting book identifiers', {
      error: error.message,
      title: extractTitle(absBook),
    });
  }

  return identifiers;
}
