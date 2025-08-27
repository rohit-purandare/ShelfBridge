# ➕ Auto-Add Books

The auto-add books feature allows ShelfBridge to automatically add books to your Hardcover library when they're not found but have reading progress in Audiobookshelf. This guide explains how it works and how to configure it.

## 🎯 What is Auto-Add Books?

Auto-add books automatically adds books to your Hardcover library when:

- ✅ Book exists in Audiobookshelf with reading progress
- ✅ Book is not found in your Hardcover library
- ✅ Book can be found in Hardcover's database by ISBN or ASIN

## 🔧 How It Works

### Without Auto-Add (Default)

```
Book: "New Science Fiction Novel"
Audiobookshelf: 45% progress
Hardcover: Not in library
Result: ⏭️ Book skipped (not in Hardcover library)
```

### With Auto-Add Enabled

```
Book: "New Science Fiction Novel"
Audiobookshelf: 45% progress
Hardcover: Not in library
Result: ➕ Book added to Hardcover library
        ✅ Progress synced (45%)
```

## ⚙️ Configuration Options

### Basic Configuration

```yaml
global:
  # Enable auto-add for all users
  auto_add_books: true
```

### Current Implementation

The auto-add feature is simple and straightforward:

```yaml
global:
  # Enable/disable auto-add
  auto_add_books: false # Default: disabled

  # Minimum progress to sync (applies to all books)
  min_progress_threshold: 5.0
```

**How it works:**

1. When a book isn't found in your Hardcover library
2. ShelfBridge searches Hardcover's database by ASIN (preferred) or ISBN
3. If found, the book is added to your library
4. Current progress is immediately synced

**Note:** There are no additional auto-add specific thresholds or filters - the same `min_progress_threshold` applies to all books.

## 🔍 Auto-Add Process

### Step-by-Step Process

```
1. Book not found in your Hardcover library
   ↓
2. Search Hardcover database by ASIN (first priority)
   ↓
3. If no ASIN match, search by ISBN (fallback)
   ↓
4. If found: Add to library + sync current progress
5. If not found: Skip book
```

### Identifier Requirements

Auto-add **requires** that books have identifiers:

- **ASIN** (Amazon Standard Identification Number) - preferred
- **ISBN** (International Standard Book Number) - fallback

Books without either identifier will be skipped.

## 📊 Auto-Add Behavior

### What Gets Auto-Added

```yaml
# Book eligibility criteria
Book Selection: ✅ Has reading progress in Audiobookshelf
  ✅ Progress above min_progress_threshold
  ✅ Not found in your Hardcover library
  ✅ Has ASIN or ISBN identifier
  ✅ Can be found in Hardcover's database

Book Information Added: ✅ Title and author
  ✅ ISBN/ASIN identifier
  ✅ Current reading progress
  ✅ Started date (if available)
```

### Auto-Add Results

```
Sample Auto-Add Results:
==================================================
📚 SYNC SUMMARY
==================================================
📖 Books processed: 25
✅ Books synced: 8
➕ Books auto-added: 3    # New books added
⏭️  Books skipped: 14
❌ Errors: 0
==================================================
```

## 🎨 Configuration Strategies

### Conservative Auto-Add

```yaml
global:
  auto_add_books: false # Manual control only
```

**Use case**: You want full control over your Hardcover library

### Permissive Auto-Add

```yaml
global:
  auto_add_books: true
  min_progress_threshold: 1.0 # Add almost any book with progress
```

**Use case**: You want ShelfBridge to automatically manage your library

### Balanced Auto-Add

```yaml
global:
  auto_add_books: true
  min_progress_threshold: 5.0 # Only books you're actively reading
```

**Use case**: Good balance of automation and control (recommended)

## 📈 Best Practices

### Recommended Configurations

**For new users:**

```yaml
global:
  auto_add_books: false
  min_progress_threshold: 5.0
```

Start conservative until you understand how it works.

**For established users:**

```yaml
global:
  auto_add_books: true
  min_progress_threshold: 5.0
```

Let ShelfBridge manage your library automatically.

**For power users:**

```yaml
global:
  auto_add_books: true
  min_progress_threshold: 1.0
```

Sync almost everything with progress.

### Gradual Implementation

```yaml
# Phase 1: Start with auto-add disabled
global:
  auto_add_books: false

# Phase 2: Enable with higher threshold
global:
  auto_add_books: true
  min_progress_threshold: 10.0

# Phase 3: Lower threshold as you get comfortable
global:
  auto_add_books: true
  min_progress_threshold: 5.0
```

## 🔍 Monitoring Auto-Add

### Understanding Auto-Add Output

```
Auto-Add Process:
==================================================
📘 "The New Novel" by Jane Author
   🔸 Progress: 23% (2h 45m of 12h 30m)
   🔸 ASIN: B08EXAMPLE123
   🔸 Action: AUTO-ADD to Hardcover (not in library)
   🔸 Search: Found in Hardcover database ✅
   🔸 Result: ➕ Added successfully
==================================================
```

### Debug Auto-Add Decisions

```bash
# Check auto-add decisions in dry run
docker exec -it shelfbridge node src/main.js sync --dry-run

# Debug specific user auto-add behavior
docker exec -it shelfbridge node src/main.js debug --user alice

# Check which books would be auto-added
docker exec -it shelfbridge node src/main.js sync --dry-run | grep -A 5 "AUTO-ADD"
```

## 🚨 Common Issues and Solutions

### Issue: Books Not Being Auto-Added

**Problem**: Expected books aren't being auto-added

**Debug steps:**

```bash
# Check if books meet criteria
docker exec -it shelfbridge node src/main.js sync --dry-run --verbose

# Check book metadata
docker exec -it shelfbridge node src/main.js debug --user alice
```

**Common causes:**

- `auto_add_books: false` in configuration
- Missing ASIN/ISBN identifiers in Audiobookshelf
- Book not found in Hardcover's database
- Progress below `min_progress_threshold`

### Issue: Books Not Found in Hardcover Database

**Problem**: Books have identifiers but auto-add fails

**Symptoms:**

```
📘 "Self-Published Book" by Indie Author
   🔸 ASIN: B08EXAMPLE123
   🔸 Action: AUTO-ADD failed (not found in Hardcover database)
```

**Solutions:**

- This is expected for self-published or very new books
- Hardcover may not have all books in their database
- You'll need to add these books manually to Hardcover first

### Issue: Unwanted Books Auto-Added

**Problem**: Auto-add is adding books you don't want

**Solutions:**

```yaml
# Disable auto-add
auto_add_books: false

# Increase threshold to only add books you're actively reading
min_progress_threshold: 15.0
```

### Issue: Missing Identifiers

**Problem**: Books skipped due to missing ASIN/ISBN

**Solutions:**

- Use Audiobookshelf's metadata providers
- Manually add ISBN/ASIN to book metadata
- Use tools like Beets or MusicBrainz Picard for bulk metadata

## 📊 Current Limitations

### Not Currently Implemented

The following features are **not implemented** but are mentioned in some documentation:

**Advanced Configuration Options:**

- `auto_add_threshold` - separate threshold for auto-add
- `auto_add_requires_identifier` - already required by default
- `auto_add_identifier_types` - ASIN and ISBN are always used
- Per-user auto-add settings
- Advanced filtering by duration, title patterns, etc.
- Metadata quality requirements

**All auto-add behavior is controlled by:**

- `auto_add_books` (true/false)
- `min_progress_threshold` (same for all books)

## 🔄 Managing Auto-Added Books

### Review Auto-Add Activity

```bash
# Check recent auto-add activity in dry run
docker exec -it shelfbridge node src/main.js sync --dry-run | grep "AUTO-ADD"

# Review sync logs for auto-add history
docker exec -it shelfbridge tail -f /app/logs/app.log
```

### Cleanup Strategy

If you've enabled auto-add and want to clean up:

```yaml
# Temporarily disable auto-add
global:
  auto_add_books: false
# Run sync to stop adding new books
# Then manually review and clean up your Hardcover library
```

## 🎯 Next Steps

1. **[Book Matching Logic](Book-Matching-Logic.md)** - Understand how books are matched
2. **[Cache Management](Cache-Management.md)** - Optimize performance
3. **[Troubleshooting Guide](../troubleshooting/Troubleshooting-Guide.md)** - Solve common issues

## 🆘 Need Help?

- **Configuration Help**: [Configuration Guide](Configuration-Guide.md)
- **General Questions**: [FAQ](../troubleshooting/FAQ.md)
- **Troubleshooting**: [Troubleshooting Guide](../troubleshooting/Troubleshooting-Guide.md)

---

**Simple auto-add keeps your Hardcover library automatically updated!** ➕📚
