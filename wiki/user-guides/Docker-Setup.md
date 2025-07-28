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

ShelfBridge automatically creates all necessary folders and configuration files:

```bash
# Create a directory for ShelfBridge
mkdir shelfbridge && cd shelfbridge

# Download docker-compose.yml
curl -O https://raw.githubusercontent.com/rohit-purandare/ShelfBridge/main/docker-compose.yml

# Start the service - everything is created automatically!
docker-compose up -d
```

**What happens automatically:**

- ✅ **Folders created**: `config/`, `data/`, and `logs/` directories
- ✅ **Config template**: `config.yaml.example` copied for reference
- ℹ️ **Smart configuration**: Detects your preferred configuration method
- ⚠️ **Container guides you**: Shows clear instructions if configuration is missing

**Next: Choose your configuration method**

ShelfBridge will detect your configuration and guide you. You have two excellent options:

**Option 1: Environment Variables (Recommended - No File Editing!)**

```bash
# Edit docker-compose.yml and uncomment/set these variables:
# SHELFBRIDGE_USER_0_ID: "your_username"
# SHELFBRIDGE_USER_0_ABS_URL: "https://your-abs-server.com"
# SHELFBRIDGE_USER_0_ABS_TOKEN: "your_abs_token"
# SHELFBRIDGE_USER_0_HARDCOVER_TOKEN: "your_hardcover_token"

# That's it! No config file editing needed.
docker-compose up -d
```

**Option 2: YAML Configuration File (Advanced Features)**

```bash
# Create config file manually from template
docker run --rm -v shelfbridge-config:/app/config \
  ghcr.io/rohit-purandare/shelfbridge:latest \
  cp /app/config/config.yaml.example /app/config/config.yaml

# Edit via temporary container
docker run --rm -it \
  -v shelfbridge-config:/app/config \
  ghcr.io/rohit-purandare/shelfbridge:latest \
  sh -c "nano /app/config/config.yaml"

# Start your main container
docker-compose up -d
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

Choose your preferred configuration method:

**Option A: Environment Variables (Recommended)**

```bash
# Edit docker-compose.yml and uncomment these lines:
environment:
  SHELFBRIDGE_USER_0_ID: "your_username"
  SHELFBRIDGE_USER_0_ABS_URL: "https://your-abs-server.com"
  SHELFBRIDGE_USER_0_ABS_TOKEN: "your_actual_abs_token"
  SHELFBRIDGE_USER_0_HARDCOVER_TOKEN: "your_actual_hardcover_token"

# That's it! No file editing needed.
```

**Option B: YAML Configuration File (Advanced)**

```bash
# Create config file from template
docker exec -it shelfbridge cp /app/config/config.yaml.example /app/config/config.yaml

# Edit configuration file
docker exec -it shelfbridge nano /app/config/config.yaml
# Replace placeholder values with your actual credentials

# Example config.yaml:
global:
  min_progress_threshold: 5.0
  auto_add_books: false

users:
  - id: your_username
    abs_url: https://your-abs-server.com
    abs_token: your_actual_abs_token
    hardcover_token: your_actual_hardcover_token
```

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

**Default `docker-compose.yml` with flexible volume options:**

```yaml
services:
  shelfbridge:
    image: ghcr.io/rohit-purandare/shelfbridge:latest
    container_name: shelfbridge
    restart: 'no' # Prevents restart loops during config setup
    volumes:
      # Named volumes for zero-setup (DEFAULT)
      - shelfbridge-config:/app/config
      - shelfbridge-data:/app/data

      # ALTERNATIVE: Local directories for easier editing
      # Uncomment lines below and comment named volumes above
      # - ./config:/app/config
      # - ./data:/app/data
      # - ./logs:/app/logs  # Optional: access logs locally

    # Environment variables for configuration (optional)
    environment:
      NODE_ENV: 'production'
      # Uncomment and set for environment-based config:
      # SHELFBRIDGE_USER_0_ID: "your_username"
      # SHELFBRIDGE_USER_0_ABS_URL: "https://your-abs-server.com"
      # SHELFBRIDGE_USER_0_ABS_TOKEN: "your_abs_token"
      # SHELFBRIDGE_USER_0_HARDCOVER_TOKEN: "your_hardcover_token"

    command: ['npm', 'start']
    healthcheck:
      test: ['CMD', 'npm', 'run', 'test:native']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

volumes:
  shelfbridge-config:
    driver: local
  shelfbridge-data:
    driver: local
```

**Key features:**

- ✅ **Automatic setup**: All folders and config templates created automatically
- ✅ **Flexible volumes**: Easy switch between named volumes and local directories
- ✅ **Environment config**: Environment variables work perfectly without config files
- ✅ **Health checks**: Built-in container health monitoring
- ⚠️ **Smart configuration**: Detects and guides you to your preferred config method

> **Note:** The container uses `restart: 'no'` and provides clear guidance on configuration options. Choose environment variables for easy Docker setup, or create config.yaml manually for advanced features. Once configured, restart with `docker-compose up -d`.

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

# Configure (choose one method)
# Option A: Environment variables (add to docker run command):
# -e SHELFBRIDGE_USER_0_ID="your_username" \
# -e SHELFBRIDGE_USER_0_ABS_URL="https://your-abs-server.com" \
# -e SHELFBRIDGE_USER_0_ABS_TOKEN="your_abs_token" \
# -e SHELFBRIDGE_USER_0_HARDCOVER_TOKEN="your_hardcover_token" \

# Option B: Create and edit config file
# docker exec -it shelfbridge cp /app/config/config.yaml.example /app/config/config.yaml
# docker exec -it shelfbridge nano /app/config/config.yaml

# Restart to apply config
docker restart shelfbridge
```

### Option B: Local Directories (Easier Config Editing)

```bash
# Directories are created automatically by the container
# No need to pre-create them!

# Run with local directory mounts
docker run -d \
  --name shelfbridge \
  --restart unless-stopped \
  -v $(pwd)/config:/app/config \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  ghcr.io/rohit-purandare/shelfbridge:latest

# Container automatically creates:
# - ./config/ directory with config.yaml.example template
# - ./data/ directory for cache and sync data
# - ./logs/ directory for application logs

# Configure (choose one method):
# Option A: Environment variables (add -e flags to docker run above)
# Option B: Create and edit config file manually
# cp config/config.yaml.example config/config.yaml
# nano config/config.yaml

docker restart shelfbridge
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

ShelfBridge automatically creates all configuration files. Choose your preferred editing method:

**Named Volumes (Default Setup):**

```bash
# Container exits with invalid config, so use one of these methods:

# Method 1: Environment variables (Easiest)
# Edit docker-compose.yml and set environment variables instead of config file

# Method 2: Temporary container to edit config file
docker run --rm -it \
  -v shelfbridge-config:/app/config \
  ghcr.io/rohit-purandare/shelfbridge:latest \
  sh -c "nano /app/config/config.yaml"

# Method 3: Copy out, edit, copy back (if container was running)
# Only works if container is running - won't work with invalid config
# docker cp shelfbridge:/app/config/config.yaml ./config.yaml
# nano config.yaml
# docker cp ./config.yaml shelfbridge:/app/config/config.yaml

# Restart after editing
docker-compose up -d
```

**Local Directories (Easier Editing):**

```bash
# Switch to local directories by editing docker-compose.yml
# Comment out named volumes, uncomment local directories
docker-compose down && docker-compose up -d

# Now edit directly on host
nano config/config.yaml  # Direct access to your config file
docker-compose restart   # Apply changes
```

**View and validate configuration:**

```bash
# Check container logs for guidance (works even if container exited)
docker-compose logs shelfbridge

# If container is running, you can validate:
# docker exec -it shelfbridge node src/main.js validate

# View config via temporary container (for named volumes)
docker run --rm \
  -v shelfbridge-config:/app/config \
  ghcr.io/rohit-purandare/shelfbridge:latest \
  cat /app/config/config.yaml
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

### Container Won't Start or Exits Immediately

**First: Check if this is expected behavior:**

```bash
# Check logs for placeholder value detection
docker-compose logs shelfbridge
```

**Expected Exit Scenarios:**

- **Placeholder values detected**: Container exits gracefully with clear instructions
- **Missing config**: Container exits until you provide configuration

**This is normal!** Edit your config and restart:

```bash
# Option 1: Local directories (if using local mounts)
nano config/config.yaml

# Option 2: Environment variables (recommended for named volumes)
# Edit docker-compose.yml and set SHELFBRIDGE_USER_0_* variables

# Option 3: Temporary container (for named volumes)
docker run --rm -it \
  -v shelfbridge-config:/app/config \
  ghcr.io/rohit-purandare/shelfbridge:latest \
  sh -c "nano /app/config/config.yaml"

# Restart container
docker-compose up -d
```

**Actual Problems:**

- **Invalid YAML syntax**: Check for indentation/formatting errors
- **Permission issues**: User/group ownership problems
- **Port conflicts**: Another service using same port
- **Volume issues**: Mounting problems

**Solutions:**

```bash
# Check container status
docker-compose ps

# Validate config syntax (only works if container is running)
# docker exec -it shelfbridge node src/main.js validate
# If container exited, check logs instead:
docker-compose logs shelfbridge

# Force recreate if needed
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
