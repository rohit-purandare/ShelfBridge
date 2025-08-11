import { BaseCommand } from '../BaseCommand.js';
import { AudiobookshelfClient } from '../../audiobookshelf-client.js';
import { HardcoverClient } from '../../hardcover-client.js';
import { BookCache } from '../../book-cache.js';
import { Semaphore } from '../../utils/concurrency.js';
import { formatWelcomeMessage } from '../../utils/github-helper.js';
import { currentVersion } from '../../version.js';
import inquirer from 'inquirer';
import cronstrue from 'cronstrue';

/**
 * Interactive mode command
 * Provides a menu-driven interface for all ShelfBridge operations
 */
export class InteractiveCommand extends BaseCommand {
  constructor(syncUserFn, registerCleanupFn) {
    super('interactive', 'Start in interactive mode');
    this.syncUser = syncUserFn;
    this.registerCleanup = registerCleanupFn;
  }

  async execute(options) {
    // Show welcome message
    console.log(formatWelcomeMessage(currentVersion));

    // Validate configuration first
    await this.validateConfiguration(this.shouldSkipValidation());

    await this.runInteractiveMode();
  }

  async runInteractiveMode() {
    const { config, globalConfig, users } = this.getConfiguration();
    let exit = false;
    
    while (!exit) {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'Interactive mode - choose an option:',
          choices: [
            { name: 'Sync all users', value: 'sync_all' },
            { name: 'Sync specific user', value: 'sync_user' },
            { name: 'Test connections', value: 'test_connections' },
            { name: 'Show configuration', value: 'show_config' },
            { name: 'Manage cache', value: 'cache' },
            { name: 'Exit', value: 'exit' },
          ],
        },
      ]);

      switch (action) {
        case 'sync_all':
          await this.handleSyncAll(users, globalConfig);
          break;
        case 'sync_user':
          await this.handleSyncUser(config, users, globalConfig);
          break;
        case 'test_connections':
          await this.handleTestConnections(users);
          break;
        case 'show_config':
          await this.handleShowConfig(config, globalConfig, users);
          break;
        case 'cache':
          await this.handleCacheManagement();
          break;
        case 'exit':
          exit = true;
          break;
      }
    }
  }

  async handleSyncAll(users, globalConfig) {
    if (globalConfig.parallel) {
      const workers = globalConfig.workers || 3;
      console.log(
        `\n🔄 Syncing all users in parallel with ${workers} workers...`
      );
      const semaphore = new Semaphore(workers);
      await Promise.all(
        users.map(async user => {
          await semaphore.acquire();
          try {
            console.log(`\n=== Syncing user: ${user.id} ===`);
            await this.syncUser(user, globalConfig, this.isVerbose());
          } finally {
            semaphore.release();
          }
        })
      );
    } else {
      for (const user of users) {
        console.log(`\n=== Syncing user: ${user.id} ===`);
        await this.syncUser(user, globalConfig, this.isVerbose());
      }
    }
  }

  async handleSyncUser(config, users, globalConfig) {
    const { userId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'userId',
        message: 'Select user to sync:',
        choices: users.map(u => ({ name: u.id, value: u.id })),
      },
    ]);
    const user = config.getUser(userId);
    await this.syncUser(user, globalConfig, this.isVerbose());
  }

  async handleTestConnections(users) {
    for (const user of users) {
      // Clean, user-friendly output for interactive mode
      process.stdout.write(
        `\n=== Testing connections for user: ${user.id} ===\n`
      );
      let absStatus = false;
      let hcStatus = false;
      
      try {
        const absClient = new AudiobookshelfClient(
          user.abs_url,
          user.abs_token,
          1,
          null,
          100
        );
        absStatus = await absClient.testConnection();
        process.stdout.write(
          `Audiobookshelf: ${absStatus ? '✅ Connected' : '❌ Failed'}\n`
        );
      } catch (e) {
        process.stdout.write(`Audiobookshelf: ❌ Error - ${e.message}\n`);
      }
      
      try {
        const hcClient = new HardcoverClient(user.hardcover_token);
        hcStatus = await hcClient.testConnection();
        process.stdout.write(
          `Hardcover: ${hcStatus ? '✅ Connected' : '❌ Failed'}\n`
        );
      } catch (e) {
        process.stdout.write(`Hardcover: ❌ Error - ${e.message}\n`);
      }
      
      if (absStatus && hcStatus) {
        process.stdout.write('All connections successful!\n');
      } else {
        process.stdout.write('One or more connections failed.\n');
      }
    }
  }

  async handleShowConfig(config, globalConfig, users) {
    // Clean, user-friendly output for interactive mode
    process.stdout.write('\n=== Configuration Status ===\n');
    process.stdout.write(`\nGlobal Settings:\n`);

    // Core Sync Settings
    process.stdout.write(`\n📊 Core Sync Settings:\n`);
    process.stdout.write(
      `  Min Progress Threshold: ${globalConfig.min_progress_threshold}%${config.isExplicitlySet('min_progress_threshold') ? '' : ' (default)'}\n`
    );
    process.stdout.write(
      `  Workers: ${globalConfig.workers}${config.isExplicitlySet('workers') ? '' : ' (default)'}\n`
    );
    process.stdout.write(
      `  Parallel Processing: ${globalConfig.parallel ? 'ON' : 'OFF'}${config.isExplicitlySet('parallel') ? '' : ' (default)'}\n`
    );
    process.stdout.write(
      `  Timezone: ${globalConfig.timezone}${config.isExplicitlySet('timezone') ? '' : ' (default)'}\n`
    );

    // Safety and Testing Settings
    process.stdout.write(`\n🛡️  Safety and Testing Settings:\n`);
    process.stdout.write(
      `  Dry Run Mode: ${globalConfig.dry_run ? 'ON' : 'OFF'}${config.isExplicitlySet('dry_run') ? '' : ' (default)'}\n`
    );
    process.stdout.write(
      `  Force Sync: ${globalConfig.force_sync ? 'ON' : 'OFF'}${config.isExplicitlySet('force_sync') ? '' : ' (default)'}\n`
    );
    process.stdout.write(
      `  Max Books to Process: ${globalConfig.max_books_to_process !== undefined ? globalConfig.max_books_to_process : 'no limit'}${config.isExplicitlySet('max_books_to_process') ? '' : ' (default)'}\n`
    );

    // Automation Settings
    process.stdout.write(`\n⏰ Automation Settings:\n`);
    if (globalConfig.sync_schedule) {
      try {
        const human = cronstrue.toString(globalConfig.sync_schedule, {
          use24HourTimeFormat: false,
        });
        process.stdout.write(
          `  Sync Schedule: ${human}${config.isExplicitlySet('sync_schedule') ? '' : ' (default)'}\n`
        );
      } catch (_e) {
        process.stdout.write(`  Sync Schedule: Invalid cron expression\n`);
      }
    } else {
      process.stdout.write(
        `  Sync Schedule: 0 3 * * * (default - daily at 3 AM)\n`
      );
    }
    process.stdout.write(
      `  Auto-add Books: ${globalConfig.auto_add_books ? 'ON' : 'OFF'}${config.isExplicitlySet('auto_add_books') ? '' : ' (default)'}\n`
    );

    // Progress Protection Settings
    process.stdout.write(`\n🔒 Progress Protection Settings:\n`);
    process.stdout.write(
      `  Progress Regression Protection: ${globalConfig.prevent_progress_regression ? 'ON' : 'OFF'}${config.isExplicitlySet('prevent_progress_regression') ? '' : ' (default)'}\n`
    );

    // Re-read Detection Settings
    if (globalConfig.reread_detection) {
      process.stdout.write(`  Re-read Detection:\n`);
      process.stdout.write(
        `    Re-read Threshold: ${globalConfig.reread_detection.reread_threshold || 30}%${globalConfig.reread_detection.reread_threshold !== undefined ? '' : ' (default)'}\n`
      );
      process.stdout.write(
        `    High Progress Threshold: ${globalConfig.reread_detection.high_progress_threshold || 85}%${globalConfig.reread_detection.high_progress_threshold !== undefined ? '' : ' (default)'}\n`
      );
      process.stdout.write(
        `    Regression Block Threshold: ${globalConfig.reread_detection.regression_block_threshold || 50}%${globalConfig.reread_detection.regression_block_threshold !== undefined ? '' : ' (default)'}\n`
      );
      process.stdout.write(
        `    Regression Warn Threshold: ${globalConfig.reread_detection.regression_warn_threshold || 15}%${globalConfig.reread_detection.regression_warn_threshold !== undefined ? '' : ' (default)'}\n`
      );
    } else {
      process.stdout.write(
        `  Re-read Detection: using defaults (not configured)\n`
      );
    }

    // Rate Limiting and Performance
    process.stdout.write(`\n⚡ Rate Limiting and Performance:\n`);
    process.stdout.write(
      `  Hardcover Semaphore: ${globalConfig.hardcover_semaphore}${config.isExplicitlySet('hardcover_semaphore') ? '' : ' (default)'}\n`
    );
    process.stdout.write(
      `  Hardcover Rate Limit: ${globalConfig.hardcover_rate_limit || 55} req/min${config.isExplicitlySet('hardcover_rate_limit') ? '' : ' (default)'}\n`
    );
    process.stdout.write(
      `  Audiobookshelf Semaphore: ${globalConfig.audiobookshelf_semaphore}${config.isExplicitlySet('audiobookshelf_semaphore') ? '' : ' (default)'}\n`
    );
    process.stdout.write(
      `  Audiobookshelf Rate Limit: ${globalConfig.audiobookshelf_rate_limit || 600} req/min${config.isExplicitlySet('audiobookshelf_rate_limit') ? '' : ' (default)'}\n`
    );

    // Library Fetching Settings
    process.stdout.write(`\n📚 Library Fetching Settings:\n`);
    process.stdout.write(
      `  Max Books to Fetch: ${globalConfig.max_books_to_fetch === null ? 'no limit' : globalConfig.max_books_to_fetch || 'no limit'}${config.isExplicitlySet('max_books_to_fetch') ? '' : ' (default)'}\n`
    );
    process.stdout.write(
      `  Page Size: ${globalConfig.page_size || 100}${config.isExplicitlySet('page_size') ? '' : ' (default)'}\n`
    );

    // Debugging and Logging
    process.stdout.write(`\n🐛 Debugging and Logging:\n`);
    process.stdout.write(
      `  Dump Failed Books: ${globalConfig.dump_failed_books ? 'ON' : 'OFF'}${config.isExplicitlySet('dump_failed_books') ? '' : ' (default)'}\n`
    );

    // Users
    process.stdout.write(`\n👤 Users (${users.length}):\n`);
    for (const user of users) {
      process.stdout.write(`  ${user.id}:\n`);
      process.stdout.write(`    Audiobookshelf: ${user.abs_url}\n`);
      process.stdout.write(`    Hardcover: Connected\n`);
    }
    process.stdout.write('\n✅ Configuration validation: Passed\n');
  }

  async handleCacheManagement() {
    let cacheExit = false;
    while (!cacheExit) {
      const { cacheAction } = await inquirer.prompt([
        {
          type: 'list',
          name: 'cacheAction',
          message: 'Cache management - choose an option:',
          choices: [
            { name: 'Show cache stats', value: 'stats' },
            { name: 'Show cache contents', value: 'show' },
            { name: 'Clear cache', value: 'clear' },
            { name: 'Export cache to JSON', value: 'export' },
            { name: 'Back', value: 'back' },
          ],
        },
      ]);

      switch (cacheAction) {
        case 'stats':
          await this.showCacheStats();
          break;
        case 'show':
          await this.showCacheContents();
          break;
        case 'clear':
          await this.clearCache();
          break;
        case 'export':
          await this.exportCache();
          break;
        case 'back':
          cacheExit = true;
          break;
      }
    }
  }

  async showCacheStats() {
    const cache = new BookCache();
    const unregisterCache = this.registerCleanup(() => cache.close());
    try {
      await cache.init();
      const stats = await cache.getCacheStats();
      process.stdout.write('\n=== Cache Statistics ===\n');
      process.stdout.write(`Total books: ${stats.total_books}\n`);
      process.stdout.write(
        `Recent books (last 7 days): ${stats.recent_books}\n`
      );
      process.stdout.write(`Cache size: ${stats.cache_size_mb} MB\n`);
    } finally {
      unregisterCache();
    }
  }

  async showCacheContents() {
    const cache2 = new BookCache();
    const unregisterCache2 = this.registerCleanup(() => cache2.close());
    try {
      await cache2.init();
      const stats = await cache2.getCacheStats();
      process.stdout.write('\n=== Cache Contents ===\n');
      process.stdout.write(`Total books: ${stats.total_books}\n\n`);

      if (stats.total_books === 0) {
        process.stdout.write('No books in cache\n');
      } else {
        const stmt = cache2.db.prepare(
          'SELECT * FROM books ORDER BY updated_at DESC'
        );
        const books = stmt.all();
        books.forEach((book, index) => {
          process.stdout.write(`${index + 1}. ${book.title}\n`);
          process.stdout.write(`   User: ${book.user_id}\n`);
          process.stdout.write(
            `   ${book.identifier_type.toUpperCase()}: ${book.identifier}\n`
          );
          process.stdout.write(`   Edition ID: ${book.edition_id}\n`);
          process.stdout.write(
            `   Progress: ${book.progress_percent}%\n`
          );
          process.stdout.write(
            `   Author: ${book.author || 'Unknown'}\n`
          );
          process.stdout.write(`   Last Sync: ${book.last_sync}\n`);
          process.stdout.write(
            `   Started At: ${book.started_at || 'Not set'}\n`
          );
          process.stdout.write(
            `   Last Listened: ${book.last_listened_at || 'Not set'}\n\n`
          );
        });
      }
    } finally {
      unregisterCache2();
    }
  }

  async clearCache() {
    const cache3 = new BookCache();
    const unregisterCache3 = this.registerCleanup(() => cache3.close());
    try {
      await cache3.clearCache();
      process.stdout.write('Cache cleared successfully\n');
    } finally {
      unregisterCache3();
    }
  }

  async exportCache() {
    const { filename } = await inquirer.prompt([
      {
        type: 'input',
        name: 'filename',
        message: 'Enter filename for export:',
        default: `backup-${new Date().toISOString().slice(0, 10)}.json`,
      },
    ]);
    const cache4 = new BookCache();
    const unregisterCache4 = this.registerCleanup(() => cache4.close());
    try {
      await cache4.exportToJson(filename);
      process.stdout.write(`Cache exported to ${filename}\n`);
    } finally {
      unregisterCache4();
    }
  }
}
