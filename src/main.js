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

// Sync command
program
  .command('sync')
  .description('Sync reading progress')
  .option('--all-users', 'Sync all users')
  .option('-u, --user <userId>', 'Sync specific user')
  .option('--force', 'Force sync even if progress unchanged (ignores cache)')
  .action(async options => {
    let config, globalConfig, users;
    try {
      // Validate configuration first
      await validateConfigurationOnStartup(program.opts().skipValidation);

      config = new Config();
      globalConfig = config.getGlobal();
      users = config.getUsers();

      // Override dry_run from config if --dry-run flag is used
      if (options.dryRun || program.opts().dryRun) {
        globalConfig.dry_run = true;
      }

      // Add force flag to global config
      if (options.force) {
        globalConfig.force_sync = true;
      }

      // Show startup information
      console.log(formatStartupMessage('Sync', currentVersion));

      logger.debug('Starting sync', {
        users: users.length,
        dryRun: globalConfig.dry_run,
        minProgressThreshold: globalConfig.min_progress_threshold,
      });

      if (options.user) {
        // Sync specific user
        const user = config.getUser(options.user);
        await syncUser(user, globalConfig, program.opts().verbose);
      } else {
        // Sync all users
        if (globalConfig.parallel) {
          const workers = globalConfig.workers || 3;
          logger.debug('Running user syncs in parallel mode', { workers });
          const semaphore = new Semaphore(workers);

          await Promise.all(
            users.map(async user => {
              await semaphore.acquire();
              try {
                await syncUser(user, globalConfig, program.opts().verbose);
              } finally {
                semaphore.release();
              }
            }),
          );
        } else {
          for (const user of users) {
            await syncUser(user, globalConfig, program.opts().verbose);
          }
        }
      }

      // Exit successfully after sync completion
      process.exit(0);
    } catch (error) {
      logger.logErrorWithIssueLink('Sync operation failed', error, {
        operation: 'sync',
        command: 'sync',
        component: 'sync_manager',
        users_count: users?.length || 0,
        dry_run: globalConfig?.dry_run || false,
        parallel_mode: globalConfig?.parallel || false,
        force_sync: globalConfig?.force_sync || false,
        severity: 'high',
      });
      process.exit(1);
    }
  });

// Test command
program
  .command('test')
  .description('Test API connections')
  .option('-u, --user <userId>', 'Test specific user')
  .action(async options => {
    try {
      // Validate configuration first
      await validateConfigurationOnStartup(program.opts().skipValidation);

      const config = new Config();
      const users = config.getUsers();

      // Control logging verbosity based on --verbose flag
      const originalLevel = logger.level;
      if (!program.opts().verbose) {
        logger.level = 'error';
      }

      try {
        if (options.user) {
          const user = config.getUser(options.user);
          console.log(`\n=== Testing connections for user: ${user.id} ===`);
          const success = await testUser(user);
          console.log(
            success
              ? '✅ All connections successful!'
              : '❌ One or more connections failed.',
          );
        } else {
          for (const user of users) {
            console.log(`\n=== Testing connections for user: ${user.id} ===`);
            const success = await testUser(user);
            console.log(
              success
                ? '✅ All connections successful!'
                : '❌ One or more connections failed.',
            );
          }
        }
      } finally {
        // Restore original logger level
        logger.level = originalLevel;
      }

      // Exit successfully after test completion
      process.exit(0);
    } catch (error) {
      logger.logErrorWithIssueLink('Connection test failed', error, {
        operation: 'test',
        command: 'test',
      });
      process.exit(1);
    }
  });

// Validate command
program
  .command('validate')
  .description('Validate configuration without running sync')
  .option('--connections', 'Test API connections')
  .option('--help-config', 'Show configuration help')
  .action(async options => {
    try {
      if (options.helpConfig) {
        const validator = new ConfigValidator();
        console.log(validator.generateHelpText());
        return;
      }

      // Always validate configuration for this command
      await validateConfigurationOnStartup(false);

      if (options.connections) {
        const success = await testAllConnections();
        if (!success) {
          process.exit(1);
        }
      }

      console.log('✅ Configuration validation completed successfully');

      // Exit successfully after validation completion
      process.exit(0);
    } catch (error) {
      logger.logErrorWithIssueLink('Configuration validation failed', error, {
        operation: 'validate',
        command: 'validate',
      });
      process.exit(1);
    }
  });

// Schema command
program
  .command('schema')
  .description('Check Hardcover GraphQL schema')
  .action(async () => {
    try {
      const config = new Config();
      const users = config.getUsers();

      if (users.length === 0) {
        console.error('No users configured');
        process.exit(1);
      }

      const user = users[0]; // Use first user
      console.log(`\n=== Checking schema for user: ${user.id} ===`);

      const hardcover = new HardcoverClient(user.hardcover_token);
      const schema = await hardcover.getSchema();

      if (schema && schema.__schema && schema.__schema.mutationType) {
        console.log('Available mutations:');
        schema.__schema.mutationType.fields.forEach(field => {
          console.log(`- ${field.name}`);
          if (field.args && field.args.length > 0) {
            console.log(
              `  Args: ${field.args.map(arg => arg.name).join(', ')}`,
            );
          }
        });
      } else {
        console.log('No schema information available');
      }

      // Exit successfully after schema check completion
      process.exit(0);
    } catch (error) {
      console.error('Schema check failed:', error.message);
      process.exit(1);
    }
  });

// Detailed schema command
program
  .command('schema-detail')
  .description('Get detailed schema information for update_user_book_read')
  .action(async () => {
    try {
      const config = new Config();
      const users = config.getUsers();

      if (users.length === 0) {
        console.error('No users configured');
        process.exit(1);
      }

      const user = users[0]; // Use first user
      console.log(`\n=== Getting detailed schema for user: ${user.id} ===`);

      const hardcover = new HardcoverClient(user.hardcover_token);
      const schema = await hardcover.getDetailedSchema();

      if (schema && schema.__schema && schema.__schema.types) {
        // Find the update_user_book_read mutation
        const mutationType = schema.__schema.types.find(
          type => type.name === 'mutation_root',
        );
        if (mutationType && mutationType.fields) {
          const updateMutation = mutationType.fields.find(
            field => field.name === 'update_user_book_read',
          );
          if (updateMutation) {
            console.log('update_user_book_read mutation found:');
            if (updateMutation.args && updateMutation.args.length > 0) {
              console.log(
                'Arguments:',
                updateMutation.args.map(arg => arg.name).join(', '),
              );

              // Find the input type for the object argument
              const objectArg = updateMutation.args.find(
                arg => arg.name === 'object',
              );
              if (objectArg && objectArg.type && objectArg.type.ofType) {
                const inputTypeName = objectArg.type.ofType.name;
                console.log(`Object argument type: ${inputTypeName}`);

                // Find the input type definition
                const inputType = schema.__schema.types.find(
                  type => type.name === inputTypeName,
                );
                if (
                  inputType &&
                  inputType.inputFields &&
                  inputType.inputFields.length > 0
                ) {
                  console.log('Available fields in object:');
                  inputType.inputFields.forEach(field => {
                    const fieldType =
                      field.type.name ||
                      (field.type.ofType ? field.type.ofType.name : 'Unknown');
                    console.log(`  - ${field.name}: ${fieldType}`);
                  });
                } else {
                  console.log('No input fields found for object type');
                }
              } else {
                console.log('Object argument type not found');
              }
            } else {
              console.log('No arguments found for update_user_book_read');
            }
          } else {
            console.log('update_user_book_read mutation not found');
          }
        } else {
          console.log('mutation_root type not found or has no fields');
        }
      } else {
        console.log('No detailed schema information available');
      }

      // Exit successfully after detailed schema check completion
      process.exit(0);
    } catch (error) {
      console.error('Detailed schema check failed:', error.message);
      process.exit(1);
    }
  });

// Print all input types and their fields
program
  .command('schema-inputs')
  .description('Print all input types and their fields from the schema')
  .action(async () => {
    try {
      const config = new Config();
      const users = config.getUsers();
      if (users.length === 0) {
        console.error('No users configured');
        process.exit(1);
      }
      const user = users[0];
      console.log(`\n=== Printing all input types for user: ${user.id} ===`);
      const hardcover = new HardcoverClient(user.hardcover_token);
      const schema = await hardcover.getDetailedSchema();
      if (schema && schema.__schema && schema.__schema.types) {
        const inputTypes = schema.__schema.types.filter(
          type => type.kind === 'INPUT_OBJECT',
        );
        inputTypes.forEach(type => {
          console.log(`\nInput type: ${type.name}`);
          if (type.inputFields && type.inputFields.length > 0) {
            type.inputFields.forEach(field => {
              const fieldType =
                field.type.name ||
                (field.type.ofType ? field.type.ofType.name : 'Unknown');
              console.log(`  - ${field.name}: ${fieldType}`);
            });
          } else {
            console.log('  (No fields)');
          }
        });
      } else {
        console.log('No detailed schema information available');
      }

      // Exit successfully after schema inputs check completion
      process.exit(0);
    } catch (error) {
      console.error('Failed to print input types:', error.message);
      process.exit(1);
    }
  });

// Config command
program
  .command('config')
  .description('Show configuration')
  .action(async () => {
    try {
      // Validate configuration first
      await validateConfigurationOnStartup(program.opts().skipValidation);

      const config = new Config();
      showConfig(config);

      // Exit successfully after config check completion
      process.exit(0);
    } catch (error) {
      logger.error('Config check failed', {
        error: error.message,
        stack: error.stack,
      });
      process.exit(1);
    }
  });

// Cache command
program
  .command('cache')
  .description('Manage cache')
  .option('--clear', 'Clear cache')
  .option('--stats', 'Show cache statistics')
  .option('--show', 'Show detailed cache contents')
  .option('--export <filename>', 'Export cache to JSON file')
  .action(async options => {
    const cache = new BookCache();

    // Register cleanup for unexpected termination
    const unregister = registerCleanup(() => cache.close());

    try {
      // Skip validation for cache operations (they don't need API access)

      if (options.clear) {
        await cache.clearCache();
        logger.info('Cache cleared successfully');
      } else if (options.stats) {
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
      } else if (options.show) {
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
            console.log(
              `   Last Listened: ${book.last_listened_at || 'Not set'}`,
            );
            console.log('');
          });
        }
      } else if (options.export) {
        await cache.exportToJson(options.export);
      } else {
        console.log(
          'Use --clear, --stats, --show, or --export to manage cache',
        );
      }
    } catch (error) {
      logger.error('Cache operation failed', {
        error: error.message,
        stack: error.stack,
      });
      process.exit(1);
    } finally {
      // Always close the database connection
      cache.close();
      unregister(); // Unregister the cleanup function
    }
  });

// Cron command
program
  .command('cron')
  .description('Start scheduled sync (runs in background)')
  .action(async () => {
    try {
      // Show startup message
      console.log(formatStartupMessage('Cron Sync', currentVersion));

      // Validate configuration first
      await validateConfigurationOnStartup(program.opts().skipValidation);

      const config = new Config();
      const cronConfig = config.getCronConfig();

      logger.info('Starting scheduled sync', {
        schedule: cronConfig.schedule,
        timezone: cronConfig.timezone,
      });

      // Run initial sync
      logger.info('Running initial sync...');
      await runScheduledSync(config);
      await showNextScheduledSync(cronConfig);

      // Schedule recurring sync
      cron.schedule(
        cronConfig.schedule,
        async () => {
          logger.info('Scheduled sync triggered');
          await runScheduledSync(config);
          await showNextScheduledSync(cronConfig);
        },
        {
          timezone: cronConfig.timezone,
        },
      );

      logger.info('Scheduled sync started. Press Ctrl+C to stop.');

      // Keep the process running
      process.on('SIGINT', () => {
        logger.info('Stopping scheduled sync...');
        process.exit(0);
      });

      // Keep alive
      setInterval(() => {
        // Do nothing, just keep the process alive
      }, 60000);
    } catch (error) {
      logger.logErrorWithIssueLink('Cron setup failed', error, {
        operation: 'cron',
        command: 'cron',
      });
      process.exit(1);
    }
  });

// Interactive command
program
  .command('interactive')
  .description('Start in interactive mode')
  .action(async () => {
    try {
      // Show welcome message
      console.log(formatWelcomeMessage(currentVersion));

      // Validate configuration first
      await validateConfigurationOnStartup(program.opts().skipValidation);

      await runInteractiveMode();

      // Exit successfully after interactive mode completion
      process.exit(0);
    } catch (error) {
      logger.logErrorWithIssueLink('Interactive mode failed', error, {
        operation: 'interactive',
        command: 'interactive',
      });
      process.exit(1);
    }
  });

// Default command (scheduled sync mode)
program
  .command('start', { isDefault: true })
  .description('Start scheduled sync (default behavior)')
  .action(async () => {
    try {
      // Show startup message
      console.log(formatStartupMessage('Scheduled Sync', currentVersion));

      // Validate configuration first
      await validateConfigurationOnStartup(program.opts().skipValidation);

      const config = new Config();
      const cronConfig = config.getCronConfig();

      logger.info('Starting scheduled sync', {
        schedule: cronConfig.schedule,
        timezone: cronConfig.timezone,
      });

      // Run initial sync
      logger.info('Running initial sync...');
      await runScheduledSync(config);
      await showNextScheduledSync(cronConfig);

      // Schedule recurring sync
      cron.schedule(
        cronConfig.schedule,
        async () => {
          logger.info('Scheduled sync triggered');
          await runScheduledSync(config);
          await showNextScheduledSync(cronConfig);
        },
        {
          timezone: cronConfig.timezone,
        },
      );

      logger.info('Scheduled sync started. Press Ctrl+C to stop.');

      // Keep the process running
      process.on('SIGINT', () => {
        logger.info('Stopping scheduled sync...');
        process.exit(0);
      });

      // Keep alive
      setInterval(() => {
        // Do nothing, just keep the process alive
      }, 60000);
    } catch (error) {
      logger.logErrorWithIssueLink('Scheduled sync failed', error, {
        operation: 'scheduled_sync',
        command: 'start',
      });
      process.exit(1);
    }
  });

// Debug command
program
  .command('debug')
  .description('Show debug information')
  .option('-u, --user <userId>', 'Debug specific user')
  .action(async options => {
    try {
      // Validate configuration first
      await validateConfigurationOnStartup(program.opts().skipValidation);

      const config = new Config();
      const users = config.getUsers();

      if (options.user) {
        const user = config.getUser(options.user);
        await debugUser(user);
      } else {
        for (const user of users) {
          logger.info('Starting debug for user', { user_id: user.id });
          await debugUser(user);
        }
      }

      // Exit successfully after debug completion
      process.exit(0);
    } catch (error) {
      logger.error('Debug failed', {
        error: error.message,
        stack: error.stack,
      });
      process.exit(1);
    }
  });

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
    await formatter.formatSyncResults(
      user,
      result,
      globalConfig,
      duration,
      verbose,
    );
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

async function runInteractiveMode() {
  const config = new Config();
  const globalConfig = config.getGlobal();
  const users = config.getUsers();
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
        if (globalConfig.parallel) {
          const workers = globalConfig.workers || 3;
          console.log(
            `\n🔄 Syncing all users in parallel with ${workers} workers...`,
          );
          const semaphore = new Semaphore(workers);
          await Promise.all(
            users.map(async user => {
              await semaphore.acquire();
              try {
                console.log(`\n=== Syncing user: ${user.id} ===`);
                await syncUser(user, globalConfig, program.opts().verbose);
              } finally {
                semaphore.release();
              }
            }),
          );
        } else {
          for (const user of users) {
            console.log(`\n=== Syncing user: ${user.id} ===`);
            await syncUser(user, globalConfig, program.opts().verbose);
          }
        }
        break;
      case 'sync_user': {
        const { userId } = await inquirer.prompt([
          {
            type: 'list',
            name: 'userId',
            message: 'Select user to sync:',
            choices: users.map(u => ({ name: u.id, value: u.id })),
          },
        ]);
        const user = config.getUser(userId);
        await syncUser(user, globalConfig, program.opts().verbose);
        break;
      }
      case 'test_connections':
        for (const user of users) {
          // Clean, user-friendly output for interactive mode
          process.stdout.write(
            `\n=== Testing connections for user: ${user.id} ===\n`,
          );
          let absStatus = false;
          let hcStatus = false;
          try {
            const absClient = new AudiobookshelfClient(
              user.abs_url,
              user.abs_token,
              1,
              null,
              100,
            );
            absStatus = await absClient.testConnection();
            process.stdout.write(
              `Audiobookshelf: ${absStatus ? '✅ Connected' : '❌ Failed'}\n`,
            );
          } catch (e) {
            process.stdout.write(`Audiobookshelf: ❌ Error - ${e.message}\n`);
          }
          try {
            const hcClient = new HardcoverClient(user.hardcover_token);
            hcStatus = await hcClient.testConnection();
            process.stdout.write(
              `Hardcover: ${hcStatus ? '✅ Connected' : '❌ Failed'}\n`,
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
        break;
      case 'show_config':
        // Clean, user-friendly output for interactive mode
        process.stdout.write('\n=== Configuration Status ===\n');
        process.stdout.write(`\nGlobal Settings:\n`);

        // =============================================================================
        // CORE SYNC SETTINGS
        // =============================================================================
        process.stdout.write(`\n📊 Core Sync Settings:\n`);
        process.stdout.write(
          `  Min Progress Threshold: ${globalConfig.min_progress_threshold}%${config.isExplicitlySet('min_progress_threshold') ? '' : ' (default)'}\n`,
        );
        process.stdout.write(
          `  Workers: ${globalConfig.workers}${config.isExplicitlySet('workers') ? '' : ' (default)'}\n`,
        );
        process.stdout.write(
          `  Parallel Processing: ${globalConfig.parallel ? 'ON' : 'OFF'}${config.isExplicitlySet('parallel') ? '' : ' (default)'}\n`,
        );
        process.stdout.write(
          `  Timezone: ${globalConfig.timezone}${config.isExplicitlySet('timezone') ? '' : ' (default)'}\n`,
        );

        // =============================================================================
        // SAFETY AND TESTING SETTINGS
        // =============================================================================
        process.stdout.write(`\n🛡️  Safety and Testing Settings:\n`);
        process.stdout.write(
          `  Dry Run Mode: ${globalConfig.dry_run ? 'ON' : 'OFF'}${config.isExplicitlySet('dry_run') ? '' : ' (default)'}\n`,
        );
        process.stdout.write(
          `  Force Sync: ${globalConfig.force_sync ? 'ON' : 'OFF'}${config.isExplicitlySet('force_sync') ? '' : ' (default)'}\n`,
        );
        process.stdout.write(
          `  Max Books to Process: ${globalConfig.max_books_to_process !== undefined ? globalConfig.max_books_to_process : 'no limit'}${config.isExplicitlySet('max_books_to_process') ? '' : ' (default)'}\n`,
        );

        // =============================================================================
        // AUTOMATION SETTINGS
        // =============================================================================
        process.stdout.write(`\n⏰ Automation Settings:\n`);
        if (globalConfig.sync_schedule) {
          try {
            const human = cronstrue.toString(globalConfig.sync_schedule, {
              use24HourTimeFormat: false,
            });
            process.stdout.write(
              `  Sync Schedule: ${human}${config.isExplicitlySet('sync_schedule') ? '' : ' (default)'}\n`,
            );
          } catch (_e) {
            process.stdout.write(`  Sync Schedule: Invalid cron expression\n`);
          }
        } else {
          process.stdout.write(
            `  Sync Schedule: 0 3 * * * (default - daily at 3 AM)\n`,
          );
        }
        process.stdout.write(
          `  Auto-add Books: ${globalConfig.auto_add_books ? 'ON' : 'OFF'}${config.isExplicitlySet('auto_add_books') ? '' : ' (default)'}\n`,
        );

        // =============================================================================
        // PROGRESS PROTECTION SETTINGS
        // =============================================================================
        process.stdout.write(`\n🔒 Progress Protection Settings:\n`);
        process.stdout.write(
          `  Progress Regression Protection: ${globalConfig.prevent_progress_regression ? 'ON' : 'OFF'}${config.isExplicitlySet('prevent_progress_regression') ? '' : ' (default)'}\n`,
        );

        // Re-read Detection Settings
        if (globalConfig.reread_detection) {
          process.stdout.write(`  Re-read Detection:\n`);
          process.stdout.write(
            `    Re-read Threshold: ${globalConfig.reread_detection.reread_threshold || 30}%${globalConfig.reread_detection.reread_threshold !== undefined ? '' : ' (default)'}\n`,
          );
          process.stdout.write(
            `    High Progress Threshold: ${globalConfig.reread_detection.high_progress_threshold || 85}%${globalConfig.reread_detection.high_progress_threshold !== undefined ? '' : ' (default)'}\n`,
          );
          process.stdout.write(
            `    Regression Block Threshold: ${globalConfig.reread_detection.regression_block_threshold || 50}%${globalConfig.reread_detection.regression_block_threshold !== undefined ? '' : ' (default)'}\n`,
          );
          process.stdout.write(
            `    Regression Warn Threshold: ${globalConfig.reread_detection.regression_warn_threshold || 15}%${globalConfig.reread_detection.regression_warn_threshold !== undefined ? '' : ' (default)'}\n`,
          );
        } else {
          process.stdout.write(
            `  Re-read Detection: using defaults (not configured)\n`,
          );
        }

        // =============================================================================
        // RATE LIMITING AND PERFORMANCE
        // =============================================================================
        process.stdout.write(`\n⚡ Rate Limiting and Performance:\n`);
        process.stdout.write(
          `  Hardcover Semaphore: ${globalConfig.hardcover_semaphore}${config.isExplicitlySet('hardcover_semaphore') ? '' : ' (default)'}\n`,
        );
        process.stdout.write(
          `  Hardcover Rate Limit: ${globalConfig.hardcover_rate_limit || 55} req/min${config.isExplicitlySet('hardcover_rate_limit') ? '' : ' (default)'}\n`,
        );
        process.stdout.write(
          `  Audiobookshelf Semaphore: ${globalConfig.audiobookshelf_semaphore}${config.isExplicitlySet('audiobookshelf_semaphore') ? '' : ' (default)'}\n`,
        );
        process.stdout.write(
          `  Audiobookshelf Rate Limit: ${globalConfig.audiobookshelf_rate_limit || 600} req/min${config.isExplicitlySet('audiobookshelf_rate_limit') ? '' : ' (default)'}\n`,
        );

        // =============================================================================
        // LIBRARY FETCHING SETTINGS
        // =============================================================================
        process.stdout.write(`\n📚 Library Fetching Settings:\n`);
        process.stdout.write(
          `  Max Books to Fetch: ${globalConfig.max_books_to_fetch === null ? 'no limit' : globalConfig.max_books_to_fetch || 'no limit'}${config.isExplicitlySet('max_books_to_fetch') ? '' : ' (default)'}\n`,
        );
        process.stdout.write(
          `  Page Size: ${globalConfig.page_size || 100}${config.isExplicitlySet('page_size') ? '' : ' (default)'}\n`,
        );

        // =============================================================================
        // DEBUGGING AND LOGGING
        // =============================================================================
        process.stdout.write(`\n🐛 Debugging and Logging:\n`);
        process.stdout.write(
          `  Dump Failed Books: ${globalConfig.dump_failed_books ? 'ON' : 'OFF'}${config.isExplicitlySet('dump_failed_books') ? '' : ' (default)'}\n`,
        );

        // =============================================================================
        // USERS
        // =============================================================================
        process.stdout.write(`\n👤 Users (${users.length}):\n`);
        for (const user of users) {
          process.stdout.write(`  ${user.id}:\n`);
          process.stdout.write(`    Audiobookshelf: ${user.abs_url}\n`);
          process.stdout.write(`    Hardcover: Connected\n`);
        }
        process.stdout.write('\n✅ Configuration validation: Passed\n');
        break;
      case 'cache': {
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
            case 'stats': {
              const cache = new BookCache();
              const unregisterCache = registerCleanup(() => cache.close());
              try {
                await cache.init();
                const stats = await cache.getCacheStats();
                process.stdout.write('\n=== Cache Statistics ===\n');
                process.stdout.write(`Total books: ${stats.total_books}\n`);
                process.stdout.write(
                  `Recent books (last 7 days): ${stats.recent_books}\n`,
                );
                process.stdout.write(`Cache size: ${stats.cache_size_mb} MB\n`);
              } finally {
                unregisterCache();
              }
              break;
            }
            case 'show': {
              const cache2 = new BookCache();
              const unregisterCache2 = registerCleanup(() => cache2.close());
              try {
                await cache2.init();
                const stats = await cache2.getCacheStats();
                process.stdout.write('\n=== Cache Contents ===\n');
                process.stdout.write(`Total books: ${stats.total_books}\n\n`);

                if (stats.total_books === 0) {
                  process.stdout.write('No books in cache\n');
                } else {
                  const stmt = cache2.db.prepare(
                    'SELECT * FROM books ORDER BY updated_at DESC',
                  );
                  const books = stmt.all();
                  books.forEach((book, index) => {
                    process.stdout.write(`${index + 1}. ${book.title}\n`);
                    process.stdout.write(`   User: ${book.user_id}\n`);
                    process.stdout.write(
                      `   ${book.identifier_type.toUpperCase()}: ${book.identifier}\n`,
                    );
                    process.stdout.write(`   Edition ID: ${book.edition_id}\n`);
                    process.stdout.write(
                      `   Progress: ${book.progress_percent}%\n`,
                    );
                    process.stdout.write(
                      `   Author: ${book.author || 'Unknown'}\n`,
                    );
                    process.stdout.write(`   Last Sync: ${book.last_sync}\n`);
                    process.stdout.write(
                      `   Started At: ${book.started_at || 'Not set'}\n`,
                    );
                    process.stdout.write(
                      `   Last Listened: ${book.last_listened_at || 'Not set'}\n\n`,
                    );
                  });
                }
              } finally {
                unregisterCache2();
              }
              break;
            }
            case 'clear': {
              const cache3 = new BookCache();
              const unregisterCache3 = registerCleanup(() => cache3.close());
              try {
                await cache3.clearCache();
                process.stdout.write('Cache cleared successfully\n');
              } finally {
                unregisterCache3();
              }
              break;
            }
            case 'export': {
              const { filename } = await inquirer.prompt([
                {
                  type: 'input',
                  name: 'filename',
                  message: 'Enter filename for export:',
                  default: `backup-${new Date().toISOString().slice(0, 10)}.json`,
                },
              ]);
              const cache4 = new BookCache();
              const unregisterCache4 = registerCleanup(() => cache4.close());
              try {
                await cache4.exportToJson(filename);
                process.stdout.write(`Cache exported to ${filename}\n`);
              } finally {
                unregisterCache4();
              }
              break;
            }
            case 'back':
              cacheExit = true;
              break;
          }
        }
        break;
      }
      case 'exit':
        exit = true;
        break;
    }
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
