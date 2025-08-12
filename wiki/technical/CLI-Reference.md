# 🖥️ CLI Reference

ShelfBridge provides a comprehensive command-line interface with 11 commands for managing audiobook progress synchronization. This reference covers all commands, options, and usage patterns.

## Table of Contents

- [Global Options](#global-options)
- [Commands Overview](#commands-overview)
- [Command Details](#command-details)
- [Interactive Mode](#interactive-mode)
- [Common Usage Patterns](#common-usage-patterns)
- [Exit Codes](#exit-codes)

## Global Options

These options can be used with any command:

| Option              | Description                              | Default |
| ------------------- | ---------------------------------------- | ------- |
| `--dry-run`         | Run without making changes to Hardcover  | `false` |
| `--skip-validation` | Skip configuration validation on startup | `false` |
| `--verbose`         | Show detailed logging output             | `false` |

## Commands Overview

| Command         | Purpose                                | Use Case                |
| --------------- | -------------------------------------- | ----------------------- |
| `sync`          | Synchronize reading progress           | Main functionality      |
| `test`          | Test API connections                   | Troubleshooting         |
| `validate`      | Validate configuration                 | Setup verification      |
| `config`        | Show current configuration             | Configuration review    |
| `cache`         | Manage local cache                     | Maintenance             |
| `cron`          | Start scheduled sync                   | Background service      |
| `interactive`   | Interactive menu mode                  | User-friendly interface |
| `debug`         | Show debug information                 | Troubleshooting         |
| `schema`        | Check Hardcover GraphQL schema         | API exploration         |
| `schema-detail` | Detailed schema for specific mutations | API development         |
| `schema-inputs` | Show all GraphQL input types           | API development         |
| `start`         | Default scheduled sync mode            | Primary service mode    |

## Command Details

### `sync` - Main Synchronization

Synchronizes reading progress from Audiobookshelf to Hardcover.

```bash
shelfbridge sync [options]
```

**Options:**
| Option | Description | Example |
|--------|-------------|---------|
| `--all-users` | Sync all configured users | `sync --all-users` |
| `-u, --user <userId>` | Sync specific user only | `sync --user alice` |
| `--force` | Force sync even if progress unchanged | `sync --force` |

**Examples:**

```bash
# Sync all users
shelfbridge sync

# Sync specific user
shelfbridge sync --user alice

# Force sync with detailed output
shelfbridge sync --force --verbose

# Dry run to see what would happen
shelfbridge sync --dry-run
```

**Output Format:**

```
🔄 Starting sync for alice
🔄 Starting sync...
Processing 150 books from Audiobookshelf...

═══════════════════════════════════════════════════════
📚 SYNC COMPLETE (12.3s)
═══════════════════════════════════════════════════════
📚 Library Status                    🌐 Hardcover Updates
├─ 847 total books                   ├─ 23 API calls made
├─ 234 with progress                 ├─ 23 successful
├─ 18 currently reading              ├─ 0 failed
└─ 150 never started                 └─ 127 skipped (no changes)

📊 Processing Results                ✅ Sync Status
├─ 15 progress updated               ├─ All updates successful
├─ 3 marked complete                 ├─ No errors occurred
├─ 2 auto-added                      ├─ Cache updated
└─ 130 skipped (no change)           └─ Ready for next sync
═══════════════════════════════════════════════════════
```

#### Start Date Handling

- ShelfBridge now always sends a start date to Hardcover when one is available from Audiobookshelf.
- Dates are derived in the configured timezone and transmitted as `YYYY-MM-DD`.
- This removes any dependency on whether Hardcover previously stored a start date, ensuring the UI does not display unknown dates (e.g., `? - ?`).

### `test` - API Connection Testing

Tests connectivity to both Audiobookshelf and Hardcover APIs.

```bash
shelfbridge test [options]
```

**Options:**
| Option | Description | Example |
|--------|-------------|---------|
| `-u, --user <userId>` | Test specific user only | `test --user alice` |

**Examples:**

```bash
# Test all users
shelfbridge test

# Test specific user with verbose output
shelfbridge test --user alice --verbose
```

**Output Format:**

```
=== Testing connections for user: alice ===
Audiobookshelf: ✅ Connected
Hardcover: ✅ Connected
✅ All connections successful!
```

### `validate` - Configuration Validation

Validates the configuration file and optionally tests API connections.

```bash
shelfbridge validate [options]
```

**Options:**
| Option | Description | Example |
|--------|-------------|---------|
| `--connections` | Also test API connections | `validate --connections` |
| `--help-config` | Show configuration help | `validate --help-config` |

**Examples:**

```bash
# Basic configuration validation
shelfbridge validate

# Validate config and test connections
shelfbridge validate --connections

# Show configuration help
shelfbridge validate --help-config
```

**Output Format:**

```
✅ Configuration validation completed successfully
```

### `config` - Show Configuration

Displays the current configuration in a human-readable format.

```bash
shelfbridge config
```

**Output Format:**

```
=== Configuration Status ===

Global Settings:
  Min Progress Threshold: 5.0%
  Workers: 3
  Parallel Processing: ON
  Timezone: America/New_York
  Dry Run Mode: OFF
  Force Sync: OFF
  Auto-add Books: ON
  Progress Regression Protection: ON

Users (2):
  alice:
    Audiobookshelf: https://audiobooks.example.com
    Hardcover: Connected
  bob:
    Audiobookshelf: https://abs.home.local:13378
    Hardcover: Connected

Configuration validation: ✅ Passed
```

### `cache` - Cache Management

Manages the local SQLite cache used for performance optimization.

```bash
shelfbridge cache [options]
```

**Options:**
| Option | Description | Example |
|--------|-------------|---------|
| `--clear` | Clear all cached data | `cache --clear` |
| `--stats` | Show cache statistics | `cache --stats` |
| `--show` | Show detailed cache contents | `cache --show` |
| `--export <filename>` | Export cache to JSON | `cache --export backup.json` |

**Examples:**

```bash
# Show cache statistics
shelfbridge cache --stats

# Export cache for backup
shelfbridge cache --export backup-2024-01-15.json

# Clear cache (will trigger full resync)
shelfbridge cache --clear
```

**Stats Output:**

```
=== Cache Statistics ===
Total books: 1,247
Recent books (last 7 days): 23
Cache size: 2.3 MB
Title/author matches cached: 156
```

**Cache Types:**

- **ASIN matches**: Books matched by Amazon identifiers (fastest, Tier 1)
- **ISBN matches**: Books matched by international book numbers (fast, Tier 2)
- **Title/author matches**: Books matched by edition-specific search with enhanced multi-author support and hierarchical data priority
- **Edition-specific data**: Cached edition metadata including duration, narrator with explicit role labels, format
- **Recent books**: Books with activity in the last 7 days

### `cron` - Scheduled Sync Service

Starts the application in scheduled sync mode, running syncs according to the configured schedule.

```bash
shelfbridge cron
```

**Features:**

- Runs initial sync immediately
- Schedules recurring syncs based on `sync_schedule` configuration
- Displays next scheduled sync time
- Runs in foreground continuously (use process manager for background)
- Process stays alive for scheduled syncs (does not exit after initial sync)

**Output Format:**

```
🔄 Starting sync...
✅ Sync complete for user: alice in 15.2s

🕒 Next scheduled sync: 2024-01-16 03:00:00 EST

Scheduled sync started. Press Ctrl+C to stop.
```

### `interactive` - Interactive Mode

Starts an interactive menu-driven interface for non-technical users.

```bash
shelfbridge interactive
```

**Menu Options:**

- Sync all users
- Sync specific user
- Test connections
- Show configuration
- Manage cache
- Exit

**Example Session:**

```
? Interactive mode - choose an option: (Use arrow keys)
❯ Sync all users
  Sync specific user
  Test connections
  Show configuration
  Manage cache
  Exit
```

### `debug` - Debug Information

Shows comprehensive debug information for troubleshooting.

```bash
shelfbridge debug [options]
```

**Options:**
| Option | Description | Example |
|--------|-------------|---------|
| `-u, --user <userId>` | Debug specific user only | `debug --user alice` |

**Information Shown:**

- User configuration details
- API connection status with additional details
- Cache information and statistics
- Sample API calls and responses
- **Book matching analysis**: Shows three-tier matching process and confidence scoring
- **Author/narrator extraction**: Enhanced multi-author support with target-based matching and hierarchical data priority (edition-level → book-level → legacy)
- **Edition-specific metadata**: Duration, narrator, format detection with explicit role label support
- **Scoring breakdown**: Detailed confidence factor analysis with improved text similarity matching
- System information
- Configuration validation status

**Output Format:**

```
════════════════════════════════════════════════════════════
🐛 DEBUG INFORMATION FOR USER
════════════════════════════════════════════════════════════
User ID: alice
Timestamp: 2024-01-15T10:30:00.000Z
════════════════════════════════════════════════════════════

📋 USER CONFIGURATION
------------------------------
User ID: alice
Audiobookshelf URL: https://audiobooks.example.com
Audiobookshelf Token: abcd1234...
Hardcover Token: xyz9876...
✅ All required fields present

🔌 CONNECTION TESTING
------------------------------
Audiobookshelf: ✅ Connected
  - ABS User: alice_reader
  - ABS User ID: 550e8400-e29b-41d4-a716-446655440000
  - ABS Libraries: 3
Hardcover: ✅ Connected
  - HC User: alice_books
  - HC User ID: 12345
  - HC Library Size: 847

📚 Available Libraries for filtering:
     "Audiobooks" (ID: lib_001)
     "Fiction" (ID: lib_002)
     "Non-Fiction" (ID: lib_003)
     "Podcasts" (ID: lib_004)
     "Sample Books" (ID: lib_005)
     "Science Fiction" (ID: lib_006)
     "Audio Courses" (ID: lib_007)

💡 Library filtering configuration:
   To filter libraries, add to your config:

   # Global filtering (applies to all users)
   global:
     libraries:
       include: ["Audiobooks", "Fiction"]
       # OR
       exclude: ["Podcasts", "Sample Books"]

   # User-specific filtering (overrides global)
   users:
     - id: alice
       libraries:
         include: ["Fiction", "Science Fiction"]

💾 CACHE INFORMATION
------------------------------
Total books in cache: 847
Cache size: 2.3 MB
Recent books (last 7 days): 15
Books for user alice: 847

🔍 SAMPLE API CALLS
------------------------------
Fetching sample books from Audiobookshelf...
Found 847 books in ABS
Sample book: "The Name of the Wind"
  Author: Patrick Rothfuss
  Progress: 67.5%
  ASIN: B12345ABCD
  ISBN: 9780756404079

Testing book matching with Hardcover...
  ✅ Found match: "The Name of the Wind"
  HC Book ID: 98765
  HC Edition ID: 43210

🖥️ SYSTEM INFORMATION
------------------------------
Node.js version: v18.19.0
Platform: linux
Architecture: x64
Memory usage: 45MB
Process uptime: 120s

⚙️ CONFIGURATION CHECK
------------------------------
Dry run mode: OFF
Min progress threshold: 5.0%
Auto-add books: ON
Progress regression protection: ON
Cron schedule: 0 3 * * * (daily at 3:00 AM)
════════════════════════════════════════════════════════════
🐛 DEBUG COMPLETED
════════════════════════════════════════════════════════════
```

### `schema` - GraphQL Schema Exploration

Shows available mutations in the Hardcover GraphQL schema.

```bash
shelfbridge schema
```

**Output Format:**

```
=== Checking schema for user: alice ===
Available mutations:
- update_user_book_read
  Args: object, where
- mark_book_completed
  Args: object, where
- add_book_to_library
  Args: object
```

### `schema-detail` - Detailed Schema Information

Shows detailed information about the `update_user_book_read` mutation.

```bash
shelfbridge schema-detail
```

### `schema-inputs` - All GraphQL Input Types

Lists all GraphQL input types and their fields.

```bash
shelfbridge schema-inputs
```

### `start` - Default Service Mode (Default Command)

Equivalent to `cron` command. This is the default behavior when no command is specified.

```bash
shelfbridge
# or
shelfbridge start
```

**Features:**

- Runs initial sync immediately
- Schedules recurring syncs based on `sync_schedule` configuration
- Process stays alive continuously for scheduled syncs
- Ideal for Docker containers and service deployments

## Interactive Mode

Interactive mode provides a user-friendly menu interface:

### Main Menu

```
? Interactive mode - choose an option:
❯ Sync all users
  Sync specific user
  Test connections
  Show configuration
  Manage cache
  Exit
```

### Cache Management Submenu

```
? Cache management - choose an option:
❯ Show cache stats
  Show cache contents
  Clear cache
  Export cache to JSON
  Back
```

## Common Usage Patterns

### Initial Setup and Testing

```bash
# 1. Validate configuration
shelfbridge validate --connections

# 2. Test sync with dry run
shelfbridge sync --dry-run --verbose

# 3. Perform first real sync
shelfbridge sync --verbose
```

### Regular Maintenance

```bash
# Check cache size
shelfbridge cache --stats

# Force a complete resync
shelfbridge sync --force

# Debug connection issues
shelfbridge debug --user alice
```

### Scheduled Operation

```bash
# Start as service (foreground, stays alive for scheduled syncs)
shelfbridge cron

# Or use the default command (ideal for Docker containers)
shelfbridge
```

### Troubleshooting

```bash
# Test connections
shelfbridge test --verbose

# Debug specific user with enhanced matching analysis
shelfbridge debug --user alice

# Check book matching confidence scores
shelfbridge sync --dry-run --verbose | grep "confidence"

# Analyze title/author fallback performance with enhanced multi-author support
shelfbridge sync --dry-run --verbose | grep -A 5 "Tier 3"

# Check author/narrator extraction with hierarchical data priority
shelfbridge sync --dry-run --verbose | grep -E "(narrator|contributions|edition-level)"

# Validate configuration including enhanced matching settings
shelfbridge validate --help-config
```

## Exit Codes

| Code | Meaning | When It Occurs                                             |
| ---- | ------- | ---------------------------------------------------------- |
| `0`  | Success | Command completed successfully                             |
| `1`  | Error   | Configuration validation failed, API errors, sync failures |

## Environment Variables

While configuration is primarily done via YAML files, these environment variables can influence behavior:

| Variable    | Description                              | Default      |
| ----------- | ---------------------------------------- | ------------ |
| `LOG_LEVEL` | Logging level (error, warn, info, debug) | `info`       |
| `NODE_ENV`  | Node.js environment                      | `production` |

## Performance Considerations

### Command Performance

- **sync**: 5-60 seconds depending on library size, cache state, and matching tier usage
  - Tier 1 (ASIN): 0.5-1s per book
  - Tier 2 (ISBN): 1-2s per book
  - Tier 3 (Title/Author): 3-8s per book (enhanced with multi-author support and hierarchical data priority)
- **test**: 2-5 seconds
- **validate**: 1-3 seconds
- **cache --stats**: < 1 second
- **debug**: 5-15 seconds
- **interactive**: Real-time (menu navigation)

### Memory Usage

- **Base CLI**: ~30-50 MB
- **During sync**: +10-20 MB
- **Large libraries**: May use up to 100 MB temporarily

### Network Usage

- **Initial sync**: 50-200 API calls (may increase with title/author fallback usage)
- **Subsequent syncs**: 10-50 API calls
- **Edition-specific searches**: 1-2 additional API calls per title/author match (enhanced with hierarchical data retrieval)
- **Enhanced GraphQL queries**: Improved data completeness with edition-level and book-level contributions
- **Rate limiting**: Automatically handled (55 req/min Hardcover, 600 req/min Audiobookshelf)

## Tips and Best Practices

### For New Users

1. Start with `validate --connections` to verify setup
2. Use `--dry-run` for your first sync
3. Use `interactive` mode for easier navigation
4. Check `debug` output if you encounter issues

### For Regular Use

1. Use scheduled mode (`cron` or `start`) for automated syncing
2. Check `cache --stats` periodically
3. Use `--force` occasionally to ensure full sync
4. Monitor logs for any recurring issues

### For Troubleshooting

1. Enable `--verbose` for detailed output
2. Use `debug` command for comprehensive information
3. Check `test` command to isolate connection issues
4. Export cache before clearing for backup

## Integration with Process Managers

### systemd Service

```ini
[Unit]
Description=ShelfBridge Sync Service
After=network.target

[Service]
Type=simple
User=shelfbridge
WorkingDirectory=/opt/shelfbridge
ExecStart=/usr/bin/node src/main.js start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Docker Compose

```yaml
version: '3.8'
services:
  shelfbridge:
    image: shelfbridge:latest
    command: ['node', 'src/main.js', 'start']
    volumes:
      - ./config:/app/config
      - ./data:/app/data
      - ./logs:/app/logs
    restart: unless-stopped
```

This CLI reference covers all available functionality. For specific configuration options, see the [Configuration Reference](../admin/Configuration-Reference.md).
