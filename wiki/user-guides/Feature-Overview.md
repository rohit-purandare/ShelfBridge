# 📚 Feature Overview

ShelfBridge is a comprehensive audiobook progress synchronization solution with advanced features for individual users, families, and power users. This overview categorizes all available functionality discovered through complete source code analysis.

## Table of Contents

- [Core Synchronization Features](#core-synchronization-features)
- [Smart Features](#smart-features)
- [Performance Features](#performance-features)
- [User Management Features](#user-management-features)
- [Configuration Features](#configuration-features)
- [CLI Features](#cli-features)
- [Automation Features](#automation-features)
- [Debugging Features](#debugging-features)
- [Data Management Features](#data-management-features)
- [Safety Features](#safety-features)

## Core Synchronization Features

### Reading Progress Sync

- **Real-time progress tracking** from Audiobookshelf to Hardcover
- **Completion status sync** when books are finished
- **Started/finished timestamp sync** with timezone support
- **Progress percentage calculation** for both audiobooks and ebooks
- **Multiple identifier support** (ASIN, ISBN-10, ISBN-13)

### Book Matching Engine

- **ASIN-first matching** optimized for audiobooks
- **ISBN fallback matching** for books without ASINs
- **Intelligent identifier extraction** from multiple metadata sources
- **Case-insensitive matching** with normalization
- **Title-based verification** to prevent false matches

### Progress Calculation

- **Time-based progress** for audiobooks (seconds to percentage)
- **Page-based progress** for ebooks (current page to percentage)
- **Automatic format detection** between audio and text books
- **Progress validation** to ensure accurate calculations

## Smart Features

### Auto-Add Functionality

- **Intelligent book addition** to Hardcover when progress is detected
- **Progress threshold filtering** (only add books with meaningful progress)
- **Immediate progress sync** after auto-adding books
- **Completion detection** during auto-add process
- **Configurable enable/disable** for user control

### Progress Regression Protection

- **Completion status protection** prevents overwriting finished books
- **High progress protection** blocks large progress drops
- **Re-reading detection** creates new sessions instead of overwriting
- **Configurable thresholds** for different protection levels
- **Warning system** for suspicious progress changes

### Re-reading Detection

- **Restart threshold detection** (progress below 30% = starting over)
- **High progress threshold** (above 85% = significant progress)
- **Regression blocking** (drops >50% from high progress blocked)
- **Warning thresholds** (drops >15% generate warnings)
- **New session creation** for legitimate re-reads

### Completion Detection

- **Always active** - checks entire library for completed books every sync
- **Parallel processing** across multiple libraries for performance
- **Optimized chunking** within libraries to respect rate limits
- **Comprehensive scanning** of all books in filtered libraries
- **Enhanced progress logging** for large library processing
- **Library statistics caching** for performance

## Performance Features

### Parallel Processing

- **Configurable worker count** (1-10 workers)
- **Batch processing** for large libraries
- **Concurrent API requests** with semaphore control
- **Memory optimization** for resource-constrained environments
- **Progress tracking** during parallel operations

### Rate Limiting

- **Hardcover API limiting** (10-60 requests/minute, default 55)
- **Audiobookshelf API limiting** (60-1200 requests/minute, default 600)
- **Intelligent queuing** delays requests instead of dropping them
- **Warning system** alerts at 80% capacity
- **Per-service limits** with independent tracking

### Connection Management

- **HTTP keep-alive** connections for efficiency
- **Connection pooling** for both APIs
- **Automatic retry logic** with exponential backoff
- **Timeout handling** (30-second timeouts)
- **Graceful cleanup** on application exit

### Caching System

- **SQLite-based cache** with WAL mode for concurrency
- **Multi-table schema** (books, sync tracking, library stats)
- **Index optimization** for fast queries
- **Cache statistics** and management tools
- **Library statistics caching** for dashboard displays

## User Management Features

### Multi-User Support

- **Independent user configurations** with separate tokens
- **Per-user sync tracking** and statistics
- **Isolated data storage** preventing cross-user contamination
- **Bulk user operations** (sync all, test all)
- **User-specific debugging** and troubleshooting

### User Configuration

- **Unique user identifiers** with validation
- **Individual API tokens** for both services
- **Server URL configuration** per user
- **User-specific settings** override global defaults

## Configuration Features

### Comprehensive Validation

- **Schema-based validation** for 25+ configuration options
- **Type checking** (string, number, boolean, object)
- **Range validation** (e.g., 0-100 for percentages)
- **Custom validators** (URLs, cron schedules, timezones)
- **Placeholder detection** identifies example values

### Default Value System

- **Sensible defaults** for all optional settings
- **Explicit value tracking** shows which values were set vs defaults
- **Configuration inheritance** from global to user settings
- **Environment-specific configurations**

### Configuration Help

- **Interactive help generation** with descriptions and examples
- **Validation error formatting** with specific fix suggestions
- **Configuration examples** for different use cases
- **Field documentation** with validation rules

## CLI Features

### Command Suite (11 Commands)

1. **`sync`** - Main synchronization with user selection and force options
2. **`test`** - API connection testing with detailed output
3. **`validate`** - Configuration validation with connection testing
4. **`config`** - Configuration display with defaults indication
5. **`cache`** - Cache management (stats, clear, export, show)
6. **`cron`** - Scheduled sync service with next-run display
7. **`interactive`** - Menu-driven interface for non-technical users
8. **`debug`** - Comprehensive debugging information
9. **`schema`** - GraphQL schema exploration tools
10. **`schema-detail`** - Detailed mutation information
11. **`start`** - Default service mode (alias for cron)

### Interactive Mode

- **Menu-driven navigation** for ease of use
- **Sub-menus** for complex operations (cache management)
- **Real-time feedback** during operations
- **User-friendly output** formatting
- **Exit handling** with proper cleanup

### Output Formatting

- **Two-column layout** for sync results
- **Progress indicators** during operations
- **Color-coded status** (✅ success, ❌ error, ⚡ fast scan)
- **Detailed statistics** (library status, processing results)
- **Performance metrics** (duration, API calls, cache hits)

## Automation Features

### Scheduled Sync

- **Cron-based scheduling** with full cron expression support
- **Timezone support** for accurate scheduling
- **Initial sync** runs immediately on startup
- **Next sync display** shows upcoming sync times
- **Background service mode** for production deployments

### Sync Intelligence

- **Change detection** only syncs modified progress
- **Cache-based optimization** reduces unnecessary API calls
- **Library statistics tracking** for dashboard displays
- **Sync frequency management** balances freshness vs performance

### Service Integration

- **systemd service** template provided
- **Docker Compose** configuration
- **Process manager** compatibility
- **Graceful shutdown** handling

## Debugging Features

### Comprehensive Debug Output

- **User configuration** verification and masking
- **API connection** testing with additional details
- **Cache information** with statistics and recent activity
- **Sample API calls** to verify book matching
- **System information** (Node.js, platform, memory)
- **Configuration validation** status

### Error Reporting

- **Failed book dumping** saves error details to files
- **Structured error messages** with context
- **Stack trace logging** for debugging
- **Error categorization** (configuration, API, network)

### Troubleshooting Tools

- **Connection testing** isolates API issues
- **Configuration validation** with fix suggestions
- **Cache inspection** tools
- **Verbose logging** with multiple levels
- **Performance monitoring** during operations

## Data Management Features

### Cache Management

- **Cache statistics** (total books, size, recent activity)
- **Cache inspection** shows detailed book information
- **Cache export** to JSON for backup/analysis
- **Cache clearing** for fresh starts
- **Automatic cache updates** during sync operations

### Database Features

- **SQLite database** with WAL mode for concurrency
- **Migration system** for schema updates
- **Index optimization** for query performance
- **Data integrity** with transaction support
- **Backup/restore** capabilities via JSON export

### Data Persistence

- **Book metadata caching** reduces API calls
- **Sync tracking** prevents duplicate operations
- **Library statistics** for dashboard display
- **Progress history** tracking
- **Timestamp management** with timezone support

## Safety Features

### Data Protection

- **Dry run mode** for testing without changes
- **Progress regression protection** prevents data loss
- **Completion status protection** preserves finished books
- **Transaction-based updates** ensure data consistency
- **Rollback capabilities** for failed operations

### Validation and Verification

- **Input validation** for all configuration options
- **API response validation** ensures data integrity
- **Book matching verification** prevents incorrect updates
- **Progress calculation validation** ensures accuracy

### Error Handling

- **Graceful degradation** continues with other books on failures
- **Comprehensive error catching** prevents crashes
- **Resource cleanup** on unexpected termination
- **Safe interruption** handling (Ctrl+C)

## Feature Availability Matrix

| Feature Category   | Basic Users | Power Users | Families | Developers |
| ------------------ | ----------- | ----------- | -------- | ---------- |
| Progress Sync      | ✅          | ✅          | ✅       | ✅         |
| Auto-Add Books     | ✅          | ✅          | ✅       | ✅         |
| Multi-User         | ❌          | ✅          | ✅       | ✅         |
| Scheduled Sync     | ✅          | ✅          | ✅       | ✅         |
| Advanced Config    | ❌          | ✅          | ✅       | ✅         |
| Debug Tools        | ❌          | ✅          | ❌       | ✅         |
| Cache Management   | ❌          | ✅          | ❌       | ✅         |
| Schema Tools       | ❌          | ❌          | ❌       | ✅         |
| Performance Tuning | ❌          | ✅          | ✅       | ✅         |
| Interactive Mode   | ✅          | ✅          | ✅       | ❌         |

## Configuration Complexity

### Minimal Setup (Basic Users)

- **3 required fields** per user (ID, ABS URL, ABS token, Hardcover token)
- **Global defaults** handle everything else
- **5-minute setup** for single users

### Standard Setup (Most Users)

- **5-10 configuration options** typically modified
- **15-minute setup** including API token generation
- **Testing and validation** included

### Advanced Setup (Power Users)

- **25+ configuration options** available
- **Custom performance tuning** for large libraries
- **Rate limiting optimization** for API efficiency
- **Multi-user coordination** for families

### Enterprise Setup (Organizations)

- **Environment-specific configs** for different stages
- **Security considerations** for token management
- **Service integration** with systemd/Docker
- **Monitoring and alerting** setup

## Platform Support

### Operating Systems

- **Linux** (full support, primary platform)
- **macOS** (full support, development platform)
- **Windows** (full support via Docker)
- **Docker** (recommended deployment method)

### Node.js Versions

- **Node.js 16+** minimum requirement
- **Node.js 18** recommended (LTS)
- **Node.js 20** tested and supported

### Deployment Options

- **Docker Compose** (recommended for most users)
- **Manual Docker** (for custom setups)
- **Direct Node.js** (for development)
- **systemd service** (for Linux servers)

## API Integration

### Audiobookshelf Integration

- **REST API** communication
- **JWT token** authentication
- **Progress endpoint** access
- **Library metadata** retrieval
- **Pagination support** for large libraries

### Hardcover Integration

- **GraphQL API** communication
- **Bearer token** authentication
- **Progress mutations** for updates
- **Book search** by identifiers
- **Library management** operations

This comprehensive feature overview covers all functionality available in ShelfBridge. For specific usage instructions, see the [User Guides](../user-guides/) section.
