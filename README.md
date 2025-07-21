# ShelfBridge

Sync your audiobook reading progress from Audiobookshelf to Hardcover automatically.

## 🚀 Quick Start

### Docker (Recommended)

**Option 1: Environment Variables (Basic Setup)**
```bash
# Download docker-compose.yml
curl -O https://raw.githubusercontent.com/rohit-purandare/ShelfBridge/main/docker-compose.yml

# Edit docker-compose.yml and uncomment/set your environment variables:
# SHELFBRIDGE_USER_0_ID: "your_username"
# SHELFBRIDGE_USER_0_ABS_URL: "https://your-audiobookshelf-server.com"
# SHELFBRIDGE_USER_0_ABS_TOKEN: "your_abs_token"
# SHELFBRIDGE_USER_0_HARDCOVER_TOKEN: "your_hardcover_token"

# Start the container
docker-compose up -d
```

**Option 2: YAML Configuration (Basic + Advanced Features)**
```bash
# Download and start
curl -O https://raw.githubusercontent.com/rohit-purandare/ShelfBridge/main/docker-compose.yml
docker-compose up -d

# Configure your settings in config.yaml
# Edit the config/config.yaml file with your credentials and advanced settings
# Restart the container:
docker-compose up -d
```

### Node.js
```bash
# Clone and install
git clone https://github.com/rohit-purandare/ShelfBridge.git
cd ShelfBridge && npm install

# Configure and start
cp config/config.yaml.example config/config.yaml
# Edit config/config.yaml with your tokens
node src/main.js start
```

## ⚙️ Configuration Options

ShelfBridge supports two configuration methods to fit different deployment needs:

### 🔧 **Environment Variables** (Basic Configuration)
Perfect for Docker deployments, container environments, and simple setups.

**✅ Supports:**
- User credentials (tokens, URLs)
- Core sync settings (workers, scheduling, thresholds)
- Rate limiting and performance tuning
- Safety settings (dry-run, progress protection)

**Example:**
```bash
SHELFBRIDGE_USER_0_ID=alice
SHELFBRIDGE_USER_0_ABS_URL=https://abs.example.com
SHELFBRIDGE_USER_0_ABS_TOKEN=your_abs_token
SHELFBRIDGE_USER_0_HARDCOVER_TOKEN=your_hardcover_token
SHELFBRIDGE_MIN_PROGRESS_THRESHOLD=5.0
SHELFBRIDGE_AUTO_ADD_BOOKS=true
```

### 📄 **YAML Configuration** (Basic + Advanced Features)
Required for advanced features and complex multi-user setups.

**✅ Everything from Environment Variables, plus:**
- **Library filtering** - Include/exclude specific libraries
- **Title/Author matching** - Intelligent fuzzy matching for books without ASIN/ISBN
- **Reread detection** - Advanced progress regression protection
- **Multi-user advanced setups** - Different settings per user
- **Complex family configurations** - User-specific library preferences

**Example:**
```yaml
global:
  min_progress_threshold: 5.0
  auto_add_books: true
  libraries:
    exclude: ["Podcasts", "Samples"]  # ← Not possible with env vars

users:
  - id: alice
    abs_url: https://abs.example.com
    abs_token: your_abs_token
    hardcover_token: your_hardcover_token
    libraries:
      include: ["Audiobooks", "Fiction"]  # ← Advanced per-user filtering
```

### 🎯 **Which Should You Use?**

| Use Case | Recommendation | Why |
|----------|---------------|-----|
| **Basic Docker setup** | Environment Variables | Simple, container-friendly |
| **Single user, no filtering** | Environment Variables | Fastest to configure |
| **Homelab/NAS deployment** | Environment Variables | Easy container management |
| **Need library filtering** | YAML Configuration | Arrays not supported in env vars |
| **Multi-user with different libraries** | YAML Configuration | Complex per-user settings |
| **Family setup** | YAML Configuration | Advanced user management |

> 💡 **Hybrid Approach:** You can use both! Set basic credentials via environment variables and advanced features via YAML.

## 📖 Documentation

### 🚀 **Getting Started**
- **[Quick Start Guide](wiki/user-guides/Quick-Start.md)** - Get running in 5 minutes
- **[Installation Methods](wiki/user-guides/Installation-Methods.md)** - Choose your setup method
- **[Docker Setup](wiki/user-guides/Docker-Setup.md)** - Container deployment guide

### ⚙️ **Configuration**
- **[Configuration Guide](wiki/admin/Configuration-Guide.md)** - Setup guide for YAML & environment variables
- **[Configuration Reference](wiki/admin/Configuration-Reference.md)** - Complete technical reference for all settings

### 🔧 **Usage & Commands**
- **[CLI Reference](wiki/technical/CLI-Reference.md)** - Command-line interface guide
- **[Feature Overview](wiki/user-guides/Feature-Overview.md)** - All available features

## 🔄 Recent Changes

**v1.14.0**: Added **environment variable configuration support**! Perfect for Docker deployments and homelab setups. Configure basic settings without YAML files. Environment variables provide ~85% feature parity with YAML configuration. Advanced features like library filtering still require YAML.

**v1.13.0**: Added multi-library filtering support! Now you can include/exclude specific Audiobookshelf libraries by name or ID. Configure globally or per-user to sync only the libraries you want. Enhanced debug command shows available libraries for easy configuration.

**v1.12.4**: Comprehensive CLI interface, multi-user support, and advanced configuration options. Use `node src/main.js <command>` for direct access, or `node src/main.js interactive` for menu-driven mode.

## 📋 Features

- ✅ **Flexible configuration** - Environment variables for simple setups, YAML for advanced features
- ✅ **Automatic sync** - Scheduled synchronization between services
- ✅ **Multi-user support** - Sync multiple users from one server
- ✅ **Library filtering** - Sync specific libraries or exclude unwanted ones
- ✅ **Progress protection** - Prevent accidental progress regression
- ✅ **Smart matching** - Advanced 3-tier matching: ASIN → ISBN → Title/Author with intelligent fuzzy matching
- ✅ **Docker support** - Easy deployment with containers
- ✅ **Comprehensive logging** - Detailed sync reports and error tracking

## 🤝 Contributing

See [Contributing Guide](wiki/developer/Contributing.md) for development setup and guidelines.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details. 