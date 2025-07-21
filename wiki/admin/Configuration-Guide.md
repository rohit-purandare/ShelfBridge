# ⚙️ Configuration Guide

Get ShelfBridge configured quickly and understand which configuration method to use for your setup. This guide covers both YAML and environment variable configuration with practical examples.

## 🎯 Quick Decision Matrix

| Your Situation | Use This Method | Why |
|----------------|-----------------|-----|
| **Basic Docker setup** | Environment Variables | Simple, container-friendly |
| **Single user, no filtering** | Environment Variables | Fastest to configure |
| **Homelab/NAS deployment** | Environment Variables | Easy container management |
| **Need library filtering** | YAML Configuration | Arrays not supported in env vars |
| **Multi-user with different libraries** | YAML Configuration | Complex per-user settings |
| **Family setup** | YAML Configuration | Advanced user management |

## 🚀 Method 1: Environment Variables (Basic Setup)

Perfect for Docker deployments, homelab setups, and simple configurations.

### ✅ **What Environment Variables Support:**
- User credentials (tokens, URLs)
- Core sync settings (workers, scheduling, thresholds)
- Rate limiting and performance tuning
- Safety settings (dry-run, progress protection)

### ❌ **What Requires YAML:**
- **Library filtering** - Include/exclude specific libraries
- **Reread detection** - Advanced progress regression protection
- **Multi-user advanced setups** - Different settings per user

### 🐳 Docker Compose Setup

Create or update your `docker-compose.yml`:

```yaml
services:
  shelfbridge:
    image: ghcr.io/rohit-purandare/shelfbridge:latest
    environment:
      # REQUIRED USER CONFIGURATION
      SHELFBRIDGE_USER_0_ID: "your_username"
      SHELFBRIDGE_USER_0_ABS_URL: "https://your-abs-server.com"
      SHELFBRIDGE_USER_0_ABS_TOKEN: "your_audiobookshelf_token"
      SHELFBRIDGE_USER_0_HARDCOVER_TOKEN: "your_hardcover_token"
      
      # OPTIONAL GLOBAL SETTINGS
      SHELFBRIDGE_MIN_PROGRESS_THRESHOLD: "5.0"
      SHELFBRIDGE_AUTO_ADD_BOOKS: "true"
      SHELFBRIDGE_SYNC_SCHEDULE: "0 3 * * *"
      SHELFBRIDGE_TIMEZONE: "UTC"
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
```

### 🖥️ Node.js Setup

Set environment variables and run:

```bash
# Required settings
export SHELFBRIDGE_USER_0_ID="your_username"
export SHELFBRIDGE_USER_0_ABS_URL="https://your-abs-server.com"
export SHELFBRIDGE_USER_0_ABS_TOKEN="your_audiobookshelf_token"
export SHELFBRIDGE_USER_0_HARDCOVER_TOKEN="your_hardcover_token"

# Optional settings
export SHELFBRIDGE_MIN_PROGRESS_THRESHOLD="5.0"
export SHELFBRIDGE_AUTO_ADD_BOOKS="true"

# Run ShelfBridge
npm start
```

### 🔄 Priority Order

ShelfBridge follows this priority hierarchy:

1. **YAML Configuration** (highest priority) - `config/config.yaml`
2. **Environment Variables** (fallback) - `SHELFBRIDGE_*`
3. **Default Values** (lowest priority) - Built-in defaults

This means you can mix both methods! Set basic credentials via environment variables and advanced features via YAML.

## 🚀 Method 2: YAML Configuration (Basic + Advanced Features)

Required for advanced features like library filtering and complex multi-user setups.

### 📁 Configuration File Location

| Installation Method | Configuration Path |
|-------------------|-------------------|
| **Docker Compose** | `./config/config.yaml` (mounted to `/app/config/config.yaml`) |
| **Node.js** | `config/config.yaml` |
| **Manual Docker** | Depends on your volume mount |

### 🏗️ Basic YAML Template

Create `config/config.yaml`:

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

### 🏗️ Advanced YAML Template (Library Filtering)

```yaml
global:
  min_progress_threshold: 5.0
  auto_add_books: true
  sync_schedule: "0 3 * * *"
  timezone: "UTC"
  
  # Global library filtering (applies to all users unless overridden)
  libraries:
    exclude: ["Podcasts", "Samples", "Previews"]

users:
  - id: alice
    abs_url: https://abs.example.com
    abs_token: alice_abs_token
    hardcover_token: alice_hardcover_token
    # Alice inherits global library filtering
    
  - id: bob
    abs_url: https://abs.example.com
    abs_token: bob_abs_token
    hardcover_token: bob_hardcover_token
    # Bob overrides global settings
    libraries:
      include: ["Science Fiction", "Fantasy", "Audiobooks"]
```

## 📖 Practical Examples

### Example 1: Single User with Docker

**Environment Variables Approach:**
```yaml
# docker-compose.yml
services:
  shelfbridge:
    image: ghcr.io/rohit-purandare/shelfbridge:latest
    environment:
      SHELFBRIDGE_USER_0_ID: "alice"
      SHELFBRIDGE_USER_0_ABS_URL: "https://audiobooks.mydomain.com"
      SHELFBRIDGE_USER_0_ABS_TOKEN: "eyJhbGciOiJIUzI1NiIs..."
      SHELFBRIDGE_USER_0_HARDCOVER_TOKEN: "hc_sk_1234567890ab..."
      SHELFBRIDGE_MIN_PROGRESS_THRESHOLD: "3.0"
      SHELFBRIDGE_AUTO_ADD_BOOKS: "true"
```

### Example 2: Family Setup with YAML

**YAML Configuration Approach:**
```yaml
# config/config.yaml
global:
  min_progress_threshold: 5.0
  auto_add_books: true
  sync_schedule: "0 */6 * * *"  # Every 6 hours
  timezone: "America/New_York"
  
  # Skip podcasts and samples for everyone
  libraries:
    exclude: ["Podcasts", "Sample Books"]

users:
  - id: mom
    abs_url: https://family-audiobooks.com
    abs_token: mom_abs_token
    hardcover_token: mom_hardcover_token
    
  - id: dad
    abs_url: https://family-audiobooks.com
    abs_token: dad_abs_token
    hardcover_token: dad_hardcover_token
    
  - id: teen
    abs_url: https://family-audiobooks.com
    abs_token: teen_abs_token
    hardcover_token: teen_hardcover_token
    # Teen only syncs specific libraries
    libraries:
      include: ["Young Adult", "Fantasy", "Science Fiction"]
```

### Example 3: Multi-User with Environment Variables

**Simple Multi-User (No Library Filtering):**
```bash
# User 0 (Primary)
export SHELFBRIDGE_USER_0_ID="alice"
export SHELFBRIDGE_USER_0_ABS_URL="https://abs.example.com"
export SHELFBRIDGE_USER_0_ABS_TOKEN="alice_token"
export SHELFBRIDGE_USER_0_HARDCOVER_TOKEN="alice_hardcover_token"

# User 1 (Secondary)
export SHELFBRIDGE_USER_1_ID="bob"
export SHELFBRIDGE_USER_1_ABS_URL="https://abs.example.com"
export SHELFBRIDGE_USER_1_ABS_TOKEN="bob_token"
export SHELFBRIDGE_USER_1_HARDCOVER_TOKEN="bob_hardcover_token"

# Global settings
export SHELFBRIDGE_MIN_PROGRESS_THRESHOLD="5.0"
export SHELFBRIDGE_AUTO_ADD_BOOKS="true"
```

### Example 4: Development/Testing Setup

**Environment Variables for Testing:**
```bash
# Safe testing configuration
export SHELFBRIDGE_DRY_RUN="true"              # Don't make real changes
export SHELFBRIDGE_MAX_BOOKS_TO_PROCESS="10"   # Limit for testing
export SHELFBRIDGE_WORKERS="1"                 # Sequential processing
export SHELFBRIDGE_PARALLEL="false"            # Easier debugging

# Test user
export SHELFBRIDGE_USER_0_ID="test_user"
export SHELFBRIDGE_USER_0_ABS_URL="https://test-abs.example.com"
export SHELFBRIDGE_USER_0_ABS_TOKEN="test_token"
export SHELFBRIDGE_USER_0_HARDCOVER_TOKEN="test_hardcover_token"
```

## 🔧 Essential Settings Explained

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
  auto_add_books: false  # Conservative (recommended for beginners)
```

**Options:**
- `false` - Conservative, only sync existing books
- `true` - Convenient, automatically adds missing books

### 3. Sync Schedule
When automatic syncing should occur:

```yaml
global:
  sync_schedule: "0 3 * * *"  # Daily at 3 AM
```

**Common schedules:**
- `"0 3 * * *"` - Daily at 3 AM (default)
- `"0 */6 * * *"` - Every 6 hours
- `"0 9,21 * * *"` - Twice daily (9 AM and 9 PM)
- `"0 2 * * 0"` - Weekly on Sunday at 2 AM

### 4. Progress Protection
Prevents accidental loss of reading progress:

```yaml
global:
  prevent_progress_regression: true  # Recommended
```

**Always keep this enabled** unless you have a specific reason to disable it.

## ✅ Validation and Testing

### Test Your Configuration

```bash
# Validate configuration
node src/main.js validate

# Test API connections
node src/main.js validate --connections

# Test sync without changes
node src/main.js sync --dry-run --verbose

# Show current configuration
node src/main.js config
```

### Common Issues and Solutions

#### Missing Required Settings
```
❌ Configuration Validation Failed:
  ✗ User configuration: 'id' is required for user 0
```

**Solution**: Ensure all required user variables are set.

#### Invalid Data Types
```
❌ Configuration Validation Failed:
  ✗ Global config: 'workers' must be number (got: string)
```

**Solution**: Check that numeric environment variables contain valid numbers.

#### Out of Range Values
```
❌ Configuration Validation Failed:
  ✗ Global config: 'min_progress_threshold' must be between 0 and 100
```

**Solution**: Use values within valid ranges.

## 🔒 Security Considerations

### Protecting Sensitive Data

**Environment Variables:**
```bash
# ✅ Use secure methods
export SHELFBRIDGE_USER_0_ABS_TOKEN="$(cat /run/secrets/abs_token)"

# ❌ Avoid hardcoding
export SHELFBRIDGE_USER_0_ABS_TOKEN="plaintext_token_here"
```

**YAML Files:**
```bash
# Restrict file access
chmod 600 config/config.yaml

# Don't commit tokens to git
echo "config/config.yaml" >> .gitignore
```

**Docker Secrets:**
For production, consider using Docker secrets or external secret management.

## 🎯 Next Steps

1. **Choose your method** based on the decision matrix above
2. **Set up configuration** using the appropriate template
3. **Test your setup** with validation commands
4. **Run your first sync** with `--dry-run` flag
5. **Monitor logs** for any issues

### Advanced Configuration

For complex setups requiring detailed tuning, see: **[Configuration Reference](Configuration-Reference.md)**

### Troubleshooting

If you encounter issues, check: **[Troubleshooting Guide](../troubleshooting/Troubleshooting-Guide.md)**

---

💡 **Pro Tip**: Start with environment variables for basic setup, then migrate to YAML if you need library filtering or advanced multi-user features. You can even use both methods together! 