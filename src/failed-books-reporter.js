import fs from 'fs';
import path from 'path';
import { DateTime } from 'luxon';
import logger from './logger.js';

/**
 * Utility class for writing failed books reports to separate log files
 */
export class FailedBooksReporter {
  /**
   * Write failed books report to a timestamped log file
   * @param {Array} failedBooks - Array of failed book objects
   * @param {Object} stats - Statistics about the failed books
   * @returns {string|null} - Path to the created log file, or null if no failed books
   */
  static writeReport(failedBooks, stats = {}) {
    if (!failedBooks || failedBooks.length === 0) {
      logger.debug('No failed books to report');
      return null;
    }

    try {
      // Create logs directory if it doesn't exist
      const logsDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      // Generate timestamped filename
      const timestamp = DateTime.now().toFormat('yyyy-MM-dd_HH-mm-ss');
      const filename = `failed-books-${timestamp}.log`;
      const filepath = path.join(logsDir, filename);

      // Build report content
      const report = this._buildReport(failedBooks, stats);

      // Write to file
      fs.writeFileSync(filepath, report, 'utf-8');

      logger.info(`Failed books report written to: ${filepath}`, {
        totalFailed: failedBooks.length,
        notFound: stats.books_not_found || 0,
        matchRejected: stats.books_match_rejected || 0,
        alreadyInLibrary: stats.books_already_in_library || 0,
      });

      return filepath;
    } catch (error) {
      logger.error('Failed to write failed books report', {
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Build the report content as a formatted string
   * @private
   */
  static _buildReport(failedBooks, stats) {
    const lines = [];

    // Header
    lines.push('='.repeat(80));
    lines.push('SHELFBRIDGE - FAILED BOOKS REPORT');
    lines.push('='.repeat(80));
    lines.push('');
    lines.push(
      `Generated: ${DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss ZZZZ')}`,
    );
    lines.push(`Total Failed Books: ${failedBooks.length}`);
    lines.push('');

    // Summary by category
    lines.push('SUMMARY BY CATEGORY');
    lines.push('-'.repeat(80));
    lines.push(
      `  Not Found in Hardcover:           ${stats.books_not_found || 0}`,
    );
    lines.push(
      `  Match Rejected (Low Confidence):  ${stats.books_match_rejected || 0}`,
    );
    lines.push(
      `  Already in Your Library:          ${stats.books_already_in_library || 0}`,
    );
    lines.push('');

    // Group books by category
    const booksByCategory = {
      NOT_FOUND: failedBooks.filter(b => b.category === 'NOT_FOUND'),
      MATCH_REJECTED: failedBooks.filter(b => b.category === 'MATCH_REJECTED'),
      ALREADY_IN_LIBRARY: failedBooks.filter(
        b => b.category === 'ALREADY_IN_LIBRARY',
      ),
    };

    // Write each category
    this._writeCategorySection(
      lines,
      'NOT FOUND IN HARDCOVER',
      booksByCategory.NOT_FOUND,
      "These books could not be found in Hardcover's database using ISBN, ASIN, or title/author search.",
    );

    this._writeCategorySection(
      lines,
      'MATCH REJECTED (LOW CONFIDENCE)',
      booksByCategory.MATCH_REJECTED,
      'These books had potential matches in Hardcover, but the match confidence was too low to auto-add.',
    );

    this._writeCategorySection(
      lines,
      'ALREADY IN YOUR LIBRARY',
      booksByCategory.ALREADY_IN_LIBRARY,
      'These books already exist in your Hardcover library, but the identifiers (ISBN/ASIN) do not match between Audiobookshelf and Hardcover.',
    );

    // Footer
    lines.push('='.repeat(80));
    lines.push('END OF REPORT');
    lines.push('='.repeat(80));
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Write a category section to the report
   * @private
   */
  static _writeCategorySection(lines, categoryTitle, books, description) {
    if (books.length === 0) {
      return;
    }

    lines.push('='.repeat(80));
    lines.push(`${categoryTitle} (${books.length})`);
    lines.push('='.repeat(80));
    lines.push('');
    lines.push(description);
    lines.push('');

    books.forEach((book, index) => {
      lines.push(`[${index + 1}] ${book.title}`);
      lines.push(`    Author: ${book.author}`);

      // Identifiers
      const identifiers = [];
      if (book.identifiers.isbn)
        identifiers.push(`ISBN: ${book.identifiers.isbn}`);
      if (book.identifiers.isbn10)
        identifiers.push(`ISBN-10: ${book.identifiers.isbn10}`);
      if (book.identifiers.asin)
        identifiers.push(`ASIN: ${book.identifiers.asin}`);

      if (identifiers.length > 0) {
        lines.push(`    Identifiers: ${identifiers.join(', ')}`);
      } else {
        lines.push('    Identifiers: None available');
      }

      // Reason
      lines.push(`    Reason: ${book.reason}`);

      // Suggestions
      if (book.suggestions && book.suggestions.length > 0) {
        lines.push('    Suggested Actions:');
        book.suggestions.forEach(suggestion => {
          lines.push(`      • ${suggestion}`);
        });
      }

      // Additional details (optional)
      if (book.details && Object.keys(book.details).length > 0) {
        const detailsStr = JSON.stringify(book.details, null, 2)
          .split('\n')
          .map(line => `      ${line}`)
          .join('\n');
        lines.push('    Additional Details:');
        lines.push(detailsStr);
      }

      lines.push('');
    });
  }
}
