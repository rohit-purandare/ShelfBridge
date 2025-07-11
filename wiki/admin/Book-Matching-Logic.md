# 🔍 Book Matching Logic

Book matching is the core of ShelfBridge's functionality. It determines how books from Audiobookshelf are matched with books in your Hardcover library. This guide explains the matching algorithm, configuration options, and troubleshooting strategies.

## 🎯 Overview

Book matching works by comparing identifiers between Audiobookshelf and Hardcover:

1. **Extract identifiers** from Audiobookshelf books
2. **Search Hardcover library** for matching identifiers
3. **Match books** based on identifier priority
4. **Handle edge cases** and fallbacks

## 📊 Identifier Types

### Primary Identifiers

| Identifier | Description | Priority | Example |
|------------|-------------|----------|---------|
| **ASIN** | Amazon Standard Identification Number | Highest | `B08FHBV4ZX` |
| **ISBN-13** | 13-digit International Standard Book Number | High | `9780441172719` |
| **ISBN-10** | 10-digit International Standard Book Number | Medium | `0441172717` |
| **ISBN** | Generic ISBN (any format) | Medium | `978-0441172719` |

### Secondary Identifiers

| Identifier | Description | Priority | Example |
|------------|-------------|----------|---------|
| **Goodreads ID** | Goodreads book identifier | Low | `77566` |
| **Google Books ID** | Google Books identifier | Low | `zyTCAlFPjgYC` |
| **LibraryThing ID** | LibraryThing identifier | Low | `15562` |

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

### Step 3: Match Priority

```yaml
# Default matching priority
identifier_priority:
  - "asin"      # 1st priority (most reliable)
  - "isbn13"    # 2nd priority
  - "isbn10"    # 3rd priority
  - "isbn"      # 4th priority
  - "goodreads" # 5th priority (if available)
```

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
  # Identifier matching priority
  identifier_priority:
    - "asin"
    - "isbn13"
    - "isbn10"
    - "isbn"
  
  # Enable fuzzy matching as fallback
  enable_fuzzy_matching: false
  
  # Fuzzy matching threshold (0.0-1.0)
  fuzzy_match_threshold: 0.85
```

### Advanced Matching Configuration

```yaml
global:
  # Identifier handling
  identifier_priority:
    - "asin"
    - "isbn13"
    - "isbn10"
    - "isbn"
    - "goodreads_id"
  
  # Normalize identifiers before matching
  normalize_identifiers: true
  
  # Clean identifiers (remove hyphens, spaces)
  clean_identifiers: true
  
  # Case-sensitive matching
  case_sensitive_matching: false
  
  # Fuzzy matching options
  enable_fuzzy_matching: false
  fuzzy_match_threshold: 0.85
  fuzzy_match_fields:
    - "title"
    - "author"
  
  # Metadata matching
  metadata_matching:
    normalize_titles: true
    ignore_subtitles: false
    author_matching_strictness: "medium"  # strict, medium, loose
```

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

### Scenario 2: Multiple Identifier Match

```
Audiobookshelf Book:
  Title: "Foundation"
  Author: "Isaac Asimov"
  ASIN: B08FHBV4ZX
  ISBN-13: 9780553293357

Hardcover Library:
  Title: "Foundation"
  Author: "Isaac Asimov"
  ASIN: B08FHBV4ZX
  ISBN-13: 9780553293357

Result: ✅ MULTIPLE IDENTIFIER MATCH
Action: Sync progress (using highest priority identifier)
```

### Scenario 3: Partial Match

```
Audiobookshelf Book:
  Title: "Dune"
  Author: "Frank Herbert"
  ISBN-13: 9780441172719

Hardcover Library:
  Title: "Dune"
  Author: "Frank Herbert"
  ISBN-13: 9780441172719
  (No ASIN)

Result: ✅ PARTIAL MATCH (ISBN-13)
Action: Sync progress
```

### Scenario 4: No Match

```
Audiobookshelf Book:
  Title: "Obscure Self-Published Book"
  Author: "Unknown Author"
  (No identifiers)

Hardcover Library:
  (Book not found)

Result: ❌ NO MATCH
Action: Skip or auto-add (if enabled)
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

## 🧩 Fuzzy Matching

### When Fuzzy Matching Helps

```yaml
# Scenario: Similar but not identical titles
Audiobookshelf: "The Fellowship of the Ring: Book One"
Hardcover: "The Fellowship of the Ring"

Without Fuzzy Matching: ❌ NO MATCH
With Fuzzy Matching: ✅ FUZZY MATCH (87% similarity)
```

### Fuzzy Matching Configuration

```yaml
global:
  # Enable fuzzy matching
  enable_fuzzy_matching: true
  
  # Similarity threshold (0.0-1.0)
  fuzzy_match_threshold: 0.85
  
  # Fields to compare
  fuzzy_match_fields:
    - "title"
    - "author"
  
  # Advanced fuzzy options
  fuzzy_options:
    ignore_case: true
    ignore_punctuation: true
    ignore_common_words: true
    common_words:
      - "the"
      - "a"
      - "an"
      - "book"
      - "volume"
```

### Fuzzy Matching Algorithms

```yaml
# Available algorithms
fuzzy_algorithms:
  - "levenshtein"     # Character-based distance
  - "jaro_winkler"    # String similarity
  - "cosine"          # Vector similarity
  - "jaccard"         # Set similarity

# Default algorithm
fuzzy_algorithm: "jaro_winkler"
```

## 🔄 Multi-Edition Handling

### Edition Matching Strategy

```yaml
# Different editions of the same book
Book Editions:
  - "Dune (Original Edition)"
  - "Dune (40th Anniversary Edition)"
  - "Dune (Unabridged Audiobook)"

Matching Strategy:
  1. Try exact identifier match first
  2. Fall back to fuzzy title/author match
  3. Consider edition metadata
  4. Use user preference for edition selection
```

### Edition Configuration

```yaml
global:
  # Edition handling
  edition_handling:
    prefer_edition_type: "audiobook"  # audiobook, ebook, hardcover, paperback
    match_any_edition: true
    create_edition_if_missing: false
    
  # Edition metadata
  edition_metadata:
    consider_narrator: true
    consider_publisher: false
    consider_publication_date: false
```

## 🎯 Per-User Matching

### User-Specific Matching Rules

```yaml
users:
  - id: alice
    # Alice prefers strict matching
    identifier_priority:
      - "asin"
      - "isbn13"
    enable_fuzzy_matching: false
    abs_url: https://abs.example.com
    abs_token: alice_token
    hardcover_token: alice_hardcover_token
    
  - id: bob
    # Bob allows fuzzy matching
    identifier_priority:
      - "asin"
      - "isbn13"
      - "isbn10"
      - "isbn"
    enable_fuzzy_matching: true
    fuzzy_match_threshold: 0.80
    abs_url: https://abs.example.com
    abs_token: bob_token
    hardcover_token: bob_hardcover_token
```

## 🔍 Debugging Matching Issues

### Debug Commands

```bash
# Check book matching for specific user
docker exec -it shelfbridge node src/main.js debug --user alice

# Verbose matching information
docker exec -it shelfbridge node src/main.js sync --dry-run --verbose

# Check specific book matching
docker exec -it shelfbridge node src/main.js debug --user alice | grep -A 10 "Book Title"
```

### Debug Output Examples

```
Book Matching Debug:
==================================================
📘 "The Martian" by Andy Weir
   🔸 Identifiers found:
      - ASIN: B00EMXBDMA
      - ISBN-13: 9780553418026
      - ISBN-10: 0553418025
   🔸 Hardcover search:
      - ASIN B00EMXBDMA: ✅ Found
      - Match confirmed via ASIN
   🔸 Result: MATCHED
==================================================
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

### Issue 2: Wrong Book Matched

**Symptoms:**
- Progress synced to wrong book
- Different editions matched
- Author mismatch

**Solutions:**
```yaml
# Increase matching strictness
global:
  identifier_priority:
    - "asin"  # Only use ASIN for strict matching
  enable_fuzzy_matching: false

# Add metadata validation
global:
  metadata_validation:
    require_author_match: true
    require_title_similarity: 0.90
```

### Issue 3: Fuzzy Matching Too Aggressive

**Symptoms:**
- Unrelated books being matched
- Wrong matches due to similar titles
- Performance issues

**Solutions:**
```yaml
# Reduce fuzzy matching sensitivity
global:
  fuzzy_match_threshold: 0.95  # Stricter threshold
  enable_fuzzy_matching: false  # Disable entirely
```

## 📊 Matching Performance

### Optimization Strategies

```yaml
global:
  # Performance optimizations
  matching_performance:
    # Cache Hardcover library for faster lookups
    cache_hardcover_library: true
    cache_duration: 3600  # 1 hour
    
    # Parallel matching for multiple books
    parallel_matching: true
    max_parallel_matches: 5
    
    # Skip expensive operations
    skip_fuzzy_for_large_libraries: true
    large_library_threshold: 1000
```

### Monitoring Performance

```bash
# Check matching performance
docker exec -it shelfbridge node src/main.js sync --dry-run --verbose | grep -i "match"

# Monitor cache effectiveness
docker exec -it shelfbridge node src/main.js cache --stats
```

## 📈 Best Practices

### Recommended Configurations

**For accuracy:**
```yaml
global:
  identifier_priority:
    - "asin"
    - "isbn13"
    - "isbn10"
  enable_fuzzy_matching: false
  normalize_identifiers: true
```

**For flexibility:**
```yaml
global:
  identifier_priority:
    - "asin"
    - "isbn13"
    - "isbn10"
    - "isbn"
  enable_fuzzy_matching: true
  fuzzy_match_threshold: 0.85
```

**For performance:**
```yaml
global:
  identifier_priority:
    - "asin"  # Fastest, most reliable
  enable_fuzzy_matching: false
  cache_hardcover_library: true
```

### Metadata Management

1. **Maintain good metadata** in Audiobookshelf
2. **Add identifiers** to books when possible
3. **Use consistent formatting** for titles and authors
4. **Verify matches** during initial setup
5. **Monitor matching results** in sync logs

## 🎯 Next Steps

1. **[Cache Management](Cache-Management.md)** - Optimize matching performance
2. **[Troubleshooting Guide](../troubleshooting/Troubleshooting-Guide.md)** - Solve matching issues
3. **[Auto-Add Books](Auto-Add-Books.md)** - Handle unmatched books

## 🆘 Need Help?

- **Matching Issues**: [Book Matching Issues](../troubleshooting/Book-Matching-Issues.md)
- **Configuration Help**: [Configuration Overview](Configuration-Overview.md)
- **General Questions**: [FAQ](../troubleshooting/FAQ.md)

---

**Accurate book matching is the foundation of reliable sync!** 🔍📚 