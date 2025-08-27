# 🎯 First Sync Guide

Congratulations on setting up ShelfBridge! This guide will walk you through running your first synchronization between Audiobookshelf and Hardcover.

## ✅ Pre-Sync Checklist

Before running your first sync, ensure you have:

- [ ] **ShelfBridge installed** (Docker or Node.js)
- [ ] **Configuration file** created and populated with real tokens
- [ ] **Audiobookshelf access** with reading progress on some books
- [ ] **Hardcover account** with API access enabled
- [ ] **Network connectivity** to both services

## 🔧 Validate Your Setup

### Step 1: Test Configuration

```bash
# Docker
docker exec -it shelfbridge node src/main.js validate

# Node.js
node src/main.js validate
```

**Expected output:**

```
✅ Configuration validation passed
✅ All required fields present
✅ API tokens format valid
✅ URLs properly formatted
```

### Step 2: Test API Connections

```bash
# Docker
docker exec -it shelfbridge node src/main.js validate --connections

# Node.js
node src/main.js validate --connections
```

**Expected output:**

```
✅ Configuration validation passed
🔍 Testing API connections...
✅ Audiobookshelf connection successful
✅ Hardcover connection successful
🎉 All connections verified!
```

## 🚀 Your First Sync

### Step 1: Dry Run (Recommended)

Always start with a dry run to see what would happen without making changes:

```bash
# Docker
docker exec -it shelfbridge node src/main.js sync --dry-run

# Node.js
node src/main.js sync --dry-run
```

### Step 2: Understanding Dry Run Output

**Example dry run output:**

```
🔍 STARTING SYNC (DRY RUN MODE)
==================================================
📚 User: alice
🔗 Audiobookshelf: https://abs.example.com
🎯 Hardcover: Connected as Alice Smith

📖 Found 15 books in Audiobookshelf
📚 Found 127 books in Hardcover library

==================================================
📖 BOOK ANALYSIS
==================================================
📘 "The Name of the Wind" by Patrick Rothfuss
   🔸 Progress: 45% (3h 24m of 7h 32m)
   🔸 ASIN: B004JHYRG0
   🔸 Action: UPDATE progress in Hardcover
   🔸 Current Hardcover progress: 12%

📗 "The Hobbit" by J.R.R. Tolkien
   🔸 Progress: 100% (COMPLETED)
   🔸 ISBN: 9780547928227
   🔸 Action: MARK as completed in Hardcover
   🔸 Current Hardcover status: In Progress

📙 "Project Hail Mary" by Andy Weir
   🔸 Progress: 8% (1h 12m of 15h 4m)
   🔸 ASIN: B08FHBV4ZX
   🔸 Action: SKIP (below 5% threshold)

📕 "Dune" by Frank Herbert
   🔸 Progress: 23% (5h 45m of 25h 12m)
   🔸 ISBN: 9780441172719
   🔸 Action: AUTO-ADD to Hardcover (not in library)

==================================================
📊 DRY RUN SUMMARY
==================================================
📖 Books found: 15
✅ Books to sync: 3
🎯 Books to complete: 1
➕ Books to auto-add: 1
⏭️  Books to skip: 10
💡 This was a DRY RUN - no changes made
==================================================
```

### Step 3: Analyze the Results

**Look for:**

- ✅ **Books to sync**: Good! These will be updated
- 🎯 **Books to complete**: Excellent! Completed books will be marked
- ➕ **Books to auto-add**: Check if this is what you want
- ⏭️ **Books to skip**: Usually due to low progress or no identifiers

**Common scenarios:**

- **Many skipped books**: Normal if you have many books with <5% progress
- **Books to auto-add**: Depends on your `auto_add_books` setting
- **No books found**: Check your API tokens and library access

### Step 4: Run the Actual Sync

If the dry run looks good, run the real sync:

```bash
# Docker
docker exec -it shelfbridge node src/main.js sync

# Node.js
node src/main.js sync
```

### Step 5: Verify Success

**Successful sync output:**

```
🔍 STARTING SYNC
==================================================
📚 User: alice
🔗 Audiobookshelf: https://abs.example.com
🎯 Hardcover: Connected as Alice Smith

✅ Updated "The Name of the Wind" progress: 12% → 45%
✅ Marked "The Hobbit" as completed
✅ Added "Dune" to Hardcover library
⏭️  Skipped 10 books (below threshold or no changes)

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

## 🔍 Troubleshooting First Sync

### "No books found"

**Possible causes:**

- API token doesn't have library access
- No books with progress in Audiobookshelf
- Wrong user ID in configuration

**Debug steps:**

```bash
# Check user info
docker exec -it shelfbridge node src/main.js debug --user your_username

# Check raw API response
curl -H "Authorization: Bearer YOUR_TOKEN" "YOUR_ABS_URL/api/me"
```

### "Books not matching"

**Possible causes:**

- Books lack ISBN/ASIN metadata
- Different editions between services
- Books not in Hardcover library

**Solutions:**

- Add metadata to books in Audiobookshelf
- Enable `auto_add_books: true` in configuration
- Manually add books to Hardcover first

### "API connection failed"

**Possible causes:**

- Wrong URL or token
- Network connectivity issues
- API service temporarily down

**Debug steps:**

```bash
# Test connections individually
node src/main.js validate --connections

# Check network connectivity
ping your-audiobookshelf-server.com
curl -I https://api.hardcover.app/v1/graphql
```

### "Progress not updating"

**Possible causes:**

- Progress hasn't changed since last sync
- Cache preventing updates
- Progress below threshold

**Solutions:**

```bash
# Force sync (ignore cache)
node src/main.js sync --force

# Clear cache
node src/main.js cache --clear

# Lower threshold temporarily
# Edit config: min_progress_threshold: 0.1
```

## 🎛️ Adjusting Settings

### If Too Many Books Are Skipped

```yaml
global:
  min_progress_threshold: 1.0 # Lower threshold
  auto_add_books: true # Add books automatically
```

### If Too Many Books Are Auto-Added

```yaml
global:
  auto_add_books: false # Only add books with significant progress
  min_progress_threshold: 10.0 # Higher threshold
```

### If Completion Status Is Wrong

```yaml
global:
  prevent_progress_regression: true # Prevent accidental overwrites
```

### If Sync Is Slow or Hanging

**For large libraries or resource-constrained devices:**

```yaml
global:
  max_books_to_fetch: 250 # Reduce total books fetched
  page_size: 50 # Smaller API responses
  workers: 1 # Reduce parallel processing
  parallel: false # Disable parallel processing
```

**For testing with limited books:**

```yaml
global:
  max_books_to_process: 10 # Test with just 10 books
  max_books_to_fetch: 50 # Fetch max 50 books
  page_size: 25 # Small responses for testing
  dry_run: true # Don't make actual changes
```

## 📊 Understanding Sync Results

### Sync Actions Explained

| Action       | Description                   | When It Happens                     |
| ------------ | ----------------------------- | ----------------------------------- |
| **UPDATE**   | Progress updated in Hardcover | Progress changed and book exists    |
| **COMPLETE** | Book marked as completed      | Progress ≥95% or completion flag    |
| **AUTO-ADD** | Book added to Hardcover       | Book not found and auto-add enabled |
| **SKIP**     | No action taken               | Below threshold or no changes       |
| **RE-READ**  | New reading session created   | Completed book restarted            |

### Success Metrics

**Good first sync:**

- ✅ **0 errors**: All API calls successful
- ✅ **Some synced books**: Progress updated correctly
- ✅ **Reasonable skip count**: Expected based on your library

**Concerning signs:**

- ❌ **All books skipped**: Check thresholds and tokens
- ❌ **Many errors**: Check API connectivity
- ❌ **Wrong progress**: Check book matching

## 🔄 Setting Up Regular Syncs

### Docker (Automatic)

Docker containers run automatically based on your `sync_schedule`:

```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs -f shelfbridge
```

### Node.js (Manual Setup)

```bash
# Start background service
npm start

# Or use PM2 for process management
npm install -g pm2
pm2 start src/main.js --name shelfbridge -- start
```

## 🎯 Next Steps

1. **[Understanding Sync Results](Understanding-Sync-Results.md)** - Learn to interpret sync output
2. **[Automatic Sync](Automatic-Sync.md)** - Set up scheduled synchronization
3. **[Configuration Overview](../admin/Configuration-Reference.md)** - Explore advanced settings

## 🆘 Need Help?

- **Sync Issues**: [Troubleshooting Guide](../troubleshooting/Troubleshooting-Guide.md)
- **Configuration Help**: [Configuration Overview](../admin/Configuration-Reference.md)
- **General Questions**: [FAQ](../troubleshooting/FAQ.md)

---

**Congratulations!** 🎉 You've successfully run your first sync. ShelfBridge is now keeping your reading progress in sync between Audiobookshelf and Hardcover!
