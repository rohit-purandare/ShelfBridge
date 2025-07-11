# ⚙️ Configuration Overview

ShelfBridge uses a YAML configuration file to manage all settings. This guide explains every configuration option, provides examples, and helps you customize ShelfBridge for your needs.

## 📁 Configuration File Location

| Installation Method | Configuration Path |
|-------------------|-------------------|
| **Docker Compose** | `/app/config/config.yaml` (inside container) |
| **Node.js** | `config/config.yaml` (in project directory) |
| **Manual Docker** | Depends on your volume mount |

## 🏗️ Configuration Structure

The configuration file has two main sections:

1. **`global`** - Settings that apply to all users and the sync process
2. **`users`** - Individual user configurations with API tokens

### Basic Configuration Template

```yaml
# Global settings for all users
global:
  min_progress_threshold: 5.0
  parallel: true
  workers: 3
  dry_run: false
  sync_schedule: "0 3 * * *"
  timezone: "UTC"
  auto_add_books: false
  prevent_progress_regression: true

# Individual user configurations
users:
  - id: alice
    abs_url: https://audiobookshelf.example.com
    abs_token: your_audiobookshelf_api_token
    hardcover_token: your_hardcover_api_token
  - id: bob
    abs_url: https://audiobookshelf.example.com
    abs_token: bobs_audiobookshelf_token
    hardcover_token: bobs_hardcover_token
```

## 🌍 Global Settings

### Core Sync Behavior

#### `min_progress_threshold`
**Type**: Number (0-100)  
**Default**: `5.0`  
**Description**: Minimum progress percentage required to sync a book

```yaml
global:
  min_progress_threshold: 10.0  # Only sync books with 10%+ progress
```

**Use Cases**:
- `5.0` - Sync most books you've started
- `25.0` - Only sync books you're seriously reading
- `0.1` - Sync almost everything (including accidental opens)

#### `auto_add_books`
**Type**: Boolean  
**Default**: `false`  
**Description**: Automatically add books to Hardcover if they're not found

```yaml
global:
  auto_add_books: true  # Add all books automatically
```

**Behavior**:
- `false` - Only add books with meaningful progress or already in Hardcover
- `true` - Add all books regardless of progress level

#### `prevent_progress_regression`
**Type**: Boolean  
**Default**: `true`  
**Description**: Enable protection against accidental progress loss

```yaml
global:
  prevent_progress_regression: true  # Recommended
```

**Features when enabled**:
- Prevents overwriting completed books with low progress
- Creates new reading sessions for re-reads
- Warns about suspicious progress drops
- Blocks large progress decreases from high-progress books

### Performance Settings

#### `parallel`
**Type**: Boolean  
**Default**: `true`  
**Description**: Enable parallel processing for better performance

```yaml
global:
  parallel: true  # Process multiple books simultaneously
```

#### `workers`
**Type**: Number (1-10)  
**Default**: `3`  
**Description**: Number of parallel workers for API requests

```yaml
global:
  workers: 5  # Increase for faster syncs (if APIs can handle it)
```

**Recommendations**:
- `3` - Good default for most setups
- `5-8` - If you have fast internet and powerful servers
- `1-2` - If you experience API rate limiting

### Scheduling Settings

#### `sync_schedule`
**Type**: String (Cron format)  
**Default**: `"0 3 * * *"` (3 AM daily)  
**Description**: When to run automatic syncs

```yaml
global:
  sync_schedule: "0 */6 * * *"  # Every 6 hours
```

**Common Schedules**:
```yaml
sync_schedule: "0 3 * * *"     # Daily at 3 AM
sync_schedule: "0 */6 * * *"   # Every 6 hours
sync_schedule: "0 9,21 * * *"  # 9 AM and 9 PM daily
sync_schedule: "0 3 * * 0"     # Weekly on Sunday at 3 AM
sync_schedule: "*/30 * * * *"  # Every 30 minutes (testing only)
```

#### `timezone`
**Type**: String  
**Default**: `"UTC"`  
**Description**: Timezone for scheduling and timestamps

```yaml
global:
  timezone: "America/New_York"  # Use your local timezone
```

**Common Timezones**:
- `"UTC"` - Coordinated Universal Time
- `"America/New_York"` - Eastern Time
- `"America/Los_Angeles"` - Pacific Time
- `"Europe/London"` - British Time
- `"Europe/Berlin"` - Central European Time
- `"Asia/Tokyo"` - Japan Standard Time

### Advanced Settings

#### `dry_run`
**Type**: Boolean  
**Default**: `false`  
**Description**: Run in dry-run mode by default (no changes made)

```yaml
global:
  dry_run: true  # Useful for testing configurations
```

#### `force_sync`
**Type**: Boolean  
**Default**: `false`  
**Optional**: Yes  
**Description**: Force sync even if progress hasn't changed

```yaml
global:
  force_sync: true  # Ignore cache, sync everything
```

### Re-reading Detection Settings

#### `reread_detection`
**Type**: Object  
**Optional**: Yes  
**Description**: Fine-tune when new reading sessions are created

```yaml
global:
  reread_detection:
    reread_threshold: 30           # Below 30% = starting over
    high_progress_threshold: 85    # Above 85% = high progress
    regression_block_threshold: 50 # Block drops >50% from high progress
    regression_warn_threshold: 15  # Warn about drops >15%
```

#### Individual Re-reading Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `reread_threshold` | Number (0-100) | `30` | Progress below this is "starting over" |
| `high_progress_threshold` | Number (0-100) | `85` | Progress above this is "high progress" |
| `regression_block_threshold` | Number (0-100) | `50` | Block progress drops larger than this |
| `regression_warn_threshold` | Number (0-100) | `15` | Warn about progress drops larger than this |

## 👥 User Settings

Each user requires these settings:

### Required Fields

#### `id`
**Type**: String  
**Required**: Yes  
**Description**: Unique identifier for this user

```yaml
users:
  - id: alice                    # Must be unique
  - id: bob_audiobookshelf       # Can use descriptive names
```

#### `abs_url`
**Type**: String (URL)  
**Required**: Yes  
**Description**: Your Audiobookshelf server URL

```yaml
users:
  - id: alice
    abs_url: https://audiobookshelf.mydomain.com     # HTTPS
  - id: bob
    abs_url: http://192.168.1.100:13378              # Local IP
```

**URL Requirements**:
- Must include `http://` or `https://`
- Should not end with a trailing slash
- Must be accessible from where ShelfBridge runs

#### `abs_token`
**Type**: String  
**Required**: Yes  
**Description**: Audiobookshelf API token for this user

```yaml
users:
  - id: alice
    abs_token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Token Requirements**:
- Generate from Audiobookshelf user settings
- Must belong to a user with library access
- Should be kept secure and not shared

#### `hardcover_token`
**Type**: String  
**Required**: Yes  
**Description**: Hardcover API token for this user

```yaml
users:
  - id: alice
    hardcover_token: hc_sk_1234567890abcdef...
```

**Token Requirements**:
- Generate from Hardcover developer settings
- Must belong to account with API access enabled
- Should be kept secure and not shared

## 📝 Complete Configuration Examples

### Single User Setup

```yaml
global:
  min_progress_threshold: 5.0
  auto_add_books: false
  prevent_progress_regression: true
  sync_schedule: "0 3 * * *"
  timezone: "America/New_York"
  workers: 3

users:
  - id: john
    abs_url: https://audiobooks.mydomain.com
    abs_token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ
    hardcover_token: hc_sk_abc123def456ghi789jkl012mno345pqr678stu
```

### Family/Multi-User Setup

```yaml
global:
  min_progress_threshold: 3.0      # Lower threshold for family
  auto_add_books: true             # Auto-add for easier management
  prevent_progress_regression: true
  sync_schedule: "0 2,14 * * *"    # Twice daily
  timezone: "America/Chicago"
  workers: 4

users:
  - id: parent1
    abs_url: https://family-audiobooks.mydomain.com
    abs_token: parent1_token_here
    hardcover_token: parent1_hardcover_token
    
  - id: parent2
    abs_url: https://family-audiobooks.mydomain.com
    abs_token: parent2_token_here
    hardcover_token: parent2_hardcover_token
    
  - id: teenager
    abs_url: https://family-audiobooks.mydomain.com
    abs_token: teen_token_here
    hardcover_token: teen_hardcover_token
```

### Performance-Optimized Setup

```yaml
global:
  min_progress_threshold: 1.0      # Sync almost everything
  auto_add_books: true
  prevent_progress_regression: true
  sync_schedule: "0 */4 * * *"     # Every 4 hours
  timezone: "UTC"
  workers: 8                       # Maximum workers
  parallel: true

users:
  - id: power_user
    abs_url: https://fast-abs.mydomain.com
    abs_token: power_user_token
    hardcover_token: power_user_hardcover_token
```

### Conservative/Testing Setup

```yaml
global:
  min_progress_threshold: 25.0     # Only substantial progress
  auto_add_books: false            # Manual control
  prevent_progress_regression: true
  sync_schedule: "0 6 * * 0"       # Weekly on Sunday
  timezone: "Europe/London"
  workers: 2                       # Conservative
  dry_run: false                   # Change to true for testing

users:
  - id: careful_user
    abs_url: https://my-audiobookshelf.com
    abs_token: careful_user_token
    hardcover_token: careful_user_hardcover_token
```

## ✅ Configuration Validation

ShelfBridge automatically validates your configuration. Common validation errors:

### Syntax Errors
```yaml
# ❌ Invalid YAML syntax
users:
  - id alice                    # Missing colon
    abs_url: http://example.com

# ✅ Correct syntax
users:
  - id: alice
    abs_url: http://example.com
```

### URL Format Errors
```yaml
# ❌ Invalid URLs
abs_url: audiobookshelf.com        # Missing protocol
abs_url: https://example.com/      # Trailing slash

# ✅ Valid URLs  
abs_url: https://audiobookshelf.com
abs_url: http://192.168.1.100:13378
```

### Range Errors
```yaml
# ❌ Out of range values
min_progress_threshold: 150.0      # Max is 100
workers: 15                        # Max is 10

# ✅ Valid ranges
min_progress_threshold: 5.0        # 0-100
workers: 3                         # 1-10
```

## 🔗 Related Pages

- **[Basic Configuration](Basic-Configuration.md)** - Essential settings only
- **[Advanced Configuration](Advanced-Configuration.md)** - Power user features  
- **[Multi-User Setup](Multi-User-Setup.md)** - Managing multiple users
- **[Configuration Validation](../technical/Configuration-Validation.md)** - Testing your config

## 💡 Configuration Tips

### Security Best Practices
- Keep API tokens secure and never commit them to version control
- Use environment variables for sensitive data in production
- Regularly rotate API tokens for security

### Performance Optimization
- Start with default settings and adjust based on your needs
- Monitor sync times and adjust `workers` accordingly
- Use appropriate `min_progress_threshold` to avoid unnecessary syncs

### Troubleshooting
- Use `dry_run: true` to test configuration changes
- Validate configuration with `node src/main.js validate`
- Check logs for detailed error information

---

**Next Steps**: [Basic Configuration](Basic-Configuration.md) for a simpler getting-started guide, or [Advanced Configuration](Advanced-Configuration.md) for power user features. 