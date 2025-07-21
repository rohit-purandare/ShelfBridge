# 🔍 Book Matching Logic

Book matching is the core of ShelfBridge's functionality. It determines how books from Audiobookshelf are matched with books in your Hardcover library. This guide explains the matching algorithm and troubleshooting strategies.

## 🎯 Overview

Book matching works by comparing identifiers between Audiobookshelf and Hardcover:

1. **Extract identifiers** from Audiobookshelf books
2. **Search Hardcover library** for matching identifiers
3. **Match books** based on identifier priority
4. **Handle unmatched books** via auto-add (if enabled)

## 📊 Supported Identifiers

ShelfBridge currently supports these book identifiers:

| Identifier | Description | Priority | Example |
|------------|-------------|----------|---------|
| **ASIN** | Amazon Standard Identification Number | Highest | `B08FHBV4ZX` |
| **ISBN-13** | 13-digit International Standard Book Number | High | `9780441172719` |
| **ISBN-10** | 10-digit International Standard Book Number | Medium | `0441172717` |

**Note:** Goodreads ID, Google Books ID, and LibraryThing ID are not currently supported.

## 🔧 Matching Algorithm

### Step 1: Identifier Extraction

```javascript
// Example: Audiobookshelf book metadata
Book: "Dune" by Frank Herbert
Identifiers found:
  - ASIN: B08FHBV4ZX
  - ISBN-13: 9780441172719
  - ISBN-10: 0441172717
```

### Step 2: Hardcover Library Search

```javascript
// Search Hardcover library for matching identifiers
Search Results:
  - ASIN B08FHBV4ZX: Found in Hardcover ✅
  - ISBN 9780441172719: Found in Hardcover ✅
  - Book matched successfully
```

### Step 3: Match Priority (Hard-coded)

ShelfBridge uses a fixed priority system:

1. **ASIN first** (most reliable for audiobooks)
2. **ISBN fallback** (for books without ASIN)

### Step 4: Match Confirmation

```javascript
// Successful match example
Book: "Dune"
Audiobookshelf: ASIN B08FHBV4ZX
Hardcover: ASIN B08FHBV4ZX
Result: ✅ MATCH CONFIRMED
Action: Sync progress
```

## ⚙️ Configuration Options

### Basic Matching Configuration

```yaml
global:
  # Auto-add books not found in Hardcover
  auto_add_books: false
  
  # Minimum progress to sync
  min_progress_threshold: 5.0
```

**Note:** Advanced matching options like fuzzy matching, configurable identifier priority, and metadata matching are not currently implemented.

## 🔍 Matching Scenarios

### Scenario 1: Perfect Match

```
Audiobookshelf Book:
  Title: "The Name of the Wind"
  Author: "Patrick Rothfuss"
  ASIN: B004JHYRG0
  ISBN: 9780756404079

Hardcover Library:
  Title: "The Name of the Wind"
  Author: "Patrick Rothfuss"
  ASIN: B004JHYRG0

Result: ✅ PERFECT MATCH (ASIN)
Action: Sync progress
```

### Scenario 2: ISBN Fallback Match

```
Audiobookshelf Book:
  Title: "Foundation"
  Author: "Isaac Asimov"
  ISBN-13: 9780553293357
  (No ASIN)

Hardcover Library:
  Title: "Foundation"
  Author: "Isaac Asimov"
  ISBN-13: 9780553293357

Result: ✅ ISBN MATCH
Action: Sync progress
```

### Scenario 3: No Match - Auto-Add

```
Audiobookshelf Book:
  Title: "New Science Fiction Novel"
  Author: "Indie Author"
  ASIN: B08NEWFICTION

Hardcover Library:
  (Book not found)

Result: ➕ AUTO-ADD (if enabled)
Action: Add to Hardcover, then sync progress
```

### Scenario 4: No Match - Skip

```
Audiobookshelf Book:
  Title: "Obscure Self-Published Book"
  Author: "Unknown Author"
  (No identifiers or not found in Hardcover)

Hardcover Library:
  (Book not found)

Result: ⏭️ SKIPPED
Action: Book not synced
```

## 🎛️ Identifier Extraction

### Common Identifier Sources

```javascript
// Audiobookshelf metadata sources
Identifier Sources:
  - Book metadata fields
  - File tags (MP3, M4A, etc.)
  - Folder names
  - Manual metadata entry
  - Metadata providers (Audible, iTunes, etc.)

// Extraction patterns
ASIN Pattern: B[0-9A-Z]{9}
ISBN-13 Pattern: 978[0-9]{10}
ISBN-10 Pattern: [0-9]{9}[0-9X]
```

### Identifier Normalization

```yaml
# Example identifier normalization
Raw Identifiers:
  - "978-0-441-17271-9"    # ISBN with hyphens
  - "0441172717"           # ISBN-10
  - "B08FHBV4ZX"          # ASIN

Normalized Identifiers:
  - "9780441172719"        # Clean ISBN-13
  - "0441172717"           # Clean ISBN-10
  - "B08FHBV4ZX"          # Clean ASIN
```

## 🚨 Common Matching Issues

### Issue 1: Books Not Matching

**Symptoms:**
- Books auto-added instead of matched
- Expected matches not found
- Sync results show "not in library"

**Debug Steps:**
```bash
# Check identifiers
docker exec -it shelfbridge node src/main.js debug --user alice

# Check Hardcover library
# Log into Hardcover and verify book exists

# Check identifier formats
# Look for formatting differences
```

**Common Causes:**
- Missing identifiers in Audiobookshelf
- Different identifier formats
- Books not in Hardcover library
- Identifier extraction issues

### Issue 2: Books Being Auto-Added Instead of Matched

**Symptoms:**
- Books you know are in Hardcover are being auto-added
- Duplicate books appearing

**Solutions:**
```yaml
# Check your Hardcover library manually
# Ensure the book actually exists with the same identifiers

# Check debug output for identifier extraction
docker exec -it shelfbridge node src/main.js debug --user alice
```

### Issue 3: No Identifiers Found

**Symptoms:**
- Books skipped with "no identifiers" message
- Only title/author matching attempted

**Solutions:**
- Add ISBN/ASIN metadata to your Audiobookshelf books
- Use Audiobookshelf's metadata providers
- Manually edit book metadata

## 📊 Matching Performance

### Current Implementation

- **Sequential processing** - Books matched one at a time
- **Simple exact matching** - No fuzzy matching overhead
- **Cached lookups** - Hardcover library cached for performance
- **Efficient identifier extraction** - Minimal processing per book

## 📈 Best Practices

### For Better Matching

1. **Maintain good metadata** in Audiobookshelf
2. **Add identifiers** to books when possible (especially ASIN for audiobooks)
3. **Use consistent formatting** for titles and authors
4. **Verify matches** during initial setup
5. **Monitor matching results** in sync logs

### Recommended Configuration

**For most users:**
```yaml
global:
  auto_add_books: false  # Conservative approach
  min_progress_threshold: 5.0
```

**For power users:**
```yaml
global:
  auto_add_books: true   # Automatically add missing books
  min_progress_threshold: 1.0  # Sync almost everything
```

## 🎯 Next Steps

1. **[Auto-Add Books](Auto-Add-Books.md)** - Handle unmatched books
2. **[Cache Management](Cache-Management.md)** - Optimize performance
3. **[Troubleshooting Guide](../troubleshooting/Troubleshooting-Guide.md)** - Solve matching issues

## 🆘 Need Help?

- **Configuration Help**: [Configuration Guide](Configuration-Guide.md)
- **General Questions**: [FAQ](../troubleshooting/FAQ.md)
- **Troubleshooting**: [Troubleshooting Guide](../troubleshooting/Troubleshooting-Guide.md)

---

**Simple, reliable book matching for your audiobook progress!** 🔍📚 