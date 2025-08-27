# 📦 Node.js Setup Guide

This guide covers installing ShelfBridge directly with Node.js. This method is ideal for developers, users who prefer direct control, or environments where Docker isn't available.

## ✅ Prerequisites

### System Requirements

- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 8.0.0 or higher (usually included with Node.js)
- **Git**: For cloning the repository
- **Operating System**: Windows, macOS, or Linux

### API Requirements

- **Audiobookshelf API token**: [How to get it](Prerequisites.md#audiobookshelf-api-token)
- **Hardcover API token**: [How to get it](Prerequisites.md#hardcover-api-token)

## 🔧 Node.js Installation

### Option 1: Official Installer (Recommended)

**Windows/macOS:**

1. Go to [nodejs.org](https://nodejs.org/)
2. Download the LTS version
3. Run the installer
4. Restart your terminal/command prompt

**Linux (Ubuntu/Debian):**

```bash
# Using NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

### Option 2: Package Managers

**macOS (Homebrew):**

```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node

# Verify installation
node --version
npm --version
```

**Windows (Chocolatey):**

```powershell
# Install Chocolatey if not already installed
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install Node.js
choco install nodejs

# Verify installation
node --version
npm --version
```

**Linux (Package Manager):**

```bash
# CentOS/RHEL/Fedora
sudo dnf install nodejs npm

# Arch Linux
sudo pacman -S nodejs npm

# Alpine Linux
sudo apk add nodejs npm
```

### Option 3: Node Version Manager (NVM)

**Linux/macOS:**

```bash
# Install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Restart terminal or run:
source ~/.bashrc

# Install latest LTS Node.js
nvm install --lts
nvm use --lts

# Verify installation
node --version
npm --version
```

**Windows (NVM-Windows):**

```powershell
# Download and install from: https://github.com/coreybutler/nvm-windows/releases
# Then run:
nvm install lts
nvm use lts
```

## 📥 ShelfBridge Installation

### Step 1: Clone Repository

```bash
# Clone the repository
git clone https://github.com/rohit-purandare/ShelfBridge.git
cd ShelfBridge

# Check available branches/tags
git branch -r
git tag
```

### Step 2: Install Dependencies

```bash
# Install all dependencies
npm install

# Optional: Install global dependencies for easier CLI usage
npm install -g .
```

### Step 3: Configuration Setup

```bash
# Copy configuration template
cp config/config.yaml.example config/config.yaml

# Edit configuration
nano config/config.yaml  # Linux/macOS
notepad config/config.yaml  # Windows
```

**Configuration example:**

```yaml
global:
  min_progress_threshold: 5.0
  auto_add_books: false
  prevent_progress_regression: true

users:
  - id: your_username
    abs_url: https://your-audiobookshelf-server.com
    abs_token: your_audiobookshelf_api_token
    hardcover_token: your_hardcover_api_token
```

### Step 4: Test Installation

```bash
# Test configuration
node src/main.js validate

# Test API connections
node src/main.js validate --connections

# Run your first sync (dry run)
node src/main.js sync --dry-run
```

## 🚀 Running ShelfBridge

### Manual Sync

```bash
# Run sync once
npm run sync

# Or directly
node src/main.js sync

# Sync specific user
node src/main.js sync --user your_username

# Force sync (ignore cache)
node src/main.js sync --force
```

### Background Service

```bash
# Start background service (respects sync_schedule)
npm start

# Or directly
node src/main.js start
```

### Available Scripts

```bash
# Run one-time sync
npm run sync

# Start background service
npm start

# Run in development mode (with auto-restart)
npm run dev

# Check cache status
npm run cache

# Run tests (if available)
npm test
```

## 🔧 Advanced Configuration

### Environment Variables

You can override configuration with environment variables:

```bash
# Set environment variables
export SHELFBRIDGE_CONFIG_PATH=/path/to/custom/config.yaml
export SHELFBRIDGE_DATA_PATH=/path/to/custom/data
export SHELFBRIDGE_LOG_LEVEL=debug

# Run with custom environment
node src/main.js sync
```

### Custom Installation Location

```bash
# Install to custom directory
git clone https://github.com/rohit-purandare/ShelfBridge.git /opt/shelfbridge
cd /opt/shelfbridge
npm install

# Create systemd service (Linux)
sudo nano /etc/systemd/system/shelfbridge.service
```

**Example systemd service:**

```ini
[Unit]
Description=ShelfBridge Sync Service
After=network.target

[Service]
Type=simple
User=shelfbridge
WorkingDirectory=/opt/shelfbridge
ExecStart=/usr/bin/node src/main.js start
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### Process Management

**Using PM2 (Process Manager):**

```bash
# Install PM2
npm install -g pm2

# Start ShelfBridge with PM2
pm2 start src/main.js --name shelfbridge -- start

# Check status
pm2 status

# View logs
pm2 logs shelfbridge

# Save PM2 configuration
pm2 save
pm2 startup
```

## 🔄 Updates and Maintenance

### Updating ShelfBridge

```bash
# Pull latest changes
git pull origin main

# Update dependencies
npm install

# Check for any configuration changes needed
node src/main.js validate

# Restart service if running
pm2 restart shelfbridge  # If using PM2
# Or restart your systemd service
```

### Backup and Restore

```bash
# Backup configuration
cp config/config.yaml config/config.yaml.backup

# Backup cache
node src/main.js cache --export backup.json

# Restore configuration
cp config/config.yaml.backup config/config.yaml

# Clear cache (will rebuild on next sync)
node src/main.js cache --clear
```

## 🛠️ Troubleshooting

### Common Issues

**"node: command not found"**

- Node.js is not installed or not in PATH
- Restart terminal after installation
- Check PATH environment variable

**"npm install" fails**

- Check Node.js version: `node --version`
- Clear npm cache: `npm cache clean --force`
- Try different registry: `npm install --registry https://registry.npmjs.org/`

**Permission errors (Linux/macOS)**

```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules

# Or use nvm to avoid permission issues
```

**"Cannot find module" errors**

- Run `npm install` in project directory
- Check if package.json exists
- Verify you're in the correct directory

### Performance Optimization

```bash
# Increase Node.js memory limit for large libraries
node --max-old-space-size=4096 src/main.js sync

# Use production environment
NODE_ENV=production node src/main.js sync
```

## 🔗 Next Steps

1. **[Configuration Overview](../admin/Configuration-Reference.md)** - Understand all configuration options
2. **[First Sync Guide](First-Sync.md)** - Run your first synchronization
3. **[CLI Reference](../technical/CLI-Reference.md)** - Complete command documentation
4. **[Troubleshooting Guide](../troubleshooting/Troubleshooting-Guide.md)** - Solve common issues

## 🆘 Need Help?

- **Installation Issues**: [Troubleshooting Guide](../troubleshooting/Troubleshooting-Guide.md)
- **Configuration Help**: [Configuration Overview](../admin/Configuration-Reference.md)
- **General Questions**: [FAQ](../troubleshooting/FAQ.md)

---

**Ready to sync?** Continue with the [First Sync Guide](First-Sync.md) to run your first synchronization!
