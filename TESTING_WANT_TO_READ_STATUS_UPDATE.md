# Testing Guide: Want to Read Status Update Feature

## Overview

This document provides comprehensive testing instructions for the Want to Read status update feature. This feature automatically transitions books from "Want to Read" status to "Currently Reading" status when reading progress is synced from Audiobookshelf to Hardcover.

## Feature Description

**Problem Solved:** Previously, when a user had a book in "Want to Read" status in Hardcover and started reading it in Audiobookshelf, ShelfBridge would sync the reading progress but the book would remain in "Want to Read" status instead of moving to "Currently Reading".

**Solution:** The fix automatically detects when a book is in "Want to Read" status (or any non-reading/non-completed status) and updates it to "Currently Reading" before syncing the progress.

---

## Automated Testing

### Running Unit Tests

The feature includes comprehensive unit tests covering all scenarios:

```bash
# Run only the Want to Read status update tests
node --test tests/want-to-read-status-update.test.js

# Run all tests to ensure no regressions
npm test
```

### Test Coverage

The automated tests cover:

- ✅ Status transition from Want to Read (1) → Currently Reading (2)
- ✅ Status preservation for Currently Reading (2) - no change
- ✅ Status preservation for Read/Completed (3) - no change
- ✅ Audiobook support (using seconds instead of pages)
- ✅ Edge cases: missing user_book, missing status_id, status_id = 0
- ✅ Unknown status IDs (4, 5, etc.) → Currently Reading (2)
- ✅ New reading session creation with Want to Read status
- ✅ Verification that status is updated BEFORE progress is synced

---

## Manual Testing

### Prerequisites

1. **Audiobookshelf Instance**: Running with books in library
2. **Hardcover Account**: With API access
3. **ShelfBridge**: Configured and running

### Test Scenario 1: Want to Read → Currently Reading (Primary Use Case)

**Setup:**

1. In Hardcover web UI, add a book to your library with "Want to Read" status
2. In Audiobookshelf, start reading the same book (ensure it has >0% progress)

**Test Steps:**

1. Run ShelfBridge sync:

   ```bash
   npm start
   ```

2. Check the sync logs for the status update message:

   ```
   [info]: Book status is 1, updating to "Currently Reading" (status_id: 2)
   ```

3. Verify in Hardcover web UI:
   - The book should now appear in "Currently Reading" shelf
   - The reading progress should be synced (e.g., 25% complete)
   - The book should NO LONGER be in "Want to Read" shelf

**Expected Result:** ✅ Book moves from "Want to Read" to "Currently Reading" with progress synced

---

### Test Scenario 2: Currently Reading Status Preservation

**Setup:**

1. Have a book in Hardcover with "Currently Reading" status and some progress (e.g., 30%)
2. Continue reading the same book in Audiobookshelf to increase progress (e.g., to 45%)

**Test Steps:**

1. Run ShelfBridge sync
2. Check logs - should NOT see status update message
3. Verify in Hardcover:
   - Book remains in "Currently Reading"
   - Progress updated to new value (45%)

**Expected Result:** ✅ Status remains "Currently Reading", only progress is updated

---

### Test Scenario 3: Completed Book Status Preservation

**Setup:**

1. Have a completed book in Hardcover (status = "Read", 100% progress)
2. Restart reading it in Audiobookshelf (e.g., 10% progress)

**Test Steps:**

1. Run ShelfBridge sync
2. Check logs - may see re-read session creation
3. Verify in Hardcover:
   - Original completion status should be preserved OR
   - New reading session created (depending on re-read detection settings)

**Expected Result:** ✅ Completed books handled according to re-read configuration

---

### Test Scenario 4: Audiobook with Want to Read Status

**Setup:**

1. Add an audiobook to Hardcover with "Want to Read" status
2. Start listening to the audiobook in Audiobookshelf (e.g., 1 hour into a 10-hour book)

**Test Steps:**

1. Run ShelfBridge sync
2. Check logs for status update message
3. Verify in Hardcover:
   - Audiobook appears in "Currently Reading"
   - Listening progress is synced (e.g., 10% or 1:00:00 / 10:00:00)

**Expected Result:** ✅ Audiobooks work the same as text books

---

### Test Scenario 5: New Book Auto-Add with Progress

**Setup:**

1. Have a book in Audiobookshelf with progress that is NOT in your Hardcover library
2. Ensure ShelfBridge auto-add is enabled

**Test Steps:**

1. Run ShelfBridge sync
2. Check logs for "Adding book to library" and status update messages
3. Verify in Hardcover:
   - Book is added to library
   - Book appears in "Currently Reading" (not "Want to Read")
   - Progress is synced

**Expected Result:** ✅ New books are added with "Currently Reading" status when auto-added

---

### Test Scenario 6: Multiple Books Sync

**Setup:**

1. Have multiple books in various states:
   - Book A: Want to Read in Hardcover, 25% progress in Audiobookshelf
   - Book B: Currently Reading in Hardcover, 50% → 60% progress
   - Book C: Want to Read in Hardcover, 10% progress in Audiobookshelf

**Test Steps:**

1. Run ShelfBridge sync
2. Check logs for status updates (should see updates for Books A and C only)
3. Verify in Hardcover:
   - Book A: Moved to "Currently Reading", 25% progress
   - Book B: Remains "Currently Reading", 60% progress
   - Book C: Moved to "Currently Reading", 10% progress

**Expected Result:** ✅ All books sync correctly with appropriate status updates

---

## Verification Checklist

After running tests, verify:

- [ ] Books in "Want to Read" automatically move to "Currently Reading" when they have progress
- [ ] Books already in "Currently Reading" remain in that status
- [ ] Completed books (status = "Read") are not affected
- [ ] Progress syncing works correctly for both text books (pages) and audiobooks (seconds)
- [ ] Logs show clear status update messages when transitions occur
- [ ] No errors or warnings in the sync output
- [ ] All automated tests pass (`npm test`)

---

## Troubleshooting

### Issue: Book remains in "Want to Read" after sync

**Possible Causes:**

1. Sync failed - check logs for errors
2. Book progress is 0% - ShelfBridge may skip sync
3. API rate limiting - check for HTTP 429 errors
4. Book not matched correctly between Audiobookshelf and Hardcover

**Debug Steps:**

1. Check sync logs for the specific book title
2. Verify book identifiers (ISBN, ASIN) match between systems
3. Run sync with `--verbose` flag for detailed output
4. Check Hardcover API responses in debug logs

### Issue: Status updated but progress not synced

**Possible Causes:**

1. Progress update API call failed after status update
2. Network issue during sync
3. Invalid edition or progress data

**Debug Steps:**

1. Check logs for progress update errors
2. Verify edition IDs are valid in Hardcover
3. Check if book has proper pages/audio_seconds data

### Issue: Completed books being reset

**Possible Causes:**

1. Re-read detection not properly configured
2. Progress regression detected incorrectly

**Debug Steps:**

1. Check re-read detection configuration in config
2. Review logs for regression detection messages
3. Adjust re-read thresholds if needed

---

## Expected Log Output

### Successful Status Update

```
[info]: Book status is 1, updating to "Currently Reading" (status_id: 2)
  userBookId: 12345
  currentStatus: 1
  newStatus: 2
[info]: Successfully updated progress for "Book Title"
  progress: 25.5%
  progress_pages: 51
```

### No Status Update Needed

```
[info]: Successfully updated progress for "Book Title"
  progress: 45.2%
  progress_pages: 90
```

---

## Rollback Procedure

If issues are found with this feature:

1. Switch back to the previous branch:

   ```bash
   git checkout main
   npm install
   ```

2. Report the issue with:
   - Sync logs
   - Book details (title, ISBN/ASIN, status before/after)
   - Expected vs. actual behavior

---

## Performance Considerations

- **Additional API Call**: The feature adds one extra API call per book when status needs updating
- **Impact**: Minimal - only affects books in "Want to Read" status
- **Rate Limiting**: Status updates count toward Hardcover API rate limits
- **Optimization**: Status check happens before sync, so no extra API calls for books already in "Currently Reading"

---

## Related Configuration

No new configuration options are required. The feature uses existing status_id values:

```
Status IDs in Hardcover:
1 = Want to Read
2 = Currently Reading
3 = Read (Completed)
```

---

## Future Enhancements

Potential improvements for future versions:

1. **Configuration Option**: Add toggle to disable automatic status updates
2. **Status Mapping**: Allow custom status ID mappings for different Hardcover instances
3. **Batch Updates**: Batch status updates for multiple books to reduce API calls
4. **Status Transition Logging**: Enhanced logging with before/after status for audit trail
5. **User Confirmation**: Optional prompt before changing book status

---

## Summary

This feature provides a seamless experience for users by automatically transitioning books from "Want to Read" to "Currently Reading" when they start reading them. The implementation:

- ✅ Solves the reported issue completely
- ✅ Maintains backward compatibility
- ✅ Includes comprehensive test coverage
- ✅ Handles all edge cases gracefully
- ✅ Provides clear logging for debugging
- ✅ Has minimal performance impact

For questions or issues, please refer to the GitHub issues page or contact the development team.
