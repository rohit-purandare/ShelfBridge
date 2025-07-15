# 📚 ShelfBridge Wiki

Welcome to the ShelfBridge documentation! ShelfBridge automatically syncs your reading progress and completion status between [Audiobookshelf](https://www.audiobookshelf.org/) and [Hardcover](https://hardcover.app/).

## 🚀 Quick Start

New to ShelfBridge? Start here:

- **[Quick Start Guide](user-guides/Quick-Start.md)** - Get up and running in 5 minutes
- **[Prerequisites](user-guides/Prerequisites.md)** - What you need before you begin
- **[Installation Methods](user-guides/Installation-Methods.md)** - Choose your preferred setup method

## 📖 User Guides

### Setup & Installation
- **[Prerequisites](user-guides/Prerequisites.md)** - System requirements and account setup
- **[Docker Setup](user-guides/Docker-Setup.md)** - Recommended installation method
- **[Node.js Setup](user-guides/Node-Setup.md)** - Direct Node.js installation
- **[Manual Docker Setup](user-guides/Manual-Docker-Setup.md)** - Advanced Docker configurations

### Basic Usage
- **[First Sync](user-guides/First-Sync.md)** - Running your first synchronization
- **[Understanding Sync Results](user-guides/Understanding-Sync-Results.md)** - Interpreting sync output
- **[Scheduling Automatic Sync](user-guides/Automatic-Sync.md)** - Set up background synchronization

## ⚙️ Configuration & Administration

### Configuration
- **[Configuration Overview](admin/Configuration-Overview.md)** - Understanding the config file
- **[Basic Configuration](admin/Basic-Configuration.md)** - Essential settings
- **[Advanced Configuration](admin/Advanced-Configuration.md)** - Power user features
- **[Multi-User Setup](admin/Multi-User-Setup.md)** - Managing multiple users

### Advanced Features
- **[Progress Regression Protection](admin/Progress-Regression-Protection.md)** - Preventing data loss during re-reads
- **[Auto-Add Books](admin/Auto-Add-Books.md)** - Automatically adding books to Hardcover
- **[Book Matching Logic](admin/Book-Matching-Logic.md)** - How ASIN/ISBN matching works
- **[Cache Management](admin/Cache-Management.md)** - Understanding and managing the cache

## 🔧 Technical Documentation

### CLI Reference
- **[Command Line Interface](technical/CLI-Reference.md)** - Complete command reference
- **[Configuration Validation](technical/Configuration-Validation.md)** - Validating your setup
- **[Debug Commands](technical/Debug-Commands.md)** - Troubleshooting tools

### Architecture & APIs
- **[Architecture Overview](technical/Architecture-Overview.md)** - How ShelfBridge works internally
- **[Pagination System](technical/Pagination-System.md)** - Configurable pagination for large libraries
- **[Rate Limiting](technical/Rate-Limiting.md)** - API rate limiting implementation
- **[Audiobookshelf API](technical/Audiobookshelf-API.md)** - Integration details
- **[Hardcover API](technical/Hardcover-API.md)** - GraphQL integration
- **[Book Caching System](technical/Book-Caching-System.md)** - SQLite cache implementation

### CI/CD & Automation
- **[GitHub Workflows](technical/GitHub-Workflows.md)** - Automated testing, security, and releases
- **[Docker Guide](technical/Docker-Guide.md)** - Docker images and deployment
- **[Environment Variables](technical/Environment-Variables.md)** - Container configuration
- **[Health Checks](technical/Health-Checks.md)** - Monitoring container health

## 🆘 Troubleshooting & FAQ

### Common Issues
- **[Troubleshooting Guide](troubleshooting/Troubleshooting-Guide.md)** - Solving common problems
- **[FAQ](troubleshooting/FAQ.md)** - Frequently asked questions
- **[Error Messages](troubleshooting/Error-Messages.md)** - Understanding error output

### Specific Issues
- **[Bearer Token Handling](troubleshooting/Bearer-Token-Handling.md)** - Automatic token normalization
- **[Connection Issues](troubleshooting/Connection-Issues.md)** - API and network problems
- **[Book Matching Issues](troubleshooting/Book-Matching-Issues.md)** - When books aren't found
- **[Progress Sync Issues](troubleshooting/Progress-Sync-Issues.md)** - Progress not updating correctly
- **[Performance Issues](troubleshooting/Performance-Issues.md)** - Slow syncs and optimization

## 👨‍💻 Developer Documentation

### Contributing
- **[Contributing Guide](developer/Contributing.md)** - How to contribute to ShelfBridge
- **[Development Setup](developer/Development-Setup.md)** - Setting up a development environment
- **[Code Structure](developer/Code-Structure.md)** - Understanding the codebase
- **[Testing](developer/Testing.md)** - Running and writing tests

### Technical Deep Dive
- **[Sync Algorithm](developer/Sync-Algorithm.md)** - How synchronization works
- **[Book Identification](developer/Book-Identification.md)** - ASIN/ISBN extraction and matching
- **[Progress Calculation](developer/Progress-Calculation.md)** - Converting between different progress formats
- **[Error Handling](developer/Error-Handling.md)** - How errors are managed and logged

## 🔗 External Resources

- **[GitHub Repository](https://github.com/rohit-purandare/ShelfBridge)** - Source code and issues
- **[Audiobookshelf Documentation](https://www.audiobookshelf.org/)** - Official Audiobookshelf docs
- **[Hardcover API Documentation](https://hardcover.app/account/developer)** - Hardcover API reference
- **[Docker Hub](https://hub.docker.com/)** - Container registry information

## 📋 Quick Reference

### Common Commands
```bash
# One-time sync
npm run sync

# Start background service
npm start

# Debug specific user
node src/main.js debug --user your_username

# Test configuration
node src/main.js validate

# Clear cache
node src/main.js cache --clear
```

### Configuration Template
```yaml
global:
  min_progress_threshold: 5.0
  auto_add_books: false
  prevent_progress_regression: true
  # Optional: Adjust for large libraries or resource-constrained devices
  # max_books_to_fetch: 250  # Optional: limit total books fetched
  # page_size: 50           # Reduce from default 100
  
users:
  - id: your_username
    abs_url: https://your-audiobookshelf-server.com
    abs_token: your_audiobookshelf_api_token
    hardcover_token: your_hardcover_api_token
```

---

**Need help?** Check the [FAQ](troubleshooting/FAQ.md) or [open an issue](https://github.com/rohit-purandare/ShelfBridge/issues) on GitHub. 