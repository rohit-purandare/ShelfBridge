# 🐳 Docker Setup Guide

This comprehensive guide covers all Docker deployment options for ShelfBridge. Docker is the recommended installation method for most users as it provides easy setup, automatic updates, and isolated environments.

## 🎯 Why Choose Docker?

**Benefits:**

- ✅ **No Node.js installation required**
- ✅ **Optimized image size** (~530MB with Alpine Linux and multi-stage builds)
- ✅ **Automatic container management**
- ✅ **Easy updates and rollbacks**
- ✅ **Isolated environment**
- ✅ **Cross-platform support**
- ✅ **Built-in health checks**

**Ideal for:**

- Home server setups
- NAS deployments (Synology, QNAP, etc.)
- Cloud deployments
- Production environments

## 📋 Prerequisites

### Required Software

- **Docker**: Version 20.10.0 or higher
- **Docker Compose**: Version 1.28.0 or higher (or Docker Desktop)

### Check Your Installation

```bash
# Verify Docker installation
docker --version
docker-compose --version

# Test Docker is working
docker run hello-world
```

### Required Information

- **Audiobookshelf server URL** and **API token**
- **Hardcover API token**
- See [Prerequisites](Prerequisites.md) for detailed token setup

## 🚀 Quick Start (Recommended)

### Zero-Setup Docker Compose

ShelfBridge uses named volumes for truly zero-setup deployment:

```bash
# Create a directory for ShelfBridge
mkdir shelfbridge && cd shelfbridge

# Download docker-compose.yml
curl -O https://raw.githubusercontent.com/rohit-purandare/ShelfBridge/main/docker-compose.yml

# Start the service
docker-compose up -d

# Edit configuration
# Edit the config/config.yaml file on your host machine using your preferred text editor (e.g., VS Code, nano, vim, Notepad).
# Once you have updated and saved the configuration, (re)start the container:
docker-compose up -d

> **Note:** The container will exit if the config file is missing or invalid. Always edit the config file on your host, not inside the container.

# Restart to apply config
docker-compose restart
```

**That's it!** ShelfBridge is now running with automatic scheduling.

## 📦 Available Docker Images

### GitHub Container Registry (Recommended)

Pre-built multi-architecture images are available:

| Tag                                          | Description              | Use Case   |
| -------------------------------------------- | ------------------------ | ---------- |
| `ghcr.io/rohit-purandare/shelfbridge:latest` | Latest stable release    | Production |
| `ghcr.io/rohit-purandare/shelfbridge:main`   | Latest development build | Testing    |

**Platforms Supported:**

- `linux/amd64` - Intel/AMD processors
- `linux/arm64` - ARM processors (Apple Silicon, Raspberry Pi, etc.)

### Verify Image Availability

```bash
# Check available tags
docker search shelfbridge

# Pull specific version
docker pull ghcr.io/rohit-purandare/shelfbridge:latest
```

## ⚙️ Docker Compose Setup (Recommended)

### Option 1: Download and Run (Easiest)

**Step 1: Download Configuration**

```bash
# Create project directory
mkdir shelfbridge && cd shelfbridge

# Download docker-compose.yml
curl -O https://raw.githubusercontent.com/rohit-purandare/ShelfBridge/main/docker-compose.yml
```

**Step 2: Start Container**

```bash
# Start in background
docker-compose up -d

# Check status
docker-compose ps
```

**Step 3: Configure**

````bash
# Edit configuration (auto-created from template)
# Edit the config/config.yaml file on your host machine using your preferred text editor (e.g., VS Code, nano, vim, Notepad).
# Once you have updated and saved the configuration, (re)start the container:
docker-compose up -d

> **Note:** The container will exit if the config file is missing or invalid. Always edit the config file on your host, not inside the container.

Replace placeholder values:
```yaml
global:
  min_progress_threshold: 5.0
  auto_add_books: false

users:
  - id: your_username
    abs_url: https://your-audiobookshelf-server.com
    abs_token: your_actual_audiobookshelf_token
    hardcover_token: your_actual_hardcover_token
````

**Step 4: Restart and Verify**

```bash
# Restart to apply configuration
docker-compose restart

# Check logs
docker-compose logs -f shelfbridge

# Test configuration
docker exec -it shelfbridge node src/main.js validate
```

### Option 2: Clone Repository (For Development)

```bash
# Clone repository
git clone https://github.com/rohit-purandare/ShelfBridge.git
cd ShelfBridge

# Optional: Build locally instead of using pre-built image
# Edit docker-compose.yml - comment 'image:' line, uncomment 'build: .'

# Start service
docker-compose up -d
```

### Docker Compose Configuration

**Default `docker-compose.yml` explained:**

```yaml
version: '3.8'

services:
  shelfbridge:
    image: ghcr.io/rohit-purandare/shelfbridge:latest
    container_name: shelfbridge
    restart: unless-stopped # Auto-restart on failure
    # Note: No user specification needed - container runs as 'node' user (UID 1000) by default
    volumes:
      - shelfbridge-config:/app/config # Configuration persistence
      - shelfbridge-data:/app/data # Cache persistence
    command: ['npm', 'start'] # Background service mode
    healthcheck: # Container health monitoring
      test: ['CMD', 'node', 'src/main.js', 'config', '--help']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

volumes:
  shelfbridge-config: # Named volume for config
  shelfbridge-data: # Named volume for data/cache
```

## 🔧 Manual Docker Run

For users who prefer direct Docker commands or need custom configurations:

### Option A: Named Volumes (Recommended)

```bash
# Create named volumes
docker volume create shelfbridge-config
docker volume create shelfbridge-data

# Run container
docker run -d \
  --name shelfbridge \
  --restart unless-stopped \
  -v shelfbridge-config:/app/config \
  -v shelfbridge-data:/app/data \
  ghcr.io/rohit-purandare/shelfbridge:latest

# Configure
# Edit the config/config.yaml file on your host machine using your preferred text editor (e.g., VS Code, nano, vim, Notepad).
# Once you have updated and saved the configuration, (re)start the container:
docker-compose up -d

> **Note:** The container will exit if the config file is missing or invalid. Always edit the config file on your host, not inside the container.

# Restart to apply config
docker restart shelfbridge
```

### Option B: Bind Mounts (Local Development)

```bash
# Create local directories
mkdir -p config data

# Run with bind mounts
docker run -d \
  --name shelfbridge \
  --restart unless-stopped \
  -v $(pwd)/config:/app/config \
  -v $(pwd)/data:/app/data \
  ghcr.io/rohit-purandare/shelfbridge:latest

# Edit local config file
nano config/config.yaml
```

### Option C: Custom Configuration

```bash
# Advanced Docker run with custom settings
docker run -d \
  --name shelfbridge \
  --restart unless-stopped \
  --memory 512m \
  --cpus 1.0 \
  -v shelfbridge-config:/app/config \
  -v shelfbridge-data:/app/data \
  -e TZ=America/New_York \
  --health-cmd="node src/main.js config --help" \
  --health-interval=30s \
  --health-timeout=10s \
  --health-retries=3 \
  ghcr.io/rohit-purandare/shelfbridge:latest
```

## 🏗️ Building from Source

### Build Local Image

```bash
# Clone repository
git clone https://github.com/rohit-purandare/ShelfBridge.git
cd ShelfBridge

# Build image
docker build -t shelfbridge .

# Run your custom build
docker run -d \
  --name shelfbridge \
  -v shelfbridge-config:/app/config \
  -v shelfbridge-data:/app/data \
  shelfbridge
```

### Multi-Architecture Build

```bash
# Create builder (if not exists)
docker buildx create --name mybuilder --use

# Build for multiple platforms
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t shelfbridge:custom \
  --push .
```

## 📁 Volume Management

### Understanding Volumes

**Named Volumes (Recommended):**

- Managed by Docker
- Persist across container updates
- Easy backup and restore
- Cross-platform compatible

**Bind Mounts:**

- Direct access to host filesystem
- Easier for development
- Platform-specific paths

### Volume Operations

```bash
# List volumes
docker volume ls

# Inspect volume details
docker volume inspect shelfbridge-config

# Backup volume
docker run --rm \
  -v shelfbridge-config:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/config-backup.tar.gz -C /data .

# Restore volume
docker run --rm \
  -v shelfbridge-config:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/config-backup.tar.gz -C /data
```

### Configuration File Access

```bash
# Edit config file
# Edit the config/config.yaml file on your host machine using your preferred text editor (e.g., VS Code, nano, vim, Notepad).
# Once you have updated and saved the configuration, (re)start the container:
docker-compose up -d

> **Note:** The container will exit if the config file is missing or invalid. Always edit the config file on your host, not inside the container.

# View current config
docker exec -it shelfbridge cat /app/config/config.yaml

# Copy config to host (for easier editing)
docker cp shelfbridge:/app/config/config.yaml ./config.yaml
# Edit locally, then copy back:
docker cp ./config.yaml shelfbridge:/app/config/config.yaml
```

## 📊 Monitoring and Logs

### Viewing Logs

```bash
# View all logs
docker-compose logs shelfbridge

# Follow logs in real-time
docker-compose logs -f shelfbridge

# View last 100 lines
docker-compose logs --tail=100 shelfbridge

# View logs since specific time
docker-compose logs --since="1h" shelfbridge
```

### Health Checks

```bash
# Check container health
docker inspect shelfbridge | grep -A 10 "Health"

# View health check logs
docker inspect shelfbridge | grep -A 20 "Health"

# Manual health check
docker exec -it shelfbridge node src/main.js config --help
```

### Container Stats

```bash
# Real-time stats
docker stats shelfbridge

# Container information
docker inspect shelfbridge

# Process list inside container
docker exec -it shelfbridge ps aux
```

## 🔄 Updates and Maintenance

### Updating ShelfBridge

**Using Docker Compose:**

```bash
# Pull latest image
docker-compose pull

# Restart with new image
docker-compose up -d

# Verify update
docker-compose logs shelfbridge
```

**Manual Docker:**

```bash
# Stop container
docker stop shelfbridge

# Remove old container (keeps volumes)
docker rm shelfbridge

# Pull latest image
docker pull ghcr.io/rohit-purandare/shelfbridge:latest

# Run new container (same volumes)
docker run -d \
  --name shelfbridge \
  --restart unless-stopped \
  -v shelfbridge-config:/app/config \
  -v shelfbridge-data:/app/data \
  ghcr.io/rohit-purandare/shelfbridge:latest
```

### Backup Strategy

**Configuration Backup:**

```bash
# Export configuration
docker exec -it shelfbridge cat /app/config/config.yaml > config-backup.yaml
```

**Cache Backup:**

```bash
# Export cache to JSON
docker exec -it shelfbridge node src/main.js cache --export /app/data/cache-backup.json

# Copy to host
docker cp shelfbridge:/app/data/cache-backup.json ./
```

**Full Volume Backup:**

```bash
# Backup all volumes
docker run --rm \
  -v shelfbridge-config:/config \
  -v shelfbridge-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/shelfbridge-full-backup.tar.gz /config /data
```

## 🛠️ Troubleshooting Docker Issues

### Container Won't Start

**Check logs:**

```bash
docker-compose logs shelfbridge
```

**Common issues:**

- **Configuration errors**: Invalid YAML syntax
- **Permission issues**: User/group ownership problems
- **Port conflicts**: Another service using same port
- **Volume issues**: Mounting problems

**Solutions:**

```bash
# Check container status
docker-compose ps

# Restart container
docker-compose restart shelfbridge

# Rebuild and restart
docker-compose up -d --force-recreate
```

### Permission Issues

**Common Error:** `permission denied when docker tries to copy the example file`

**Note:** This issue has been automatically resolved in recent versions of ShelfBridge. The container now automatically fixes volume permissions on startup.

**If you're still experiencing this issue:**

**Quick Fix:**

```bash
# Update to latest version
docker-compose pull
docker-compose up -d
```

**If that doesn't work:**

```bash
# Manual fix for legacy versions
docker exec -u root -it shelfbridge chown -R node:node /app/config /app/data
docker-compose restart shelfbridge
```

**Last resort:**

```bash
# Check current permissions
docker exec -it shelfbridge ls -la /app/config/

# Recreate volumes (WARNING: deletes your config)
docker-compose down
docker volume rm shelfbridge-config shelfbridge-data
docker-compose up -d
```

**For detailed solutions:** See [Troubleshooting Guide](../troubleshooting/Troubleshooting-Guide.md#permission-issues)

### Configuration Issues

```bash
# Validate configuration
docker exec -it shelfbridge node src/main.js validate

# Reset to template
docker exec -it shelfbridge cp /app/config/config.yaml.example /app/config/config.yaml
```

### Network Issues

```bash
# Test network connectivity from container
docker exec -it shelfbridge curl -I https://api.hardcover.app/v1/graphql

# Check container networking
docker network ls
docker inspect shelfbridge
```

## 🔗 NAS Deployment

### Synology NAS

1. **Install Docker** via Package Center
2. **Open Docker app**
3. **Registry** → Search "shelfbridge" → Download
4. **Container** → Create → Use advanced settings
5. **Volume** → Add folders for config and data
6. **Environment** → Set timezone if needed
7. **Start container**

### QNAP NAS

1. **Install Container Station**
2. **Create Application** → Docker Compose
3. **Paste Docker Compose configuration**
4. **Adjust volume paths** for QNAP filesystem
5. **Deploy**

### Unraid

1. **Apps** → Search "shelfbridge"
2. **Install** (or add custom template)
3. **Configure paths** for Unraid shares
4. **Set schedule** if desired
5. **Start**

## 🔗 Related Pages

- **[Prerequisites](Prerequisites.md)** - Getting API tokens and requirements
- **[Quick Start Guide](Quick-Start.md)** - Fastest way to get running
- **[Configuration Overview](../admin/Configuration-Reference.md)** - Understanding config options
- **[Troubleshooting Guide](../troubleshooting/Troubleshooting-Guide.md)** - Solving common problems

## 💡 Docker Best Practices

### Security

- **Run as non-root**: Container runs as `node` user (UID 1000) by default
- **Read-only filesystem**: Add `read_only: true` with tmpfs for writable areas
- **Resource limits**: Set memory and CPU limits
- **Keep updated**: Regularly update base images

### Performance

- **Optimized Docker builds**: Multi-stage builds with Alpine Linux base for better compatibility (~530MB)
- **Build cache efficiency**: BuildKit cache mounts speed up CI/CD builds
- **Use named volumes**: Better performance than bind mounts
- **Appropriate resources**: Don't over-allocate memory/CPU
- **Health checks**: Monitor container health

### Maintenance

- **Regular updates**: Keep ShelfBridge and Docker updated
- **Monitor logs**: Check for errors regularly
- **Backup volumes**: Regular configuration and cache backups
- **Test restores**: Verify your backup strategy works

---

**Next Steps:** Configure ShelfBridge with your [API tokens](Prerequisites.md) and run your [first sync](First-Sync.md)!
