# ⚙️ Basic Configuration

This guide covers the essential configuration settings needed to get ShelfBridge running. Start here for a simple, working setup.

## 🎯 Configuration Overview

ShelfBridge uses a YAML configuration file with two main sections:

1. **`global`** - Settings that apply to all users
2. **`users`** - Individual user configurations

## 📁 Configuration File Location

| Installation Method | Configuration Path |
|-------------------|-------------------|
| **Docker Compose** | Container: `/app/config/config.yaml` |
| **Node.js** | Project: `config/config.yaml` |
| **Manual Docker** | Volume: depends on your mount |

## 🏗️ Basic Configuration Template

```yaml
# Basic ShelfBridge Configuration
global:
  # Minimum progress required to sync a book (0-100)
  min_progress_threshold: 5.0
  
  # Automatically add books to Hardcover if not found
  auto_add_books: false
  
  # Prevent accidental progress regression
  prevent_progress_regression: true
  
  # Sync schedule (cron format)
  sync_schedule: "0 3 * * *"
  
  # Timezone for scheduling
  timezone: "UTC"

# User configurations
users:
  - id: your_username
    abs_url: https://your-audiobookshelf-server.com
    abs_token: your_audiobookshelf_api_token
    hardcover_token: your_hardcover_api_token
```

## 🔧 Essential Settings

### 1. Minimum Progress Threshold

Controls when books are synced based on progress percentage:

```yaml
global:
  min_progress_threshold: 5.0  # Only sync books with 5%+ progress
```

**Common values:**
- `1.0` - Very permissive (sync almost everything)
- `5.0` - Default (skip accidental opens)
- `10.0` - Conservative (only sync books you're actively reading)
- `25.0` - Strict (only sync books you're committed to)

### 2. Auto-Add Books

Determines if books should be automatically added to Hardcover:

```yaml
global:
  auto_add_books: false  # Only add books with significant progress
```

**Options:**
- `false` - Conservative (recommended for beginners)
- `true` - Permissive (adds all books found)

### 3. Progress Regression Protection

Prevents accidental loss of reading progress:

```yaml
global:
  prevent_progress_regression: true  # Recommended
```

**Benefits:**
- Prevents completed books from being marked incomplete
- Protects against accidental progress resets
- Creates new reading sessions for re-reads

### 4. Sync Schedule

When automatic syncs run (cron format):

```yaml
global:
  sync_schedule: "0 3 * * *"  # Daily at 3 AM
```

**Common schedules:**
```yaml
sync_schedule: "0 3 * * *"     # Daily at 3 AM
sync_schedule: "0 */6 * * *"   # Every 6 hours
sync_schedule: "0 9,21 * * *"  # 9 AM and 9 PM
sync_schedule: "0 3 * * 0"     # Weekly on Sunday
```

### 5. Timezone

Your local timezone for scheduling:

```yaml
global:
  timezone: "America/New_York"
```

**Find your timezone:**
- Use: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
- Examples: `"UTC"`, `"America/Los_Angeles"`, `"Europe/London"`

## 👤 User Configuration

### Basic User Setup

```yaml
users:
  - id: alice                                    # Unique identifier
    abs_url: https://audiobookshelf.example.com  # Your ABS server
    abs_token: your_abs_api_token                # Your ABS API token
    hardcover_token: your_hardcover_api_token    # Your Hardcover token
```

### Required Fields

| Field | Description | Example |
|-------|-------------|---------|
| `id` | Unique user identifier | `alice`, `john_doe` |
| `abs_url` | Audiobookshelf server URL | `https://abs.example.com` |
| `abs_token` | Audiobookshelf API token | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `hardcover_token` | Hardcover API token | `hc_sk_1234567890abcdef...` |

### URL Format Requirements

```yaml
# ✅ Correct URL formats
abs_url: https://audiobookshelf.example.com
abs_url: http://192.168.1.100:13378
abs_url: https://abs.mydomain.com

# ❌ Incorrect formats
abs_url: audiobookshelf.example.com      # Missing protocol
abs_url: https://example.com/            # Trailing slash
abs_url: https://example.com/path        # Additional path
```

## 🔐 API Token Setup

### Audiobookshelf API Token

1. Log into your Audiobookshelf server
2. Go to Settings → Users
3. Click your username
4. Generate API Token
5. Copy the complete token

### Hardcover API Token

1. Go to [hardcover.app/account/developer](https://hardcover.app/account/developer)
2. Enable API access if needed
3. Generate API token
4. Copy the complete token

## 📝 Configuration Examples

### Single User (Most Common)

```yaml
global:
  min_progress_threshold: 5.0
  auto_add_books: false
  prevent_progress_regression: true
  sync_schedule: "0 3 * * *"
  timezone: "America/New_York"

users:
  - id: alice
    abs_url: https://abs.example.com
    abs_token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
    hardcover_token: hc_sk_1234567890abcdef...
```

### Family Setup (Multiple Users)

```yaml
global:
  min_progress_threshold: 5.0
  auto_add_books: false
  prevent_progress_regression: true
  sync_schedule: "0 3 * * *"
  timezone: "America/New_York"

users:
  - id: alice
    abs_url: https://abs.example.com
    abs_token: alice_abs_token
    hardcover_token: alice_hardcover_token
  - id: bob
    abs_url: https://abs.example.com
    abs_token: bob_abs_token
    hardcover_token: bob_hardcover_token
```

### Permissive Setup (Sync Everything)

```yaml
global:
  min_progress_threshold: 1.0   # Very low threshold
  auto_add_books: true          # Add all books
  prevent_progress_regression: true
  sync_schedule: "0 */6 * * *"  # Every 6 hours
  timezone: "UTC"

users:
  - id: bookworm
    abs_url: https://abs.example.com
    abs_token: your_abs_token
    hardcover_token: your_hardcover_token
```

### Conservative Setup (Sync Carefully)

```yaml
global:
  min_progress_threshold: 10.0  # Higher threshold
  auto_add_books: false         # No auto-add
  prevent_progress_regression: true
  sync_schedule: "0 3 * * *"    # Daily only
  timezone: "UTC"

users:
  - id: careful_reader
    abs_url: https://abs.example.com
    abs_token: your_abs_token
    hardcover_token: your_hardcover_token
```

## ✅ Configuration Validation

### Test Your Configuration

```bash
# Docker
docker exec -it shelfbridge node src/main.js validate

# Node.js
node src/main.js validate
```

### Test API Connections

```bash
# Docker
docker exec -it shelfbridge node src/main.js validate --connections

# Node.js
node src/main.js validate --connections
```

### Common Validation Errors

**"Invalid YAML syntax"**
```yaml
# ❌ Common mistakes
users:
  - id alice              # Missing colon
    abs_url http://...    # Missing colon
    
# ✅ Correct syntax
users:
  - id: alice
    abs_url: http://...
```

**"Placeholder values detected"**
```yaml
# ❌ Still has placeholders
abs_token: your_audiobookshelf_api_token

# ✅ Real token
abs_token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**"Invalid URL format"**
```yaml
# ❌ Common URL mistakes
abs_url: example.com           # Missing protocol
abs_url: https://example.com/  # Trailing slash

# ✅ Correct format
abs_url: https://example.com
```

## 🔧 Editing Configuration

### Docker

```bash
# Edit config file
docker exec -it shelfbridge nano /app/config/config.yaml

# Restart container to apply changes
docker-compose restart shelfbridge
```

### Node.js

```bash
# Edit config file
nano config/config.yaml

# Restart service if running
# Press Ctrl+C to stop, then restart
```

## 🎯 Next Steps

Once you have basic configuration working:

1. **[Run First Sync](../user-guides/First-Sync.md)** - Test your setup
2. **[Advanced Configuration](Advanced-Configuration.md)** - Explore more options
3. **[Multi-User Setup](Multi-User-Setup.md)** - Add more users

## 🆘 Need Help?

- **Configuration Issues**: [Troubleshooting Guide](../troubleshooting/Troubleshooting-Guide.md)
- **API Token Help**: [Prerequisites](../user-guides/Prerequisites.md)
- **General Questions**: [FAQ](../troubleshooting/FAQ.md)

---

**A good basic configuration gets you 90% of the way there!** ⚙️✨ 