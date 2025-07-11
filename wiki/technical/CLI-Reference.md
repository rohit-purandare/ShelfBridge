# 🖥️ Command Line Interface Reference

ShelfBridge provides a comprehensive command-line interface for all operations. This page documents every command, option, and flag available.

## 📋 General Usage

```bash
node src/main.js <command> [options]

# Or with npm scripts
npm run <script>
```

### Global Options

These options can be used with any command:

| Option | Description | Default |
|--------|-------------|---------|
| `--dry-run` | Run without making any changes | `false` |
| `--skip-validation` | Skip configuration validation on startup | `false` |
| `--help` | Show help for a command | - |

## 🔄 Sync Commands

### `sync` - Synchronize Reading Progress

The main command to sync your reading progress from Audiobookshelf to Hardcover.

```bash
node src/main.js sync [options]
npm run sync  # Shortcut
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

### `start` - Background Service (Default)

Start ShelfBridge in interactive mode or as the default command.

```bash
node src/main.js start
node src/main.js  # Same as start (default command)
npm start         # Shortcut
```

This command runs the scheduled sync service based on your `sync_schedule` configuration.

### `cron` - Scheduled Sync Service

Start the background sync service that runs on your configured schedule.

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

### `debug` - Debug Information

Show detailed information about your setup and data for troubleshooting.

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

#### Debug Output

Shows detailed information including:
- Audiobookshelf connection status
- Available books and their metadata
- Progress information
- Book identifiers (ISBN/ASIN)
- Cache status
- Configuration validation

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

For convenience, several npm scripts are available:

| Script | Command | Description |
|--------|---------|-------------|
| `npm start` | `node src/main.js` | Start background service |
| `npm run sync` | `node src/main.js sync` | One-time sync |
| `npm run dev` | `node --watch src/main.js` | Development mode with auto-restart |

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
docker exec -it shelfbridge npm run sync

# Debug in Docker
docker exec -it shelfbridge node src/main.js debug

# Clear cache in Docker
docker exec -it shelfbridge node src/main.js cache --clear

# View logs
docker-compose logs -f shelfbridge
```

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