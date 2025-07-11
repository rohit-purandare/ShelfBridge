# ShelfBridge

ShelfBridge automatically syncs your reading progress and completion status between your [Audiobookshelf](https://www.audiobookshelf.org/) server and [Hardcover](https://hardcover.app/) account. It intelligently matches books using ASIN (Amazon's book identifier for audiobooks) and ISBN (standard book identifier for print/ebooks) to ensure accurate synchronization.

## ✨ Features

- 📚 **Smart Book Matching**: Matches books by ASIN (audiobooks) and falls back to ISBN (print/ebooks)
- 🔄 **Automatic Sync**: Runs on a schedule or on-demand
- 🎯 **Completion Detection**: Uses Audiobookshelf's completion flag and progress percentage
- 🛡️ **Progress Regression Protection**: Prevents accidental overwriting of completion status
- 🔄 **Re-reading Detection**: Automatically creates new reading sessions for re-reads
- ➕ **Smart Auto-Add**: Intelligently adds books to Hardcover based on reading progress
- 💾 **Intelligent Caching**: SQLite cache for efficient syncing and performance
- 👥 **Multi-User Support**: Sync multiple users in one run
- 🐳 **Docker Ready**: Production-ready Docker image with health checks
- 🛡️ **Secure**: No secrets in images, no data sent to third parties

## 📚 Documentation

For comprehensive setup guides, configuration options, troubleshooting, and more, visit our **[📖 Wiki Documentation](wiki/Home.md)**.

## 🚀 Quick Start with Docker Compose

**Perfect for most users** who want a hassle-free, production-ready setup with automatic updates and easy management.

### Zero-Setup Docker Compose

ShelfBridge uses named volumes for truly zero-setup deployment - no cloning required!

1. **Download and Run:**
   ```bash
   # Create a directory for ShelfBridge
   mkdir shelfbridge && cd shelfbridge
   
   # Download the compose file
   curl -O https://raw.githubusercontent.com/rohit-purandare/ShelfBridge/main/docker-compose.yml
   
   # Start the service
   docker-compose up -d
   ```

2. **Edit your configuration:**
   ```bash
   # Access the auto-created config in the Docker volume
   docker exec -it shelfbridge nano /app/config/config.yaml
   ```

3. **View logs and verify:**
   ```bash
   # Check if everything is working
   docker-compose logs -f shelfbridge
   ```

### What Happens Automatically

When you run `docker-compose up -d`, the container automatically:

- ✅ **Creates volumes**: Docker manages `shelfbridge-config` and `shelfbridge-data` volumes
- ✅ **Provides template**: `config.yaml.example` is copied to the config volume
- ✅ **Creates config**: `config.yaml` is auto-created from the template with placeholder values
- ✅ **Intelligent validation**: Container detects placeholder values and guides you through setup
- ✅ **Ready to edit**: Edit config using `docker exec` - restart container if needed with `docker-compose restart`

**Truly zero-setup!** No local directories or files needed.

### Available Images

Pre-built images are available from GitHub Container Registry:

- `ghcr.io/rohit-purandare/shelfbridge:latest` - Latest stable build from main branch
- `ghcr.io/rohit-purandare/shelfbridge:main` - Development build from main branch
- Version tags (e.g., `v1.0.0`) - Available only if semantic version releases have been published

**Platforms:** Supports both `linux/amd64` and `linux/arm64` (Intel/AMD and ARM processors including Apple Silicon and Raspberry Pi).

## 📖 Need More Help?

Visit our **[📚 Complete Documentation Wiki](wiki/Home.md)** for:

- **[🚀 Quick Start Guide](wiki/user-guides/Quick-Start.md)** - 5-minute setup for any deployment method
- **[📋 Prerequisites](wiki/user-guides/Prerequisites.md)** - API tokens and requirements  
- **[🐳 Docker Setup](wiki/user-guides/Docker-Setup.md)** - Comprehensive Docker deployment guide
- **[⚙️ Configuration](wiki/admin/Configuration-Overview.md)** - Complete configuration reference
- **[🖥️ CLI Reference](wiki/technical/CLI-Reference.md)** - All commands and options
- **[🔧 Troubleshooting](wiki/troubleshooting/Troubleshooting-Guide.md)** - Common issues and solutions
- **[❓ FAQ](wiki/troubleshooting/FAQ.md)** - Frequently asked questions
- **[🏗️ Architecture](wiki/technical/Architecture-Overview.md)** - Technical deep-dive
- **[🤝 Contributing](wiki/developer/Contributing.md)** - Development and contribution guide

## 🤝 Support

- **Issues**: Report bugs and feature requests on [GitHub Issues](https://github.com/rohit-purandare/ShelfBridge/issues)
- **Documentation**: Check our [Wiki](wiki/Home.md) and inline code comments
- **Community**: Join discussions in the [GitHub repository](https://github.com/rohit-purandare/ShelfBridge)

---

**Happy syncing! 📚✨** 