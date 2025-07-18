# ⚙️ Configuration Reference

ShelfBridge uses a YAML configuration file with comprehensive validation and sensible defaults. This reference covers all 25+ configuration options, their validation rules, and usage examples.

## Table of Contents

- [Configuration Structure](#configuration-structure)
- [Global Configuration](#global-configuration)
- [User Configuration](#user-configuration)
- [Configuration Examples](#configuration-examples)
- [Validation](#validation)
- [Environment-Specific Configs](#environment-specific-configs)

## Configuration Structure

ShelfBridge expects a `config/config.yaml` file with two main sections:

```yaml
global:
  # Global settings that apply to all users
  
users:
  # Array of user-specific configurations
```

### File Location

| Environment | Configuration File Path |
|-------------|------------------------|
| Local Development | `config/config.yaml` |
| Docker | `/app/config/config.yaml` (mounted volume) |
| Production | `config/config.yaml` (relative to application) |

## Global Configuration

### Core Sync Settings

#### `min_progress_threshold`
- **Type**: Number (0-100)
- **Default**: `5.0`
- **Description**: Minimum progress percentage required to sync a book
- **Validation**: Must be between 0 and 100

```yaml
global:
  min_progress_threshold: 5.0  # Only sync books with >5% progress
```

#### `workers`
- **Type**: Number (1-10)
- **Default**: `3`
- **Description**: Number of parallel workers for processing books
- **Validation**: Must be between 1 and 10

```yaml
global:
  workers: 3  # Process 3 books concurrently
```

#### `parallel`
- **Type**: Boolean
- **Default**: `true`
- **Description**: Enable parallel processing of books
- **Impact**: When false, processes books sequentially

```yaml
global:
  parallel: true  # Enable parallel processing
```

#### `timezone`
- **Type**: String
- **Default**: `"UTC"`
- **Description**: Timezone for scheduling and timestamps
- **Validation**: Must be a valid timezone identifier

```yaml
global:
  timezone: "America/New_York"  # Eastern Time
  # Other examples:
  # timezone: "Europe/London"
  # timezone: "Asia/Tokyo"
  # timezone: "UTC"
```

### Safety and Testing Settings

#### `dry_run`
- **Type**: Boolean
- **Default**: `false`
- **Description**: Run in dry-run mode without making changes to Hardcover
- **Override**: Can be overridden with `--dry-run` CLI flag

```yaml
global:
  dry_run: false  # Make real changes (set to true for testing)
```

#### `force_sync`
- **Type**: Boolean
- **Default**: `false`
- **Description**: Force sync even if progress appears unchanged
- **Override**: Can be overridden with `--force` CLI flag

```yaml
global:
  force_sync: false  # Only sync changed progress
```

#### `max_books_to_process`
- **Type**: Number (1-10000)
- **Default**: No limit
- **Description**: Maximum number of books to process during sync (useful for testing)
- **Optional**: Can be omitted for no limit

```yaml
global:
  max_books_to_process: 50  # Limit to 50 books for testing
```

### Automation Settings

#### `sync_schedule`
- **Type**: String (Cron expression)
- **Default**: `"0 3 * * *"` (daily at 3 AM)
- **Description**: Cron schedule for automatic sync
- **Validation**: Must be a valid cron expression

```yaml
global:
  sync_schedule: "0 3 * * *"     # Daily at 3:00 AM
  # Other examples:
  # sync_schedule: "0 */6 * * *"  # Every 6 hours
  # sync_schedule: "0 8,20 * * *" # Twice daily (8 AM, 8 PM)
  # sync_schedule: "0 9 * * 1-5"  # Weekdays at 9 AM
```

#### `auto_add_books`
- **Type**: Boolean
- **Default**: `false`
- **Description**: Automatically add books to Hardcover if not found and have progress
- **Impact**: When enabled, books with progress are automatically added to your Hardcover library

```yaml
global:
  auto_add_books: true  # Auto-add books with progress
```

### Progress Protection Settings

#### `prevent_progress_regression`
- **Type**: Boolean
- **Default**: `true`
- **Description**: Prevent accidentally overwriting completion status or high progress
- **Behavior**: Blocks large progress drops that might indicate re-reading

```yaml
global:
  prevent_progress_regression: true  # Protect against accidental progress loss
```

#### `reread_detection`
- **Type**: Object
- **Default**: Uses built-in defaults if not specified
- **Description**: Controls when new reading sessions are created vs updating existing ones

```yaml
global:
  reread_detection:
    reread_threshold: 30        # Progress below 30% = "starting over"
    high_progress_threshold: 85 # Progress above 85% = "high progress"
    regression_block_threshold: 50  # Block drops >50% from high progress
    regression_warn_threshold: 15   # Warn about drops >15% from high progress
```

**Individual Settings:**

##### `reread_threshold`
- **Type**: Number (0-100)
- **Default**: `30`
- **Description**: Progress below this percentage is considered "starting over"

##### `high_progress_threshold`
- **Type**: Number (0-100)
- **Default**: `85`
- **Description**: Progress above this percentage is considered "high progress"

##### `regression_block_threshold`
- **Type**: Number (0-100)
- **Default**: `50`
- **Description**: Block progress drops larger than this percentage from high progress

##### `regression_warn_threshold`
- **Type**: Number (0-100)
- **Default**: `15`
- **Description**: Warn about progress drops larger than this percentage from high progress

### Rate Limiting and Performance

#### `hardcover_semaphore`
- **Type**: Number (1-10)
- **Default**: `1`
- **Description**: Maximum concurrent Hardcover API requests
- **Recommendation**: Keep at 1 to respect Hardcover's rate limits

```yaml
global:
  hardcover_semaphore: 1  # One request at a time to Hardcover
```

#### `hardcover_rate_limit`
- **Type**: Number (10-60)
- **Default**: `55`
- **Description**: Hardcover API rate limit in requests per minute
- **Recommendation**: Stay below 60 to avoid hitting their limits

```yaml
global:
  hardcover_rate_limit: 55  # 55 requests per minute to Hardcover
```

#### `audiobookshelf_semaphore`
- **Type**: Number (1-10)
- **Default**: `5`
- **Description**: Maximum concurrent Audiobookshelf API requests
- **Note**: Can be higher since Audiobookshelf is typically self-hosted

```yaml
global:
  audiobookshelf_semaphore: 5  # Up to 5 concurrent requests
```

#### `audiobookshelf_rate_limit`
- **Type**: Number (60-1200)
- **Default**: `600`
- **Description**: Audiobookshelf API rate limit in requests per minute
- **Note**: Adjust based on your server capacity

```yaml
global:
  audiobookshelf_rate_limit: 600  # 600 requests per minute
```

### Library Fetching Settings

#### `max_books_to_fetch`
- **Type**: Number (1-10000) or null
- **Default**: No limit
- **Description**: Maximum number of books to fetch from Audiobookshelf
- **Optional**: Omit for no limit

```yaml
global:
  max_books_to_fetch: 1000  # Limit to 1000 books
  # Or omit for no limit:
  # max_books_to_fetch: null
```

#### `page_size`
- **Type**: Number (25-200)
- **Default**: `100`
- **Description**: Number of books to fetch per API call
- **Impact**: Larger values = fewer API calls but more memory usage

```yaml
global:
  page_size: 100  # Fetch 100 books per API call
```

#### `deep_scan_interval`
- **Type**: Number (1-100)
- **Default**: `10`
- **Description**: Number of syncs between deep scans
- **Impact**: Deep scans check entire library, fast scans only check books in progress
- **Performance**: Lower values = more thorough but slower, higher values = faster but may miss changes

```yaml
global:
  deep_scan_interval: 10  # Deep scan every 10 syncs
  # Other examples:
  # deep_scan_interval: 5   # More frequent deep scans
  # deep_scan_interval: 20  # Less frequent deep scans
  # deep_scan_interval: 1   # Always do deep scan (slower)
```

### Debugging and Logging

#### `dump_failed_books`
- **Type**: Boolean
- **Default**: `true`
- **Description**: Dump failed sync books to text file for debugging
- **Output**: Creates files in logs directory when sync errors occur

```yaml
global:
  dump_failed_books: true  # Save error details to files
```

## User Configuration

Each user in the `users` array requires these fields:

### Required Fields

#### `id`
- **Type**: String
- **Required**: Yes
- **Description**: Unique user identifier
- **Validation**: Must be at least 1 character, no duplicates allowed

#### `abs_url`
- **Type**: String (URL)
- **Required**: Yes
- **Description**: Audiobookshelf server URL
- **Validation**: Must be valid HTTP/HTTPS URL

#### `abs_token`
- **Type**: String
- **Required**: Yes
- **Description**: Audiobookshelf API token
- **Validation**: Must be at least 10 characters
- **Note**: Bearer prefix is automatically removed if present

#### `hardcover_token`
- **Type**: String
- **Required**: Yes
- **Description**: Hardcover API token
- **Validation**: Must be at least 10 characters
- **Note**: Bearer prefix is automatically removed if present

```yaml
users:
  - id: "alice"
    abs_url: "https://audiobooks.example.com"
    abs_token: "your_audiobookshelf_api_token"
    hardcover_token: "your_hardcover_api_token"
  
  - id: "bob"
    abs_url: "https://abs.home.local:13378"
    abs_token: "another_abs_token"
    hardcover_token: "another_hardcover_token"
```

## Configuration Examples

### Minimal Configuration
```yaml
global:
  # Use all defaults
  
users:
  - id: "alice"
    abs_url: "https://audiobooks.example.com"
    abs_token: "your_abs_token_here"
    hardcover_token: "your_hardcover_token_here"
```

### Conservative Configuration (Slow but Safe)
```yaml
global:
  min_progress_threshold: 10.0  # Higher threshold
  workers: 1                    # Sequential processing
  parallel: false               # No parallel processing
  auto_add_books: false         # Manual book management
  prevent_progress_regression: true
  hardcover_semaphore: 1
  hardcover_rate_limit: 30      # Very conservative rate limit
  audiobookshelf_semaphore: 1
  audiobookshelf_rate_limit: 60
  
users:
  - id: "alice"
    abs_url: "https://audiobooks.example.com"
    abs_token: "your_abs_token_here"
    hardcover_token: "your_hardcover_token_here"
```

### Performance-Optimized Configuration
```yaml
global:
  min_progress_threshold: 1.0   # Sync almost everything
  workers: 5                    # More parallel workers
  parallel: true                # Enable parallel processing
  auto_add_books: true          # Auto-add for convenience
  sync_schedule: "0 */4 * * *"  # Every 4 hours
  hardcover_semaphore: 1        # Keep conservative for Hardcover
  hardcover_rate_limit: 55
  audiobookshelf_semaphore: 8   # More aggressive for self-hosted
  audiobookshelf_rate_limit: 1000
  page_size: 200                # Larger pages
  
users:
  - id: "alice"
    abs_url: "https://audiobooks.example.com"
    abs_token: "your_abs_token_here"
    hardcover_token: "your_hardcover_token_here"
```

### Multi-User Family Configuration
```yaml
global:
  min_progress_threshold: 5.0
  workers: 3
  auto_add_books: true
  sync_schedule: "0 2 * * *"    # 2 AM daily
  timezone: "America/New_York"
  prevent_progress_regression: true
  reread_detection:
    reread_threshold: 25        # Lower threshold for family with re-readers
    high_progress_threshold: 90
    regression_block_threshold: 60
    regression_warn_threshold: 20
  
users:
  - id: "mom"
    abs_url: "https://audiobooks.family.com"
    abs_token: "mom_abs_token"
    hardcover_token: "mom_hardcover_token"
    
  - id: "dad"
    abs_url: "https://audiobooks.family.com"
    abs_token: "dad_abs_token"
    hardcover_token: "dad_hardcover_token"
    
  - id: "teenager"
    abs_url: "https://audiobooks.family.com"
    abs_token: "teen_abs_token"
    hardcover_token: "teen_hardcover_token"
```

### Development/Testing Configuration
```yaml
global:
  dry_run: true                 # Never make real changes
  max_books_to_process: 10      # Limit for testing
  workers: 1                    # Sequential for easier debugging
  parallel: false
  dump_failed_books: true       # Enable debugging
  force_sync: true              # Always sync for testing
  
users:
  - id: "test_user"
    abs_url: "https://test-abs.example.com"
    abs_token: "test_abs_token"
    hardcover_token: "test_hardcover_token"
```

## Validation

ShelfBridge performs comprehensive validation on startup:

### Validation Types

1. **Schema Validation**: Checks data types, ranges, and required fields
2. **Placeholder Detection**: Identifies example/placeholder values that need replacement
3. **Custom Validation**: URL format, timezone validity, cron expression syntax
4. **Connection Testing**: Optional API connectivity verification

### Running Validation

```bash
# Basic validation
shelfbridge validate

# Validation with connection testing
shelfbridge validate --connections

# Show configuration help
shelfbridge validate --help-config
```

### Common Validation Errors

#### Placeholder Values
```
❌ Configuration Validation Failed:

🔧 PLACEHOLDER VALUES DETECTED:

  ✗ User 0: 'abs_url' contains placeholder value 'your-audiobookshelf-server.com'
  ✗ User 0: 'abs_token' contains placeholder value 'your_audiobookshelf_api_token'
```

**Solution**: Replace placeholder values with your actual credentials.

#### Invalid Data Types
```
❌ Configuration Validation Failed:

  ✗ Global config: 'workers' must be number (got: string)
  ✗ User 0: 'abs_url' must be a valid URL
```

**Solution**: Check data types and URL formats.

#### Range Violations
```
❌ Configuration Validation Failed:

  ✗ Global config: 'min_progress_threshold' must be between 0 and 100 (got: 150)
  ✗ Global config: 'workers' must be at least 1 (got: 0)
```

**Solution**: Ensure values are within valid ranges.

### Placeholder Patterns Detected

The validator automatically detects these common placeholder patterns:

**URLs:**
- `your-audiobookshelf-server.com`
- `your-abs-server.com`
- `your-server.com`
- `localhost.example.com`
- `example.com`
- `audiobookshelf.example.com`

**Tokens:**
- `your_audiobookshelf_api_token`
- `your_hardcover_api_token`
- `your_token_here`
- `abc123`
- `xyz789`
- `token123`

**User IDs:**
- `your_username`
- `your_user_id`
- `user_id_here`
- `username_here`

## Environment-Specific Configs

### Docker Configuration

When using Docker, mount your configuration:

```yaml
# docker-compose.yml
version: '3.8'
services:
  shelfbridge:
    image: shelfbridge:latest
    volumes:
      - ./config:/app/config      # Mount config directory
      - ./data:/app/data          # Mount data directory
      - ./logs:/app/logs          # Mount logs directory
```

### Environment Variables

While YAML is the primary configuration method, these environment variables can influence behavior:

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Logging level (error, warn, info, debug) | `info` |
| `NODE_ENV` | Node.js environment | `production` |

### Configuration Security

#### Protecting Sensitive Data

1. **File Permissions**: Restrict access to config files
   ```bash
   chmod 600 config/config.yaml
   ```

2. **Environment Variables**: For highly secure environments, consider using environment variables for tokens:
   ```bash
   export ABS_TOKEN="your_actual_token"
   export HARDCOVER_TOKEN="your_actual_token"
   ```

3. **Docker Secrets**: Use Docker secrets in production environments

#### Token Management

- **Audiobookshelf Tokens**: Generated in Audiobookshelf UI under Settings > Users > [Your User] > API Token
- **Hardcover Tokens**: Generated at https://hardcover.app/account/developer
- **Token Rotation**: Regenerate tokens periodically and update configuration

### Configuration Validation Reference

| Setting | Type | Range/Validation | Default | Required |
|---------|------|------------------|---------|----------|
| `min_progress_threshold` | Number | 0-100 | 5.0 | No |
| `parallel` | Boolean | true/false | true | No |
| `workers` | Number | 1-10 | 3 | No |
| `dry_run` | Boolean | true/false | false | No |
| `sync_schedule` | String | Valid cron expression | "0 3 * * *" | No |
| `timezone` | String | Valid timezone | "UTC" | No |
| `force_sync` | Boolean | true/false | false | No |
| `auto_add_books` | Boolean | true/false | false | No |
| `max_books_to_process` | Number | 1-10000 | null | No |
| `prevent_progress_regression` | Boolean | true/false | true | No |
| `hardcover_semaphore` | Number | 1-10 | 1 | No |
| `hardcover_rate_limit` | Number | 10-60 | 55 | No |
| `audiobookshelf_semaphore` | Number | 1-10 | 5 | No |
| `audiobookshelf_rate_limit` | Number | 60-1200 | 600 | No |
| `max_books_to_fetch` | Number | 1-10000 or null | null | No |
| `page_size` | Number | 25-200 | 100 | No |
| `deep_scan_interval` | Number | 1-100 | 10 | No |
| `dump_failed_books` | Boolean | true/false | true | No |
| `reread_detection.*` | Object | See individual fields | Built-in defaults | No |
| `id` | String | Min length: 1, unique | - | Yes |
| `abs_url` | String | Valid HTTP/HTTPS URL | - | Yes |
| `abs_token` | String | Min length: 10 | - | Yes |
| `hardcover_token` | String | Min length: 10 | - | Yes |

This configuration reference covers all available options. For CLI usage, see the [CLI Reference](../technical/CLI-Reference.md). For troubleshooting configuration issues, see the [Troubleshooting Guide](../troubleshooting/Troubleshooting-Guide.md). 