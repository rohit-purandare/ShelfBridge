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
# Daily at 3 AM
sync_schedule: "0 3 * * *"
```
```yaml
# Every 6 hours
sync_schedule: "0 */6 * * *"
```
```yaml
# 9 AM and 9 PM
sync_schedule: "0 9,21 * * *"
```
```yaml
# Weekly on Sunday
sync_schedule: "0 3 * * 0"
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
# Start background service (scheduled sync)
npm start

# Or directly
node src/main.js start

# For interactive mode instead
npm run interactive
node src/main.js interactive
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