# ➕ Auto-Add Books

The auto-add books feature allows ShelfBridge to automatically add books to your Hardcover library when they're not found but have reading progress in Audiobookshelf. This guide explains how it works and how to configure it effectively.

## 🎯 What is Auto-Add Books?

Auto-add books automatically adds books to your Hardcover library when:
- ✅ Book exists in Audiobookshelf with reading progress
- ✅ Book is not found in your Hardcover library
- ✅ Book meets your configured criteria (progress, identifiers, etc.)

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

### Advanced Configuration

```yaml
global:
  # Enable auto-add
  auto_add_books: true
  
  # Minimum progress required to auto-add
  auto_add_threshold: 1.0
  
  # Require identifiers for auto-add
  auto_add_requires_identifier: true
  
  # Which identifiers are acceptable
  auto_add_identifier_types:
    - "asin"
    - "isbn"
    - "isbn13"
```

## 🎛️ Threshold Configuration

### Understanding Thresholds

```yaml
global:
  # General sync threshold
  min_progress_threshold: 5.0
  
  # Auto-add specific threshold
  auto_add_threshold: 1.0
  
  # How they work together:
  # - Books with 1-5% progress: Auto-added but not synced
  # - Books with 5%+ progress: Auto-added and synced
  # - Books with <1% progress: Skipped entirely
```

### Threshold Examples

| Progress | min_progress_threshold | auto_add_threshold | Action |
|----------|----------------------|-------------------|--------|
| 15% | 5.0 | 1.0 | ✅ Auto-add + sync progress |
| 3% | 5.0 | 1.0 | ➕ Auto-add only (no progress sync) |
| 0.5% | 5.0 | 1.0 | ⏭️ Skip (below auto-add threshold) |
| 8% | 5.0 | 10.0 | ⏭️ Skip (below auto-add threshold) |

## 🎨 Configuration Strategies

### Conservative Auto-Add

```yaml
global:
  auto_add_books: true
  auto_add_threshold: 10.0           # Only books with significant progress
  auto_add_requires_identifier: true  # Must have ISBN/ASIN
  min_progress_threshold: 5.0
```

**Use case**: Only add books you're actively reading

### Permissive Auto-Add

```yaml
global:
  auto_add_books: true
  auto_add_threshold: 0.1            # Almost any progress
  auto_add_requires_identifier: false # Don't require identifiers
  min_progress_threshold: 5.0
```

**Use case**: Add everything you've touched

### Balanced Auto-Add

```yaml
global:
  auto_add_books: true
  auto_add_threshold: 1.0            # Minimal progress required
  auto_add_requires_identifier: true  # Must have identifiers
  min_progress_threshold: 5.0
```

**Use case**: Good balance of automation and control

## 🔍 Identifier Requirements

### Why Identifiers Matter

```yaml
global:
  auto_add_requires_identifier: true
  
  # Acceptable identifier types (in order of preference)
  auto_add_identifier_types:
    - "asin"    # Amazon Standard Identification Number
    - "isbn"    # International Standard Book Number
    - "isbn13"  # 13-digit ISBN
    - "isbn10"  # 10-digit ISBN
```

**Benefits of requiring identifiers:**
- ✅ Ensures accurate book matching
- ✅ Prevents duplicate entries
- ✅ Improves sync reliability
- ✅ Reduces manual cleanup

**Drawbacks:**
- ❌ Skips books without metadata
- ❌ May miss self-published books
- ❌ Requires good metadata management

### Identifier Configuration

```yaml
global:
  auto_add_books: true
  
  # Strict identifier requirements
  auto_add_requires_identifier: true
  auto_add_identifier_types:
    - "asin"    # Only ASIN (most strict)
    
  # Flexible identifier requirements
  auto_add_requires_identifier: true
  auto_add_identifier_types:
    - "asin"
    - "isbn"
    - "isbn13"
    - "isbn10"
    - "goodreads_id"  # If available
    
  # No identifier requirements
  auto_add_requires_identifier: false
```

## 🎯 Per-User Configuration

### Different Auto-Add Strategies

```yaml
global:
  auto_add_books: false  # Default: disabled

users:
  - id: bookworm
    # Heavy reader: add everything
    auto_add_books: true
    auto_add_threshold: 0.1
    auto_add_requires_identifier: false
    abs_url: https://abs.example.com
    abs_token: bookworm_token
    hardcover_token: bookworm_hardcover_token
    
  - id: casual
    # Casual reader: only add books being read
    auto_add_books: true
    auto_add_threshold: 15.0
    auto_add_requires_identifier: true
    abs_url: https://abs.example.com
    abs_token: casual_token
    hardcover_token: casual_hardcover_token
    
  - id: curator
    # Curator: manual control only
    auto_add_books: false
    abs_url: https://abs.example.com
    abs_token: curator_token
    hardcover_token: curator_hardcover_token
```

## 📊 Auto-Add Behavior

### What Gets Auto-Added

```yaml
# Book eligibility criteria
Book Selection:
  ✅ Has reading progress in Audiobookshelf
  ✅ Progress above auto_add_threshold
  ✅ Not found in Hardcover library
  ✅ Meets identifier requirements (if enabled)
  ✅ Not in exclude patterns (if configured)

Book Information Added:
  ✅ Title and author
  ✅ ISBN/ASIN (if available)
  ✅ Current reading progress
  ✅ Started date (if available)
  ✅ Book cover (if available)
```

### Auto-Add Results

```
Sample Auto-Add Results:
==================================================
📚 SYNC SUMMARY
==================================================
📖 Books processed: 25
✅ Books synced: 8
➕ Books auto-added: 5    # New books added
⏭️  Books skipped: 12
❌ Errors: 0
==================================================
```

## 🔧 Fine-Tuning Auto-Add

### Advanced Filters

```yaml
global:
  auto_add_books: true
  auto_add_threshold: 5.0
  
  # Advanced filtering
  auto_add_filters:
    # Minimum book duration (minutes)
    min_duration: 30
    
    # Maximum book duration (minutes)
    max_duration: 2400  # 40 hours
    
    # Exclude books with these patterns in title
    exclude_title_patterns:
      - "Sample"
      - "Preview"
      - "Trailer"
      - "Excerpt"
    
    # Only include books from these libraries
    include_libraries:
      - "Audiobooks"
      - "Favorites"
    
    # Exclude books from these libraries
    exclude_libraries:
      - "Podcasts"
      - "Temporary"
```

### Metadata Requirements

```yaml
global:
  auto_add_books: true
  
  # Require specific metadata
  auto_add_metadata_requirements:
    require_author: true
    require_duration: true
    require_publication_year: false
    require_description: false
    
    # Minimum metadata quality score (0-100)
    min_metadata_score: 50
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
   🔸 Threshold: 23% > 5% ✅
   🔸 Identifier: ASIN available ✅
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

### Issue: Too Many Books Auto-Added

**Problem**: Auto-add is adding too many books you don't want

**Solutions**:
```yaml
# Increase threshold
auto_add_threshold: 15.0

# Require identifiers
auto_add_requires_identifier: true

# Add exclusion patterns
auto_add_filters:
  exclude_title_patterns:
    - "Sample"
    - "Preview"
    - "Podcast"
```

### Issue: Books Not Being Auto-Added

**Problem**: Expected books aren't being auto-added

**Debug steps**:
```bash
# Check if books meet criteria
docker exec -it shelfbridge node src/main.js sync --dry-run --verbose

# Check book metadata
docker exec -it shelfbridge node src/main.js debug --user alice

# Check identifier availability
docker exec -it shelfbridge node src/main.js debug --user alice | grep -A 10 "Book Title"
```

**Common causes**:
- Progress below auto_add_threshold
- Missing required identifiers
- Book already in Hardcover library
- Excluded by filter patterns

### Issue: Duplicate Books Created

**Problem**: Auto-add creating duplicate entries

**Solutions**:
```yaml
# Require identifiers for better matching
auto_add_requires_identifier: true

# Use strict identifier types
auto_add_identifier_types:
  - "asin"
  - "isbn13"
```

## 📈 Best Practices

### Recommended Configurations

**For new users:**
```yaml
global:
  auto_add_books: true
  auto_add_threshold: 10.0
  auto_add_requires_identifier: true
  min_progress_threshold: 5.0
```

**For heavy readers:**
```yaml
global:
  auto_add_books: true
  auto_add_threshold: 1.0
  auto_add_requires_identifier: false
  min_progress_threshold: 5.0
```

**For curated libraries:**
```yaml
global:
  auto_add_books: false  # Manual control
  # Or very strict:
  auto_add_books: true
  auto_add_threshold: 25.0
  auto_add_requires_identifier: true
```

### Gradual Implementation

```yaml
# Phase 1: Start conservative
global:
  auto_add_books: true
  auto_add_threshold: 20.0
  auto_add_requires_identifier: true

# Phase 2: Reduce threshold as you get comfortable
global:
  auto_add_books: true
  auto_add_threshold: 10.0
  auto_add_requires_identifier: true

# Phase 3: Fine-tune based on results
global:
  auto_add_books: true
  auto_add_threshold: 5.0
  auto_add_requires_identifier: true
```

## 🔄 Managing Auto-Added Books

### Review and Cleanup

```bash
# Check recent auto-add activity
docker exec -it shelfbridge node src/main.js sync --dry-run | grep "AUTO-ADD"

# Review cache for auto-added books
docker exec -it shelfbridge node src/main.js cache --show | grep -B 5 -A 5 "auto_added"
```

### Bulk Operations

```yaml
# Temporarily disable auto-add for cleanup
global:
  auto_add_books: false

# Run cleanup sync
# Then re-enable with adjusted settings
global:
  auto_add_books: true
  auto_add_threshold: 15.0  # Higher threshold
```

## 🎯 Next Steps

1. **[Book Matching Logic](Book-Matching-Logic.md)** - Understand how books are matched
2. **[Cache Management](Cache-Management.md)** - Optimize performance
3. **[Troubleshooting Guide](../troubleshooting/Troubleshooting-Guide.md)** - Solve common issues

## 🆘 Need Help?

- **Auto-Add Issues**: [Troubleshooting Guide](../troubleshooting/Troubleshooting-Guide.md)
- **Configuration Help**: [Configuration Overview](Configuration-Overview.md)
- **General Questions**: [FAQ](../troubleshooting/FAQ.md)

---

**Auto-add books keeps your Hardcover library automatically updated!** ➕📚 