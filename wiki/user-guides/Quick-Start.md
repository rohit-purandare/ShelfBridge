# 🚀 Quick Start Guide

Get ShelfBridge running in 5 minutes! This guide will have you syncing your reading progress between Audiobookshelf and Hardcover quickly.

## ✅ Prerequisites Checklist

Before you start, make sure you have:

- [ ] **Audiobookshelf server** running and accessible
- [ ] **Audiobookshelf API token** ([How to get it](Prerequisites.md#audiobookshelf-api-token))
- [ ] **Hardcover account** with API access enabled
- [ ] **Hardcover API token** ([How to get it](Prerequisites.md#hardcover-api-token))
- [ ] **Docker** installed (recommended) OR **Node.js 18+** installed

## 🐳 Option 1: Docker Quick Start (Recommended)

### 1. Download and Start
```bash
# Create a directory for ShelfBridge
mkdir shelfbridge && cd shelfbridge

# Download docker-compose.yml
curl -O https://raw.githubusercontent.com/rohit-purandare/ShelfBridge/main/docker-compose.yml

# Start the container
docker-compose up -d
```

### 2. Configure Your Settings
```bash
# Edit the configuration file
docker exec -it shelfbridge nano /app/config/config.yaml
```

**Replace the placeholder values with your actual tokens:**
```yaml
global:
  min_progress_threshold: 5.0
  auto_add_books: false

users:
  - id: your_username
    abs_url: https://your-audiobookshelf-server.com
    abs_token: your_actual_audiobookshelf_token
    hardcover_token: your_actual_hardcover_token
```

### 3. Test and Run
```bash
# Test your configuration
docker exec -it shelfbridge node src/main.js validate

# Run your first sync
docker exec -it shelfbridge npm run sync

# Check the logs
docker-compose logs -f
```

## 📦 Option 2: Node.js Quick Start

### 1. Install and Setup
```bash
# Clone the repository
git clone https://github.com/rohit-purandare/ShelfBridge.git
cd ShelfBridge

# Install dependencies
npm install

# Copy configuration template
cp config/config.yaml.example config/config.yaml
```

### 2. Configure Your Settings
```bash
# Edit the configuration file
nano config/config.yaml
```

**Update with your actual values:**
```yaml
global:
  min_progress_threshold: 5.0
  auto_add_books: false

users:
  - id: your_username
    abs_url: https://your-audiobookshelf-server.com  # e.g., https://abs.mydomain.com
    abs_token: your_actual_audiobookshelf_token
    hardcover_token: your_actual_hardcover_token
```

### 3. Test and Run
```bash
# Test your configuration
node src/main.js validate

# Run your first sync
npm run sync
```

## ✅ Verify Your Setup

If everything is working correctly, you should see output like this:

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
```

## 🔄 Set Up Automatic Sync (Optional)

### Docker
```bash
# The container runs automatically with the default schedule (3 AM daily)
# To customize the schedule, edit the sync_schedule in your config.yaml
```

### Node.js
```bash
# Start the background service
npm start
```

## 🆘 Common Issues

### "Configuration validation failed"
- Check that all URLs start with `http://` or `https://`
- Verify your API tokens are correct and not placeholder values
- Make sure your Audiobookshelf server is accessible

### "No books found"
- Ensure your Audiobookshelf user has access to libraries
- Check that you have books with reading progress in Audiobookshelf
- Verify your API token has the correct permissions

### "GraphQL errors"
- Confirm your Hardcover API token is correct
- Ensure API access is enabled in your Hardcover account settings
- Check your internet connection to Hardcover

## 🎯 What's Next?

Now that you're up and running:

1. **[Understanding Sync Results](Understanding-Sync-Results.md)** - Learn what the sync output means
2. **[Configuration Overview](../admin/Configuration-Overview.md)** - Explore advanced settings
3. **[Automatic Sync](Automatic-Sync.md)** - Set up scheduled synchronization

## 🔗 Related Pages

- **[Prerequisites](Prerequisites.md)** - Detailed requirements and token setup
- **[Docker Setup](Docker-Setup.md)** - Complete Docker installation guide
- **[Node.js Setup](Node-Setup.md)** - Complete Node.js installation guide
- **[Troubleshooting Guide](../troubleshooting/Troubleshooting-Guide.md)** - Solve common problems

---

**Still having issues?** Check our [FAQ](../troubleshooting/FAQ.md) or [troubleshooting guide](../troubleshooting/Troubleshooting-Guide.md). 