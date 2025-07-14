# 📊 Understanding Sync Results

ShelfBridge provides detailed output about its synchronization process. This guide helps you understand what the sync results mean and how to interpret the information.

## 🔍 Sync Output Structure

ShelfBridge sync output consists of several sections:

1. **Sync Header** - Basic session information
2. **Book Analysis** - Detailed per-book decisions
3. **Progress Updates** - Real-time sync actions
4. **Sync Summary** - Final statistics

## 📋 Sync Header

```
🔍 STARTING SYNC
==================================================
📚 User: alice
🔗 Audiobookshelf: https://abs.example.com
🎯 Hardcover: Connected as Alice Smith
⏱️  Started: 2024-01-15 14:30:15 UTC
```

**What it tells you:**
- **User**: Which configured user is being synced
- **Audiobookshelf**: Your server URL (confirms correct connection)
- **Hardcover**: Connected user name (confirms correct account)
- **Started**: Timestamp of sync start

## 📖 Book Analysis Section

### Individual Book Entries

```
📘 "The Name of the Wind" by Patrick Rothfuss
   🔸 Progress: 45% (3h 24m of 7h 32m)
   🔸 ASIN: B004JHYRG0
   🔸 Action: UPDATE progress in Hardcover
   🔸 Current Hardcover progress: 12%
   🔸 Last listened: 2024-01-14 20:15:00
```

**Field explanations:**
- **Title/Author**: Book identification
- **Progress**: Current listening progress (percentage and time)
- **ASIN/ISBN**: Book identifier used for matching
- **Action**: What ShelfBridge will do with this book
- **Current Hardcover progress**: Existing progress in Hardcover
- **Last listened**: When you last made progress

### Sync Actions Explained

| Action | Emoji | Description | When It Happens |
|--------|-------|-------------|----------------|
| **UPDATE** | ✅ | Progress updated in Hardcover | Progress changed and book exists |
| **COMPLETE** | 🎯 | Book marked as completed | Progress ≥95% or completion flag |
| **AUTO-ADD** | ➕ | Book added to Hardcover | Book not found and auto-add enabled |
| **SKIP** | ⏭️ | No action taken | Below threshold or no changes |
| **RE-READ** | 🔄 | New reading session created | Completed book restarted |
| **ERROR** | ❌ | Action failed | API error or network issue |

### Progress Indicators

**Progress Display Formats:**
```
Progress: 45% (3h 24m of 7h 32m)     # Audiobook with time
Progress: 67% (201 of 300 pages)     # Ebook with pages
Progress: 100% (COMPLETED)           # Completed book
Progress: 8% (below 5% threshold)    # Below sync threshold
```

## 🔄 Real-Time Updates

During sync, you'll see real-time progress:

```
✅ Updated "The Name of the Wind" progress: 12% → 45%
✅ Marked "The Hobbit" as completed
✅ Added "Dune" to Hardcover library
⏭️  Skipped "Project Hail Mary" (below threshold)
🔄 Created new reading session for "The Fellowship of the Ring"
❌ Failed to update "Foundation" (network error)
```

**Status meanings:**
- **✅ Updated**: Progress successfully synced
- **✅ Marked**: Book successfully marked as completed
- **✅ Added**: Book successfully added to Hardcover
- **⏭️ Skipped**: Book intentionally skipped
- **🔄 Created**: New reading session for re-read
- **❌ Failed**: Action failed (see error details)

### 🚦 Rate Limiting Messages

ShelfBridge respects Hardcover's API limits (55 requests per minute). You may see these messages:

```
⚠️  Rate limit warning: 44/55 requests used in the current minute
⚠️  Rate limit exceeded. Waiting 60s before next request
```

**Rate limit message types:**
- **⚠️ Warning**: When approaching 80% of the rate limit (44+ requests)
- **⚠️ Exceeded**: When the limit is reached, requests are automatically queued
- **🔄 Waiting**: Shows delay time before next request can be made

**What this means:**
- **Normal behavior**: Rate limiting prevents API errors
- **Automatic handling**: Requests are queued, not dropped
- **Sync continues**: The sync will complete, just takes longer
- **Large libraries**: More likely to see rate limiting with 100+ books

## 📊 Sync Summary

```
==================================================
📚 SYNC SUMMARY
==================================================
⏱️  Duration: 3.2s
📖 Books processed: 15
✅ Books synced: 3
🎯 Books completed: 1
➕ Books auto-added: 1
⏭️  Books skipped: 10
❌ Errors: 0
==================================================
```

### Summary Statistics

| Metric | Description | Good Range |
|--------|-------------|------------|
| **Duration** | Total sync time | 1-30 seconds |
| **Books processed** | Total books analyzed | Any number |
| **Books synced** | Progress updates made | 0-50% of processed |
| **Books completed** | Books marked complete | 0-10% of processed |
| **Books auto-added** | New books added | Depends on settings |
| **Books skipped** | Books not synced | 50-90% of processed |
| **Errors** | Failed operations | 0 (ideally) |

## 🎯 Interpreting Results

### Healthy Sync Results

**Good indicators:**
- **✅ 0 errors**: All API calls successful
- **✅ Some synced books**: Progress being tracked
- **✅ Reasonable skip count**: Expected based on library
- **✅ Fast duration**: Under 30 seconds for most libraries

**Example healthy sync:**
```
📊 SYNC SUMMARY
Duration: 2.1s
Books processed: 127
Books synced: 8
Books completed: 2
Books auto-added: 0
Books skipped: 117
Errors: 0
```

### Concerning Results

**Red flags:**
- **❌ All books skipped**: Check thresholds and tokens
- **❌ Many errors**: Check API connectivity
- **❌ Very slow**: >60 seconds indicates problems
- **❌ No progress updates**: Check book matching

**Example concerning sync:**
```
📊 SYNC SUMMARY
Duration: 45.2s
Books processed: 15
Books synced: 0
Books completed: 0
Books auto-added: 0
Books skipped: 15
Errors: 3
```

### 🚦 Rate Limiting Impact on Sync Time

**Normal rate limiting behavior:**
- **Large libraries**: May take 2-5 minutes for 100+ books
- **Rate limit warnings**: Expected with frequent API calls
- **Automatic delays**: Sync pauses to respect API limits

**When rate limiting indicates issues:**
- **Single book taking >60s**: May indicate API problems
- **Excessive warnings**: Could suggest inefficient batching
- **Sync failing**: Rate limiting should never cause complete failure

## 🔍 Common Scenarios

### All Books Skipped

**Possible causes:**
- **Low progress**: Books below `min_progress_threshold`
- **No identifiers**: Books missing ISBN/ASIN
- **No changes**: Progress hasn't changed since last sync

**Solutions:**
```yaml
# Lower threshold temporarily
min_progress_threshold: 1.0

# Force sync to ignore cache
node src/main.js sync --force

# Enable auto-add for missing books
auto_add_books: true
```

### Many Books Auto-Added

**What it means:**
- Books not found in your Hardcover library
- ShelfBridge adding them automatically

**If unwanted:**
```yaml
# Disable auto-add
auto_add_books: false

# Increase threshold for auto-add
min_progress_threshold: 10.0
```

### Books Not Matching

**Symptoms:**
- Books auto-added instead of updated
- Wrong editions matched
- "Not found in library" messages

**Solutions:**
1. **Add metadata** to books in Audiobookshelf
2. **Check identifiers** in debug output
3. **Manually add books** to Hardcover first

### Re-reading Detection

**Example output:**
```
📗 "The Hobbit" by J.R.R. Tolkien
   🔸 Previous progress: 100% (COMPLETED)
   🔸 Current progress: 15%
   🔸 Action: CREATE new reading session
   🔸 Re-read detected: Starting fresh
```

**What it means:**
- You've completed this book before
- You're reading it again
- ShelfBridge creates a new reading session

## 🚨 Error Handling and Debugging

### Error Dump Files

When sync errors occur, ShelfBridge can automatically create detailed error reports in the `data/` folder. These files contain:

- **Complete sync summary** with statistics
- **Detailed information** for each failed book
- **Specific error messages** and actions taken
- **Book identifiers** and progress information
- **Processing timings** for debugging

**File naming format:**
```
failed-sync-{user_id}-{timestamp}.txt
```

**Example:**
```
failed-sync-john_doe-2024-01-15T10-30-45.txt
```

**Configuration:**
```yaml
global:
  # Enable/disable error dump files (default: true)
  dump_failed_books: true
```

**Sample error dump content:**
```
================================================================================
FAILED SYNC BOOKS DUMP
Generated: 1/15/2024, 10:30:45 AM
User ID: john_doe
Total Books Processed: 25
Total Errors: 3
================================================================================

📊 SYNC SUMMARY
----------------------------------------
Books processed: 25
Books synced: 20
Books completed: 1
Books auto-added: 1
Books skipped: 2
Books with errors: 3
Total errors: 3

❌ FAILED BOOKS DETAILS
================================================================================

1. BOOK: The Great Gatsby
   Status: ERROR
   Progress: 45.2%
   Identifiers: ASIN=B08N5WRWNW
   Actions taken:
     • Found identifiers: ASIN=B08N5WRWNW
     • Cache: No cached data found
     • Current progress: 45.2%
     • Found in Hardcover library: The Great Gatsby
   Errors encountered:
     • API rate limit exceeded
```

### Using Error Dumps for Troubleshooting

1. **Review the error summary** to understand the scope of issues
2. **Check specific book details** to identify patterns
3. **Look for common error types** (rate limiting, missing identifiers, etc.)
4. **Use the information** to adjust configuration or fix underlying issues

### Common Error Patterns

**Rate Limiting:**
- Multiple "API rate limit exceeded" errors
- Solution: Reduce `workers` setting or enable `parallel: false`

**Missing Identifiers:**
- Books with "no identifier" in actions
- Solution: Add ISBN/ASIN metadata to books in Audiobookshelf

**Connection Issues:**
- "Failed to connect" or timeout errors
- Solution: Check network connectivity and API tokens

## 🛠️ Debugging with Debug Mode

For detailed troubleshooting:

```bash
# Get detailed user information
node src/main.js debug --user alice

# Check specific book matching
node src/main.js debug --user alice | grep -A 10 "Book Title"
```

**Debug output includes:**
- Raw API responses
- Book identifier extraction
- Matching logic details
- Cache hit/miss information

## 📈 Performance Interpretation

### Sync Speed Factors

**Fast syncs (1-5 seconds):**
- Small libraries (< 50 books)
- Good cache hit rate
- Stable network connection

**Slow syncs (10-60 seconds):**
- Large libraries (> 200 books)
- Many API calls needed
- Network latency issues

**Very slow syncs (> 60 seconds):**
- Network problems
- API rate limiting
- Database issues

### Optimization Tips

```yaml
# Reduce API calls
workers: 2  # Fewer parallel workers

# Increase cache efficiency
force_sync: false  # Use cache when possible

# Reduce processed books
min_progress_threshold: 10.0  # Higher threshold
```

## 🔄 Comparing Sync Results

### Track Progress Over Time

**First sync (large):**
```
Books processed: 127
Books synced: 45
Books completed: 12
Duration: 15.3s
```

**Subsequent syncs (smaller):**
```
Books processed: 127
Books synced: 3
Books completed: 1
Duration: 2.1s
```

**What this shows:**
- Cache is working effectively
- Only changed books are being synced
- Performance improving over time

## 🎯 Next Steps

Based on your sync results:

1. **All good**: [Set up Automatic Sync](Automatic-Sync.md)
2. **Issues found**: [Troubleshooting Guide](../troubleshooting/Troubleshooting-Guide.md)
3. **Want to customize**: [Configuration Overview](../admin/Configuration-Overview.md)

## 🆘 Need Help?

- **Sync Issues**: [Troubleshooting Guide](../troubleshooting/Troubleshooting-Guide.md)
- **Configuration Help**: [Configuration Overview](../admin/Configuration-Overview.md)
- **General Questions**: [FAQ](../troubleshooting/FAQ.md)

---

**Understanding your sync results helps you optimize ShelfBridge for your specific needs!** 📊✨ 