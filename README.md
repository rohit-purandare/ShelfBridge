# ShelfBridge

ShelfBridge automatically syncs your reading progress and completion status between your [Audiobookshelf](https://www.audiobookshelf.org/) server and [Hardcover](https://hardcover.app/) account. It intelligently matches books using ASIN (Amazon's book identifier for audiobooks) and ISBN (standard book identifier for print/ebooks) to ensure accurate synchronization.

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

## 🔧 Before You Begin

You'll need active accounts and API access for both services:

### Audiobookshelf Requirements
- **Account Type**: Admin account OR user account with library access
- **Server Access**: Your Audiobookshelf server URL
- **API Token**: Generated from Settings > Users > [Your User] > API Token

### Hardcover Requirements  
- **Account**: Free Hardcover account
- **API Token**: Get from https://hardcover.app/account/developer
- **Developer Access**: Enable API access in your account settings

### System Requirements
- **Node.js**: 18.0.0 or higher (check with `node --version`)
- **Operating System**: Linux, macOS, or Windows

## 🚀 Setup Instructions

Choose the setup method that best fits your needs:

### 🐳 Method 1: Docker Compose (Recommended)

**When to use:** Perfect for most users who want a hassle-free, production-ready setup with automatic updates and easy management.

**Benefits:** 
- No Node.js installation required
- Automatic container management
- Easy updates and rollbacks
- Isolated environment

#### Option A: Pre-built Image (Easiest)

1. **Start the service:**
   ```bash
   # Clone the repository for the docker-compose.yml file
   git clone https://github.com/rohit-purandare/ShelfBridge.git
   cd ShelfBridge
   
   # This pulls the latest image and starts the container
   docker-compose up -d
   ```

2. **Set up your configuration:**
   ```bash
   # Copy the example configuration
   cp config/config.yaml.example config/config.yaml
   
   # Edit with your actual credentials
   nano config/config.yaml
   
   # Restart to use your config
   docker-compose restart
   ```

3. **View logs and verify:**
   ```bash
   # Check if everything is working
   docker-compose logs -f shelfbridge
   ```

#### Option B: Build from Source

For development or customization:

```bash
# Edit docker-compose.yml to build locally instead of pulling image
# Comment out the 'image:' line and uncomment the 'build: .' line
# Then run:
docker-compose up -d
```

---

### 📦 Method 2: npm/Node.js Setup

**When to use:** Best for developers, contributors, or users who prefer direct Node.js control and want to run custom modifications.

**Requirements:** Node.js 18.0.0 or higher

#### 1. Installation

```bash
# Clone the repository
git clone https://github.com/rohit-purandare/ShelfBridge.git
cd ShelfBridge

# Install dependencies
npm install
```

#### 2. Configuration Setup

```bash
# Create necessary directories
mkdir -p config data

# Copy the configuration template
cp config/config.yaml.example config/config.yaml

# Edit with your credentials
nano config/config.yaml
```

#### 3. Configure Your Credentials

Edit `config/config.yaml` with your actual API tokens:

```yaml
global:
  min_progress_threshold: 5.0
  parallel: true
  workers: 3
  dry_run: false
  sync_schedule: "0 3 * * *"  # Every day at 3am
  timezone: "Etc/UTC"

users:
  - id: your_username  # Replace with your preferred identifier
    abs_url: https://your-audiobookshelf-server.com  # Your Audiobookshelf URL
    abs_token: your_audiobookshelf_api_token_here     # From ABS Settings > Users > API Token
    hardcover_token: your_hardcover_api_token_here    # From hardcover.app/account/developer
```

#### 4. Test Your Setup

Before running a full sync, verify your configuration:

```bash
# Check if your credentials work
node src/main.js debug --user your_username

# Run a dry-run to see what would be synced (no changes made)
node src/main.js sync --dry-run
```

#### 5. Run Your First Sync

```bash
# Perform the actual sync
npm run sync
```

---

### ⚙️ Method 3: Manual Docker Run

**When to use:** Advanced users who need custom Docker configurations or want granular control over container settings.

**Note:** This method requires manual configuration and maintenance.

#### Pre-built Image

```bash
# Create directories
mkdir -p config data

# Run the container
docker run -d \
  --name shelfbridge \
  -v $(pwd)/config/config.yaml:/app/config/config.yaml:ro \
  -v $(pwd)/data:/app/data \
  -e TZ=Etc/UTC \
  -e NODE_ENV=production \
  ghcr.io/rohit-purandare/shelfbridge:latest

# Copy and edit configuration
cp config/config.yaml.example config/config.yaml
nano config/config.yaml

# Restart container with your config
docker restart shelfbridge
```

#### Build from Source

```bash
# Build the image
docker build -t shelfbridge .

# Run the container
docker run -d \
  --name shelfbridge \
  -v $(pwd)/config/config.yaml:/app/config/config.yaml:ro \
  -v $(pwd)/data:/app/data \
  -e TZ=Etc/UTC \
  -e NODE_ENV=production \
  shelfbridge
```

### 🏷️ Available Images

Pre-built images are available from GitHub Container Registry:

- `ghcr.io/rohit-purandare/shelfbridge:latest` - Latest stable build from main branch
- `ghcr.io/rohit-purandare/shelfbridge:main` - Development build from main branch
- Version tags (e.g., `v1.0.0`) - Available only if semantic version releases have been published

**Note:** Check the [repository packages page](https://github.com/rohit-purandare/ShelfBridge/pkgs/container/shelfbridge) to see all currently available tags.

**Platforms:** Supports both `linux/amd64` and `linux/arm64` (Intel/AMD and ARM processors including Apple Silicon and Raspberry Pi).

---

## ✅ Verification (All Methods)

After completing setup with any method above, verify your installation:

**Expected output on successful sync:**
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

📋 DETAILED BOOK RESULTS
==================================================

1. ✅ The Seven Husbands of Evelyn Hugo
   Status: SYNCED
   Progress: 67.2%
   Identifiers: ASIN=B01LZXVS4P
   Actions:
     • Found in Hardcover library: The Seven Husbands of Evelyn Hugo
     • Progress updated to 67.2%

2. 🎯 Atomic Habits
   Status: COMPLETED
   Progress: 100.0%
   Identifiers: ISBN=9780735211292
   Actions:
     • Found in Hardcover library: Atomic Habits
     • Marked as completed (100.0%)

3. ⏭️  The Midnight Library
   Status: SKIPPED
   Progress: 45.1%
   Actions:
     • Skipping - no progress change

==================================================

🏁 Sync completed successfully!
```

## ⚙️ Configuration

### Basic Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `min_progress_threshold` | Minimum progress % to sync | 5.0 |
| `parallel` | Enable parallel processing | true |
| `workers` | Number of parallel workers | 3 |
| `dry_run` | Show what would be synced | false |
| `sync_schedule` | Cron schedule for auto-sync | "0 3 * * *" |
| `timezone` | Timezone for scheduling | "Etc/UTC" |

### Multi-User Configuration

For families or shared servers:

```yaml
users:
  - id: alice
    abs_url: https://audiobookshelf.example.com
    abs_token: alice_abs_token
    hardcover_token: alice_hardcover_token
  - id: bob
    abs_url: https://audiobookshelf.example.com  
    abs_token: bob_abs_token
    hardcover_token: bob_hardcover_token
```

### Schedule Examples

```yaml
# Every 6 hours
sync_schedule: "0 */6 * * *"

# Twice daily (9 AM and 9 PM)  
sync_schedule: "0 9,21 * * *"

# Weekly on Sundays at 3 AM
sync_schedule: "0 3 * * 0"
```

## 🖥️ Usage

### One-Time Sync Commands

```bash
# Sync all configured users (recommended for most users)
npm run sync

# Alternative direct command (same result)
node src/main.js sync

# Sync only a specific user
node src/main.js sync --user alice

# Test what would be synced without making changes
node src/main.js sync --dry-run
```

### Scheduled Background Service

For automatic syncing based on your configured schedule:

```bash
# Start the background service (runs continuously)
npm start

# This runs sync according to your sync_schedule setting
# The process will keep running until stopped with Ctrl+C
```

**Note**: Use `npm run sync` for manual/one-time syncing, use `npm start` for automatic scheduled syncing.

### Debug and Cache Management

```bash
# View raw Audiobookshelf data for troubleshooting
node src/main.js debug

# Show what's in the cache
node src/main.js cache --show

# Clear cache if you're having sync issues
node src/main.js cache --clear

# Export cache contents to JSON file
node src/main.js cache --export

# Show cache statistics
node src/main.js cache --stats
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

### Common Issues and Solutions

**"No books found"** *(occurs during first sync or config issues)*
- Check Audiobookshelf API token and URL
- Verify library permissions in Audiobookshelf
- Ensure your user has access to the libraries
- Run `node src/main.js debug --user your_username` to see raw data

**"GraphQL errors"** *(occurs when updating Hardcover, usually token/permission issues)*
- Verify Hardcover API token is correct
- Check if your Hardcover account has developer API access enabled
- Ensure book matching succeeded (ISBN/ASIN availability)
- Review Hardcover API documentation at their developer portal

**"Cache issues"** *(sync seems stuck or produces wrong results)*
- Clear cache: `node src/main.js cache --clear`
- Check file permissions on `data/` directory
- Ensure SQLite database isn't corrupted

**"Connection refused"** *(network/server issues)*
- Verify Audiobookshelf server is accessible from your network
- Check if server URLs include proper http:// or https://
- Test manual access to both services

### Debug Process

1. **Check configuration:**
   ```bash
   node src/main.js debug --user your_username
   ```

2. **Test without changes:**
   ```bash
   node src/main.js sync --dry-run --user your_username
   ```

3. **Check cache contents:**
   ```bash
   node src/main.js cache --show
   ```

4. **Clear cache if needed:**
   ```bash
   node src/main.js cache --clear
   ```

5. **Re-run with fresh cache:**
   ```bash
   node src/main.js sync --user your_username
   ```

### Logs and Output

ShelfBridge provides detailed logging for:
- Progress updates
- Book matching results  
- API errors
- Cache operations
- Network timeouts

## 🛠️ Development

### Setup for Contributors

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

- **Issues**: Report bugs and feature requests on [GitHub Issues](https://github.com/rohit-purandare/ShelfBridge/issues)
- **Documentation**: Check this README and inline code comments
- **Community**: Join discussions in the [GitHub repository](https://github.com/rohit-purandare/ShelfBridge)

---

**Happy syncing! 📚✨** 