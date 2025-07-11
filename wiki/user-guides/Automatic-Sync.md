# ⏰ Automatic Sync Setup

Set up ShelfBridge to automatically sync your reading progress on a schedule. This guide covers all methods of running ShelfBridge in the background.

## 🎯 Overview

ShelfBridge can run automatically using several methods:

1. **Docker Container** - Easiest, runs automatically
2. **Node.js Background Service** - Built-in scheduler
3. **System Cron** - System-level scheduling
4. **Process Manager** - PM2, systemd, etc.

## 🐳 Docker Automatic Sync

### Default Docker Behavior

Docker containers run automatically with the built-in scheduler:

```bash
# Start container (runs automatically)
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f shelfbridge
```

### Configure Schedule

Edit your `config.yaml` to set the sync schedule:

```yaml
global:
  sync_schedule: "0 3 * * *"  # 3 AM daily
  timezone: "America/New_York"
```

**Common schedules:**
```yaml
sync_schedule: "0 3 * * *"     # Daily at 3 AM
sync_schedule: "0 */6 * * *"   # Every 6 hours
sync_schedule: "0 9,21 * * *"  # 9 AM and 9 PM
sync_schedule: "0 3 * * 0"     # Weekly on Sunday
```

### Docker Management Commands

```bash
# Check container status
docker-compose ps

# View recent logs
docker-compose logs --tail 50 shelfbridge

# Follow logs in real-time
docker-compose logs -f shelfbridge

# Restart container
docker-compose restart shelfbridge

# Stop automatic sync
docker-compose stop shelfbridge

# Start automatic sync
docker-compose start shelfbridge
```

## 📦 Node.js Background Service

### Built-in Scheduler

ShelfBridge has a built-in background scheduler:

```bash
# Start background service
npm start

# Or directly
node src/main.js start
```

**What it does:**
- Runs an initial sync immediately
- Schedules recurring syncs based on `sync_schedule`
- Keeps running until interrupted (Ctrl+C)
- Respects your configured timezone

### Configuration

Edit `config/config.yaml`:

```yaml
global:
  sync_schedule: "0 3 * * *"  # Cron format
  timezone: "UTC"             # Your timezone
  
# Optional: Different schedule per user
users:
  - id: alice
    sync_schedule: "0 2 * * *"  # Override global schedule
    # ... other config
```

### Background Service Management

```bash
# Start service
npm start

# View service status (if running)
ps aux | grep node

# Stop service
# Press Ctrl+C in the terminal running the service
```

## 🕐 System Cron Setup

### Linux/macOS Cron

For advanced users who want system-level scheduling:

```bash
# Edit crontab
crontab -e

# Add ShelfBridge sync job
0 3 * * * cd /path/to/ShelfBridge && node src/main.js sync >> /var/log/shelfbridge.log 2>&1
```

**Cron format:**
```
# ┌───────────── minute (0-59)
# │ ┌───────────── hour (0-23)
# │ │ ┌───────────── day of month (1-31)
# │ │ │ ┌───────────── month (1-12)
# │ │ │ │ ┌───────────── day of week (0-6) (0=Sunday)
# │ │ │ │ │
# │ │ │ │ │
# * * * * * command to execute
```

**Example cron entries:**
```bash
# Daily at 3 AM
0 3 * * * cd /opt/shelfbridge && node src/main.js sync

# Every 6 hours
0 */6 * * * cd /opt/shelfbridge && node src/main.js sync

# Weekdays at 9 AM
0 9 * * 1-5 cd /opt/shelfbridge && node src/main.js sync

# Multiple users
0 3 * * * cd /opt/shelfbridge && node src/main.js sync --user alice
30 3 * * * cd /opt/shelfbridge && node src/main.js sync --user bob
```

### Windows Task Scheduler

Create a scheduled task in Windows:

1. Open Task Scheduler
2. Create Basic Task
3. Set trigger (daily, weekly, etc.)
4. Set action: Start a program
5. Program: `node`
6. Arguments: `src/main.js sync`
7. Start in: `C:\path\to\ShelfBridge`

## 🔧 Process Manager Setup

### PM2 (Popular Node.js Process Manager)

```bash
# Install PM2
npm install -g pm2

# Start ShelfBridge with PM2
pm2 start src/main.js --name shelfbridge -- start

# Check status
pm2 status

# View logs
pm2 logs shelfbridge

# Restart
pm2 restart shelfbridge

# Stop
pm2 stop shelfbridge

# Auto-start on boot
pm2 startup
pm2 save
```

### Systemd (Linux)

Create a systemd service:

```bash
# Create service file
sudo nano /etc/systemd/system/shelfbridge.service
```

**Service configuration:**
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
RestartSec=30
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

**Enable and start:**
```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service
sudo systemctl enable shelfbridge

# Start service
sudo systemctl start shelfbridge

# Check status
sudo systemctl status shelfbridge

# View logs
sudo journalctl -u shelfbridge -f
```

## 📊 Monitoring Automatic Sync

### Check Sync Status

**Docker:**
```bash
# Check if container is running
docker-compose ps

# View recent sync results
docker-compose logs --tail 100 shelfbridge

# Check last sync time
docker exec shelfbridge ls -la /app/data/
```

**Node.js:**
```bash
# Check if process is running
ps aux | grep node

# View log files
tail -f logs/shelfbridge.log

# Check cache for last sync
node src/main.js cache --stats
```

### Log File Locations

| Installation Method | Log Location |
|-------------------|--------------|
| **Docker Compose** | `docker-compose logs shelfbridge` |
| **Node.js** | `logs/shelfbridge.log` |
| **PM2** | `pm2 logs shelfbridge` |
| **Systemd** | `journalctl -u shelfbridge` |

## 🔍 Troubleshooting Automatic Sync

### Sync Not Running

**Check if service is running:**
```bash
# Docker
docker-compose ps

# Node.js
ps aux | grep node

# PM2
pm2 status

# Systemd
sudo systemctl status shelfbridge
```

**Common issues:**
- Service not started
- Configuration errors
- File permissions
- Network connectivity

### Sync Errors

**Check logs for errors:**
```bash
# Docker
docker-compose logs --tail 100 shelfbridge | grep -i error

# Node.js
grep -i error logs/shelfbridge.log

# PM2
pm2 logs shelfbridge | grep -i error
```

**Common error patterns:**
- API authentication failures
- Network timeout errors
- Configuration validation errors
- Database connection issues

### Schedule Not Working

**Verify cron schedule:**
```bash
# Test cron expression online: https://crontab.guru/
# Common mistake: wrong timezone setting
```

**Check timezone:**
```yaml
global:
  timezone: "America/New_York"  # Must match your local timezone
```

## ⚡ Performance Optimization

### For Large Libraries

```yaml
global:
  workers: 2                    # Fewer parallel workers
  min_progress_threshold: 10.0  # Higher threshold
  parallel: true                # Enable parallel processing
```

### For Frequent Syncs

```yaml
global:
  sync_schedule: "0 */2 * * *"  # Every 2 hours
  force_sync: false             # Use cache effectively
```

### For Slow Networks

```yaml
global:
  workers: 1                    # Single worker
  timeout: 30000                # Increase timeout
```

## 🔄 Advanced Scheduling

### Per-User Schedules

```yaml
users:
  - id: alice
    sync_schedule: "0 3 * * *"  # Alice syncs at 3 AM
    # ... other config
  - id: bob
    sync_schedule: "0 4 * * *"  # Bob syncs at 4 AM
    # ... other config
```

### Conditional Scheduling

```bash
# Only sync if connected to home network
if ping -c 1 192.168.1.1 > /dev/null; then
    cd /opt/shelfbridge && node src/main.js sync
fi
```

### Multi-Environment Setup

```bash
# Development: sync every hour
# Production: sync daily
if [ "$NODE_ENV" = "development" ]; then
    SCHEDULE="0 * * * *"
else
    SCHEDULE="0 3 * * *"
fi
```

## 📈 Monitoring and Alerting

### Basic Monitoring

```bash
# Check if sync completed successfully
if [ $? -eq 0 ]; then
    echo "Sync completed successfully"
else
    echo "Sync failed" | mail -s "ShelfBridge Alert" you@example.com
fi
```

### Health Checks

```bash
# Docker health check
docker exec shelfbridge node src/main.js validate

# Node.js health check
node src/main.js validate --connections
```

## 🎯 Next Steps

1. **[Understanding Sync Results](Understanding-Sync-Results.md)** - Interpret automatic sync output
2. **[Configuration Overview](../admin/Configuration-Overview.md)** - Fine-tune your settings
3. **[Troubleshooting Guide](../troubleshooting/Troubleshooting-Guide.md)** - Solve common issues

## 🆘 Need Help?

- **Scheduling Issues**: [Troubleshooting Guide](../troubleshooting/Troubleshooting-Guide.md)
- **Configuration Help**: [Configuration Overview](../admin/Configuration-Overview.md)
- **General Questions**: [FAQ](../troubleshooting/FAQ.md)

---

**Set it and forget it!** ⏰ Your reading progress will now sync automatically on your chosen schedule. 