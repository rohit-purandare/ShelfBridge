#!/usr/bin/env node

import { Command } from 'commander';
import { Config } from './config.js';
import { ConfigValidator } from './config-validator.js';
import { SyncManager } from './sync-manager.js';
import { AudiobookshelfClient } from './audiobookshelf-client.js';
import { HardcoverClient } from './hardcover-client.js';
import { BookCache } from './book-cache.js';
import cron from 'node-cron';
import logger from './logger.js';

const program = new Command();

program
    .name('ShelfBridge')
    .description('Sync your audiobook reading progress from Audiobookshelf to Hardcover automatically')
    .version('1.0.0');

program.option('--dry-run', 'Run without making changes');
program.option('--skip-validation', 'Skip configuration validation on startup');

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
        logger.error('Configuration validation error', { 
            error: error.message, 
            stack: error.stack 
        });
        
        console.error('\n❌ Configuration validation failed:');
        console.error(`   ${error.message}`);
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
        const validator = new ConfigValidator();
        const users = config.getUsers();
        
        const connectionErrors = await validator.testConnections(users);
        
        if (connectionErrors.length > 0) {
            logger.error('API connection tests failed');
            console.error('\n❌ API Connection Tests Failed:');
            connectionErrors.forEach(error => {
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
            stack: error.stack 
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
    .action(async (options) => {
        try {
            // Validate configuration first
            await validateConfigurationOnStartup(program.opts().skipValidation);
            
            const config = new Config();
            const globalConfig = config.getGlobal();
            const users = config.getUsers();
            
            // Override dry_run from config if --dry-run flag is used
            if (options.dryRun || program.opts().dryRun) {
                globalConfig.dry_run = true;
            }
            
            // Add force flag to global config
            if (options.force) {
                globalConfig.force_sync = true;
            }
            
            // Show startup information
            logger.debug('Starting sync', {
                users: users.length,
                dryRun: globalConfig.dry_run,
                minProgressThreshold: globalConfig.min_progress_threshold
            });
            
            if (options.user) {
                // Sync specific user
                const user = config.getUser(options.user);
                await syncUser(user, globalConfig);
            } else {
                // Sync all users
                for (const user of users) {
                    await syncUser(user, globalConfig);
                }
            }
        } catch (error) {
            logger.error('Sync failed', { error: error.message, stack: error.stack });
            process.exit(1);
        }
    });

// Test command
program
    .command('test')
    .description('Test API connections')
    .option('-u, --user <userId>', 'Test specific user')
    .action(async (options) => {
        try {
            // Validate configuration first
            await validateConfigurationOnStartup(program.opts().skipValidation);
            
            const config = new Config();
            const users = config.getUsers();
            
            if (options.user) {
                const user = config.getUser(options.user);
                await testUser(user);
            } else {
                for (const user of users) {
                    logger.info('Starting test for user', { userId: user.id });
                    await testUser(user);
                }
            }
        } catch (error) {
            logger.error('Test failed', { error: error.message, stack: error.stack });
            process.exit(1);
        }
    });

// Validate command
program
    .command('validate')
    .description('Validate configuration without running sync')
    .option('--connections', 'Test API connections')
    .option('--help-config', 'Show configuration help')
    .action(async (options) => {
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
            
        } catch (error) {
            logger.error('Validation failed', { error: error.message, stack: error.stack });
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
                        console.log(`  Args: ${field.args.map(arg => arg.name).join(', ')}`);
                    }
                });
            } else {
                console.log('No schema information available');
            }
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
                const mutationType = schema.__schema.types.find(type => type.name === 'mutation_root');
                if (mutationType && mutationType.fields) {
                    const updateMutation = mutationType.fields.find(field => field.name === 'update_user_book_read');
                    if (updateMutation) {
                        console.log('update_user_book_read mutation found:');
                        if (updateMutation.args && updateMutation.args.length > 0) {
                            console.log('Arguments:', updateMutation.args.map(arg => arg.name).join(', '));
                            
                            // Find the input type for the object argument
                            const objectArg = updateMutation.args.find(arg => arg.name === 'object');
                            if (objectArg && objectArg.type && objectArg.type.ofType) {
                                const inputTypeName = objectArg.type.ofType.name;
                                console.log(`Object argument type: ${inputTypeName}`);
                                
                                // Find the input type definition
                                const inputType = schema.__schema.types.find(type => type.name === inputTypeName);
                                if (inputType && inputType.inputFields && inputType.inputFields.length > 0) {
                                    console.log('Available fields in object:');
                                    inputType.inputFields.forEach(field => {
                                        const fieldType = field.type.name || (field.type.ofType ? field.type.ofType.name : 'Unknown');
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
                const inputTypes = schema.__schema.types.filter(type => type.kind === 'INPUT_OBJECT');
                inputTypes.forEach(type => {
                    console.log(`\nInput type: ${type.name}`);
                    if (type.inputFields && type.inputFields.length > 0) {
                        type.inputFields.forEach(field => {
                            const fieldType = field.type.name || (field.type.ofType ? field.type.ofType.name : 'Unknown');
                            console.log(`  - ${field.name}: ${fieldType}`);
                        });
                    } else {
                        console.log('  (No fields)');
                    }
                });
            } else {
                console.log('No detailed schema information available');
            }
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
        } catch (error) {
            logger.error('Config check failed', { error: error.message, stack: error.stack });
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
    .action(async (options) => {
        try {
            // Skip validation for cache operations (they don't need API access)
            
            const cache = new BookCache();
            
            if (options.clear) {
                cache.clearCache();
                logger.info('Cache cleared successfully');
            } else if (options.stats) {
                const stats = cache.getCacheStats();
                console.log('=== Cache Statistics ===');
                console.log(`Total books: ${stats.total_books}`);
                console.log(`Recent books (last 7 days): ${stats.recent_books}`);
                console.log(`Cache size: ${stats.cache_size_mb} MB`);
            } else if (options.show) {
                const stats = cache.getCacheStats();
                console.log('=== Cache Contents ===');
                console.log(`Total books: ${stats.total_books}`);
                console.log('');
                
                // Get all books ordered by most recent
                const stmt = cache.db.prepare('SELECT * FROM books ORDER BY updated_at DESC');
                const books = stmt.all();
                
                if (books.length === 0) {
                    console.log('No books in cache');
                } else {
                    books.forEach((book, index) => {
                        console.log(`${index + 1}. ${book.title}`);
                        console.log(`   User: ${book.user_id}`);
                        console.log(`   ${book.identifier_type.toUpperCase()}: ${book.identifier}`);
                        console.log(`   Edition ID: ${book.edition_id}`);
                        console.log(`   Progress: ${book.progress_percent}%`);
                        console.log(`   Author: ${book.author || 'Unknown'}`);
                        console.log(`   Last Sync: ${book.last_sync}`);
                        console.log(`   Started At: ${book.started_at || 'Not set'}`);
                        console.log(`   Last Listened: ${book.last_listened_at || 'Not set'}`);
                        console.log('');
                    });
                }
            } else if (options.export) {
                cache.exportToJson(options.export);
            } else {
                console.log('Use --clear, --stats, --show, or --export to manage cache');
            }
            
            cache.close();
        } catch (error) {
            logger.error('Cache operation failed', { error: error.message, stack: error.stack });
            process.exit(1);
        }
    });

// Cron command
program
    .command('cron')
    .description('Start scheduled sync (runs in background)')
    .action(async () => {
        try {
            // Validate configuration first
            await validateConfigurationOnStartup(program.opts().skipValidation);
            
            const config = new Config();
            const cronConfig = config.getCronConfig();
            
            logger.info('Starting scheduled sync', { 
                schedule: cronConfig.schedule, 
                timezone: cronConfig.timezone 
            });
            
            // Run initial sync
            logger.info('Running initial sync...');
            await runScheduledSync(config);
            
            // Schedule recurring sync
            cron.schedule(cronConfig.schedule, () => {
                logger.info('Scheduled sync triggered');
                runScheduledSync(config);
            }, {
                timezone: cronConfig.timezone
            });
            
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
            logger.error('Cron setup failed', { error: error.message, stack: error.stack });
            process.exit(1);
        }
    });

// Default command (interactive mode)
program
    .command('start', { isDefault: true })
    .description('Start in interactive mode')
    .action(async () => {
        try {
            // Validate configuration first
            await validateConfigurationOnStartup(program.opts().skipValidation);
            
            await runInteractiveMode();
        } catch (error) {
            logger.error('Interactive mode failed', { error: error.message, stack: error.stack });
            process.exit(1);
        }
    });

// Debug command
program
    .command('debug')
    .description('Show debug information')
    .option('-u, --user <userId>', 'Debug specific user')
    .action(async (options) => {
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
                    logger.info('Starting debug for user', { userId: user.id });
                    await debugUser(user);
                }
            }
        } catch (error) {
            logger.error('Debug failed', { error: error.message, stack: error.stack });
            process.exit(1);
        }
    });

async function syncUser(user, globalConfig) {
    // Validate user object
    if (!user) {
        throw new Error('User object is required');
    }
    
    if (!user.id || !user.abs_url || !user.abs_token || !user.hardcover_token) {
        throw new Error(`Invalid user configuration: missing required fields for user ${user.id || 'unknown'}`);
    }
    
    const startTime = Date.now();
    
    try {
        const syncManager = new SyncManager(user, globalConfig, globalConfig.dry_run);
        const result = await syncManager.syncProgress();
        
        // Log summary
        const duration = (Date.now() - startTime) / 1000;
        
        logger.debug('Sync completed for user', {
            userId: user.id,
            summary: {
                duration: `${duration.toFixed(1)}s`,
                books_processed: result.books_processed,
                books_synced: result.books_synced,
                books_completed: result.books_completed,
                books_auto_added: result.books_auto_added,
                books_skipped: result.books_skipped,
                errors: result.errors.length
            }
        });

        // Display detailed console summary
        console.log('='.repeat(50));
        console.log('📚 SYNC SUMMARY');
        console.log('='.repeat(50));
        console.log(`⏱️  Duration: ${duration.toFixed(1)}s`);
        console.log(`📖 Books processed: ${result.books_processed}`);
        console.log(`✅ Books synced: ${result.books_synced}`);
        console.log(`🎯 Books completed: ${result.books_completed}`);
        console.log(`➕ Books auto-added: ${result.books_auto_added}`);
        console.log(`⏭️  Books skipped: ${result.books_skipped}`);
        console.log(`❌ Errors: ${result.errors.length}`);
        console.log('='.repeat(50));

        // Show detailed book results if any books were processed
        if (result.book_details && result.book_details.length > 0) {
            console.log('\n📋 DETAILED BOOK RESULTS');
            console.log('='.repeat(50));
            
            result.book_details.forEach((book, index) => {
                const statusIcon = {
                    'synced': '✅',
                    'completed': '🎯',
                    'auto_added': '➕',
                    'skipped': '⏭️',
                    'error': '❌'
                }[book.status] || '❓';
                
                console.log(`\n${index + 1}. ${statusIcon} ${book.title}`);
                console.log(`   Status: ${book.status.toUpperCase()}`);
                
                if (book.progress.before !== null) {
                    console.log(`   Progress: ${book.progress.before.toFixed(1)}%`);
                }
                
                if (book.identifiers && Object.keys(book.identifiers).length > 0) {
                    const identifierStr = Object.entries(book.identifiers)
                        .filter(([k, v]) => v)
                        .map(([k, v]) => `${k.toUpperCase()}=${v}`)
                        .join(', ');
                    if (identifierStr) {
                        console.log(`   Identifiers: ${identifierStr}`);
                    }
                }
                
                if (book.actions && book.actions.length > 0) {
                    console.log(`   Actions:`);
                    book.actions.forEach(action => {
                        console.log(`     • ${action}`);
                    });
                }
                
                if (book.errors && book.errors.length > 0) {
                    console.log(`   Errors:`);
                    book.errors.forEach(error => {
                        console.log(`     ❌ ${error}`);
                    });
                }
                
                if (book.timing) {
                    console.log(`   Processing time: ${book.timing}ms`);
                }
            });
            
            console.log('='.repeat(50));
        }

        // Show error summary if there were errors
        if (result.errors && result.errors.length > 0) {
            console.log('\n❌ ERROR SUMMARY');
            console.log('='.repeat(30));
            result.errors.forEach((error, index) => {
                console.log(`${index + 1}. ${error}`);
            });
            console.log('='.repeat(30));
        }

        // Show status breakdown
        if (result.book_details && result.book_details.length > 0) {
            const statusCounts = {};
            result.book_details.forEach(book => {
                statusCounts[book.status] = (statusCounts[book.status] || 0) + 1;
            });
            
            console.log('\n📊 STATUS BREAKDOWN');
            console.log('='.repeat(30));
            Object.entries(statusCounts).forEach(([status, count]) => {
                const statusIcon = {
                    'synced': '✅',
                    'completed': '🎯',
                    'auto_added': '➕',
                    'skipped': '⏭️',
                    'error': '❌'
                }[status] || '❓';
                console.log(`${statusIcon} ${status.toUpperCase()}: ${count}`);
            });
            console.log('='.repeat(30));
        }

        console.log('\n🏁 Sync completed successfully!');
        
    } catch (error) {
        logger.error('Sync failed for user', { 
            userId: user.id,
            error: error.message, 
            stack: error.stack 
        });
        throw error;
    }
}

async function testUser(user) {
    const userLogger = logger.forUser(user.id);
    userLogger.info('Testing API connections');
    
    let absStatus = false;
    let hcStatus = false;
    
    try {
        userLogger.info('Testing Audiobookshelf connection');
        const absClient = new AudiobookshelfClient(user.abs_url, user.abs_token);
        absStatus = await absClient.testConnection();
        
        if (absStatus) {
            userLogger.info('Audiobookshelf connection successful');
        } else {
            userLogger.error('Audiobookshelf connection failed');
        }
    } catch (error) {
        userLogger.error('Audiobookshelf connection failed', { 
            error: error.message, 
            stack: error.stack 
        });
        absStatus = false;
    }
    
    try {
        userLogger.info('Testing Hardcover connection');
        const hcClient = new HardcoverClient(user.hardcover_token);
        hcStatus = await hcClient.testConnection();
        
        if (hcStatus) {
            userLogger.info('Hardcover connection successful');
        } else {
            userLogger.error('Hardcover connection failed');
        }
    } catch (error) {
        userLogger.error('Hardcover connection failed', { 
            error: error.message, 
            stack: error.stack 
        });
        hcStatus = false;
    }
    
    // Summary
    const allSuccessful = absStatus && hcStatus;
    userLogger.info('Connection test completed', { 
        audiobookshelf: absStatus, 
        hardcover: hcStatus, 
        allSuccessful 
    });
    
    return allSuccessful;
}

function showConfig(config) {
    logger.info('Showing configuration status');
    
    // Show global config
    const globalConfig = config.getGlobal();
    logger.info('Global configuration loaded', { 
        settings: Object.keys(globalConfig),
        hasAllRequired: true 
    });
    
    // Show users
    const users = config.getUsers();
    logger.info('User configuration loaded', { 
        userCount: users.length 
    });
    
    // Check for missing user fields
    const missing = [];
    for (const user of users) {
        for (const key of ['id', 'abs_url', 'abs_token', 'hardcover_token']) {
            if (!user[key]) {
                missing.push(`User '${user.id || '[unknown]'}' missing: ${key}`);
            }
        }
    }
    
    if (missing.length > 0) {
        logger.warn('Configuration validation failed', { 
            missingFields: missing,
            userCount: users.length 
        });
        return false;
    } else {
        logger.info('Configuration validation passed', { 
            userCount: users.length 
        });
        return true;
    }
}

async function runScheduledSync(config) {
    try {
        const globalConfig = config.getGlobal();
        const users = config.getUsers();
        
        logger.info('Starting scheduled sync', { userCount: users.length });
        
        for (const user of users) {
            logger.info('Starting scheduled sync for user', { userId: user.id });
            await syncUser(user, globalConfig);
        }
        
        logger.info('Scheduled sync completed', { userCount: users.length });
    } catch (error) {
        logger.error('Scheduled sync failed', { 
            error: error.message, 
            stack: error.stack 
        });
    }
}

async function runInteractiveMode() {
    console.log('=== Audiobookshelf to Hardcover Sync Tool ===');
    console.log('Interactive mode - choose an option:');
    console.log('1. Sync all users');
    console.log('2. Sync specific user');
    console.log('3. Test connections');
    console.log('4. Show configuration');
    console.log('5. Manage cache');
    console.log('6. Exit');
    
    // For now, just run sync all users
    // In a full implementation, you'd use a library like readline or inquirer
    console.log('\nRunning sync for all users...');
    
    const config = new Config();
    const globalConfig = config.getGlobal();
    const users = config.getUsers();
    
    for (const user of users) {
        console.log(`\n=== Syncing user: ${user.id} ===`);
        await syncUser(user, globalConfig);
    }
}

// Parse command line arguments
program.parse();

// If no command is provided, show help
if (!process.argv.slice(2).length) {
    program.outputHelp();
}

// Graceful shutdown handler
process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down gracefully');
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down gracefully');
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
}); 