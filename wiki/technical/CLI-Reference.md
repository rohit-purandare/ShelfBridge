# 🖥️ Command Line Interface Reference

ShelfBridge provides a comprehensive command-line interface for all operations. This page documents every command, option, and flag available.

## 📋 General Usage

```bash
node src/main.js <command> [options]
```

### Global Options

These options can be used with any command:

| Option | Description | Default |
|--------|-------------|---------|
| `--dry-run` | Run without making any changes | `false` |
| `--skip-validation` | Skip configuration validation on startup | `false` |
| `--verbose` | Show detailed logging output | `false` |
| `--help` | Show help for a command | - |

### Command Behavior

**Process Exit:**
- All commands exit automatically after completion
- Return control to the terminal/shell
- Exit with code 0 on success, non-zero on error

**Resource Cleanup:**
- Database connections are properly closed
- Temporary resources are cleaned up
- Safe to run multiple times

**Interruption:**
- Commands can be interrupted with Ctrl+C
- Cleanup procedures attempt to run before exit
- **Risk of data inconsistency**: Interruption during API calls or cache updates may cause the local cache to become out of sync with Hardcover

## 🔄 Sync Commands

### `sync` - Synchronize Reading Progress

The main command to sync your reading progress from Audiobookshelf to Hardcover.

```bash
node src/main.js sync [options]
```

#### Options

| Option | Short | Description | Example |
|--------|-------|-------------|---------|
| `--all-users` | - | Sync all configured users | `--all-users` |
| `--user <userId>` | `-u` | Sync specific user only | `-u alice` |
| `--force` | - | Force sync even if progress unchanged | `--force` |
| `--dry-run` | - | Show what would be synced without changes | `--dry-run` |

#### Examples

```bash
# Sync all users
node src/main.js sync

# Sync specific user
node src/main.js sync --user alice

# See what would be synced without making changes
node src/main.js sync --dry-run

# Force sync all books (ignore cache)
node src/main.js sync --force

# Combine options
node src/main.js sync --user bob --dry-run
```

#### Output

```
==================================================
📚 SYNC SUMMARY
==================================================
⏱️  Duration: 2.3s
📖 Books processed: 15
✅ Books synced: 3
🎯 Books completed: 1
➕ Books auto-added: 0
⏭️  Books skipped: 11
❌ Errors: 0
==================================================
```

### `test` - Test API Connections

Test API connections for all configured users or a specific user. Useful for verifying that your Audiobookshelf and Hardcover tokens are valid and that the services are reachable.

```bash
node src/main.js test [options]
```

#### Options

| Option                | Short | Description                | Example         |
|-----------------------|-------|----------------------------|-----------------|
| `--user <userId>`     | `-u`  | Test specific user only    | `-u alice`      |

#### Examples

```bash
# Test API connections for all users (clean output)
node src/main.js test

# Test API connections for a specific user (clean output)
node src/main.js test --user alice

# Test with detailed logging output
node src/main.js test --verbose

# Test specific user with verbose output
node src/main.js test --user alice --verbose
```

#### Output

```
=== Testing connections for user: alice ===
✅ Audiobookshelf connection successful
✅ Hardcover connection successful
=== Testing connections for user: bob ===
✅ Audiobookshelf connection successful
✅ Hardcover connection successful
```

### `start` - Scheduled Sync Service (Default)

Start ShelfBridge in scheduled sync mode (default behavior).

```bash
node src/main.js start
node src/main.js  # Same as start (default command)
```

This command runs the scheduled sync service based on your `sync_schedule` configuration.

### `interactive` - Interactive Mode

Start ShelfBridge in interactive mode for manual operations.

```bash
node src/main.js interactive
```

- Provides menu-driven interface
- Manual sync operations
- Configuration management
- Cache management

### `cron` - Scheduled Sync Service (Alias)

Alias for the start command - runs the same scheduled sync service.

```bash
node src/main.js cron
```

- Runs an initial sync immediately
- Schedules recurring syncs based on `sync_schedule` in config
- Keeps running until interrupted (Ctrl+C)
- Uses the configured `timezone` for scheduling

## ⚙️ Configuration Commands

### `validate` - Validate Configuration

Check your configuration file for errors and test API connections.

```bash
node src/main.js validate [options]
```

#### Options

| Option | Description |
|--------|-------------|
| `--connections` | Test API connections to all services |
| `--help-config` | Show detailed configuration help |

#### Examples

```bash
# Basic validation
node src/main.js validate

# Validate and test connections
node src/main.js validate --connections

# Show configuration help
node src/main.js validate --help-config
```

### `config` - Show Configuration

Display your current configuration (with sensitive data masked).

```bash
node src/main.js config
```

## 🗄️ Cache Management Commands

### `cache` - Manage Cache

Manage the SQLite cache that stores book information and sync state.

```bash
node src/main.js cache [options]
```

#### Options

| Option | Description | Example |
|--------|-------------|---------|
| `--clear` | Clear all cached data | `--clear` |
| `--stats` | Show cache statistics | `--stats` |
| `--show` | Show detailed cache contents | `--show` |
| `--export <filename>` | Export cache to JSON file | `--export backup.json` |

#### Examples

```bash
# Show cache statistics
node src/main.js cache --stats

# View all cached books
node src/main.js cache --show

# Clear cache (forces full re-sync next time)
node src/main.js cache --clear

# Export cache to JSON file
node src/main.js cache --export my-cache-backup.json
```

#### Cache Statistics Output

```
=== Cache Statistics ===
Total books: 127
Users: alice, bob
Recent books (last 7 days): 8
Cache size: 2.1 MB
```

## 🐛 Debug Commands

### `debug` - Comprehensive Debug Information

Show detailed diagnostic information about your ShelfBridge setup for troubleshooting and validation.

```bash
node src/main.js debug [options]
```

#### Options

| Option | Short | Description | Example |
|--------|-------|-------------|---------|
| `--user <userId>` | `-u` | Debug specific user only | `-u alice` |

#### Examples

```bash
# Debug all users
node src/main.js debug

# Debug specific user
node src/main.js debug --user alice
```

#### Debug Output Sections

The debug command provides comprehensive information organized into these sections:

##### 📋 User Configuration
- Validates all required fields (ID, URLs, tokens)
- Shows masked API tokens for security
- Identifies missing configuration

##### 🔌 Connection Testing
- Tests both Audiobookshelf and Hardcover APIs
- Shows server information and user details
- Displays library statistics

##### 💾 Cache Information
- Cache statistics (total books, size, recent activity)
- User-specific cached books
- Recent sync activity

##### 🔍 Sample API Calls
- Fetches sample books from Audiobookshelf
- Tests book matching between services
- Validates identifier matching (ISBN/ASIN)

##### 🖥️ System Information
- Node.js version and platform details
- Memory usage and process uptime
- Runtime environment information

##### ⚙️ Configuration Check
- Global settings overview
- Sync behavior configurations
- Scheduling and automation settings

#### Sample Debug Output

```
============================================================
🐛 DEBUG INFORMATION FOR USER
============================================================
User ID: alice
Timestamp: 2024-01-15T10:30:00.000Z
============================================================

📋 USER CONFIGURATION
------------------------------
User ID: alice
Audiobookshelf URL: https://abs.example.com
Audiobookshelf Token: abcd1234...
Hardcover Token: wxyz5678...
✅ All required fields present

🔌 CONNECTION TESTING
------------------------------
Testing Audiobookshelf connection...
Audiobookshelf: ✅ Connected
  - ABS User: alice
  - ABS User ID: abc123
  - ABS Libraries: 2
Testing Hardcover connection...
Hardcover: ✅ Connected
  - HC User: alice_reader
  - HC User ID: 456789
  - HC Library Size: 127

💾 CACHE INFORMATION
------------------------------
Total books in cache: 127
Cache size: 2.1 MB
Recent books (last 7 days): 8
Books for user alice: 89

Recent books for this user:
  1. The Great Gatsby
     Progress: 75%
     Last sync: 2024-01-15T09:15:00.000Z
     Identifier: ISBN=9780123456789

🔍 SAMPLE API CALLS
------------------------------
Fetching sample books from Audiobookshelf...
Found 15 books in ABS
Sample book: "The Great Gatsby"
  Author: F. Scott Fitzgerald
  Progress: 75%
  ASIN: B08ABCDEFG
  ISBN: 9780123456789
Testing book matching with Hardcover...
  ✅ Found match: "The Great Gatsby"
  HC Book ID: 12345
  HC Edition ID: 67890

🖥️ SYSTEM INFORMATION
------------------------------
Node.js version: v18.17.0
Platform: darwin
Architecture: x64
Memory usage: 45MB
Process uptime: 127s

⚙️ CONFIGURATION CHECK
------------------------------
Dry run mode: OFF
Min progress threshold: 5%
Auto-add books: ON
Progress regression protection: ON
Cron schedule: 0 3 * * *
Cron timezone: UTC

============================================================
🐛 DEBUG COMPLETED
============================================================
```

#### When to Use Debug

- **Initial Setup**: Verify your configuration is correct
- **Troubleshooting**: Diagnose sync issues or API problems
- **Performance**: Check cache usage and system resources
- **Support**: Gather information for bug reports or help requests

## 🔍 Schema Commands

These commands help developers inspect the Hardcover GraphQL API schema.

### `schema` - Show Available Mutations

Display available GraphQL mutations in the Hardcover API.

```bash
node src/main.js schema
```

### `schema-detail` - Detailed Schema Information

Get detailed information about specific mutations and their arguments.

```bash
node src/main.js schema-detail
```

### `schema-inputs` - Show Input Types

Display all GraphQL input types and their fields.

```bash
node src/main.js schema-inputs
```

## 📜 npm Scripts

For convenience, several npm scripts are available as shortcuts:

| Script | Command | Description |
|--------|---------|-------------|
| `npm start` | `node src/main.js` | Start background service |
| `npm run sync` | `node src/main.js sync` | One-time sync |
| `npm run dev` | `node --watch src/main.js` | Development mode with auto-restart |

**Note**: All commands can be run directly with `node src/main.js <command>` for more control over options.

## 🐳 Docker Commands

When running in Docker, prefix commands with docker exec:

```bash
# Docker Compose
docker exec -it shelfbridge <command>

# Manual Docker
docker exec -it shelfbridge-container <command>
```

### Examples

```bash
# Sync in Docker
docker exec -it shelfbridge node src/main.js sync

# Debug in Docker
docker exec -it shelfbridge node src/main.js debug

# Clear cache in Docker
docker exec -it shelfbridge node src/main.js cache --clear

# View logs
docker-compose logs -f shelfbridge
```

### 🚨 Docker Troubleshooting: Native Module Errors

If you see errors like:
```
Error: Could not locate the bindings file. Tried:
 → .../better_sqlite3.node
```
or any other native module binding errors.

**The container will automatically attempt to fix all native module issues on startup.** If the automatic fix fails:

1. **Rebuild the Docker image:**
   ```bash
   docker-compose build --no-cache
   ```

2. **Or pull the latest image:**
   ```bash
   docker pull ghcr.io/rohit-purandare/shelfbridge:latest
   ```

3. **For manual Docker builds:**
   ```bash
   docker build --no-cache -t shelfbridge .
   ```

**Why this happens:**
- Native modules are compiled for specific OS/architecture combinations
- Moving between different machines or architectures can cause mismatches
- The container automatically detects and rebuilds all native modules during startup if needed

**What the container does automatically:**
- Checks all native modules (.node files) for compatibility
- Rebuilds any broken native modules for the current environment
- Provides detailed feedback about which modules are working or broken
- Falls back to helpful error messages if automatic fixes don't work

**Prevention:**
- Always use the official Docker image when possible
- If building locally, ensure you build on the same architecture you'll run on
- The container includes comprehensive native module detection and repair

### Accessing the Interactive CLI Menu in Docker

You can use the interactive menu from within your Docker container. There are two main ways:

#### 1. One-liner (directly from your host):
```bash
docker exec -it shelfbridge node src/main.js
```
This will launch the interactive menu immediately in your terminal.

#### 2. Open a shell in the container, then run the CLI:
```bash
# Enter the container shell
# (use /bin/bash or /bin/sh depending on your image)
docker exec -it shelfbridge /bin/bash
# or
docker exec -it shelfbridge /bin/sh

# Then, inside the container, run:
node src/main.js
# or
node src/main.js start
```
This is useful if you want to run multiple commands or explore the container environment.

## 🔧 Configuration File Options

Many CLI behaviors can be controlled through your `config.yaml` file:

```yaml
global:
  # These affect CLI behavior
  dry_run: false              # Default for --dry-run
  workers: 3                  # Parallel processing workers
  sync_schedule: "0 3 * * *"  # Cron schedule for background service
  timezone: "UTC"             # Timezone for scheduling
```

## 🚨 Exit Codes

ShelfBridge uses standard exit codes:

| Code | Meaning | Common Causes |
|------|---------|---------------|
| `0` | Success | Command completed successfully |
| `1` | General Error | Configuration errors, API failures, network issues |

## 📊 Verbose Output

For more detailed output, ShelfBridge logs extensively. Check the logs directory or use Docker logs:

```bash
# View application logs
tail -f logs/app.log

# Docker logs
docker-compose logs -f shelfbridge
```

## 🔗 Related Pages

- **[Configuration Overview](../admin/Configuration-Overview.md)** - Understanding config options
- **[Debug Commands](Debug-Commands.md)** - Detailed debugging guide
- **[Cache Management](../admin/Cache-Management.md)** - Understanding the cache system
- **[Troubleshooting Guide](../troubleshooting/Troubleshooting-Guide.md)** - Solving common issues

## 💡 Tips and Tricks

### Quick Testing
```bash
# Test configuration without syncing
node src/main.js validate --connections

# See what would sync without changes
node src/main.js sync --dry-run

# Debug a single user quickly
node src/main.js debug -u username
```

### Performance Monitoring
```bash
# Check cache stats before sync
node src/main.js cache --stats

# Monitor sync performance
time node src/main.js sync

# Force fresh sync for comparison
node src/main.js cache --clear && node src/main.js sync
```

### Backup and Recovery
```bash
# Backup cache before major changes
node src/main.js cache --export backup-$(date +%Y%m%d).json

# Clear cache to start fresh
node src/main.js cache --clear
```

---

**Need more help?** Check the [Debug Commands guide](Debug-Commands.md) or [Troubleshooting Guide](../troubleshooting/Troubleshooting-Guide.md). 