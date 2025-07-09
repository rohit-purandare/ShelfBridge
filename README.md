# ShelfBridge

> **Sync your audiobook reading progress from [Audiobookshelf](https://www.audiobookshelf.org/) to [Hardcover](https://hardcover.app/) automatically.**

ShelfBridge is a Node.js application that bridges the gap between Audiobookshelf and Hardcover, automatically syncing your reading progress and book completion status. It intelligently matches books using ASIN (for audiobooks) and ISBN (for print/ebooks) for accurate synchronization.

## ✨ Features

- 📚 **Smart Book Matching**: Matches books by ASIN (audiobooks) and falls back to ISBN (print/ebooks)
- 🔄 **Automatic Sync**: Runs on a schedule or on-demand
- 🎯 **Completion Detection**: Uses Audiobookshelf's completion flag and progress percentage
- 💾 **Intelligent Caching**: SQLite cache for efficient syncing and performance
- 👥 **Multi-User Support**: Sync multiple users in one run
- 🐳 **Docker Ready**: Production-ready Docker image with health checks
- 🛡️ **Secure**: No secrets in images, no data sent to third parties
- 📊 **Progress Tracking**: Handles both page-based and time-based progress
- 🔍 **Debug Tools**: Built-in debugging and cache management commands

## 🚀 Quick Start

### Prerequisites

- Node.js 18.0.0 or higher
- Audiobookshelf server (with API access)
- Hardcover account (with API token)

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <your-repo-url>
   cd ShelfBridge
   npm install
   ```

2. **Create configuration:**
   ```bash
   mkdir -p config data
   cp config/config.yaml.example config/config.yaml
   ```

3. **Configure your settings:**
   ```bash
   # Edit config/config.yaml with your credentials
   nano config/config.yaml
   ```

4. **Run your first sync:**
   ```bash
   npm run sync
   ```

## ⚙️ Configuration

### Basic Configuration

Create `config/config.yaml` based on the example:

```yaml
global:
  min_progress_threshold: 5.0
  parallel: true
  workers: 3
  dry_run: false
  sync_schedule: "0 3 * * *"  # Every day at 3am
  timezone: "Etc/UTC"

users:
  - id: your_user_id
    abs_url: https://your-audiobookshelf-server.com
    abs_token: your_audiobookshelf_api_token
    hardcover_token: your_hardcover_api_token
```

### Multi-User Configuration

```yaml
users:
  - id: alice
    abs_url: https://audiobookshelf.alice.com
    abs_token: alice_abs_token
    hardcover_token: alice_hardcover_token
  - id: bob
    abs_url: https://audiobookshelf.bob.com
    abs_token: bob_abs_token
    hardcover_token: bob_hardcover_token
```

### Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `min_progress_threshold` | Minimum progress % to sync | 5.0 |
| `parallel` | Enable parallel processing | true |
| `workers` | Number of parallel workers | 3 |
| `dry_run` | Show what would be synced | false |
| `sync_schedule` | Cron schedule for auto-sync | "0 3 * * *" |
| `timezone` | Timezone for scheduling | "Etc/UTC" |

## 🖥️ Usage

### Command Line Interface

```bash
# Sync all users
npm run sync
node src/main.js sync

# Sync specific user
node src/main.js sync --user your_user_id

# Dry run (no changes)
node src/main.js sync --dry-run

# Debug mode
node src/main.js debug

# Cache management
node src/main.js cache --show
node src/main.js cache --clear
node src/main.js cache --export
```

### Available Commands

| Command | Description |
|---------|-------------|
| `sync` | Sync reading progress |
| `debug` | Show raw Audiobookshelf data |
| `cache --show` | Display cache contents |
| `cache --clear` | Clear the cache |
| `cache --export` | Export cache to JSON |
| `cache --stats` | Show cache statistics |

### Scheduled Sync

Start the scheduled sync service:

```bash
npm start
```

This runs the sync according to your `sync_schedule` configuration.

## 🐳 Docker Deployment

### Docker Compose

```yaml
version: '3.8'

services:
  shelfbridge:
    build: .
    container_name: shelfbridge
    restart: unless-stopped
    user: "1000:1000"
    environment:
      - TZ=Etc/UTC
    volumes:
      - ./config/config.yaml:/app/config/config.yaml:ro
      - ./data:/app/data
    command: ["npm", "start"]
    healthcheck:
      test: ["CMD", "node", "src/main.js", "--version"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
```

### Docker Run

```bash
docker run -d \
  --name shelfbridge \
  -v $(pwd)/config/config.yaml:/app/config/config.yaml:ro \
  -v $(pwd)/data:/app/data \
  -e TZ=Etc/UTC \
  shelfbridge:latest
```

## 🔧 How It Works

### Book Matching Logic

1. **ASIN Priority**: For audiobooks, ShelfBridge first tries to match by ASIN (Amazon Standard Identification Number)
2. **ISBN Fallback**: If no ASIN is found, it falls back to ISBN (ISBN-10 or ISBN-13)
3. **Skip Unmatched**: Books without ISBN/ASIN are skipped to ensure accuracy

### Progress Synchronization

- **Audiobooks**: Uses `progress_seconds` with total duration
- **Print/Ebooks**: Uses `progress_pages` with total page count
- **Completion**: Detects completion via Audiobookshelf's `is_finished` flag or ≥95% progress

### Cache System

ShelfBridge uses SQLite (`data/.book_cache.db`) to cache:

- **Book Editions**: Maps ISBNs/ASINs to Hardcover edition IDs
- **Progress Values**: Only syncs when progress changes
- **Author Information**: Reduces API calls
- **User Isolation**: All data is keyed by user_id

**Benefits:**
- First sync: Full sync of all books
- Subsequent syncs: Only changed progress
- Performance: Significantly faster after initial sync
- Persistence: Survives container restarts

## 🐛 Troubleshooting

### Common Issues

**"No books found"**
- Check Audiobookshelf API token and URL
- Verify library permissions
- Run `node src/main.js debug` to see raw data

**"GraphQL errors"**
- Verify Hardcover API token
- Check book matching (ISBN/ASIN availability)
- Review Hardcover API documentation

**"Cache issues"**
- Clear cache: `node src/main.js cache --clear`
- Check file permissions on `data/` directory

### Debug Commands

```bash
# View raw Audiobookshelf data
node src/main.js debug

# Check cache contents
node src/main.js cache --show

# Test connections
npm run test

# Dry run sync
node src/main.js sync --dry-run
```

### Logs

ShelfBridge provides detailed logging:
- Progress updates
- Book matching results
- API errors
- Cache operations

## 🛠️ Development

### Setup

```bash
# Install dependencies
npm install

# Development mode with auto-restart
npm run dev

# Run tests
npm test

# Lint code
npm run lint
```

### Project Structure

```
ShelfBridge/
├── src/
│   ├── main.js              # CLI entry point
│   ├── sync-manager.js      # Core sync logic
│   ├── audiobookshelf-client.js  # ABS API client
│   ├── hardcover-client.js  # Hardcover API client
│   ├── book-cache.js        # SQLite cache management
│   ├── config.js            # Configuration loader
│   └── utils.js             # Utility functions
├── config/
│   ├── config.yaml.example  # Configuration template
│   └── config.yaml          # Your configuration (ignored by git)
├── data/                    # Cache and data files (ignored by git)
├── docker-compose.yml       # Docker Compose configuration
├── Dockerfile              # Docker image definition
└── package.json            # Dependencies and scripts
```

### API Integration

ShelfBridge integrates with:

- **Audiobookshelf API**: Fetches reading progress and book metadata
- **Hardcover GraphQL API**: Updates reading progress and completion status

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is open source. See the LICENSE file for details.

## 🤝 Support

- **Issues**: Report bugs and feature requests on GitHub
- **Documentation**: Check this README and inline code comments
- **Community**: Join discussions in the GitHub repository

---

**Happy syncing! 📚✨** 