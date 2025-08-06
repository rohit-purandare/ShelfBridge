/**
 * Debug utility functions
 *
 * This module provides debugging and diagnostic utilities
 * for troubleshooting and development purposes.
 */
import logger from '../logger.js';

/**
 * Dump failed sync books to a file for debugging
 * @param {string} userId - User ID
 * @param {Array} failedBooks - Array of failed book objects
 * @param {string} timestamp - Timestamp for the dump file
 * @returns {Promise<string>} - Path to the dump file
 */
export async function dumpFailedSyncBooks(
  userId,
  failedBooks,
  timestamp = new Date().toISOString().replace(/[:.]/g, '-'),
) {
  if (!failedBooks || failedBooks.length === 0) {
    return null;
  }

  const fs = await import('fs');
  const path = await import('path');

  // Ensure data directory exists
  const dataDir = 'data';
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const filename = `failed-sync-${userId}-${timestamp}.txt`;
  const filepath = path.join(dataDir, filename);

  const output = [];
  output.push(`Failed Sync Books for User: ${userId}`);
  output.push(`Timestamp: ${new Date().toISOString()}`);
  output.push(`Count: ${failedBooks.length}`);
  output.push('='.repeat(80));
  output.push('');

  for (const [index, book] of failedBooks.entries()) {
    output.push(`${index + 1}. ${book.title || 'Unknown Title'}`);
    output.push(`   Author: ${book.author || 'Unknown Author'}`);
    output.push(`   Error: ${book.error || 'Unknown Error'}`);
    output.push(`   Progress: ${book.progress || 0}%`);
    if (book.identifiers) {
      output.push(`   Identifiers: ${JSON.stringify(book.identifiers)}`);
    }
    output.push('');
  }

  fs.writeFileSync(filepath, output.join('\n'), 'utf8');

  logger.info(`Failed sync books dumped to: ${filepath}`, {
    userId,
    failedCount: failedBooks.length,
    filepath,
  });

  return filepath;
}
