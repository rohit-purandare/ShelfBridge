# Early Progress Check Optimization for Title/Author Books

## Problem Description

Previously, books matched using **title/author** (those without ISBN/ASIN identifiers) were always triggering Hardcover API searches during sync, even when their progress hadn't changed. This created unnecessary API load and slower sync performance.

### Root Cause

The early progress change optimization in `sync-manager.js` only applied to books with `identifiers.isbn` or `identifiers.asin`. Books matched by title/author would:

1. Skip the early progress check (lines 433-479)
2. Always trigger expensive `bookMatcher.findMatch()` calls
3. Always execute `hardcover.searchBooksForMatching()` API calls
4. Only check progress change after the expensive operations

## Solution Implemented

Extended the early progress check optimization to support title/author books by:

### Code Changes

**File**: `src/sync-manager.js` (lines 429-500)

```javascript
// BEFORE (only ISBN/ASIN books optimized)
const hasIdentifiers = identifiers.isbn || identifiers.asin;
if (hasIdentifiers && !this.globalConfig.force_sync) {
  // Early progress check logic
}

// AFTER (includes title/author books)
const hasIdentifiers = identifiers.isbn || identifiers.asin;
const titleAuthorId = hasIdentifiers
  ? null
  : this.cache.generateTitleAuthorIdentifier(title, author);

if ((hasIdentifiers || titleAuthorId) && !this.globalConfig.force_sync) {
  const identifier = identifiers.asin || identifiers.isbn || titleAuthorId;
  const identifierType = identifiers.asin
    ? 'asin'
    : identifiers.isbn
      ? 'isbn'
      : 'title_author';

  // Check if we have cached data for this book
  const cachedInfo = await this.cache.getCachedBookInfo(
    userId,
    identifier,
    title,
    identifierType,
  );

  if (cachedInfo.exists) {
    // Validate progress and check for changes
    const hasChanged = await this.cache.hasProgressChanged(
      userId,
      identifier,
      title,
      validatedProgress,
      identifierType,
    );

    if (!hasChanged) {
      // Skip expensive operations - return early
      return {
        status: 'skipped',
        reason: 'Progress unchanged (optimized early check)',
      };
    }
  }
}
```

### Key Improvements

1. **Title/Author Support**: Books without ISBN/ASIN now get early progress checks
2. **Cache Integration**: Uses existing `generateTitleAuthorIdentifier()` method from BookCache
3. **Identifier Type Tracking**: Properly handles `'title_author'` as an identifier type
4. **Backward Compatibility**: Existing ISBN/ASIN optimization remains unchanged
5. **Error Handling**: Gracefully falls back to expensive matching if cache fails

## Performance Impact

### Before Fix

- Title/author books: **Always** triggered API searches
- Example: 100 title/author books = 100 API calls per sync

### After Fix

- Title/author books: **Only** trigger API searches when progress changed
- Example: 100 title/author books with 5% progress changes = 5 API calls per sync
- **95% reduction** in unnecessary API calls for stable libraries

## Testing

Comprehensive test coverage added in:

- `tests/early-progress-check-optimization.test.js` - Dedicated test suite
- `tests/sync-manager-two-stage.test.js` - Integration tests

### Test Scenarios Covered

1. **ISBN/ASIN Books** - Existing behavior unchanged
2. **Title/Author Cached** - Skip when progress unchanged
3. **Title/Author Changed** - Proceed when progress changed
4. **Title/Author New** - Proceed when no cache exists
5. **Force Sync** - Bypass optimization when force_sync enabled
6. **Error Handling** - Graceful fallback on cache errors
7. **Performance** - Timing improvements for batch operations
8. **Mixed Books** - ISBN/ASIN and title/author in same sync

### Running Tests

```bash
# Run comprehensive tests
./test/run-early-progress-check-tests.sh

# Run specific test suites
npx jest tests/early-progress-check-optimization.test.js
npx jest tests/sync-manager-two-stage.test.js --testNamePattern="Early Progress Check"
```

## Implementation Details

### Cache Key Generation

- Uses existing `BookCache.generateTitleAuthorIdentifier(title, author)`
- Format: `title_author:normalized_title|normalized_author`
- Consistent with existing caching patterns

### Progress Change Detection

- Leverages existing `cache.hasProgressChanged()` method
- Supports `'title_author'` identifier type parameter
- Uses same tolerance thresholds as ISBN/ASIN books

### Logging Enhancements

- Added identifier type to debug logs
- Example: `"Early skip for Book: Progress unchanged (50.0%) - title_author match"`
- Helps distinguish optimization paths in logs

## Backward Compatibility

- **Existing ISBN/ASIN optimization**: Unchanged
- **Existing cache structure**: Compatible
- **Existing configuration**: No changes required
- **Existing API contracts**: Preserved

## Configuration

No new configuration required. Uses existing settings:

- `force_sync: false` - Enables optimization (default)
- `force_sync: true` - Bypasses optimization
- Cache settings - Uses existing cache configuration

## Monitoring

Log patterns to monitor optimization effectiveness:

```bash
# Count early skips by type
grep "Early skip.*isbn" logs/sync.log | wc -l
grep "Early skip.*title_author" logs/sync.log | wc -l

# Monitor API call reduction
grep "searchBooksForMatching" logs/sync.log | wc -l
```

## Future Enhancements

Potential improvements:

1. Cache warming strategies for new title/author books
2. Batch progress change checking
3. Predictive caching based on reading patterns
