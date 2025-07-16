# ShelfBridge Performance Timing Profiler

A standalone timing instrumentation script that wraps key functions and async operations in ShelfBridge with detailed performance measurements to help identify bottlenecks.

## Features

- **Real-time timing feedback**: Shows timing as operations complete
- **Visual performance indicators**: Uses emojis to indicate performance (🚀 fast, ⚠️ slow, 🐌 very slow)
- **Comprehensive reporting**: Detailed breakdown of all timed operations
- **Categorized performance analysis**: Groups operations by performance level
- **Optimization suggestions**: Provides specific recommendations based on timing data
- **Multiple operation modes**: Test sync operations, cache performance, or specific users

## Usage

### Basic Commands

```bash
# Profile a full sync operation (all users) - SIMULATED mode
node tools/timing-profiler.js sync

# Profile sync for a specific user - SIMULATED mode
node tools/timing-profiler.js sync alice

# Profile with REAL sync operations (makes actual API calls)
PROFILE_MODE=real node tools/timing-profiler.js sync alice

# Profile cache operations only
node tools/timing-profiler.js cache

# Simulate interactive mode behavior (test timing differences)
node tools/timing-profiler.js interactive-sim alice

# Show help
node tools/timing-profiler.js help
```

### Using npm scripts

```bash
# Profile full sync (simulated)
npm run profile

# Profile cache operations
npm run profile-cache

# Profile specific user (pass arguments after --)
npm run profile -- sync alice

# Profile with real sync operations
PROFILE_MODE=real npm run profile -- sync alice
```

## Operating Modes

The profiler operates in two modes:

### 🔄 **SIMULATION Mode** (Default - Safe)
- **What it does**: Times all operations up to the actual sync calls
- **API calls made**: Configuration, connection tests, book fetching, cache operations
- **API calls NOT made**: Progress updates, book completion, auto-adding books
- **Use when**: You want to identify bottlenecks without making changes to your data
- **Safety**: Completely safe - no data modifications

### ⚡ **REAL SYNC Mode** (Advanced - Makes Changes)
- **What it does**: Runs the actual sync operations including API calls to Hardcover
- **API calls made**: Everything including progress updates and auto-adding books
- **Use when**: You want true timing of the complete sync process
- **Safety**: ⚠️ **Will modify your Hardcover data** - use carefully!

```bash
# Enable real sync mode
PROFILE_MODE=real node tools/timing-profiler.js sync alice
```

## What Gets Timed

The profiler instruments the following key operations:

### Configuration & Setup (Both Modes)
- Configuration loading and validation
- User configuration extraction
- Connection testing (Audiobookshelf & Hardcover)

### Sync Operations
- Fetching books from Audiobookshelf
- Fetching user library from Hardcover
- Creating identifier lookup tables
- Individual book processing (first 10 books get detailed timing)
- Overall book processing time

**In SIMULATION mode:**
- Book identifier extraction
- Cache lookups
- Hardcover library matching
- Decision logic (would sync/skip/auto-add)

**In REAL SYNC mode (PROFILE_MODE=real):**
- All simulation operations PLUS:
- Actual progress updates to Hardcover API
- Book completion marking
- Auto-adding books to Hardcover library
- Cache storage of sync results

### Cache Operations (Both Modes)
- Cache initialization
- Cache statistics gathering
- Sample database queries
- Cache cleanup

## Interactive vs Normal Sync Timing Analysis

If you notice significant timing differences between `node src/main.js sync` and running sync through interactive mode, use the interactive simulation to understand why:

```bash
# Test interactive mode behavior simulation
node tools/timing-profiler.js interactive-sim alice
```

### Common Timing Differences:

**🔥 HTTP Connection Reuse**
- **Normal sync**: Establishes fresh HTTP connections to APIs
- **Interactive mode**: Reuses persistent HTTP connections (faster)

**💾 Database Connection Pooling**
- **Normal sync**: Fresh SQLite database connection
- **Interactive mode**: Potentially cached database connections

**🚀 JIT Optimization**
- **Normal sync**: Cold start performance
- **Interactive mode**: Node.js JIT optimizations from previous runs

**📦 Config Object Reuse**
- **Normal sync**: Fresh config parsing and validation
- **Interactive mode**: Reused config objects in memory

The interactive simulation runs multiple sync cycles with the same config objects to show you these performance differences.

## Performance Thresholds

The profiler categorizes operations based on duration:

- **⚡ Very Fast**: < 100ms
- **🚀 Fast**: 100ms - 1s  
- **✨ Normal**: 1s - 5s
- **⏰ Warning**: 5s - 10s
- **⚠️ Slow**: 10s - 30s
- **🐌 Very Slow**: > 30s

## Sample Output

```
🔍 ShelfBridge Performance Profiler
=====================================

⏱️  config_loading: Starting... (Loading and validating configuration)
✅ config_loading: 45ms 🚀

⏱️  user_alice_abs_connection_test: Starting... (Testing Audiobookshelf connection for alice)
✅ user_alice_abs_connection_test: 234ms 🚀

⏱️  user_alice_abs_fetch_books: Starting... (Fetching books from Audiobookshelf for alice)
✅ user_alice_abs_fetch_books: 2.3s ✨

================================================================================
📊 PERFORMANCE TIMING REPORT
================================================================================

📋 SUMMARY:
   Total Steps: 15
   Successful: 14 ✅
   Failed: 1 ❌
   Total Time: 45.7s

⚠️  SLOW STEPS (10.0s-30.0s):
   1. user_alice_hc_fetch_library: 15.2s (33.3% of total)
      Fetching Hardcover library for alice

⏰ WARNING STEPS (5.0s-10.0s):
   1. user_alice_book_processing_overall: 8.1s (17.7% of total)
      Processing all 127 books

💡 PERFORMANCE RECOMMENDATIONS:
   🟡 MODERATE: 1 steps took longer than 10.0s
      Consider optimizing: user_alice_hc_fetch_library

🚀 OPTIMIZATION SUGGESTIONS:
   📖 Hardcover API: Consider reducing GraphQL query complexity or batching
   🔄 Book processing: Consider parallel processing or better progress tracking
================================================================================
```

## Interpreting Results

### Critical Issues (🐌 Very Slow > 30s)
- Immediate attention required
- Likely API timeouts, network issues, or inefficient queries
- Check network connectivity and API rate limits

### Moderate Issues (⚠️ Slow 10-30s)
- Should be optimized for better user experience
- Common causes: large library fetches, complex GraphQL queries
- Consider pagination, caching, or parallel processing

### Minor Issues (⏰ Warning 5-10s)
- May impact user experience with large libraries
- Monitor these operations as library size grows

## Common Performance Bottlenecks

### Hardcover Library Fetching
- **Cause**: Large libraries with complex GraphQL queries
- **Solution**: Implement pagination or reduce query complexity

### Audiobookshelf Book Fetching
- **Cause**: Large libraries, network latency
- **Solution**: Increase pagination size or use parallel requests

### Individual Book Processing
- **Cause**: Many cache lookups and API calls in sequence
- **Solution**: Enable parallel processing in config

### Cache Operations
- **Cause**: Database without proper indexes
- **Solution**: Check cache indexes and consider SQLite optimization

## Optimization Tips

1. **Increase parallel workers** in config:
   ```yaml
   global:
     workers: 5
     parallel: true
   ```

2. **Adjust rate limits** for faster APIs:
   ```yaml
   global:
     audiobookshelf_rate_limit: 1200
     hardcover_rate_limit: 58
   ```

3. **Use pagination** for large libraries:
   ```yaml
   global:
     page_size: 200
     max_books_to_fetch: 1000
   ```

4. **Enable dry run** for testing:
   ```yaml
   global:
     dry_run: true
   ```

## ⚠️ Important Notes for REAL SYNC Mode

When using `PROFILE_MODE=real`:

- **📝 Data will be modified**: The profiler will make actual changes to your Hardcover library
- **🔄 Progress will be synced**: Book reading progress will be updated in Hardcover  
- **➕ Books may be auto-added**: If `auto_add_books: true`, new books will be added to your library
- **💾 Cache will be updated**: Sync results will be stored in the local cache
- **🧪 Test with dry run**: Consider setting `dry_run: true` in config for safer testing

**Recommended approach for real timing:**
1. First run in simulation mode to identify major bottlenecks
2. Use a test user or small library for real mode profiling
3. Set `max_books_to_process: 5` in config to limit scope
4. Enable `dry_run: true` if you want timing without data changes

## Troubleshooting

### Script Won't Run
- Ensure you have a valid `config/config.yaml` file
- Check that all dependencies are installed: `npm install`
- Verify Node.js version >= 18

### No Timing Data
- Check that the script completed successfully
- Look for error messages in the output
- Try running with a smaller library first

### Very Slow Operations
- Check your internet connection
- Verify API tokens are valid
- Consider reducing the scope with `max_books_to_process`

### Real Mode Errors
- Verify your API tokens have write permissions
- Check rate limits aren't being exceeded
- Ensure books exist in both systems for sync operations

## Advanced Usage

### Custom Thresholds
You can modify the performance thresholds in the script:

```javascript
this.warningThreshold = 3000;    // 3 seconds instead of 5
this.slowThreshold = 8000;       // 8 seconds instead of 10
this.verySlowThreshold = 20000;  // 20 seconds instead of 30
```

### Export Timing Data
The profiler stores all timing data in memory. You can extend it to export JSON:

```javascript
// Add to PerformanceProfiler class
exportTimingData(filename) {
    const data = {
        summary: {
            totalSteps: this.stepTimings.length,
            totalDuration: this.stepTimings.reduce((sum, step) => sum + step.duration, 0),
            successful: this.stepTimings.filter(step => step.success).length
        },
        steps: this.stepTimings
    };
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
}
``` 