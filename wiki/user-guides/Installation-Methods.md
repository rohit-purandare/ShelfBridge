# 🚀 Installation Methods

ShelfBridge can be installed using several different methods. Choose the one that best fits your environment and experience level.

## 🎯 Which Method Should I Choose?

| Method | Best For | Difficulty | Updates | Isolation |
|--------|----------|------------|---------|-----------|
| **Docker Compose** | Most users, home servers | Easy | Automatic | Excellent |
| **Manual Docker** | Custom deployments, advanced users | Medium | Manual | Excellent |
| **Node.js Direct** | Developers, custom integrations | Medium | Manual | None |
| **From Source** | Contributors, bleeding edge | Hard | Manual | None |

## 🐳 Docker Methods (Recommended)

### 1. Docker Compose (Easiest)

**Perfect for:**
- Home server deployments
- NAS systems (Synology, QNAP, etc.)
- Users who want "set and forget" operation

**Advantages:**
- Zero-configuration setup
- Automatic container management
- Easy updates
- Named volumes for data persistence

**Get Started:**
- [Docker Setup Guide](Docker-Setup.md) - Complete Docker installation
- [Quick Start Guide](Quick-Start.md) - Get running in 5 minutes

### 2. Manual Docker

**Perfect for:**
- Custom container orchestration
- Kubernetes deployments
- Advanced Docker users

**Advantages:**
- Full control over container configuration
- Custom network setups
- Integration with existing container stacks

**Get Started:**
See the [Docker Setup Guide](Docker-Setup.md) for manual Docker commands and configurations.

## 📦 Node.js Methods

### 3. Node.js Direct Installation

**Perfect for:**
- Development environments
- Custom integrations
- Users who prefer direct control

**Advantages:**
- Direct access to source code
- Easy debugging and customization
- No containerization overhead

**Get Started:**
- [Node.js Setup Guide](Node-Setup.md) - Complete Node.js installation
- [Prerequisites](Prerequisites.md) - System requirements

### 4. From Source (Advanced)

**Perfect for:**
- Contributors and developers
- Testing unreleased features
- Custom modifications

**Advantages:**
- Latest development code
- Ability to modify source
- Full development environment

**Get Started:**
- [Contributing Guide](../developer/Contributing.md) - Development setup
- [Development Setup](../developer/Development-Setup.md) - Detailed dev environment

## 🖥️ Platform-Specific Considerations

### Linux
- **Docker**: Native support, excellent performance
- **Node.js**: Direct installation recommended
- **Package managers**: Use system package manager for Node.js

### macOS
- **Docker Desktop**: Easy installation and management
- **Node.js**: Install via Homebrew or official installer
- **Apple Silicon**: Both Docker and Node.js have native ARM64 support

### Windows
- **Docker Desktop**: Recommended for Windows 10/11
- **WSL2**: Excellent for Linux-like experience
- **Node.js**: Official Windows installer available

### NAS Systems (Synology, QNAP, etc.)
- **Docker**: Usually the best option
- **Check compatibility**: Ensure your NAS supports Docker
- **ARM processors**: Use ARM64 Docker images

## 🏗️ Infrastructure Considerations

### Home Server
- **Docker Compose**: Ideal for most home servers
- **Portainer**: Consider for Docker management UI
- **Reverse proxy**: Integrate with existing proxy setup

### Cloud Deployment
- **Docker**: Works on all major cloud platforms
- **Container services**: AWS ECS, Google Cloud Run, Azure Container Instances
- **Serverless**: Consider for scheduled sync operations

### Corporate Environment
- **Security**: Review Docker security policies
- **Proxy**: Configure for corporate proxy servers
- **Compliance**: Ensure meets corporate software policies

## 🔄 Migration Between Methods

### Docker Compose → Manual Docker
1. Export volumes: `docker-compose down && docker volume ls`
2. Note volume paths and configurations
3. Use manual Docker run with same volumes

### Node.js → Docker
1. Backup configuration: `cp config/config.yaml config.backup`
2. Export cache: `node src/main.js cache --export backup.json`
3. Set up Docker with same configuration
4. Import cache if needed

### Docker → Node.js
1. Extract config: `docker exec container cat /app/config/config.yaml`
2. Extract cache: `docker exec container node src/main.js cache --export`
3. Set up Node.js environment
4. Import configuration and cache

## 🛠️ Next Steps

Once you've chosen your installation method:

1. **Review Prerequisites**: [Prerequisites Guide](Prerequisites.md)
2. **Follow Installation Guide**: Method-specific setup instructions
3. **Configure ShelfBridge**: [Configuration Overview](../admin/Configuration-Overview.md)
4. **Test Your Setup**: [First Sync Guide](First-Sync.md)

## 🆘 Need Help?

- **Installation Issues**: [Troubleshooting Guide](../troubleshooting/Troubleshooting-Guide.md)
- **Configuration Help**: [Configuration Overview](../admin/Configuration-Overview.md)
- **General Questions**: [FAQ](../troubleshooting/FAQ.md)

---

**Ready to install?** Choose your method and follow the corresponding guide! 