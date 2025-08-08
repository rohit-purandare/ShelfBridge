# 📊 Data Models

This document defines all data structures used throughout ShelfBridge, including configuration objects, API responses, cache schemas, and internal data models. This reference is essential for developers and advanced users who need to understand data flow and structure.

## Table of Contents

- [Configuration Models](#configuration-models)
- [User Models](#user-models)
- [Book Models](#book-models)
- [Progress Models](#progress-models)
- [Cache Models](#cache-models)
- [API Response Models](#api-response-models)
- [Internal Models](#internal-models)
- [Validation Models](#validation-models)

## Configuration Models

### GlobalConfig

```typescript
interface GlobalConfig {
  // Core sync settings
  min_progress_threshold: number; // 0-100, default: 5.0
  workers: number; // 1-10, default: 3
  parallel: boolean; // default: true
  timezone: string; // IANA timezone, default: "UTC"

  // Safety and testing
  dry_run: boolean; // default: false
  force_sync: boolean; // default: false
  max_books_to_process?: number; // 1-10000, optional

  // Automation
  sync_schedule: string; // cron expression, default: "0 3 * * *"
  auto_add_books: boolean; // default: false

  // Progress protection
  prevent_progress_regression: boolean; // default: true
  reread_detection?: RereadDetection; // optional object

  // Rate limiting and performance
  hardcover_semaphore: number; // 1-10, default: 1
  hardcover_rate_limit: number; // 10-60, default: 55
  audiobookshelf_semaphore: number; // 1-10, default: 5
  audiobookshelf_rate_limit: number; // 60-1200, default: 600

  // Library fetching
  max_books_to_fetch?: number; // 1-10000 or null, optional
  page_size: number; // 25-200, default: 100

  // Debugging
  dump_failed_books: boolean; // default: true
}
```

### RereadDetection

```typescript
interface RereadDetection {
  reread_threshold: number; // 0-100, default: 30
  high_progress_threshold: number; // 0-100, default: 85
  regression_block_threshold: number; // 0-100, default: 50
  regression_warn_threshold: number; // 0-100, default: 15
}
```

### UserConfig

```typescript
interface UserConfig {
  id: string; // unique identifier, min length: 1
  abs_url: string; // valid HTTP/HTTPS URL
  abs_token: string; // min length: 10
  hardcover_token: string; // min length: 10
}
```

### FullConfig

```typescript
interface FullConfig {
  global: GlobalConfig;
  users: UserConfig[];
}
```

## User Models

### User (Internal)

```typescript
interface User {
  id: string;
  abs_url: string;
  abs_token: string; // normalized (Bearer prefix removed)
  hardcover_token: string; // normalized (Bearer prefix removed)
}
```

### CronConfig

```typescript
interface CronConfig {
  schedule: string; // cron expression
  timezone: string; // IANA timezone
}
```

## Book Models

### BookIdentifiers

```typescript
interface BookIdentifiers {
  asin?: string; // normalized (uppercase, no spaces)
  isbn?: string; // normalized (no hyphens/spaces)
}
```

### AudiobookshelfBook

```typescript
interface AudiobookshelfBook {
  // Core metadata
  id: string;
  title: string;
  author?: string;

  // Progress tracking
  progress_percentage: number; // 0-100
  is_finished?: boolean | number; // 1 = finished, 0 = not finished
  started_at?: number; // Unix timestamp in milliseconds
  finished_at?: number; // Unix timestamp in milliseconds
  last_listened_at?: string; // ISO date string

  // Identifiers (nested in metadata)
  metadata?: {
    asin?: string;
    isbn?: string;
    isbn_10?: string;
    isbn_13?: string;
  };

  // Media information
  media?: {
    metadata?: {
      asin?: string;
      isbn?: string;
      isbn_10?: string;
      isbn_13?: string;
    };
  };

  // Internal processing flags
  _isMetadataOnly?: boolean; // indicates filtering metadata
  _filteringStats?: LibraryStats; // attached during deep scans
}
```

### HardcoverBook

```typescript
interface HardcoverBook {
  id: number; // Hardcover book ID
  title: string;
  slug: string;
  editions?: HardcoverEdition[];
  contributions?: HardcoverContribution[]; // Book-level contributors (enhanced)
}
```

### HardcoverEdition

```typescript
interface HardcoverEdition {
  id: number; // Edition ID
  format: string; // "audiobook", "hardcover", etc.
  pages?: number; // for text books
  audio_seconds?: number; // for audiobooks
  isbn_10?: string;
  isbn_13?: string;
  asin?: string;
  book: HardcoverBook;
  contributions?: HardcoverContribution[]; // Edition-level contributors (enhanced)
}
```

### HardcoverUserBook

```typescript
interface HardcoverUserBook {
  id: number; // User book ID
  book: HardcoverBook;
  status?: string; // reading status
}
```

### HardcoverContribution

```typescript
interface HardcoverContribution {
  author: {
    id: number;
    name: string;
  };
  contribution?: string; // Role label (e.g., "Narrator", "Reader", null for authors)
}
```

### HardcoverMatch

```typescript
interface HardcoverMatch {
  userBook: HardcoverUserBook;
  edition: HardcoverEdition;
}
```

## Progress Models

### ProgressInfo

```typescript
interface ProgressInfo {
  before: number; // previous progress percentage
  after: number; // new progress percentage
  changed: boolean; // whether progress actually changed
}
```

### ProgressRegression

```typescript
interface ProgressRegression {
  shouldBlock: boolean; // block the sync operation
  shouldWarn: boolean; // warn about potential issue
  reason: string; // explanation for the decision
}
```

### CurrentProgress

```typescript
interface CurrentProgress {
  has_progress: boolean; // user has any progress
  latest_read?: {
    current_page?: number;
    total_pages?: number;
    current_seconds?: number;
    total_seconds?: number;
    finished_at?: string; // ISO date if completed
    started_at?: string; // ISO date when started
  };
}
```

## Cache Models

### CachedBook (Database Schema)

```sql
CREATE TABLE books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  identifier TEXT NOT NULL,           -- ISBN or ASIN
  identifier_type TEXT NOT NULL,      -- 'isbn' or 'asin'
  title TEXT NOT NULL,
  edition_id INTEGER,                 -- Hardcover edition ID
  author TEXT,
  last_progress REAL DEFAULT 0.0,     -- previous progress percentage
  progress_percent REAL DEFAULT 0.0,  -- current progress percentage
  last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_listened_at TIMESTAMP,
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  UNIQUE(user_id, identifier, title)
);
```

### CachedBookInfo

```typescript
interface CachedBookInfo {
  exists: boolean; // book found in cache
  last_sync?: string; // ISO timestamp of last sync
  progress_percent?: number; // cached progress percentage
  edition_id?: number; // Hardcover edition ID
}
```

### SyncTracking (Database Schema)

```sql
CREATE TABLE sync_tracking (
  user_id TEXT PRIMARY KEY,
  sync_count INTEGER DEFAULT 0,
  total_syncs INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### LibraryStats (Database Schema and Interface)

```sql
CREATE TABLE library_stats (
  user_id TEXT PRIMARY KEY,
  total_books INTEGER DEFAULT 0,
  books_with_progress INTEGER DEFAULT 0,
  in_progress_books INTEGER DEFAULT 0,
  completed_books INTEGER DEFAULT 0,
  never_started_books INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

```typescript
interface LibraryStats {
  totalBooksInLibrary: number; // total books in ABS library
  totalWithProgress: number; // books with any progress
  inProgressBooks: number; // currently being read
  allCompletedBooks: number; // all completed books
  completedBooksFiltered: number; // completed books in current query
  booksNeverStarted: number; // books never opened
  booksPassingFilter: number; // books that passed filter criteria
}
```

### CacheStats

```typescript
interface CacheStats {
  total_books: number; // total books in cache
  recent_books: number; // books updated in last 7 days
  cache_size_mb: number; // cache file size in MB
}
```

## API Response Models

### ValidationResult

```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[]; // validation error messages
  warnings: string[]; // validation warnings
}
```

### ConnectionTestResult

```typescript
interface ConnectionTestResult {
  abs: boolean; // Audiobookshelf connection successful
  hardcover: boolean; // Hardcover connection successful
  errors: string[]; // specific error messages
}
```

### SyncResult

```typescript
interface SyncResult {
  books_processed: number; // total books examined
  books_synced: number; // books with progress updated
  books_completed: number; // books marked as completed
  books_auto_added: number; // books automatically added
  books_skipped: number; // books skipped (no changes)
  errors: string[]; // error messages
  timing: Record<string, number>; // timing information
  book_details: BookSyncDetail[]; // detailed results per book
  deep_scan_performed: boolean; // whether deep scan was used

  // Library statistics (if available)
  total_books_in_library?: number;
  books_with_progress?: number;
  books_in_progress?: number;
  all_completed_books?: number;
  books_never_started?: number;
  stats_source?: 'deep_scan' | 'cached' | 'realtime' | 'mixed' | 'none';
  stats_last_updated?: string;
}
```

### BookSyncDetail

```typescript
interface BookSyncDetail {
  title: string;
  author?: string;
  status: 'synced' | 'completed' | 'auto_added' | 'skipped' | 'error';
  reason?: string; // explanation for status

  // Progress information
  progress: {
    before: number | null; // previous progress
    after: number | null; // new progress
    changed: boolean; // whether progress changed
  };

  // Identifiers used
  identifiers: BookIdentifiers;

  // Cache information
  cache_status: {
    found: boolean; // book found in cache
    last_sync?: string; // last sync timestamp
  };

  // Hardcover information
  hardcover_info?: {
    edition_id: number;
    format?: string;
    pages?: number;
    duration?: string; // formatted duration for audiobooks
  };

  // API response details
  api_response?: {
    success: boolean;
    status_code: number;
    duration: number; // response time in seconds
  };

  // Timestamps
  timestamps: {
    last_listened_at?: string;
    completed_at?: string;
  };

  // Actions taken
  actions: string[]; // list of actions performed
  errors: string[]; // any errors encountered
  timing?: number; // processing time in milliseconds
}
```

## Internal Models

### AutoAddResult

```typescript
interface AutoAddResult {
  status: 'auto_added' | 'skipped' | 'error';
  reason: string; // explanation
  title: string; // book title
  hardcover_id?: number; // Hardcover book ID if added
  edition_id?: number; // Hardcover edition ID if added
}
```

### ExistingSyncResult

```typescript
interface ExistingSyncResult {
  status: 'synced' | 'completed' | 'skipped' | 'error';
  reason?: string; // explanation
  title: string; // book title
}
```

### ProgressCalculation

```typescript
interface ProgressCalculation {
  currentProgress: number; // calculated current value
  totalValue: number; // total pages or seconds
  useSeconds: boolean; // true for audiobooks, false for books
  progressPercent: number; // percentage (0-100)
}
```

### TimingData

```typescript
interface TimingData {
  [operation: string]: number; // operation name -> duration in ms
}
```

### FilteringStats

```typescript
interface FilteringStats {
  totalBooksInLibrary: number;
  totalWithProgress: number;
  inProgressBooks: number;
  allCompletedBooks: number;
  completedBooksFiltered: number;
  booksNeverStarted: number;
  booksPassingFilter: number;
}
```

## Validation Models

### ConfigSchema

```typescript
interface ConfigSchema {
  global: Record<string, FieldSchema>;
  users: {
    type: 'array';
    minItems: number;
    items: Record<string, FieldSchema>;
  };
}
```

### FieldSchema

```typescript
interface FieldSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  optional?: boolean;
  default?: any;
  min?: number; // for numbers
  max?: number; // for numbers
  minLength?: number; // for strings
  validate?: string; // custom validation function name
  description: string; // human-readable description
  properties?: Record<string, FieldSchema>; // for nested objects
}
```

### PlaceholderPatterns

```typescript
interface PlaceholderPatterns {
  urls: string[]; // URL placeholder patterns
  tokens: string[]; // Token placeholder patterns
  userIds: string[]; // User ID placeholder patterns
}
```

## Error Models

### SyncError

```typescript
interface SyncError {
  book_title: string;
  user_id: string;
  error_type: 'api' | 'network' | 'validation' | 'cache';
  error_message: string;
  timestamp: string; // ISO timestamp
  identifiers?: BookIdentifiers;
  stack_trace?: string;
}
```

### FailedBookDump

```typescript
interface FailedBookDump {
  timestamp: string; // ISO timestamp
  user_id: string;
  sync_summary: {
    total_errors: number;
    total_processed: number;
    success_rate: number; // percentage
  };
  failed_books: {
    title: string;
    author?: string;
    identifiers: BookIdentifiers;
    error: string;
    attempted_action: string;
  }[];
}
```

## Rate Limiting Models

### RateLimiterConfig

```typescript
interface RateLimiterConfig {
  points: number; // requests allowed
  duration: number; // time window in seconds
}
```

### SemaphoreState

```typescript
interface SemaphoreState {
  maxConcurrency: number; // maximum concurrent operations
  current: number; // current active operations
  queue: Array<() => void>; // queued operations
}
```

## Logging Models

### LogContext

```typescript
interface LogContext {
  userId?: string;
  operation?: string;
  bookId?: string;
  title?: string;
}
```

### LogEntry

```typescript
interface LogEntry {
  timestamp: string; // ISO timestamp
  level: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
  message: string;
  service: string; // "shelfbridge"
  version: string; // application version
  context?: LogContext;
  metadata?: Record<string, any>;
}
```

## Enhanced Author & Narrator Extraction Models (New!)

### AuthorExtractionResult

```typescript
// Author extraction with hierarchical data priority and multi-author support
interface AuthorExtractionResult {
  author: string; // Primary author name (best match)
  confidence: number; // 0-100 confidence score for author match
  source: 'edition' | 'book' | 'legacy'; // Data source used for extraction
  allAuthors?: string[]; // All authors for multi-author works
  narrator?: string; // Identified narrator (if any)
  narratorSource?: 'explicit' | 'heuristic' | 'legacy'; // Narrator detection method
  targetAuthor?: string; // Author being searched for (if provided)
  similarity?: number; // Text similarity score (0-100) when target provided
}
```

### NarratorExtractionResult

```typescript
// Narrator extraction with explicit role label support
interface NarratorExtractionResult {
  narrator: string; // Narrator name
  source: 'explicit' | 'heuristic' | 'legacy'; // Detection method
  confidence: number; // 0-100 confidence score
  roleLabel?: string; // Explicit role (e.g., "Narrator", "Reader")
  contributionLevel: 'edition' | 'book' | 'legacy'; // Data source level
}
```

### TextSimilarityOptions

```typescript
// Text similarity matching configuration
interface TextSimilarityOptions {
  threshold: number; // Minimum similarity score (0-100)
  ignoreCase: boolean; // Case-insensitive matching
  normalizeSpacing: boolean; // Normalize whitespace and punctuation
  fuzzyMatching: boolean; // Enable fuzzy string matching
}
```

## Data Flow Relationships

### Configuration Flow

```
config.yaml → Config.load() → ConfigValidator.validate() → GlobalConfig + UserConfig[]
```

### Sync Flow

```
UserConfig → SyncManager → AudiobookshelfBook[] → BookIdentifiers → HardcoverMatch → SyncResult
```

### Cache Flow

```
BookSyncDetail → BookCache.store() → SQLite Database → CachedBookInfo
```

### Progress Flow

```
AudiobookshelfBook.progress → ProgressCalculation → Hardcover API → CurrentProgress
```

## Data Validation Rules

### Global Configuration

- All numeric values have defined ranges (e.g., 0-100 for percentages)
- String values are validated for format (URLs, cron expressions, timezones)
- Boolean values have explicit defaults
- Optional fields can be omitted and will use defaults

### User Configuration

- User IDs must be unique across all users
- URLs must be valid HTTP/HTTPS with proper format
- Tokens must meet minimum length requirements
- Bearer prefixes are automatically stripped

### Book Data

- Progress percentages are constrained to 0-100 range
- Timestamps are normalized to ISO format with timezone support
- Identifiers are normalized (uppercase, no special characters)
- Title and author fields are trimmed of whitespace

### Cache Data

- All foreign keys reference valid primary keys
- Timestamps use CURRENT_TIMESTAMP for defaults
- Progress values are validated before storage
- Unique constraints prevent duplicate entries

This data model reference provides the complete structure for all data used in ShelfBridge. For implementation details, see the [Architecture Overview](Architecture-Overview.md). For API usage, see the [CLI Reference](CLI-Reference.md).
