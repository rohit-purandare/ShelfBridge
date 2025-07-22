# ⚙️ Configuration Reference

Complete technical reference for all ShelfBridge configuration options. This document covers every setting, validation rule, data type, and advanced feature for both YAML and environment variable configuration methods.

## Table of Contents

- [Configuration Structure](#configuration-structure)
- [Global Configuration](#global-configuration)
- [User Configuration](#user-configuration)
- [Environment Variables](#environment-variables)
- [Advanced Features](#advanced-features)
- [Validation Reference](#validation-reference)
- [Configuration Examples](#configuration-examples)

## Configuration Structure

ShelfBridge uses a two-section configuration structure:

```yaml
global:
  # Global settings that apply to all users

users:
  # Array of user-specific configurations
```

### Priority Order

1. **YAML Configuration** (highest) - `config/config.yaml`
2. **Environment Variables** (fallback) - `SHELFBRIDGE_*`
3. **Default Values** (lowest) - Built-in application defaults

## Global Configuration

### Core Sync Settings

#### `min_progress_threshold`

- **Type**: Number (0-100)
- **Default**: `5.0`
- **YAML**: `min_progress_threshold: 5.0`
- **Environment**: `SHELFBRIDGE_MIN_PROGRESS_THRESHOLD=5.0`
- **Description**: Minimum progress percentage required to sync a book
- **Validation**: Must be between 0 and 100

```yaml
global:
  min_progress_threshold: 5.0 # Only sync books with >5% progress
```

#### `workers`

- **Type**: Number (1-10)
- **Default**: `3`
- **YAML**: `workers: 3`
- **Environment**: `SHELFBRIDGE_WORKERS=3`
- **Description**: Number of parallel workers for processing books
- **Validation**: Must be between 1 and 10

```yaml
global:
  workers: 3 # Process 3 books concurrently
```

#### `parallel`

- **Type**: Boolean
- **Default**: `true`
- **YAML**: `parallel: true`
- **Environment**: `SHELFBRIDGE_PARALLEL=true`
- **Description**: Enable parallel processing of books
- **Impact**: When false, processes books sequentially for easier debugging

```yaml
global:
  parallel: true # Enable parallel processing
```

#### `timezone`

- **Type**: String
- **Default**: `"UTC"`
- **YAML**: `timezone: "America/New_York"`
- **Environment**: `SHELFBRIDGE_TIMEZONE=America/New_York`
- **Description**: Timezone for scheduling and timestamps
- **Validation**: Must be a valid IANA timezone identifier

```yaml
global:
  timezone: 'America/New_York'
```

### Safety and Testing Settings

#### `dry_run`

- **Type**: Boolean
- **Default**: `false`
- **YAML**: `dry_run: true`
- **Environment**: `SHELFBRIDGE_DRY_RUN=true`
- **Description**: Run without making actual changes to Hardcover
- **Use Case**: Testing, validation, preview of changes

```yaml
global:
  dry_run: true # Preview changes without applying them
```

#### `force_sync`

- **Type**: Boolean
- **Default**: `false`
- **YAML**: `force_sync: true`
- **Environment**: `SHELFBRIDGE_FORCE_SYNC=true`
- **Description**: Force sync even if progress appears unchanged
- **Use Case**: Recovering from sync errors, cache issues

#### `max_books_to_process`

- **Type**: Number (1-10000) or null
- **Default**: `null` (no limit)
- **YAML**: `max_books_to_process: 10`
- **Environment**: `SHELFBRIDGE_MAX_BOOKS_TO_PROCESS=10`
- **Description**: Maximum number of books to process during sync
- **Use Case**: Testing with subset, resource-constrained environments

### Automation Settings

#### `sync_schedule`

- **Type**: String (cron expression)
- **Default**: `"0 3 * * *"` (daily at 3 AM)
- **YAML**: `sync_schedule: "0 */6 * * *"`
- **Environment**: `SHELFBRIDGE_SYNC_SCHEDULE="0 */6 * * *"`
- **Description**: Cron schedule for automatic sync
- **Validation**: Must be valid cron expression
- **Examples**:
  - `"0 3 * * *"` - Every day at 3:00 AM
  - `"0 */6 * * *"` - Every 6 hours
  - `"0 9,21 * * *"` - Twice daily at 9 AM and 9 PM
  - `"0 3 * * 1"` - Every Monday at 3:00 AM

#### `auto_add_books`

- **Type**: Boolean
- **Default**: `false`
- **YAML**: `auto_add_books: true`
- **Environment**: `SHELFBRIDGE_AUTO_ADD_BOOKS=true`
- **Description**: Automatically add books to Hardcover that don't exist
- **Impact**: When true, creates new Hardcover entries for missing books

### Enhanced Matching Settings

#### `title_author_matching` (YAML Only)

Advanced nested object for intelligent book matching when ASIN/ISBN are unavailable:

```yaml
global:
  title_author_matching:
    enabled: true # Enable title/author fallback matching (default: true)
    confidence_threshold: 0.70 # Minimum confidence score (0.0-1.0, default: 0.70)
    max_search_results: 5 # Maximum search results to evaluate (default: 5)
```

- **Type**: Object with nested properties
- **Default**: Enabled with standard settings
- **Environment**: Not supported (YAML configuration only)
- **Description**: Third-tier fallback matching using edition-specific GraphQL search with AI-powered scoring

**Enhanced Three-Tier System:**

1. **Primary**: ASIN matching (fastest, most reliable, ~85% success for audiobooks)
2. **Secondary**: ISBN matching (fallback for books without ASIN, ~70% success)
3. **Tertiary**: Title/Author matching with edition-specific search (~60% success for incomplete metadata)

**Sub-properties:**

- `enabled`: Boolean, default: `true` - Enable/disable the feature
- `confidence_threshold`: Number (0.0-1.0), default: `0.70` - Minimum match confidence
- `max_search_results`: Number (1-20), default: `5` - Search result limit for edition matching

#### `scoring_weights` (YAML Only - Advanced)

Fine-tune the confidence scoring algorithm weights:

```yaml
global:
  scoring_weights:
    title: 0.25 # 25% - Core title similarity (fuzzy matching)
    author: 0.18 # 18% - Author name comparison
    activity: 0.18 # 18% - Hardcover popularity metrics (users, ratings)
    series: 0.12 # 12% - Series name + sequence matching
    format: 0.10 # 10% - Format preference (audiobook/ebook/physical)
    year: 0.07 # 7% - Publication year similarity
    duration: 0.05 # 5% - Audiobook duration matching
    narrator: 0.03 # 3% - Narrator name matching (audiobooks only)
```

- **Type**: Object with weight values (must sum to 1.0)
- **Default**: Balanced weights optimized for accuracy
- **Environment**: Not supported (YAML configuration only)
- **Description**: Customize scoring factor importance for edition-specific matching

**Enhanced Confidence Scoring:**
The new scoring system evaluates match confidence using eight weighted factors:

| Factor               | Weight | Purpose                                        | Scoring Range |
| -------------------- | ------ | ---------------------------------------------- | ------------- |
| **Title Similarity** | 25%    | Core text matching using fuzzy algorithms      | 0-100%        |
| **Author Match**     | 18%    | Author name comparison with normalization      | 0-100%        |
| **Activity Score**   | 18%    | Hardcover popularity (users, ratings, lists)   | 0-100%        |
| **Series Match**     | 12%    | Series name + sequence number matching         | 0-100%        |
| **Format Match**     | 10%    | User's format vs edition format preference     | 0-100%        |
| **Publication Year** | 7%     | Year similarity for edition disambiguation     | 0-100%        |
| **Duration Match**   | 5%     | Audiobook length comparison (±1-20% tolerance) | 0-100%        |
| **Narrator Match**   | 3%     | Audiobook narrator name matching               | 0-100%        |

**Confidence Result Ranges:**

- **95-100%**: Perfect Match → Immediate sync, high confidence logging
- **80-94%**: High Confidence → Sync with validation details
- **70-79%**: Good Match → Sync (configurable threshold)
- **60-69%**: Fair Match → Require manual confirmation or lower threshold
- **<60%**: Poor Match → Skip, suggest metadata improvement

**Edition-Specific Features:**

- **Direct edition search**: GraphQL query to Hardcover's editions endpoint
- **Format preference bonuses**: +10 points for audiobook matches, +8 for ebook, +5 for physical
- **Duration precision**: Audiobook length matching within 1-20% tolerance
- **Narrator inference**: Smart detection using contributor position analysis
- **Series intelligence**: Automatic series name and sequence extraction from titles

**Example scenarios:**

- Audiobook with only title/author metadata
- Books from smaller publishers without ASIN/ISBN
- International editions with different identifiers
- User-uploaded content with incomplete metadata

**Performance:**

- Results are cached for improved performance
- Rate-limited to respect Hardcover API limits
- Fallback only occurs when ASIN/ISBN matching fails

### Progress Protection Settings

#### `prevent_progress_regression`

- **Type**: Boolean
- **Default**: `true`
- **YAML**: `prevent_progress_regression: true`
- **Environment**: `SHELFBRIDGE_PREVENT_PROGRESS_REGRESSION=true`
- **Description**: Prevent accidentally overwriting completion status or high progress
- **Recommendation**: Keep enabled unless specifically needed

#### `reread_detection` (YAML Only)

Advanced nested object for fine-tuning progress regression protection:

```yaml
global:
  reread_detection:
    reread_threshold: 30 # Progress below 30% = "starting over"
    high_progress_threshold: 85 # Progress above 85% = "high progress"
    regression_block_threshold: 50 # Block drops >50% from high progress
    regression_warn_threshold: 15 # Warn about drops >15% from high progress
```

**Sub-properties:**

- `reread_threshold`: Number (0-100), default: 30
- `high_progress_threshold`: Number (0-100), default: 85
- `regression_block_threshold`: Number (0-100), default: 50
- `regression_warn_threshold`: Number (0-100), default: 15

### Rate Limiting and Performance

#### `hardcover_semaphore`

- **Type**: Number (1-10)
- **Default**: `1`
- **YAML**: `hardcover_semaphore: 1`
- **Environment**: `SHELFBRIDGE_HARDCOVER_SEMAPHORE=1`
- **Description**: Maximum concurrent requests to Hardcover API
- **Recommendation**: Keep at 1 to respect Hardcover's rate limits

#### `hardcover_rate_limit`

- **Type**: Number (10-60)
- **Default**: `55`
- **YAML**: `hardcover_rate_limit: 55`
- **Environment**: `SHELFBRIDGE_HARDCOVER_RATE_LIMIT=55`
- **Description**: Hardcover API requests per minute
- **Recommendation**: Stay below 60 to avoid hitting API limits

#### `audiobookshelf_semaphore`

- **Type**: Number (1-10)
- **Default**: `5`
- **YAML**: `audiobookshelf_semaphore: 5`
- **Environment**: `SHELFBRIDGE_AUDIOBOOKSHELF_SEMAPHORE=5`
- **Description**: Maximum concurrent requests to Audiobookshelf API
- **Note**: Can be higher since Audiobookshelf is typically self-hosted

#### `audiobookshelf_rate_limit`

- **Type**: Number (60-1200)
- **Default**: `600`
- **YAML**: `audiobookshelf_rate_limit: 600`
- **Environment**: `SHELFBRIDGE_AUDIOBOOKSHELF_RATE_LIMIT=600`
- **Description**: Audiobookshelf API requests per minute
- **Note**: Adjust based on your server capacity

### Library Fetching Settings

#### `max_books_to_fetch`

- **Type**: Number (1-10000) or null
- **Default**: `null` (no limit)
- **YAML**: `max_books_to_fetch: 1000`
- **Environment**: `SHELFBRIDGE_MAX_BOOKS_TO_FETCH=1000`
- **Description**: Maximum number of books to fetch from Audiobookshelf
- **Use Case**: Prevents memory issues on resource-constrained devices

#### `page_size`

- **Type**: Number (25-200)
- **Default**: `100`
- **YAML**: `page_size: 100`
- **Environment**: `SHELFBRIDGE_PAGE_SIZE=100`
- **Description**: Number of books to fetch per API call
- **Impact**:
  - Smaller values = more API calls, smaller responses (better for slow connections)
  - Larger values = fewer API calls, larger responses (better for fast connections)

#### `deep_scan_interval`

- **Type**: Number (1-100)
- **Default**: `10`
- **YAML**: `deep_scan_interval: 10`
- **Environment**: `SHELFBRIDGE_DEEP_SCAN_INTERVAL=10`
- **Description**: Number of syncs between deep scans
- **Behavior**:
  - Deep scans check the entire library
  - Fast scans only check books in progress
  - Set to 1 for always full scan

### Debugging Settings

#### `dump_failed_books`

- **Type**: Boolean
- **Default**: `true`
- **YAML**: `dump_failed_books: true`
- **Environment**: `SHELFBRIDGE_DUMP_FAILED_BOOKS=true`
- **Description**: Create detailed error reports for failed syncs
- **Output**: Creates error report files in the data/ folder

### Library Filtering (YAML Only)

Global library filtering configuration that applies to all users unless overridden:

```yaml
global:
  libraries:
    include: ['Audiobooks', 'Fiction'] # Only sync these libraries
    # OR use exclude instead:
    # exclude: ["Podcasts", "Samples"]    # Skip these libraries
```

**Properties:**

- `include`: Array of library names/IDs to sync (mutually exclusive with exclude)
- `exclude`: Array of library names/IDs to skip (mutually exclusive with include)

**Validation Rules:**

- Cannot use both include and exclude simultaneously
- Library names are case-insensitive
- Can use library IDs or display names
- Minimum array length: 1

## User Configuration

Each user requires these settings:

### Required User Settings

#### `id`

- **Type**: String
- **YAML**: `id: alice`
- **Environment**: `SHELFBRIDGE_USER_0_ID=alice`
- **Description**: Unique identifier for the user
- **Validation**: Minimum length 1, must be unique across users

#### `abs_url`

- **Type**: String (URL)
- **YAML**: `abs_url: https://abs.example.com`
- **Environment**: `SHELFBRIDGE_USER_0_ABS_URL=https://abs.example.com`
- **Description**: Audiobookshelf server URL
- **Validation**: Must be valid HTTP/HTTPS URL

#### `abs_token`

- **Type**: String
- **YAML**: `abs_token: your_abs_token`
- **Environment**: `SHELFBRIDGE_USER_0_ABS_TOKEN=your_abs_token`
- **Description**: Audiobookshelf API token
- **Validation**: Minimum length 10

#### `hardcover_token`

- **Type**: String
- **YAML**: `hardcover_token: your_hardcover_token`
- **Environment**: `SHELFBRIDGE_USER_0_HARDCOVER_TOKEN=your_hardcover_token`
- **Description**: Hardcover API token
- **Validation**: Minimum length 10

### Optional User Settings

#### User-Specific Library Filtering (YAML Only)

```yaml
users:
  - id: alice
    # ... required settings ...
    libraries:
      include: ['Science Fiction', 'Fantasy']
      # OR
      exclude: ['Podcasts']
```

**Behavior**: User-specific library settings override global library filtering.

## Environment Variables

### Format

All environment variables use the `SHELFBRIDGE_` prefix:

**Global Settings:**

```bash
SHELFBRIDGE_<SETTING_NAME>=<value>
```

**User Settings:**

```bash
SHELFBRIDGE_USER_<INDEX>_<SETTING_NAME>=<value>
```

### Data Type Parsing

Environment variables are automatically parsed:

- **Boolean**: `true`, `false`, `1`, `0` (case-insensitive)
- **Number**: Any valid number (integer or decimal)
- **String**: Used as-is

### Complete Environment Variable Reference

| Environment Variable                      | Type             | Default        | YAML Equivalent               |
| ----------------------------------------- | ---------------- | -------------- | ----------------------------- |
| `SHELFBRIDGE_MIN_PROGRESS_THRESHOLD`      | Number (0-100)   | 5.0            | `min_progress_threshold`      |
| `SHELFBRIDGE_WORKERS`                     | Number (1-10)    | 3              | `workers`                     |
| `SHELFBRIDGE_PARALLEL`                    | Boolean          | true           | `parallel`                    |
| `SHELFBRIDGE_TIMEZONE`                    | String           | UTC            | `timezone`                    |
| `SHELFBRIDGE_DRY_RUN`                     | Boolean          | false          | `dry_run`                     |
| `SHELFBRIDGE_FORCE_SYNC`                  | Boolean          | false          | `force_sync`                  |
| `SHELFBRIDGE_MAX_BOOKS_TO_PROCESS`        | Number           | (none)         | `max_books_to_process`        |
| `SHELFBRIDGE_SYNC_SCHEDULE`               | String           | "0 3 \* \* \*" | `sync_schedule`               |
| `SHELFBRIDGE_AUTO_ADD_BOOKS`              | Boolean          | false          | `auto_add_books`              |
| `SHELFBRIDGE_PREVENT_PROGRESS_REGRESSION` | Boolean          | true           | `prevent_progress_regression` |
| `SHELFBRIDGE_HARDCOVER_SEMAPHORE`         | Number (1-10)    | 1              | `hardcover_semaphore`         |
| `SHELFBRIDGE_HARDCOVER_RATE_LIMIT`        | Number (10-60)   | 55             | `hardcover_rate_limit`        |
| `SHELFBRIDGE_AUDIOBOOKSHELF_SEMAPHORE`    | Number (1-10)    | 5              | `audiobookshelf_semaphore`    |
| `SHELFBRIDGE_AUDIOBOOKSHELF_RATE_LIMIT`   | Number (60-1200) | 600            | `audiobookshelf_rate_limit`   |
| `SHELFBRIDGE_MAX_BOOKS_TO_FETCH`          | Number           | (none)         | `max_books_to_fetch`          |
| `SHELFBRIDGE_PAGE_SIZE`                   | Number (25-200)  | 100            | `page_size`                   |
| `SHELFBRIDGE_DEEP_SCAN_INTERVAL`          | Number           | 10             | `deep_scan_interval`          |
| `SHELFBRIDGE_DUMP_FAILED_BOOKS`           | Boolean          | true           | `dump_failed_books`           |

### User Environment Variables

| Pattern                                | Description          | Example                                              |
| -------------------------------------- | -------------------- | ---------------------------------------------------- |
| `SHELFBRIDGE_USER_<N>_ID`              | User identifier      | `SHELFBRIDGE_USER_0_ID=alice`                        |
| `SHELFBRIDGE_USER_<N>_ABS_URL`         | Audiobookshelf URL   | `SHELFBRIDGE_USER_0_ABS_URL=https://abs.example.com` |
| `SHELFBRIDGE_USER_<N>_ABS_TOKEN`       | Audiobookshelf token | `SHELFBRIDGE_USER_0_ABS_TOKEN=your_token`            |
| `SHELFBRIDGE_USER_<N>_HARDCOVER_TOKEN` | Hardcover token      | `SHELFBRIDGE_USER_0_HARDCOVER_TOKEN=your_token`      |

**Note**: `<N>` is the user index (0, 1, 2, etc.)

## Advanced Features

### Multi-User Configuration

#### YAML Multi-User Setup

```yaml
global:
  min_progress_threshold: 5.0
  libraries:
    exclude: ['Podcasts', 'Samples'] # Global exclusions

users:
  - id: alice
    abs_url: https://abs.example.com
    abs_token: alice_token
    hardcover_token: alice_hardcover_token
    # Alice inherits global library filtering

  - id: bob
    abs_url: https://abs.example.com
    abs_token: bob_token
    hardcover_token: bob_hardcover_token
    # Bob overrides global filtering
    libraries:
      include: ['Science Fiction', 'Fantasy']
```

#### Environment Variable Multi-User Setup

```bash
# Global settings
SHELFBRIDGE_MIN_PROGRESS_THRESHOLD=5.0
SHELFBRIDGE_AUTO_ADD_BOOKS=true

# User 0 (Alice)
SHELFBRIDGE_USER_0_ID=alice
SHELFBRIDGE_USER_0_ABS_URL=https://abs.example.com
SHELFBRIDGE_USER_0_ABS_TOKEN=alice_token
SHELFBRIDGE_USER_0_HARDCOVER_TOKEN=alice_hardcover_token

# User 1 (Bob)
SHELFBRIDGE_USER_1_ID=bob
SHELFBRIDGE_USER_1_ABS_URL=https://abs.example.com
SHELFBRIDGE_USER_1_ABS_TOKEN=bob_token
SHELFBRIDGE_USER_1_HARDCOVER_TOKEN=bob_hardcover_token
```

### Library Filtering (YAML Only)

#### Global Library Filtering

```yaml
global:
  libraries:
    include: ['Audiobooks', 'Fiction']
    # OR
    exclude: ['Podcasts', 'Samples', 'Previews']
```

#### Per-User Library Filtering

```yaml
users:
  - id: adult_user
    # ... credentials ...
    libraries:
      exclude: ['Kids Books']

  - id: child_user
    # ... credentials ...
    libraries:
      include: ['Kids Books', 'Young Adult']
```

#### Library Identification

- **By Name**: `"Science Fiction"` (case-insensitive)
- **By ID**: `"lib_abc123def456"`
- **Mixed**: `["Science Fiction", "lib_abc123def456"]`

### Advanced Performance Tuning

#### High-Volume Setup

```yaml
global:
  workers: 5
  parallel: true
  page_size: 150
  max_books_to_fetch: 2000
  audiobookshelf_semaphore: 7
  audiobookshelf_rate_limit: 800
```

#### Resource-Constrained Setup

```yaml
global:
  workers: 1
  parallel: false
  page_size: 50
  max_books_to_fetch: 250
  audiobookshelf_semaphore: 2
  audiobookshelf_rate_limit: 200
```

#### Development/Testing Setup

```yaml
global:
  dry_run: true
  max_books_to_process: 10
  workers: 1
  parallel: false
  dump_failed_books: true
  force_sync: true
```

## Validation Reference

### Schema Validation Types

1. **Type Validation**: Checks data types (string, number, boolean)
2. **Range Validation**: Checks numeric ranges and constraints
3. **Format Validation**: URL format, timezone validity, cron expressions
4. **Custom Validation**: Placeholder detection, mutual exclusions
5. **Connection Testing**: Optional API connectivity verification

### Common Validation Errors

#### Placeholder Values

```
❌ Configuration Validation Failed:
  ✗ User 0: 'abs_url' contains placeholder value 'your-audiobookshelf-server.com'
  ✗ User 0: 'abs_token' contains placeholder value 'your_audiobookshelf_api_token'
```

**Detected Patterns:**

- URLs: `your-audiobookshelf-server.com`, `example.com`, `localhost.example.com`
- Tokens: `your_audiobookshelf_api_token`, `your_hardcover_api_token`, `abc123`
- User IDs: `your_username`, `your_user_id`

#### Type Mismatches

```
❌ Configuration Validation Failed:
  ✗ Global config: 'workers' must be number (got: string)
  ✗ User 0: 'abs_url' must be a valid URL
```

#### Range Violations

```
❌ Configuration Validation Failed:
  ✗ Global config: 'min_progress_threshold' must be between 0 and 100 (got: 150)
  ✗ Global config: 'workers' must be at least 1 (got: 0)
```

#### Library Filtering Conflicts

```
❌ Configuration Validation Failed:
  ✗ Global config: Cannot use both 'include' and 'exclude' in libraries configuration
```

### Complete Validation Rules

| Setting                       | Type    | Range/Rules                   | Required |
| ----------------------------- | ------- | ----------------------------- | -------- |
| `min_progress_threshold`      | Number  | 0-100                         | No       |
| `workers`                     | Number  | 1-10                          | No       |
| `parallel`                    | Boolean | true/false                    | No       |
| `timezone`                    | String  | Valid IANA timezone           | No       |
| `dry_run`                     | Boolean | true/false                    | No       |
| `sync_schedule`               | String  | Valid cron expression         | No       |
| `force_sync`                  | Boolean | true/false                    | No       |
| `auto_add_books`              | Boolean | true/false                    | No       |
| `max_books_to_process`        | Number  | 1-10000 or null               | No       |
| `prevent_progress_regression` | Boolean | true/false                    | No       |
| `hardcover_semaphore`         | Number  | 1-10                          | No       |
| `hardcover_rate_limit`        | Number  | 10-60                         | No       |
| `audiobookshelf_semaphore`    | Number  | 1-10                          | No       |
| `audiobookshelf_rate_limit`   | Number  | 60-1200                       | No       |
| `max_books_to_fetch`          | Number  | 1-10000 or null               | No       |
| `page_size`                   | Number  | 25-200                        | No       |
| `deep_scan_interval`          | Number  | 1-100                         | No       |
| `dump_failed_books`           | Boolean | true/false                    | No       |
| `libraries.include`           | Array   | Min length 1, strings         | No       |
| `libraries.exclude`           | Array   | Min length 1, strings         | No       |
| `reread_detection.*`          | Object  | See individual sub-properties | No       |
| User `id`                     | String  | Min length 1, unique          | **Yes**  |
| User `abs_url`                | String  | Valid HTTP/HTTPS URL          | **Yes**  |
| User `abs_token`              | String  | Min length 10                 | **Yes**  |
| User `hardcover_token`        | String  | Min length 10                 | **Yes**  |

## Configuration Examples

### Enterprise/Production Configuration

```yaml
global:
  # Performance optimized
  min_progress_threshold: 5.0
  workers: 5
  parallel: true
  page_size: 150
  deep_scan_interval: 15

  # Reliability settings
  prevent_progress_regression: true
  auto_add_books: false
  dump_failed_books: true

  # Conservative rate limiting
  hardcover_rate_limit: 50
  audiobookshelf_rate_limit: 400

  # Scheduling
  sync_schedule: '0 2 * * *'
  timezone: 'America/New_York'

  # Global library filtering
  libraries:
    exclude: ['Podcasts', 'Sample Books', 'Audio Previews']

users:
  - id: production_user
    abs_url: https://abs.company.com
    abs_token: production_abs_token
    hardcover_token: production_hardcover_token
```

### Family Configuration

```yaml
global:
  min_progress_threshold: 5.0
  auto_add_books: true
  sync_schedule: '0 */6 * * *' # Every 6 hours
  timezone: 'America/New_York'

  # Family-friendly defaults
  prevent_progress_regression: true
  reread_detection:
    reread_threshold: 25 # Lower threshold for re-readers
    high_progress_threshold: 90
    regression_block_threshold: 60
    regression_warn_threshold: 20

  # Global exclusions
  libraries:
    exclude: ['Podcasts', 'Sample Books']

users:
  - id: mom
    abs_url: https://family-audiobooks.com
    abs_token: mom_abs_token
    hardcover_token: mom_hardcover_token

  - id: dad
    abs_url: https://family-audiobooks.com
    abs_token: dad_abs_token
    hardcover_token: dad_hardcover_token

  - id: teenager
    abs_url: https://family-audiobooks.com
    abs_token: teen_abs_token
    hardcover_token: teen_hardcover_token
    # Override global settings for teen
    libraries:
      include: ['Young Adult', 'Fantasy', 'Science Fiction']
```

### Development/Testing Configuration

```yaml
global:
  # Safe testing defaults
  dry_run: true
  max_books_to_process: 10
  workers: 1
  parallel: false

  # Debug settings
  dump_failed_books: true
  force_sync: true

  # Conservative performance
  page_size: 25
  deep_scan_interval: 1 # Always do full scan for testing

users:
  - id: test_user
    abs_url: https://test-abs.example.com
    abs_token: test_abs_token
    hardcover_token: test_hardcover_token
```

---

## Related Documentation

- **[Configuration Guide](Configuration-Guide.md)** - User-focused setup guide
- **[Multi-User Setup](Multi-User-Setup.md)** - Advanced multi-user configurations
- **[Troubleshooting Guide](../troubleshooting/Troubleshooting-Guide.md)** - Common configuration issues
- **[CLI Reference](../technical/CLI-Reference.md)** - Command-line validation tools
