#!/usr/bin/env node

import { performance } from 'perf_hooks';
import { Config } from '../src/config.js';
import { SyncManager } from '../src/sync-manager.js';
import { AudiobookshelfClient } from '../src/audiobookshelf-client.js';
import { HardcoverClient } from '../src/hardcover-client.js';
import { BookCache } from '../src/book-cache.js';
import { ConfigValidator } from '../src/config-validator.js';
import logger from '../src/logger.js';

/**
 * Performance timing instrumentation for ShelfBridge
 * Wraps key functions with timing measurements to identify bottlenecks
 */
class PerformanceProfiler {
    constructor() {
        this.timings = new Map();
        this.stepTimings = [];
        this.warningThreshold = 5000; // 5 seconds
        this.slowThreshold = 10000;   // 10 seconds
        this.verySlowThreshold = 30000; // 30 seconds
    }

    /**
     * Start timing a step
     */
    startStep(stepName, description = '') {
        const startTime = performance.now();
        this.timings.set(stepName, {
            startTime,
            description,
            status: 'running'
        });
        console.log(`⏱️  ${stepName}: Starting... ${description ? `(${description})` : ''}`);
    }

    /**
     * End timing a step and return duration
     */
    endStep(stepName, success = true, details = '') {
        const timing = this.timings.get(stepName);
        if (!timing) {
            console.log(`❌ Error: Step "${stepName}" was not started`);
            return 0;
        }

        const endTime = performance.now();
        const duration = endTime - timing.startTime;
        
        timing.endTime = endTime;
        timing.duration = duration;
        timing.success = success;
        timing.details = details;
        timing.status = success ? 'completed' : 'failed';

        // Add to step timings for summary
        this.stepTimings.push({
            name: stepName,
            description: timing.description,
            duration,
            success,
            details
        });

        // Format duration for display
        const formattedDuration = this.formatDuration(duration);
        const statusIcon = success ? '✅' : '❌';
        const speedIcon = this.getSpeedIcon(duration);

        console.log(`${statusIcon} ${stepName}: ${formattedDuration} ${speedIcon} ${details ? `- ${details}` : ''}`);
        
        return duration;
    }

    /**
     * Wrap an async function with timing
     */
    async timeAsync(stepName, asyncFn, description = '') {
        this.startStep(stepName, description);
        try {
            const result = await asyncFn();
            this.endStep(stepName, true);
            return result;
        } catch (error) {
            this.endStep(stepName, false, error.message);
            throw error;
        }
    }

    /**
     * Wrap a sync function with timing
     */
    timeSync(stepName, syncFn, description = '') {
        this.startStep(stepName, description);
        try {
            const result = syncFn();
            this.endStep(stepName, true);
            return result;
        } catch (error) {
            this.endStep(stepName, false, error.message);
            throw error;
        }
    }

    /**
     * Format duration for display
     */
    formatDuration(ms) {
        if (ms < 1000) {
            return `${Math.round(ms)}ms`;
        } else if (ms < 60000) {
            return `${(ms / 1000).toFixed(1)}s`;
        } else {
            const minutes = Math.floor(ms / 60000);
            const seconds = Math.floor((ms % 60000) / 1000);
            return `${minutes}m ${seconds}s`;
        }
    }

    /**
     * Get speed icon based on duration
     */
    getSpeedIcon(ms) {
        if (ms >= this.verySlowThreshold) return '🐌'; // Very slow
        if (ms >= this.slowThreshold) return '⚠️';     // Slow
        if (ms >= this.warningThreshold) return '⏰';  // Warning
        if (ms < 100) return '⚡';                     // Very fast
        if (ms < 1000) return '🚀';                   // Fast
        return '✨';                                   // Normal
    }

    /**
     * Print detailed timing report
     */
    printReport() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 PERFORMANCE TIMING REPORT');
        console.log('='.repeat(80));

        if (this.stepTimings.length === 0) {
            console.log('No timing data collected');
            return;
        }

        // Sort by duration (slowest first)
        const sortedTimings = [...this.stepTimings].sort((a, b) => b.duration - a.duration);

        // Calculate totals
        const totalDuration = this.stepTimings.reduce((sum, step) => sum + step.duration, 0);
        const successfulSteps = this.stepTimings.filter(step => step.success).length;
        const failedSteps = this.stepTimings.filter(step => !step.success).length;

        // Summary
        console.log(`\n📋 SUMMARY:`);
        console.log(`   Total Steps: ${this.stepTimings.length}`);
        console.log(`   Successful: ${successfulSteps} ✅`);
        console.log(`   Failed: ${failedSteps} ❌`);
        console.log(`   Total Time: ${this.formatDuration(totalDuration)}`);

        // Performance categories
        const verySlowSteps = sortedTimings.filter(step => step.duration >= this.verySlowThreshold);
        const slowSteps = sortedTimings.filter(step => step.duration >= this.slowThreshold && step.duration < this.verySlowThreshold);
        const warningSteps = sortedTimings.filter(step => step.duration >= this.warningThreshold && step.duration < this.slowThreshold);

        if (verySlowSteps.length > 0) {
            console.log(`\n🐌 VERY SLOW STEPS (>${this.formatDuration(this.verySlowThreshold)}):`);
            verySlowSteps.forEach((step, index) => {
                const percentage = ((step.duration / totalDuration) * 100).toFixed(1);
                console.log(`   ${index + 1}. ${step.name}: ${this.formatDuration(step.duration)} (${percentage}% of total)`);
                if (step.description) console.log(`      ${step.description}`);
                if (!step.success && step.details) console.log(`      Error: ${step.details}`);
            });
        }

        if (slowSteps.length > 0) {
            console.log(`\n⚠️  SLOW STEPS (${this.formatDuration(this.slowThreshold)}-${this.formatDuration(this.verySlowThreshold)}):`);
            slowSteps.forEach((step, index) => {
                const percentage = ((step.duration / totalDuration) * 100).toFixed(1);
                console.log(`   ${index + 1}. ${step.name}: ${this.formatDuration(step.duration)} (${percentage}% of total)`);
                if (step.description) console.log(`      ${step.description}`);
                if (!step.success && step.details) console.log(`      Error: ${step.details}`);
            });
        }

        if (warningSteps.length > 0) {
            console.log(`\n⏰ WARNING STEPS (${this.formatDuration(this.warningThreshold)}-${this.formatDuration(this.slowThreshold)}):`);
            warningSteps.forEach((step, index) => {
                const percentage = ((step.duration / totalDuration) * 100).toFixed(1);
                console.log(`   ${index + 1}. ${step.name}: ${this.formatDuration(step.duration)} (${percentage}% of total)`);
                if (step.description) console.log(`      ${step.description}`);
                if (!step.success && step.details) console.log(`      Error: ${step.details}`);
            });
        }

        // Detailed step breakdown
        console.log(`\n📈 DETAILED BREAKDOWN (by execution order):`);
        this.stepTimings.forEach((step, index) => {
            const percentage = ((step.duration / totalDuration) * 100).toFixed(1);
            const statusIcon = step.success ? '✅' : '❌';
            const speedIcon = this.getSpeedIcon(step.duration);
            
            console.log(`   ${index + 1}. ${step.name}: ${this.formatDuration(step.duration)} (${percentage}%) ${statusIcon}${speedIcon}`);
            if (step.description) console.log(`      ${step.description}`);
            if (!step.success && step.details) console.log(`      Error: ${step.details}`);
        });

        // Performance recommendations
        console.log(`\n💡 PERFORMANCE RECOMMENDATIONS:`);
        if (verySlowSteps.length > 0) {
            console.log(`   🔴 CRITICAL: ${verySlowSteps.length} steps took longer than ${this.formatDuration(this.verySlowThreshold)}`);
            console.log(`      Focus on optimizing: ${verySlowSteps.map(s => s.name).join(', ')}`);
        }
        if (slowSteps.length > 0) {
            console.log(`   🟡 MODERATE: ${slowSteps.length} steps took longer than ${this.formatDuration(this.slowThreshold)}`);
            console.log(`      Consider optimizing: ${slowSteps.map(s => s.name).join(', ')}`);
        }
        if (warningSteps.length > 0) {
            console.log(`   🟠 MINOR: ${warningSteps.length} steps took longer than ${this.formatDuration(this.warningThreshold)}`);
        }

        // Suggest specific optimizations
        console.log(`\n🚀 OPTIMIZATION SUGGESTIONS:`);
        
        const absSteps = sortedTimings.filter(step => step.name.includes('audiobookshelf') || step.name.includes('ABS'));
        const hcSteps = sortedTimings.filter(step => step.name.includes('hardcover') || step.name.includes('HC'));
        const cacheSteps = sortedTimings.filter(step => step.name.includes('cache') || step.name.includes('Cache'));
        
        if (absSteps.some(step => step.duration > this.warningThreshold)) {
            console.log(`   📚 Audiobookshelf API: Consider increasing rate limits or using pagination`);
        }
        if (hcSteps.some(step => step.duration > this.warningThreshold)) {
            console.log(`   📖 Hardcover API: Consider reducing GraphQL query complexity or batching`);
        }
        if (cacheSteps.some(step => step.duration > this.warningThreshold)) {
            console.log(`   💾 Cache operations: Consider database optimization or indexing`);
        }

        const bookProcessingSteps = sortedTimings.filter(step => step.name.includes('book') && step.name.includes('process'));
        if (bookProcessingSteps.length > 10 && bookProcessingSteps.some(step => step.duration > 1000)) {
            console.log(`   🔄 Book processing: Consider parallel processing or better progress tracking`);
        }

        console.log('='.repeat(80));
    }
}

/**
 * Instrumented version of the main sync flow
 */
async function runInstrumentedSync(userId = null) {
    const profiler = new PerformanceProfiler();
    let config, globalConfig, users;
    
    try {
        // Configuration loading and validation
        config = await profiler.timeAsync(
            'config_loading',
            async () => {
                const cfg = new Config();
                const validator = new ConfigValidator();
                const validationResult = await validator.validateConfiguration(cfg);
                if (!validationResult.valid) {
                    throw new Error('Configuration validation failed');
                }
                return cfg;
            },
            'Loading and validating configuration'
        );

        globalConfig = profiler.timeSync(
            'global_config_extraction',
            () => config.getGlobal(),
            'Extracting global configuration'
        );

        users = profiler.timeSync(
            'users_config_extraction', 
            () => {
                const allUsers = config.getUsers();
                return userId ? [config.getUser(userId)] : allUsers;
            },
            userId ? `Getting user ${userId}` : 'Getting all users'
        );

        console.log(`\n🔄 Starting instrumented sync for ${users.length} user(s)...`);

        // Test connections for all users
        for (const user of users) {
            await runInstrumentedConnectionTests(profiler, user);
        }

        // Run sync for each user
        for (const user of users) {
            await runInstrumentedUserSync(profiler, user, globalConfig);
        }

    } catch (error) {
        profiler.endStep('overall_sync', false, error.message);
        console.error(`\n❌ Sync failed: ${error.message}`);
    } finally {
        // Print the performance report
        profiler.printReport();
    }
}

/**
 * Instrumented connection testing
 */
async function runInstrumentedConnectionTests(profiler, user) {
    const stepPrefix = `user_${user.id}`;
    
    // Test Audiobookshelf connection
    await profiler.timeAsync(
        `${stepPrefix}_abs_connection_test`,
        async () => {
            const client = new AudiobookshelfClient(user.abs_url, user.abs_token, 1, null, 100);
            const result = await client.testConnection();
            if (!result) throw new Error('Connection failed');
            return result;
        },
        `Testing Audiobookshelf connection for ${user.id}`
    );

    // Test Hardcover connection  
    await profiler.timeAsync(
        `${stepPrefix}_hc_connection_test`,
        async () => {
            const client = new HardcoverClient(user.hardcover_token);
            const result = await client.testConnection();
            if (!result) throw new Error('Connection failed');
            return result;
        },
        `Testing Hardcover connection for ${user.id}`
    );
}

/**
 * Instrumented user sync process
 */
async function runInstrumentedUserSync(profiler, user, globalConfig) {
    const stepPrefix = `user_${user.id}`;
    let syncManager, cache;
    
    try {
        // Initialize sync manager
        syncManager = profiler.timeSync(
            `${stepPrefix}_sync_manager_init`,
            () => new SyncManager(user, globalConfig, globalConfig.dry_run, true),
            `Initializing SyncManager for ${user.id}`
        );

        // Initialize cache
        cache = new BookCache();
        await profiler.timeAsync(
            `${stepPrefix}_cache_init`,
            async () => await cache.init(),
            `Initializing cache for ${user.id}`
        );

        // Fetch Audiobookshelf books
        const absBooks = await profiler.timeAsync(
            `${stepPrefix}_abs_fetch_books`,
            async () => await syncManager.audiobookshelf.getReadingProgress(),
            `Fetching books from Audiobookshelf for ${user.id}`
        );

        console.log(`   Found ${absBooks?.length || 0} books in Audiobookshelf`);

        // Fetch Hardcover library
        const hardcoverBooks = await profiler.timeAsync(
            `${stepPrefix}_hc_fetch_library`,
            async () => await syncManager.hardcover.getUserBooks(),
            `Fetching Hardcover library for ${user.id}`
        );

        console.log(`   Found ${hardcoverBooks?.length || 0} books in Hardcover`);

        if (!absBooks || absBooks.length === 0) {
            profiler.endStep(`${stepPrefix}_book_processing`, true, 'No books to process');
            return;
        }

        // Limit books if configured
        let booksToProcess = absBooks;
        const maxBooks = globalConfig.max_books_to_process;
        if (maxBooks && maxBooks > 0 && absBooks.length > maxBooks) {
            booksToProcess = absBooks.slice(0, maxBooks);
            console.log(`   Limited to first ${maxBooks} books for timing analysis`);
        }

        // Create identifier lookup
        const identifierLookup = profiler.timeSync(
            `${stepPrefix}_create_lookup`,
            () => syncManager._createIdentifierLookup(hardcoverBooks),
            `Creating identifier lookup for ${user.id}`
        );

        // Process individual books with detailed timing
        await runInstrumentedBookProcessing(profiler, stepPrefix, booksToProcess, syncManager, identifierLookup, cache);

    } catch (error) {
        profiler.endStep(`${stepPrefix}_sync`, false, error.message);
        throw error;
    } finally {
        // Cleanup
        if (syncManager) {
            profiler.timeSync(
                `${stepPrefix}_cleanup`,
                () => syncManager.cleanup(),
                `Cleaning up SyncManager for ${user.id}`
            );
        }
        if (cache) {
            profiler.timeSync(
                `${stepPrefix}_cache_cleanup`,
                () => cache.close(),
                `Closing cache for ${user.id}`
            );
        }
    }
}

/**
 * Instrumented book processing with individual book timing
 */
async function runInstrumentedBookProcessing(profiler, stepPrefix, books, syncManager, identifierLookup, cache) {
    const maxBooksToProfile = 10; // Limit detailed per-book profiling to avoid noise
    const booksToProfile = books.slice(0, maxBooksToProfile);
    
    console.log(`   Processing ${books.length} books (detailed timing for first ${Math.min(maxBooksToProfile, books.length)})...`);

    // Time the overall book processing
    await profiler.timeAsync(
        `${stepPrefix}_book_processing_overall`,
        async () => {
            let processedCount = 0;
            
            for (const [index, book] of books.entries()) {
                const bookTitle = book.metadata?.title || book.title || `Book ${index + 1}`;
                const shortTitle = bookTitle.length > 30 ? bookTitle.substring(0, 30) + '...' : bookTitle;
                
                // Only do detailed timing for first few books
                if (index < maxBooksToProfile) {
                    await profiler.timeAsync(
                        `${stepPrefix}_book_${index + 1}`,
                        async () => {
                            // Extract identifiers
                            const identifiers = syncManager._extractBookIdentifier(book);
                            
                            // Check cache
                            const cacheIdentifier = identifiers.asin || identifiers.isbn;
                            if (cacheIdentifier) {
                                const identifierType = identifiers.asin ? 'asin' : 'isbn';
                                await cache.getCachedBookInfo(syncManager.userId, cacheIdentifier, bookTitle, identifierType);
                            }
                            
                            // Check if book exists in Hardcover
                            const hardcoverMatch = syncManager._findBookInHardcover(book, identifierLookup);
                            
                            // Option 1: SIMULATE processing (faster, safer - current default)
                            if (process.env.PROFILE_MODE !== 'real') {
                                if (hardcoverMatch) {
                                    return 'existing_book_sync';
                                } else if (syncManager.globalConfig.auto_add_books) {
                                    return 'auto_add_attempt';
                                } else {
                                    return 'skipped';
                                }
                            }
                            
                            // Option 2: REAL processing (actual sync operations)
                            // Set PROFILE_MODE=real environment variable to enable
                            else {
                                console.log(`      → Running REAL sync for "${shortTitle}"`);
                                
                                // Check progress threshold
                                const currentProgress = book.progress_percentage || 0;
                                if (syncManager._isZeroProgress(currentProgress)) {
                                    return 'skipped_low_progress';
                                }
                                
                                // Check cache for progress changes
                                const identifier = identifiers.asin || identifiers.isbn;
                                const identifierType = identifiers.asin ? 'asin' : 'isbn';
                                
                                if (!syncManager.globalConfig.force_sync && identifier) {
                                    const hasChanged = await cache.hasProgressChanged(
                                        syncManager.userId, 
                                        identifier, 
                                        bookTitle, 
                                        currentProgress, 
                                        identifierType
                                    );
                                    if (!hasChanged) {
                                        return 'skipped_no_change';
                                    }
                                }
                                
                                if (hardcoverMatch) {
                                    // Run actual sync for existing book
                                    const syncResult = await syncManager._syncExistingBook(
                                        book, 
                                        hardcoverMatch, 
                                        identifierType, 
                                        identifier
                                    );
                                    return syncResult.status;
                                } else {
                                    // Run actual auto-add attempt
                                    const autoAddResult = await syncManager._tryAutoAddBook(book, identifiers);
                                    return autoAddResult.status;
                                }
                            }
                        },
                        `Processing "${shortTitle}"${process.env.PROFILE_MODE === 'real' ? ' (REAL SYNC)' : ' (SIMULATED)'}`
                    );
                } else {
                    // Just do basic processing without detailed timing for remaining books
                    const identifiers = syncManager._extractBookIdentifier(book);
                    const cacheIdentifier = identifiers.asin || identifiers.isbn;
                    if (cacheIdentifier) {
                        const identifierType = identifiers.asin ? 'asin' : 'isbn';
                        await cache.getCachedBookInfo(syncManager.userId, cacheIdentifier, bookTitle, identifierType);
                    }
                }
                
                processedCount++;
                
                // Show progress for large libraries
                if (books.length > 20 && processedCount % 10 === 0) {
                    console.log(`     Processed ${processedCount}/${books.length} books...`);
                }
            }
            
            return processedCount;
        },
        `Processing all ${books.length} books${process.env.PROFILE_MODE === 'real' ? ' (REAL SYNC MODE)' : ' (SIMULATION MODE)'}`
    );
}

/**
 * Instrumented cache operations test
 */
async function runInstrumentedCacheTest(profiler) {
    const cache = new BookCache();
    
    try {
        await profiler.timeAsync(
            'cache_init_test',
            async () => await cache.init(),
            'Cache initialization'
        );

        const stats = await profiler.timeAsync(
            'cache_stats_test',
            async () => await cache.getCacheStats(),
            'Getting cache statistics'
        );

        console.log(`\n💾 Cache contains ${stats.total_books} books (${stats.cache_size_mb} MB)`);

        // Test cache operations if there are books
        if (stats.total_books > 0) {
            await profiler.timeAsync(
                'cache_query_test',
                async () => {
                    const stmt = cache.db.prepare('SELECT * FROM books LIMIT 10');
                    return stmt.all();
                },
                'Sample cache query (10 books)'
            );
        }

    } finally {
        profiler.timeSync(
            'cache_cleanup_test',
            () => cache.close(),
            'Cache cleanup'
        );
    }
}

/**
 * Main execution
 */
async function main() {
    console.log('🔍 ShelfBridge Performance Profiler');
    console.log('=====================================\n');
    
    const args = process.argv.slice(2);
    const command = args[0] || 'sync';
    const userId = args[1] || null;

    try {
        switch (command) {
            case 'sync':
                await runInstrumentedSync(userId);
                break;
                
            case 'interactive-sim':
                await runInteractiveSimulation(userId);
                break;
                
            case 'cache':
                const profiler = new PerformanceProfiler();
                await runInstrumentedCacheTest(profiler);
                profiler.printReport();
                break;
                
            case 'help':
                console.log('Usage: node timing-profiler.js [command] [userId]');
                console.log('Commands:');
                console.log('  sync [userId]        - Run instrumented sync (default)');
                console.log('  interactive-sim [userId] - Simulate interactive mode (reused config)');
                console.log('  cache                - Test cache operations');
                console.log('  help                 - Show this help');
                console.log('\nExamples:');
                console.log('  node timing-profiler.js sync');
                console.log('  node timing-profiler.js sync alice');
                console.log('  node timing-profiler.js interactive-sim alice');
                console.log('  node timing-profiler.js cache');
                break;
                
            default:
                console.log(`Unknown command: ${command}`);
                console.log('Use "help" for usage information');
                process.exit(1);
        }
    } catch (error) {
        console.error(`\n💥 Profiler failed: ${error.message}`);
        process.exit(1);
    }
}

/**
 * Simulate interactive mode behavior - reuse config objects and keep connections alive
 */
async function runInteractiveSimulation(userId = null) {
    const profiler = new PerformanceProfiler();
    
    console.log('\n🔄 Running INTERACTIVE MODE simulation...');
    console.log('(Simulates config reuse and persistent connections like interactive mode)\n');
    
    try {
        // Load config ONCE (like interactive mode)
        const config = await profiler.timeAsync(
            'interactive_config_loading',
            async () => {
                const cfg = new Config();
                const validator = new ConfigValidator();
                const validationResult = await validator.validateConfiguration(cfg);
                if (!validationResult.valid) {
                    throw new Error('Configuration validation failed');
                }
                return cfg;
            },
            'Loading configuration (interactive style - once)'
        );

        const globalConfig = config.getGlobal();
        const users = userId ? [config.getUser(userId)] : config.getUsers();

        console.log(`🔄 Starting interactive-style sync for ${users.length} user(s)...`);
        console.log('(Reusing same config objects like interactive mode)\n');

        // Test connections using SAME config objects
        for (const user of users) {
            await runInstrumentedConnectionTests(profiler, user);
        }

        // Run multiple syncs with SAME config (simulating interactive behavior)
        console.log('\n🔁 Running multiple syncs with same config objects (interactive simulation)...\n');
        
        for (let run = 1; run <= 2; run++) {
            console.log(`\n--- Interactive Sync Run #${run} ---`);
            
            for (const user of users) {
                const stepPrefix = `run${run}_user_${user.id}`;
                
                // Reuse the same config objects (like interactive mode)
                await runInstrumentedUserSyncWithConfig(profiler, user, globalConfig, stepPrefix, config);
                
                // Add a small delay to simulate user interaction
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

    } catch (error) {
        profiler.endStep('interactive_simulation', false, error.message);
        console.error(`\n❌ Interactive simulation failed: ${error.message}`);
    } finally {
        // Print comparison report
        profiler.printReport();
        
        console.log('\n' + '='.repeat(80));
        console.log('🔍 INTERACTIVE vs NORMAL MODE ANALYSIS');
        console.log('='.repeat(80));
        console.log('This simulation shows timing differences you might see between:');
        console.log('• Normal sync: Fresh process, new config, new connections');
        console.log('• Interactive mode: Persistent process, reused config, cached connections');
        console.log('');
        console.log('Key differences to look for:');
        console.log('• Run #1 (cold start) vs Run #2 (warmed up) timing');
        console.log('• Database connection initialization time');
        console.log('• HTTP connection establishment time');
        console.log('• Overall sync performance improvements in Run #2');
        console.log('='.repeat(80));
    }
}

/**
 * Run user sync with provided config objects (simulating interactive mode reuse)
 */
async function runInstrumentedUserSyncWithConfig(profiler, user, globalConfig, stepPrefix, config) {
    let syncManager, cache;
    
    try {
        // Initialize sync manager (but with reused globalConfig)
        syncManager = profiler.timeSync(
            `${stepPrefix}_sync_manager_init`,
            () => new SyncManager(user, globalConfig, globalConfig.dry_run, true),
            `Initializing SyncManager for ${user.id} (reused config)`
        );

        // Initialize cache (potentially reused connection)
        cache = new BookCache();
        await profiler.timeAsync(
            `${stepPrefix}_cache_init`,
            async () => await cache.init(),
            `Initializing cache for ${user.id} (potential reuse)`
        );

        // Fetch Audiobookshelf books (potentially reused HTTP connections)
        const absBooks = await profiler.timeAsync(
            `${stepPrefix}_abs_fetch_books`,
            async () => await syncManager.audiobookshelf.getReadingProgress(),
            `Fetching books from Audiobookshelf for ${user.id} (reused client)`
        );

        console.log(`   Found ${absBooks?.length || 0} books in Audiobookshelf`);

        // Fetch Hardcover library (potentially reused HTTP connections)
        const hardcoverBooks = await profiler.timeAsync(
            `${stepPrefix}_hc_fetch_library`,
            async () => await syncManager.hardcover.getUserBooks(),
            `Fetching Hardcover library for ${user.id} (reused client)`
        );

        console.log(`   Found ${hardcoverBooks?.length || 0} books in Hardcover`);

        if (!absBooks || absBooks.length === 0) {
            profiler.endStep(`${stepPrefix}_book_processing`, true, 'No books to process');
            return;
        }

        // Limit books for testing
        let booksToProcess = absBooks.slice(0, 5); // Limit to 5 for faster testing

        // Create identifier lookup (using same config/data)
        const identifierLookup = profiler.timeSync(
            `${stepPrefix}_create_lookup`,
            () => syncManager._createIdentifierLookup(hardcoverBooks),
            `Creating identifier lookup for ${user.id} (reused data)`
        );

        // Process books with potential caching benefits
        await runInstrumentedBookProcessing(profiler, stepPrefix, booksToProcess, syncManager, identifierLookup, cache);

    } catch (error) {
        profiler.endStep(`${stepPrefix}_sync`, false, error.message);
        throw error;
    } finally {
        // Cleanup
        if (syncManager) {
            profiler.timeSync(
                `${stepPrefix}_cleanup`,
                () => syncManager.cleanup(),
                `Cleaning up SyncManager for ${user.id}`
            );
        }
        if (cache) {
            profiler.timeSync(
                `${stepPrefix}_cache_cleanup`,
                () => cache.close(),
                `Closing cache for ${user.id}`
            );
        }
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { PerformanceProfiler }; 