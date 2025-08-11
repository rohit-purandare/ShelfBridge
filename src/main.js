#!/usr/bin/env node

import { Command } from 'commander';
import { Config } from './config.js';
import { ConfigValidator } from './config-validator.js';
import { SyncManager } from './sync-manager.js';
import { AudiobookshelfClient } from './audiobookshelf-client.js';
import { HardcoverClient } from './hardcover-client.js';
import { BookCache } from './book-cache.js';
import { testApiConnections } from './utils/api-testing.js';
import { currentVersion } from './version.js';
import cron from 'node-cron';
import { setMaxListeners } from 'events';
import logger from './logger.js';
import { Semaphore } from './utils/concurrency.js';
import {
  formatStartupMessage,
  formatWelcomeMessage,
} from './utils/github-helper.js';
import { SyncResultFormatter } from './display/SyncResultFormatter.js';
import { CommandRegistry } from './cli/CommandRegistry.js';
import inquirer from 'inquirer';
import fs from 'fs';
import cronstrue from 'cronstrue';

const program = new Command();

program
  .name('ShelfBridge')
  .description(
    'Sync your audiobook reading progress from Audiobookshelf to Hardcover automatically',
  )
  .version(currentVersion);

program.option('--dry-run', 'Run without making changes');
program.option('--skip-validation', 'Skip configuration validation on startup');
program.option('--verbose', 'Show detailed logging output');

// Initialize command registry and register all extracted commands
const commandRegistry = new CommandRegistry();
commandRegistry.registerCommands({
  syncUserFn: syncUser,
  registerCleanupFn: registerCleanup,
  testUserFn: testUser,
  testAllConnectionsFn: testAllConnections,
  showConfigFn: showConfig,
  debugUserFn: debugUser,
  runScheduledSyncFn: runScheduledSync,
  showNextScheduledSyncFn: showNextScheduledSync,
});

// Configure all extracted commands
commandRegistry.configureCommands(program);

/**
 * Validate configuration on startup
 */
async function validateConfigurationOnStartup(skipValidation = false) {
  if (skipValidation) {
    logger.debug('Skipping configuration validation');
    return;
  }

  try {
    logger.debug('Validating configuration...');

    const config = new Config();
    const validator = new ConfigValidator();

    // Validate configuration structure
    const validationResult = await validator.validateConfiguration(config);

    if (!validationResult.valid) {
      logger.error('Configuration validation failed');
      console.error(validator.formatErrors(validationResult));

      // Show help for fixing configuration
      console.log('\n' + '='.repeat(50));
      console.log('Configuration Help:');
      console.log('='.repeat(50));
      console.log(validator.generateHelpText());

      process.exit(1);
    }

    logger.debug('Configuration validation passed');
  } catch (error) {
    logger.logErrorWithIssueLink('Configuration validation failed', error, {
      operation: 'config_validation',
      component: 'config_validator',
      config_file_exists: fs.existsSync('config/config.yaml'),
      env_config_detected: !!process.env.SHELFBRIDGE_USER_0_ID,
      severity: 'high',
    });

    console.error('\nPlease check your config/config.yaml file and try again.');

    process.exit(1);
  }
}

/**
 * Test API connections for all users
 */
async function testAllConnections() {
  try {
    logger.info('Testing API connections...');

    const config = new Config();
    const users = config.getUsers();

    const allErrors = [];

    for (const [index, user] of users.entries()) {
      if (
        !user.id ||
        !user.abs_url ||
        !user.abs_token ||
        !user.hardcover_token
      ) {
        continue; // Skip users with missing required fields (already validated)
      }

      const results = await testApiConnections(user);

      if (!results.abs) {
        allErrors.push(
          `User ${index} (${user.id}): Audiobookshelf connection failed`,
        );
      }

      if (!results.hardcover) {
        allErrors.push(
          `User ${index} (${user.id}): Hardcover connection failed`,
        );
      }

      // Add specific error messages
      results.errors.forEach(error => {
        allErrors.push(`User ${index} (${user.id}): ${error}`);
      });
    }

    if (allErrors.length > 0) {
      logger.error('API connection tests failed');
      console.error('\n❌ API Connection Tests Failed:');
      allErrors.forEach(error => {
        console.error(`   ✗ ${error}`);
      });
      console.error('\nPlease check your API tokens and server URLs.');
      return false;
    }

    logger.info('✅ All API connections successful');
    return true;
  } catch (error) {
    logger.error('Connection test error', {
      error: error.message,
      stack: error.stack,
    });
    return false;
  }
}

async function syncUser(user, globalConfig, verbose = false) {
  // Validate user object
  if (!user) {
    throw new Error('User object is required');
  }

  if (!user.id || !user.abs_url || !user.abs_token || !user.hardcover_token) {
    throw new Error(
      `Invalid user configuration: missing required fields for user ${user.id || 'unknown'}`,
    );
  }

  const startTime = Date.now();
  const syncManager = new SyncManager(
    user,
    globalConfig,
    globalConfig.dry_run,
    verbose,
  );

  // Register cleanup for unexpected termination
  const unregister = registerCleanup(() => syncManager.cleanup());

  try {
    const result = await syncManager.syncProgress();

    // Log summary
    const duration = (Date.now() - startTime) / 1000;

    logger.debug('Sync completed for user', {
      user_id: user.id,
      summary: {
        duration: `${duration.toFixed(1)}s`,
        books_processed: result.books_processed,
        books_synced: result.books_synced,
        books_completed: result.books_completed,
        books_auto_added: result.books_auto_added,
        books_skipped: result.books_skipped,
        errors: result.errors.length,
      },
    });

    // Use the SyncResultFormatter to display results
    const formatter = new SyncResultFormatter();
    await formatter.formatSyncResults(user, result, globalConfig, duration, verbose);
  } catch (error) {
    logger.error('Sync failed for user', {
      user_id: user.id,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  } finally {
    // Ensure the SyncManager's database connection is closed
    syncManager.cleanup();
    unregister(); // Unregister the cleanup function
  }
}

async function testUser(user) {
  const userLogger = logger.forUser(user.id);
  const isVerbose = program.opts().verbose;

  if (isVerbose) {
    userLogger.info('Testing API connections');
  }

  // Use shared utility for connection testing
  const results = await testApiConnections(user);

  // Display results
  console.log(`Audiobookshelf: ${results.abs ? '✅ Connected' : '❌ Failed'}`);
  console.log(`Hardcover: ${results.hardcover ? '✅ Connected' : '❌ Failed'}`);

  // Show errors if any
  if (results.errors.length > 0 && isVerbose) {
    results.errors.forEach(error => {
      userLogger.error(error);
    });
  }

  const allSuccessful = results.abs && results.hardcover;

  if (isVerbose) {
    userLogger.info('Connection test completed', {
      audiobookshelf: results.abs,
      hardcover: results.hardcover,
      allSuccessful,
    });
  }

  return allSuccessful;
}

async function debugUser(user) {
  console.log('\n' + '='.repeat(60));
  console.log('🐛 DEBUG INFORMATION FOR USER');
  console.log('='.repeat(60));
  console.log(`User ID: ${user.id}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  const userLogger = logger.forUser(user.id);
  userLogger.info('Starting debug session');

  try {
    // 1. User Configuration
    console.log('\n📋 USER CONFIGURATION');
    console.log('-'.repeat(30));
    console.log(`User ID: ${user.id}`);
    console.log(`Audiobookshelf URL: ${user.abs_url}`);
    console.log(
      `Audiobookshelf Token: ${user.abs_token ? `${user.abs_token.substring(0, 8)}...` : 'NOT SET'}`,
    );
    console.log(
      `Hardcover Token: ${user.hardcover_token ? `${user.hardcover_token.substring(0, 8)}...` : 'NOT SET'}`,
    );

    // Validate required fields
    const requiredFields = ['id', 'abs_url', 'abs_token', 'hardcover_token'];
    const missingFields = requiredFields.filter(field => !user[field]);

    if (missingFields.length > 0) {
      console.log(`❌ Missing required fields: ${missingFields.join(', ')}`);
    } else {
      console.log('✅ All required fields present');
    }

    // 2. Connection Testing
    console.log('\n🔌 CONNECTION TESTING');
    console.log('-'.repeat(30));

    // Use shared utility for basic connection testing
    const connectionResults = await testApiConnections(user);

    console.log(
      `Audiobookshelf: ${connectionResults.abs ? '✅ Connected' : '❌ Failed'}`,
    );
    console.log(
      `Hardcover: ${connectionResults.hardcover ? '✅ Connected' : '❌ Failed'}`,
    );

    // Show errors if any
    if (connectionResults.errors.length > 0) {
      connectionResults.errors.forEach(error => {
        console.log(`  ❌ ${error}`);
      });
    }

    let absClient, hcClient;

    // Get additional info for successful connections
    if (connectionResults.abs) {
      try {
        absClient = new AudiobookshelfClient(
          user.abs_url,
          user.abs_token,
          1,
          500,
          100,
        );
        const userInfo = await absClient._getCurrentUser();
        console.log(`  - ABS User: ${userInfo.username || 'Unknown'}`);
        console.log(`  - ABS User ID: ${userInfo.id || 'Unknown'}`);
        console.log(
          `  - ABS Libraries: ${userInfo.librariesAccessible?.length || 'Unknown'}`,
        );

        // Show available libraries for library filtering configuration
        try {
          const libraries = await absClient.getLibraries();
          if (libraries && libraries.length > 0) {
            console.log(`\n📚 Available Libraries for filtering:`);
            libraries.forEach(lib => {
              console.log(`     "${lib.name}" (ID: ${lib.id})`);
            });
            console.log(`\n💡 Configure library filtering in config.yaml:`);
            console.log(`   libraries:`);
            console.log(
              `     include: ["${libraries[0]?.name || 'Library Name'}"]`,
            );
            console.log(`     # OR`);
            console.log(`     exclude: ["Podcasts", "Samples"]`);
          }
        } catch (libError) {
          console.log(`  - Library info unavailable: ${libError.message}`);
        }
      } catch (error) {
        console.log(`  - Additional ABS info unavailable: ${error.message}`);
      }
    }

    if (connectionResults.hardcover) {
      try {
        hcClient = new HardcoverClient(user.hardcover_token);
        const query = `
                    query {
                        me {
                            id
                            username
                            user_books_aggregate {
                                aggregate {
                                    count
                                }
                            }
                        }
                    }
                `;
        const result = await hcClient._executeQuery(query);
        if (result && result.me) {
          console.log(`  - HC User: ${result.me.username || 'Unknown'}`);
          console.log(`  - HC User ID: ${result.me.id || 'Unknown'}`);
          console.log(
            `  - HC Library Size: ${result.me.user_books_aggregate?.aggregate?.count || 'Unknown'}`,
          );
        }
      } catch (error) {
        console.log(`  - Additional HC info unavailable: ${error.message}`);
      }
    }

    // 3. Cache Information
    console.log('\n💾 CACHE INFORMATION');
    console.log('-'.repeat(30));

    const cache = new BookCache();
    const unregisterCache = registerCleanup(() => cache.close());

    try {
      await cache.init();
      const stats = await cache.getCacheStats();
      console.log(`Total books in cache: ${stats.total_books}`);
      console.log(`Cache size: ${stats.cache_size_mb} MB`);
      console.log(`Recent books (last 7 days): ${stats.recent_books}`);

      // Get user-specific cache data
      const userBooksStmt = cache.db.prepare(
        'SELECT * FROM books WHERE user_id = ? ORDER BY updated_at DESC',
      );
      const userBooks = userBooksStmt.all(user.id);
      console.log(`Books for user ${user.id}: ${userBooks.length}`);

      if (userBooks.length > 0) {
        console.log('\nRecent books for this user:');
        userBooks.slice(0, 5).forEach((book, index) => {
          console.log(`  ${index + 1}. ${book.title}`);
          console.log(`     Progress: ${book.progress_percent}%`);
          console.log(`     Last sync: ${book.last_sync}`);
          console.log(
            `     Identifier: ${book.identifier_type.toUpperCase()}=${book.identifier}`,
          );
        });

        if (userBooks.length > 5) {
          console.log(`     ... and ${userBooks.length - 5} more books`);
        }
      }
    } catch (error) {
      console.log(`Cache error: ${error.message}`);
    } finally {
      unregisterCache();
    }

    // 4. Sample API Calls (if connections are working)
    if (connectionResults.abs && connectionResults.hardcover) {
      console.log('\n🔍 SAMPLE API CALLS');
      console.log('-'.repeat(30));

      try {
        console.log('Fetching sample books from Audiobookshelf...');
        const books = await absClient.getReadingProgress();
        console.log(`Found ${books.length} books in ABS`);

        if (books.length > 0) {
          const sampleBook = books[0];
          console.log(`Sample book: "${sampleBook.title}"`);
          console.log(`  Author: ${sampleBook.author || 'Unknown'}`);
          console.log(
            `  Progress: ${sampleBook.progress ? sampleBook.progress.progress : 'No progress'}`,
          );
          console.log(`  ASIN: ${sampleBook.metadata?.asin || 'None'}`);
          console.log(`  ISBN: ${sampleBook.metadata?.isbn || 'None'}`);

          // Test book matching
          if (sampleBook.metadata?.asin || sampleBook.metadata?.isbn) {
            console.log('Testing book matching with Hardcover...');
            const identifier =
              sampleBook.metadata?.asin || sampleBook.metadata?.isbn;
            const identifierType = sampleBook.metadata?.asin ? 'asin' : 'isbn';

            try {
              const searchMethod =
                identifierType === 'asin'
                  ? 'searchBooksByAsin'
                  : 'searchBooksByIsbn';
              const matchedBooks = await hcClient[searchMethod](identifier);
              if (matchedBooks && matchedBooks.length > 0) {
                const matchedBook = matchedBooks[0];
                console.log(`  ✅ Found match: "${matchedBook.book.title}"`);
                console.log(`  HC Book ID: ${matchedBook.book.id}`);
                console.log(`  HC Edition ID: ${matchedBook.id}`);
              } else {
                console.log(`  ❌ No match found in Hardcover`);
              }
            } catch (error) {
              console.log(`  ❌ Error matching book: ${error.message}`);
            }
          }
        }
      } catch (error) {
        console.log(`Sample API call error: ${error.message}`);
      }
    }

    // 5. System Information
    console.log('\n🖥️  SYSTEM INFORMATION');
    console.log('-'.repeat(30));
    console.log(`Node.js version: ${process.version}`);
    console.log(`Platform: ${process.platform}`);
    console.log(`Architecture: ${process.arch}`);
    console.log(
      `Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
    );
    console.log(`Process uptime: ${Math.round(process.uptime())}s`);

    // 6. Configuration Check
    console.log('\n⚙️  CONFIGURATION CHECK');
    console.log('-'.repeat(30));

    const config = new Config();
    const globalConfig = config.getGlobal();

    console.log(`Dry run mode: ${globalConfig.dry_run ? 'ON' : 'OFF'}`);
    console.log(
      `Min progress threshold: ${globalConfig.min_progress_threshold}%`,
    );
    console.log(
      `Auto-add books: ${globalConfig.auto_add_books ? 'ON' : 'OFF'}`,
    );
    console.log(
      `Progress regression protection: ${globalConfig.prevent_progress_regression ? 'ON' : 'OFF'}`,
    );

    if (globalConfig.cron?.enabled) {
      console.log(`Cron schedule: ${globalConfig.cron.schedule}`);
      console.log(`Cron timezone: ${globalConfig.cron.timezone}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('🐛 DEBUG COMPLETED');
    console.log('='.repeat(60));

    userLogger.info('Debug session completed successfully');
  } catch (error) {
    console.log(`\n❌ Debug session failed: ${error.message}`);
    userLogger.error('Debug session failed', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

function showConfig(config) {
  logger.info('Showing configuration status');

  // Show global config
  const globalConfig = config.getGlobal();
  logger.info('Global configuration loaded', {
    settings: Object.keys(globalConfig),
  });

  // Show users
  const users = config.getUsers();
  logger.info('User configuration loaded', {
    userCount: users.length,
  });

  // Configuration validation is handled by ConfigValidator class
  // This function now just displays configuration information
  return true;
}

async function runScheduledSync(config) {
  try {
    const globalConfig = config.getGlobal();
    const users = config.getUsers();

    logger.info('Starting scheduled sync', { userCount: users.length });

    if (globalConfig.parallel) {
      const workers = globalConfig.workers || 3;
      logger.debug('Running user syncs in parallel mode', { workers });
      const semaphore = new Semaphore(workers);

      await Promise.all(
        users.map(async user => {
          await semaphore.acquire();
          try {
            logger.info('Starting scheduled sync for user', {
              user_id: user.id,
            });
            await syncUser(user, globalConfig, program.opts().verbose);
          } finally {
            semaphore.release();
          }
        }),
      );
    } else {
      for (const user of users) {
        logger.info('Starting scheduled sync for user', { user_id: user.id });
        await syncUser(user, globalConfig, program.opts().verbose);
      }
    }

    logger.info('Scheduled sync completed', { userCount: users.length });
  } catch (error) {
    logger.error('Scheduled sync failed', {
      error: error.message,
      stack: error.stack,
    });
  }
}

// Helper to display next scheduled sync time
async function showNextScheduledSync(cronConfig) {
  try {
    const { CronJob } = await import('cron');
    const job = new CronJob(
      cronConfig.schedule,
      () => {},
      null,
      false,
      cronConfig.timezone,
    );
    const nextDate = job.nextDate();
    const { DateTime } = await import('luxon');
    const nextSync = DateTime.fromJSDate(
      nextDate.toJSDate ? nextDate.toJSDate() : nextDate,
      { zone: cronConfig.timezone },
    );
    console.log(
      `\n🕒 Next scheduled sync: ${nextSync.toFormat('yyyy-LL-dd HH:mm:ss ZZZZ')}`,
    );
  } catch (err) {
    console.log('Could not determine next scheduled sync time:', err.message);
  }
}

// Global cleanup handlers for unexpected termination
const cleanupHandlers = new Set();

/**
 * Register a cleanup function to be called on process termination
 * @param {Function} cleanupFn - Function to call for cleanup
 * @returns {Function} - Unregister function
 */
function registerCleanup(cleanupFn) {
  cleanupHandlers.add(cleanupFn);

  // Return unregister function
  return () => {
    cleanupHandlers.delete(cleanupFn);
  };
}

/**
 * Execute all registered cleanup functions
 */
function executeCleanup() {
  logger.debug('Executing cleanup handlers', { count: cleanupHandlers.size });
  for (const cleanup of cleanupHandlers) {
    try {
      cleanup();
    } catch (error) {
      logger.error('Error during cleanup', { error: error.message });
    }
  }
}

// Register process termination handlers
process.on('SIGINT', () => {
  logger.info('Received SIGINT, cleaning up...');
  executeCleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, cleaning up...');
  executeCleanup();
  process.exit(0);
});

process.on('uncaughtException', error => {
  logger.logErrorWithIssueLink('Uncaught exception occurred', error, {
    operation: 'uncaught_exception',
    component: 'process_handler',
    severity: 'critical',
    event_type: 'uncaught_exception',
    process_argv: process.argv.slice(2).join(' '),
    current_listeners: process.listenerCount('uncaughtException'),
  });
  executeCleanup();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  // Create an error object from the rejection reason
  const error =
    reason instanceof Error
      ? reason
      : new Error(reason?.toString() || 'Unknown rejection reason');

  logger.logErrorWithIssueLink('Unhandled promise rejection occurred', error, {
    operation: 'unhandled_rejection',
    component: 'process_handler',
    severity: 'critical',
    event_type: 'unhandled_rejection',
    promise_info: promise?.toString(),
    process_argv: process.argv.slice(2).join(' '),
    rejection_type: typeof reason,
    current_listeners: process.listenerCount('unhandledRejection'),
  });
  executeCleanup();
  process.exit(1);
});

// Configure global event listener limits to prevent warnings in parallel operations
// This helps when running multiple SyncManagers simultaneously
setMaxListeners(0); // 0 means unlimited for the global EventEmitter

// Parse command line arguments
program.parse();

// Export cleanup registration for use by other modules
export { registerCleanup };
