# ShelfBridge

Sync your audiobook reading progress from Audiobookshelf to Hardcover automatically.

## 🚀 Quick Start

### Docker (Recommended)
```bash
# Download and start
curl -O https://raw.githubusercontent.com/rohit-purandare/ShelfBridge/main/docker-compose.yml
docker-compose up -d

# Configure your settings
# Edit the config/config.yaml file on your host machine using your preferred text editor (e.g., VS Code, nano, vim, Notepad).
# Once you have updated and saved the configuration, (re)start the container:
docker-compose up -d

> **Note:** The container will exit if the config file is missing or invalid. Always edit the config file on your host, not inside the container.
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

## 📖 Documentation

- **[Quick Start Guide](wiki/user-guides/Quick-Start.md)** - Get running in 5 minutes
- **[Installation Methods](wiki/user-guides/Installation-Methods.md)** - Choose your setup method
- **[Configuration Guide](wiki/admin/Configuration-Overview.md)** - All configuration options
- **[CLI Reference](wiki/technical/CLI-Reference.md)** - Command-line interface guide

## 🔄 Recent Changes

**v1.5.3**: Improved CLI interface with clean output and `--verbose` option. Use `node src/main.js <command>` for direct access, or `node src/main.js interactive` for menu-driven mode.

## 📋 Features

- ✅ **Automatic sync** - Scheduled synchronization between services
- ✅ **Multi-user support** - Sync multiple users from one server
- ✅ **Progress protection** - Prevent accidental progress regression
- ✅ **Smart matching** - Match books using ISBN/ASIN identifiers
- ✅ **Docker support** - Easy deployment with containers
- ✅ **Comprehensive logging** - Detailed sync reports and error tracking

## ⚡ Performance & Debugging

ShelfBridge includes specialized tools for performance analysis and optimization:

- **[Performance Timing Profiler](tools/)** - Analyze sync performance and identify bottlenecks
- **HTTP Keep-Alive Optimization** - Improved connection reuse for faster API calls
- **Performance Testing Tools** - Validate and measure optimization improvements

For detailed usage, see the [Performance Tools Documentation](tools/README.md).

## 🤝 Contributing

See [Contributing Guide](wiki/developer/Contributing.md) for development setup and guidelines.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details. 