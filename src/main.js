#!/usr/bin/env node

import { Command } from 'commander';
import { Config } from './config.js';
import { SyncManager } from './sync-manager.js';
import { AudiobookshelfClient } from './audiobookshelf-client.js';
import { HardcoverClient } from './hardcover-client.js';
import { BookCache } from './book-cache.js';
import cron from 'node-cron';

const program = new Command();

program
    .name('ShelfBridge')
    .description('Sync your audiobook listening progress from Audiobookshelf to Hardcover')
    .version('1.0.0');

// Global options
program.option('-v, --verbose', 'Enable verbose logging');
program.option('--dry-run', 'Run without making changes');

// Sync command
program
    .command('sync')
    .description('Sync reading progress')
    .option('--all-users', 'Sync all users')
    .option('-u, --user <userId>', 'Sync specific user')
    .action(async (options) => {
        try {
            const config = new Config();
            const globalConfig = config.getGlobal();
            const users = config.getUsers();
            
            // Override dry_run from config if --dry-run flag is used
            if (options.dryRun) {
                globalConfig.dry_run = true;
            }
            
            if (options.user) {
                // Sync specific user
                const user = config.getUser(options.user);
                await syncUser(user, globalConfig);
            } else {
                // Sync all users
                for (const user of users) {
                    console.log(`\n=== Syncing user: ${user.id} ===`);
                    await syncUser(user, globalConfig);
                }
            }
        } catch (error) {
            console.error('Sync failed:', error.message);
            process.exit(1);
        }
    });

// Test command
program
    .command('test')
    .description('Test API connections')
    .option('--all-users', 'Test all users')
    .option('-u, --user <userId>', 'Test specific user')
    .action(async (options) => {
        try {
            const config = new Config();
            const users = config.getUsers();
            
            if (options.user) {
                const user = config.getUser(options.user);
                await testUser(user);
            } else {
                for (const user of users) {
                    console.log(`\n=== Testing user: ${user.id} ===`);
                    await testUser(user);
                }
            }
        } catch (error) {
            console.error('Test failed:', error.message);
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
    .description('Show configuration status')
    .action(() => {
        try {
            const config = new Config();
            showConfig(config);
        } catch (error) {
            console.error('Config check failed:', error.message);
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
            const cache = new BookCache();
            
            if (options.clear) {
                cache.clearCache();
                console.log('Cache cleared successfully');
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
            console.error('Cache operation failed:', error.message);
            process.exit(1);
        }
    });

// Cron command
program
    .command('cron')
    .description('Start scheduled sync (runs in background)')
    .action(async () => {
        try {
            const config = new Config();
            const cronConfig = config.getCronConfig();
            
            console.log(`Starting scheduled sync with cron: ${cronConfig.schedule} (timezone: ${cronConfig.timezone})`);
            
            // Run initial sync
            console.log('Running initial sync...');
            await runScheduledSync(config);
            
            // Schedule recurring sync
            cron.schedule(cronConfig.schedule, () => {
                console.log('\n=== Scheduled sync triggered ===');
                runScheduledSync(config);
            }, {
                timezone: cronConfig.timezone
            });
            
            console.log('Scheduled sync started. Press Ctrl+C to stop.');
            
            // Keep the process running
            process.on('SIGINT', () => {
                console.log('\nStopping scheduled sync...');
                process.exit(0);
            });
            
        } catch (error) {
            console.error('Failed to start scheduled sync:', error.message);
            process.exit(1);
        }
    });

// Interactive command
program
    .command('interactive')
    .description('Run in interactive mode')
    .action(async () => {
        try {
            await runInteractiveMode();
        } catch (error) {
            console.error('Interactive mode failed:', error.message);
            process.exit(1);
        }
    });

program
    .command('debug')
    .description('Debug: Show raw Audiobookshelf data')
    .action(async () => {
        try {
            const config = new Config();
            const users = config.getUsers();
            
            if (users.length === 0) {
                console.error('No users configured');
                process.exit(1);
            }
            
            const user = users[0]; // Use first user
            console.log(`=== Debugging Audiobookshelf data for user: ${user.id} ===`);
            
            const audiobookshelf = new AudiobookshelfClient(
                user.abs_url, 
                user.abs_token, 
                3
            );
            
            const books = await audiobookshelf.getReadingProgress();
            console.log(`\nFound ${books.length} total books in Audiobookshelf`);
            
            books.forEach((book, index) => {
                const title = (book.media && book.media.metadata && book.media.metadata.title) || book.title || 'Unknown';
                const progress = book.progress_percentage || 0;
                const isFinished = book.is_finished || false;
                console.log(`${index + 1}. '${title}' - Progress: ${progress}% - Finished: ${isFinished}`);
            });
            
        } catch (error) {
            console.error('Debug failed:', error.message);
            process.exit(1);
        }
    });

async function syncUser(user, globalConfig) {
    const startTime = Date.now();
    console.log(`Starting sync for user: ${user.id}`);
    
    try {
        const syncManager = new SyncManager(user, globalConfig, globalConfig.dry_run);
        const result = await syncManager.syncProgress();
        
        // Log summary
        const duration = (Date.now() - startTime) / 1000;
        console.log('='.repeat(50));
        console.log('📚 SYNC SUMMARY');
        console.log('='.repeat(50));
        console.log(`⏱️  Duration: ${duration.toFixed(1)}s`);
        console.log(`📖 Books processed: ${result.books_processed}`);
        console.log(`✅ Books synced: ${result.books_synced}`);
        console.log(`🎯 Books completed: ${result.books_completed}`);
        console.log(`➕ Books auto-added: ${result.books_auto_added}`);
        console.log(`⏭ Books skipped: ${result.books_skipped}`);
        
        if (result.errors.length > 0) {
            console.log(`❌ Errors encountered: ${result.errors.length}`);
            for (const error of result.errors) {
                console.error(`  - ${error}`);
            }
        } else {
            console.log('🎉 No errors encountered!');
        }
        
        console.log('='.repeat(50));
        
        return result;
    } catch (error) {
        console.error(`Sync failed for user ${user.id}:`, error.message);
        throw error;
    }
}

async function testUser(user) {
    console.log('🔍 Testing API connections...');
    
    let absStatus = false;
    let hcStatus = false;
    
    try {
        console.log('📚 Testing Audiobookshelf connection...');
        const absClient = new AudiobookshelfClient(user.abs_url, user.abs_token);
        absStatus = await absClient.testConnection();
        
        if (absStatus) {
            console.log('✅ Audiobookshelf connection: Success');
        } else {
            console.error('❌ Audiobookshelf connection: Failed');
        }
    } catch (error) {
        console.error(`❌ Audiobookshelf connection failed: ${error.message}`);
        absStatus = false;
    }
    
    try {
        console.log('📖 Testing Hardcover connection...');
        const hcClient = new HardcoverClient(user.hardcover_token);
        hcStatus = await hcClient.testConnection();
        
        if (hcStatus) {
            console.log('✅ Hardcover connection: Success');
        } else {
            console.error('❌ Hardcover connection: Failed');
        }
    } catch (error) {
        console.error(`❌ Hardcover connection failed: ${error.message}`);
        hcStatus = false;
    }
    
    // Summary
    console.log('='.repeat(40));
    if (absStatus && hcStatus) {
        console.log('🎉 All connections successful!');
    } else {
        console.error('❌ Some connections failed!');
    }
    console.log('='.repeat(40));
    
    return absStatus && hcStatus;
}

function showConfig(config) {
    console.log('=== Configuration Status ===');
    
    // Show global config
    const globalConfig = config.getGlobal();
    console.log('Global settings:');
    for (const [key, value] of Object.entries(globalConfig)) {
        console.log(`  ${key}: ${value}`);
    }
    
    // Show users
    const users = config.getUsers();
    console.log(`\nConfigured users (${users.length}):`);
    for (const user of users) {
        const id = user.id || '[missing id]';
        const absUrl = user.abs_url || '[missing abs_url]';
        const absToken = user.abs_token;
        const hardcoverToken = user.hardcover_token;
        
        console.log(`- id: ${id}`);
        console.log(`    abs_url: ${absUrl}`);
        console.log(`    abs_token: ${absToken ? 'set' : 'MISSING'}`);
        console.log(`    hardcover_token: ${hardcoverToken ? 'set' : 'MISSING'}`);
    }
    
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
        console.log('\nSome users have missing fields:');
        for (const m of missing) {
            console.log(`  ${m}`);
        }
        console.log('\nPlease edit config/config.yaml to fix missing values.');
        return false;
    } else {
        console.log('\n✓ All users and global settings are configured correctly!');
        return true;
    }
}

async function runScheduledSync(config) {
    try {
        const globalConfig = config.getGlobal();
        const users = config.getUsers();
        
        for (const user of users) {
            console.log(`\n=== Scheduled sync for user: ${user.id} ===`);
            await syncUser(user, globalConfig);
        }
    } catch (error) {
        console.error('Scheduled sync failed:', error.message);
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