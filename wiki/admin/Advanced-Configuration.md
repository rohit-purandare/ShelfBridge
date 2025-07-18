# 🔧 Advanced Configuration

This guide covers advanced configuration options for power users who want to fine-tune ShelfBridge's behavior. These settings provide granular control over sync behavior, performance, and edge cases.

## 🎯 Prerequisites

- Basic configuration working
- Understanding of YAML syntax
- Familiarity with cron schedules
- Knowledge of your specific requirements

## 📊 Performance Settings

### Parallel Processing

Control how many books are processed simultaneously:

```yaml
global:
  # Enable parallel processing
  parallel: true
  
  # Number of concurrent workers
  workers: 3
  
  # Maximum concurrent API requests
  max_concurrent_requests: 5
```

**Performance tuning:**
- `workers: 1` - Sequential processing (slower but gentler)
- `workers: 3` - Default (good balance)
- `workers: 5-8` - Aggressive (faster but more resource intensive)

### Deep Scan Configuration

Control how often ShelfBridge performs comprehensive library scans:

```yaml
global:
  # Number of syncs between deep scans (default: 10)
  deep_scan_interval: 10
  
  # Force deep scan every time (testing/debugging)
  # deep_scan_interval: 1
  
  # Less frequent deep scans (performance-focused)
  # deep_scan_interval: 25
```

**Deep Scan Behavior:**
- **Deep Scan**: Checks entire Audiobookshelf library for changes
  - Finds newly added books
  - Detects completed books
  - Updates library statistics  
  - Slower but comprehensive

- **Fast Scan**: Only checks books currently in progress
  - Much faster execution
  - Minimal API calls
  - May miss some changes

**Tuning Guidelines:**
- `deep_scan_interval: 1` - Always deep scan (slowest, most thorough)
- `deep_scan_interval: 5` - Frequent deep scans (good for active libraries)
- `deep_scan_interval: 10` - Default (balanced performance)
- `deep_scan_interval: 20-50` - Infrequent deep scans (performance focused)
- `deep_scan_interval: 100` - Rare deep scans (speed prioritized)

**When to Use Different Settings:**
- **Active readers**: Lower intervals (5-10) to catch changes quickly
- **Casual readers**: Higher intervals (20-50) for better performance
- **Large libraries**: Higher intervals to reduce processing time
- **Testing/debugging**: Interval of 1 to always see full library state

### API Rate Limiting

Control request frequency to avoid overwhelming APIs:

```yaml
global:
  # Hardcover API rate limit (10-60 requests/minute, default: 55)
  hardcover_rate_limit: 55
  
  # Audiobookshelf API rate limit (60-1200 requests/minute, default: 600)
  audiobookshelf_rate_limit: 600
  
  # Timeout for API requests (milliseconds)
  request_timeout: 30000
```

**Rate limiting options:**
- **Conservative**: Lower limits for shared accounts or slower servers
- **Default**: Balanced performance for most setups
- **Aggressive**: Higher limits for powerful servers (use with caution)

## 🔄 Sync Behavior Settings

### Force Sync Options

Override normal sync behavior:

```yaml
global:
  # Force sync even if progress hasn't changed
  force_sync: false
  
  # Ignore cache completely
  ignore_cache: false
  
  # Always run full sync (no incremental)
  full_sync_only: false
```

### Threshold Fine-Tuning

Advanced progress threshold configurations:

```yaml
global:
  # Standard threshold for sync
  min_progress_threshold: 5.0
  
  # Threshold for auto-adding books
  auto_add_threshold: 1.0
  
  # Threshold for marking books as completed
  completion_threshold: 95.0
  
  # Threshold for considering high progress
  high_progress_threshold: 85.0
```

## 📚 Book Matching Configuration

### Identifier Preferences

Control how books are matched between services:

```yaml
global:
  # Identifier matching priority
  identifier_priority:
    - "asin"      # Amazon Standard Identification Number (preferred)
    - "isbn"      # International Standard Book Number
    - "isbn13"    # 13-digit ISBN
    - "isbn10"    # 10-digit ISBN
  
  # Fallback to fuzzy matching if no identifier match
  enable_fuzzy_matching: false
  
  # Similarity threshold for fuzzy matching (0.0-1.0)
  fuzzy_match_threshold: 0.85
```

### Metadata Handling

Control how book metadata is processed:

```yaml
global:
  # Normalize titles for matching
  normalize_titles: true
  
  # Ignore subtitle differences
  ignore_subtitles: false
  
  # Author name matching strictness
  author_matching_strictness: "medium"  # strict, medium, loose
```

## 🔁 Re-reading Detection

Fine-tune how ShelfBridge handles re-reads:

```yaml
global:
  # Re-reading detection settings
  reread_detection:
    enabled: true
    
    # Progress threshold for detecting re-reads
    reread_threshold: 30.0
    
    # High progress threshold for regression protection
    high_progress_threshold: 85.0
    
    # Maximum progress drop before blocking (percentage points)
    regression_block_threshold: 50.0
    
    # Minimum progress drop to warn about (percentage points)
    regression_warn_threshold: 15.0
    
    # Create new reading sessions for re-reads
    create_new_sessions: true
```

## 📅 Advanced Scheduling

### Per-User Schedules

Override global schedule for specific users:

```yaml
global:
  sync_schedule: "0 3 * * *"  # Default schedule

users:
  - id: alice
    sync_schedule: "0 2 * * *"  # Alice syncs at 2 AM
    abs_url: https://abs.example.com
    abs_token: alice_token
    hardcover_token: alice_hardcover_token
  
  - id: bob
    sync_schedule: "0 4 * * *"  # Bob syncs at 4 AM
    abs_url: https://abs.example.com
    abs_token: bob_token
    hardcover_token: bob_hardcover_token
```

### Conditional Scheduling

Advanced cron expressions:

```yaml
# Weekdays only
global:
  sync_schedule: "0 3 * * 1-5"
```

```yaml
# Every 4 hours
global:
  sync_schedule: "0 */4 * * *"
```

```yaml
# 4 times a day (9 AM, 1 PM, 5 PM, 9 PM)
global:
  sync_schedule: "0 9,13,17,21 * * *"
```

```yaml
# Twice a month (1st and 15th)
global:
  sync_schedule: "0 3 1,15 * *"
```

```yaml
# Weekly on Sunday
global:
  sync_schedule: "0 3 * * 0"
```

## 🏷️ User-Specific Overrides

### Individual User Settings

Override global settings for specific users:

```yaml
global:
  min_progress_threshold: 5.0
  auto_add_books: false

users:
  - id: alice
    # Alice uses global settings
    abs_url: https://abs.example.com
    abs_token: alice_token
    hardcover_token: alice_hardcover_token
  
  - id: bob
    # Bob has custom settings
    min_progress_threshold: 10.0    # More conservative
    auto_add_books: true            # Auto-add enabled
    prevent_progress_regression: false  # Disabled
    abs_url: https://abs.example.com
    abs_token: bob_token
    hardcover_token: bob_hardcover_token
```

### User-Specific Filters

Filter books for specific users:

```yaml
users:
  - id: alice
    abs_url: https://abs.example.com
    abs_token: alice_token
    hardcover_token: alice_hardcover_token
    
    # Only sync books from specific libraries
    library_filters:
      - "Audiobooks"
      - "Sci-Fi Collection"
    
    # Exclude specific books/series
    exclude_patterns:
      - "Sample Chapter"
      - "Podcast"
    
    # Only sync books with specific metadata
    metadata_filters:
      require_asin: true
      require_isbn: false
```

## 🔍 Debug and Development

### Logging Configuration

Control what gets logged:

```yaml
global:
  # Log level: error, warn, info, debug, trace
  log_level: "info"
  
  # Log API requests and responses
  log_api_calls: false
  
  # Log cache operations
  log_cache_operations: false
  
  # Log book matching decisions
  log_matching_decisions: true
  
  # Maximum log file size (MB)
  max_log_size: 10
  
  # Number of log files to keep
  log_retention_count: 5
```

### Development Mode

Settings for development and testing:

```yaml
global:
  # Development mode settings
  development_mode: false
  
  # Dry run mode by default
  default_dry_run: false
  
  # Skip validation checks
  skip_validation: false
  
  # Enable additional debug output
  verbose_output: false
```

## 🌐 Network Configuration

### Proxy Settings

Configure proxy servers:

```yaml
global:
  # HTTP proxy configuration
  proxy:
    enabled: false
    host: "proxy.example.com"
    port: 8080
    username: "proxy_user"
    password: "proxy_pass"
    
    # Proxy protocol: http, https, socks4, socks5
    protocol: "http"
    
    # Bypass proxy for these hosts
    bypass_hosts:
      - "localhost"
      - "127.0.0.1"
      - "*.local"
```

### Timeout Settings

Control request timeouts:

```yaml
global:
  # Network timeout settings
  timeouts:
    # Connection timeout (milliseconds)
    connect: 10000
    
    # Read timeout (milliseconds)
    read: 30000
    
    # Total request timeout (milliseconds)
    total: 60000
    
    # Retry attempts on failure
    retry_attempts: 3
    
    # Delay between retries (milliseconds)
    retry_delay: 1000
```

## 💾 Cache Configuration

### Cache Behavior

Control cache behavior:

```yaml
global:
  # Cache settings
  cache:
    # Enable caching
    enabled: true
    
    # Cache expiration (hours)
    expiration: 168  # 1 week
    
    # Maximum cache size (MB)
    max_size: 100
    
    # Cache cleanup frequency (hours)
    cleanup_frequency: 24
    
    # Compact database periodically
    auto_compact: true
    
    # Backup cache before major operations
    backup_before_cleanup: true
```

### Cache Optimization

Performance tuning for cache:

```yaml
global:
  cache:
    # SQLite optimization settings
    sqlite_settings:
      # Journal mode: DELETE, TRUNCATE, PERSIST, MEMORY, WAL, OFF
      journal_mode: "WAL"
      
      # Synchronous mode: OFF, NORMAL, FULL, EXTRA
      synchronous_mode: "NORMAL"
      
      # Page size (bytes)
      page_size: 4096
      
      # Cache size (pages)
      cache_size: 2000
      
      # Memory-mapped I/O size (MB)
      mmap_size: 64
```

## 🚨 Error Handling

### Retry Logic

Configure retry behavior:

```yaml
global:
  # Error handling settings
  error_handling:
    # Maximum retry attempts
    max_retries: 3
    
    # Exponential backoff multiplier
    backoff_multiplier: 2.0
    
    # Base delay for retries (milliseconds)
    base_delay: 1000
    
    # Maximum delay between retries (milliseconds)
    max_delay: 30000
    
    # Retry on specific error types
    retry_on_errors:
      - "network_timeout"
      - "rate_limit"
      - "server_error"
```

### Failure Modes

Control what happens when things go wrong:

```yaml
global:
  # Failure handling
  failure_handling:
    # Continue sync even if some books fail
    continue_on_error: true
    
    # Maximum number of consecutive failures before stopping
    max_consecutive_failures: 5
    
    # Send notifications on repeated failures
    notify_on_repeated_failures: false
    
    # Notification settings
    notifications:
      email: "admin@example.com"
      webhook: "https://hooks.slack.com/..."
```

## 🔐 Security Settings

### API Security

Security-related configurations:

```yaml
global:
  # Security settings
  security:
    # Validate SSL certificates
    verify_ssl: true
    
    # Custom CA certificate path
    ca_certificate: "/path/to/ca.pem"
    
    # User agent for API requests
    user_agent: "ShelfBridge/1.0"
    
    # Rate limiting to prevent abuse
    rate_limiting:
      enabled: true
      max_requests_per_minute: 60
      
    # API key rotation detection
    detect_key_rotation: true
```

## 📈 Monitoring and Metrics

### Performance Monitoring

Track sync performance:

```yaml
global:
  # Monitoring settings
  monitoring:
    # Enable performance metrics
    enable_metrics: true
    
    # Metrics collection interval (seconds)
    metrics_interval: 60
    
    # Store metrics in database
    store_metrics: true
    
    # Metrics retention period (days)
    metrics_retention: 30
    
    # Export metrics to external systems
    export_metrics:
      enabled: false
      endpoint: "http://metrics.example.com/api/v1/metrics"
      format: "prometheus"  # prometheus, json, csv
```

## 🎯 Complete Advanced Example

```yaml
# Advanced ShelfBridge Configuration
global:
  # Basic settings
  min_progress_threshold: 5.0
  auto_add_books: false
  prevent_progress_regression: true
  sync_schedule: "0 3 * * *"
  timezone: "America/New_York"
  
  # Performance settings
  parallel: true
  workers: 3
  deep_scan_interval: 15  # Custom deep scan frequency
  
  # Advanced thresholds
  auto_add_threshold: 1.0
  completion_threshold: 95.0
  high_progress_threshold: 85.0
  
  # Re-reading detection
  reread_detection:
    reread_threshold: 30.0
    high_progress_threshold: 85.0
    regression_block_threshold: 50.0
    regression_warn_threshold: 15.0
  
  # Rate limiting
  hardcover_semaphore: 1
  hardcover_rate_limit: 55
  audiobookshelf_semaphore: 5
  audiobookshelf_rate_limit: 600
  
  # Library fetching
  max_books_to_fetch: 2000
  page_size: 150
  
  # Debugging
  dump_failed_books: true

users:
  - id: alice
    abs_url: https://abs.example.com
    abs_token: alice_token
    hardcover_token: alice_hardcover_token
    
  - id: bob
    abs_url: https://abs.example.com
    abs_token: bob_token
    hardcover_token: bob_hardcover_token
```

## 🔍 Validation and Testing

### Validate Advanced Configuration

```bash
# Test configuration syntax
node src/main.js validate

# Test with verbose output
node src/main.js validate --verbose

# Test specific user
node src/main.js validate --user alice

# Test dry run with advanced settings
node src/main.js sync --dry-run --verbose
```

## 🎯 Next Steps

1. **[Multi-User Setup](Multi-User-Setup.md)** - Configure multiple users
2. **[Progress Regression Protection](Progress-Regression-Protection.md)** - Understand protection features
3. **[Cache Management](Cache-Management.md)** - Optimize cache performance

## 🆘 Need Help?

- **Configuration Issues**: [Troubleshooting Guide](../troubleshooting/Troubleshooting-Guide.md)
- **Performance Problems**: [Performance Issues](../troubleshooting/Performance-Issues.md)
- **General Questions**: [FAQ](../troubleshooting/FAQ.md)

---

**Advanced configuration gives you complete control over ShelfBridge's behavior!** 🔧⚙️