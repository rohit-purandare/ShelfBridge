import { BaseCommand } from '../BaseCommand.js';
import { BookCache } from '../../book-cache.js';
import logger from '../../logger.js';

/**
 * Cache command - manages cache operations
 */
export class CacheCommand extends BaseCommand {
  constructor(registerCleanupFn) {
    super('cache', 'Manage cache');
    this.registerCleanup = registerCleanupFn;
  }

  addOptions(command) {
    command
      .option('--clear', 'Clear entire cache')
      .option('--stats', 'Show cache statistics')
      .option('--show', 'Show detailed cache contents')
      .option('--export <filename>', 'Export cache to JSON file')
      .option('--delete-title <title>', 'Delete cached book by title')
      .option(
        '--delete-edition <editionId>',
        'Delete cached book by edition ID',
      );
  }

  async execute(options) {
    const cache = new BookCache();

    // Register cleanup for unexpected termination
    const unregister = this.registerCleanup(() => cache.close());

    try {
      // Skip validation for cache operations (they don't need API access)

      if (options.clear) {
        await cache.clearCache();
        logger.info('Cache cleared successfully');
      } else if (options.deleteTitle) {
        const deleted = await cache.deleteByTitle(options.deleteTitle);
        if (deleted > 0) {
          console.log(
            `Successfully deleted ${deleted} book(s) with title "${options.deleteTitle}"`,
          );
        } else {
          console.log(`No books found with title "${options.deleteTitle}"`);
        }
      } else if (options.deleteEdition) {
        const editionId = parseInt(options.deleteEdition, 10);
        if (isNaN(editionId)) {
          console.log('Error: Edition ID must be a number');
          return;
        }
        const deleted = await cache.deleteByEdition(editionId);
        if (deleted > 0) {
          console.log(
            `Successfully deleted ${deleted} book(s) with edition ID ${editionId}`,
          );
        } else {
          console.log(`No books found with edition ID ${editionId}`);
        }
      } else if (options.stats) {
        await this.showCacheStats(cache);
      } else if (options.show) {
        await this.showCacheContents(cache);
      } else if (options.export) {
        await cache.exportToJson(options.export);
      } else {
        console.log(
          'Use --clear, --stats, --show, --delete-title, --delete-edition, or --export to manage cache',
        );
      }
    } catch (error) {
      logger.error('Cache operation failed', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    } finally {
      // Always close the database connection
      cache.close();
      unregister(); // Unregister the cleanup function
    }
  }

  async showCacheStats(cache) {
    const stats = await cache.getCacheStats();

    console.log('=== Cache Statistics ===');
    console.log(`Total books: ${stats.total_books}`);
    console.log(`Recent books (last 7 days): ${stats.recent_books}`);
    console.log(`Cache size: ${stats.cache_size_mb} MB`);

    // Show title/author cached entries
    await cache.init();
    const titleAuthorCount = cache.db
      .prepare(
        `
        SELECT COUNT(*) as count 
        FROM books 
        WHERE identifier_type = 'title_author'
      `,
      )
      .get();
    console.log(`Title/author matches cached: ${titleAuthorCount.count}`);
  }

  async showCacheContents(cache) {
    const stats = await cache.getCacheStats();
    console.log('=== Cache Contents ===');
    console.log(`Total books: ${stats.total_books}`);
    console.log('');

    // Initialize the cache to access the database directly
    await cache.init();

    // Get all books ordered by most recent
    const stmt = cache.db.prepare(
      'SELECT * FROM books ORDER BY updated_at DESC',
    );
    const books = stmt.all();

    if (books.length === 0) {
      console.log('No books in cache');
    } else {
      books.forEach((book, index) => {
        console.log(`${index + 1}. ${book.title}`);
        console.log(`   User: ${book.user_id}`);
        console.log(
          `   ${book.identifier_type.toUpperCase()}: ${book.identifier}`,
        );
        console.log(`   Edition ID: ${book.edition_id}`);
        console.log(`   Progress: ${book.progress_percent}%`);
        console.log(`   Author: ${book.author || 'Unknown'}`);
        console.log(`   Last Sync: ${book.last_sync}`);
        console.log(`   Started At: ${book.started_at || 'Not set'}`);
        console.log(`   Last Listened: ${book.last_listened_at || 'Not set'}`);
        console.log('');
      });
    }
  }
}
