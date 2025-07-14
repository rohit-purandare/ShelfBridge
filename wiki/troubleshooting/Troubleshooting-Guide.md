# 🆘 Troubleshooting Guide

This guide helps you diagnose and solve common ShelfBridge issues. Start with the most common problems and work your way through the diagnostic steps.

## 📄 Error Dump Files

When sync errors occur, ShelfBridge automatically creates detailed error reports in the `data/` folder. These files are invaluable for troubleshooting:

**File location:** `data/failed-sync-{user_id}-{timestamp}.txt`

**What they contain:**
- Complete sync summary with statistics
- Detailed information for each failed book
- Specific error messages and actions taken
- Book identifiers and progress information
- Processing timings for debugging

**To use error dumps:**
1. Look for files in the `data/` folder after a failed sync
2. Open the most recent file with your text editor
3. Review the error patterns and book details
4. Use the information to adjust your configuration

**Disable error dumps:**
```yaml
global:
  dump_failed_books: false
```

## 🚀 Quick Diagnostics

Before diving into specific issues, run these commands to get a quick overview:

```bash
# Test your configuration
node src/main.js validate --connections

# Run a dry-run to see what would happen
node src/main.js sync --dry-run

# Check cache status
node src/main.js cache --stats

# Debug a specific user
node src/main.js debug --user your_username
```

## 🔧 Most Common Issues

### 1. "Configuration validation failed"

**Symptoms:**
- ShelfBridge won't start
- Error messages about invalid configuration
- Placeholder values detected

**Diagnostic Steps:**
```bash
# Check configuration syntax
node src/main.js validate

# Show configuration help
node src/main.js validate --help-config
```

**Solutions:**

#### Invalid YAML Syntax
```yaml
# ❌ Common syntax errors
users:
  - id alice              # Missing colon after 'id'
    abs_url http://...    # Missing colon after 'abs_url'

# ✅ Correct syntax
users:
  - id: alice
    abs_url: http://...
```

#### Placeholder Values Still Present
```yaml
# ❌ Still has placeholder values
abs_token: your_audiobookshelf_api_token
hardcover_token: your_hardcover_api_token

# ✅ Real values
abs_token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
hardcover_token: hc_sk_1234567890abcdef...
```

#### Invalid URLs
```yaml
# ❌ Common URL errors
abs_url: audiobookshelf.com           # Missing protocol
abs_url: https://example.com/         # Trailing slash
abs_url: https://localhost:13378/     # Trailing slash

# ✅ Correct URLs
abs_url: https://audiobookshelf.com
abs_url: http://192.168.1.100:13378
abs_url: https://abs.mydomain.com
```

### 2. "No books found" or Empty Library

**Symptoms:**
- Sync completes but shows 0 books processed
- Debug shows empty library

**Diagnostic Steps:**
```bash
# Debug user to see raw data
node src/main.js debug --user your_username

# Test API connection
curl -H "Authorization: Bearer YOUR_TOKEN" "YOUR_ABS_URL/api/me"
```

**Solutions:**

#### Check Library Access
1. Log into Audiobookshelf web interface
2. Verify you can see your books
3. Check user permissions in admin settings
4. Ensure the API token belongs to the correct user

#### Check API Token
```bash
# Test token directly
curl -H "Authorization: Bearer YOUR_TOKEN" "YOUR_ABS_URL/api/libraries"
```

If this fails:
1. Generate a new API token from Audiobookshelf
2. Copy the complete token (they're long!)
3. Update your configuration

#### Check Reading Progress
- Ensure you have actually listened to some books
- Progress must be above your `min_progress_threshold`
- Try temporarily lowering the threshold to 0.1

### 3. "GraphQL errors" or Hardcover API Issues

**Symptoms:**
- Books found but sync fails
- "Authentication failed" errors
- "Field not found" errors

**Diagnostic Steps:**
```bash
# Test Hardcover token
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_HARDCOVER_TOKEN" \
  -d '{"query": "{ me { id name } }"}' \
  https://api.hardcover.app/v1/graphql
```

**Solutions:**

#### Check Hardcover API Token
1. Go to [hardcover.app/account/developer](https://hardcover.app/account/developer)
2. Ensure API access is enabled
3. Generate a new token if needed
4. Update your configuration

#### API Access Not Enabled
1. Log into Hardcover
2. Go to Account Settings
3. Look for "Developer" or "API" section
4. Enable API access
5. Generate new token

#### Network/Firewall Issues
- Ensure access to `api.hardcover.app` on port 443
- Check corporate firewall settings
- Try from a different network

### 4. Books Not Matching

**Symptoms:**
- Books auto-added instead of syncing existing ones
- "Not found in Hardcover library" messages
- Wrong book matches

**Diagnostic Steps:**
```bash
# Check book identifiers
node src/main.js debug --user your_username | grep -A 5 "Book title"
```

**Solutions:**

#### Missing ASIN/ISBN Metadata
1. Check book metadata in Audiobookshelf
2. Add ISBN or ASIN information if available
3. Use the "Edit" button in Audiobookshelf to add metadata

#### Different Editions
- ShelfBridge matches by ASIN (audiobooks) or ISBN (books)
- If you have different editions, they might not match
- Consider enabling `auto_add_books: true` for flexibility

#### Improve Matching
```yaml
global:
  auto_add_books: true  # Add books if not found
  min_progress_threshold: 1.0  # Lower threshold
```

### 5. Performance Issues

**Symptoms:**
- Sync takes a very long time
- Timeout errors
- High CPU/memory usage

**Diagnostic Steps:**
```bash
# Check cache stats
node src/main.js cache --stats

# Time a sync
time node src/main.js sync

# Check cache contents
node src/main.js cache --show
```

**Solutions:**

#### Reduce Workers
```yaml
global:
  workers: 2  # Reduce from default 3
```

#### Clear Corrupted Cache
```bash
# Clear cache to start fresh
node src/main.js cache --clear
```

#### Network Issues
- Check internet connection stability
- Try different times of day
- Verify server accessibility

#### Rate Limiting (Normal Behavior)
Rate limiting is **expected behavior** and not a problem to fix:

**Rate limiting messages you might see:**
```
⚠️  Rate limit warning: 44/55 requests used in the current minute
⚠️  Rate limit exceeded. Waiting 60s before next request
```

**What this means:**
- **Normal operation**: ShelfBridge respects Hardcover's 55 requests/minute limit
- **Automatic handling**: Requests are queued, not dropped
- **Slower sync**: Large libraries may take 2-5 minutes instead of seconds
- **No data loss**: All books will be processed, just more slowly

**When rate limiting is expected:**
- **Large libraries**: 100+ books with reading progress  
- **Initial syncs**: First sync processes all books
- **Books with metadata**: Each book requires 1-2 API calls

**This is NOT a problem to fix** - it's protective behavior that prevents API errors.

## 🐳 Docker-Specific Issues

### Container Won't Start

**Diagnostic Steps:**
```bash
# Check container status
docker-compose ps

# View container logs
docker-compose logs shelfbridge

# Check configuration inside container
docker exec -it shelfbridge cat /app/config/config.yaml
```

**Solutions:**

#### Configuration Not Found
```bash
# Verify volume mounts
docker volume inspect shelfbridge-config

# Copy sample config if needed
docker exec -it shelfbridge cp /app/config/config.yaml.example /app/config/config.yaml
```

#### Permission Issues

**Common Error:** `permission denied when docker tries to copy the example file`

**Note:** This issue has been automatically resolved in recent versions of ShelfBridge. The container now automatically fixes volume permissions on startup.

**If you're still experiencing this issue:**

**Symptoms:**
- Container fails to start with permission errors
- "permission denied" when copying config.yaml.example
- Container exits immediately after startup

**Diagnostic Steps:**
```bash
# Check container logs for permission errors
docker-compose logs shelfbridge

# Check file permissions inside container
docker exec -it shelfbridge ls -la /app/config/

# Check volume ownership
docker exec -it shelfbridge ls -la /app/
```

**Solutions:**

**Option 1: Update to Latest Version (Recommended)**
```bash
# Pull the latest image
docker-compose pull

# Restart with new image
docker-compose up -d
```

**Option 2: Manual Fix (Legacy Versions)**
```bash
# Fix ownership of config directory (run as root)
docker exec -u root -it shelfbridge chown -R node:node /app/config

# Fix ownership of data directory
docker exec -u root -it shelfbridge chown -R node:node /app/data

# Restart container
docker-compose restart shelfbridge
```

**Option 3: Recreate Volumes (If above doesn't work)**
```bash
# Stop container
docker-compose down

# Remove volumes (WARNING: This will delete your config and cache)
docker volume rm shelfbridge-config shelfbridge-data

# Start container (will recreate config from template)
docker-compose up -d
```

**Option 4: Use Bind Mounts with Correct Permissions**
```bash
# Create local directories with correct ownership
mkdir -p ./config ./data
sudo chown -R 1000:1000 ./config ./data

# Update docker-compose.yml to use bind mounts
volumes:
  - ./config:/app/config
  - ./data:/app/data

# Restart container
docker-compose up -d
```

### Container Keeps Restarting

**Check Health Status:**
```bash
# View health check results
docker inspect shelfbridge | grep -A 10 "Health"

# Run health check manually
docker exec -it shelfbridge node src/main.js config --help
```

**Common Causes:**
- Invalid configuration causing startup failures
- Missing configuration file
- Permission issues

## 💾 Cache Issues

### Cache Corruption

**Symptoms:**
- Inconsistent sync results
- SQL error messages
- Crashes during sync

**Solutions:**
```bash
# Clear cache completely
node src/main.js cache --clear

# Export cache before clearing (backup)
node src/main.js cache --export backup-$(date +%Y%m%d).json

# Check cache file permissions
ls -la data/.book_cache.db
```

### Cache Not Working

**Symptoms:**
- Every sync takes the same amount of time
- No performance improvement after first sync

**Check Cache Status:**
```bash
# Verify cache is being written
node src/main.js cache --stats

# Check after sync
node src/main.js sync
node src/main.js cache --stats
```

## 🌐 Network Issues

### Connection Timeouts

**Symptoms:**
- "ECONNREFUSED" errors
- "ETIMEDOUT" errors
- Inconsistent connectivity

**Solutions:**

#### Check Audiobookshelf Server
```bash
# Test direct connection
curl -I YOUR_ABS_URL

# Test API endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" "YOUR_ABS_URL/api/ping"
```

#### Check Hardcover API
```bash
# Test Hardcover connectivity
curl -I https://api.hardcover.app/v1/graphql
```

#### Network Configuration
- Verify firewall settings
- Check VPN connectivity if using private networks
- Test from the same network as ShelfBridge

### Proxy/Reverse Proxy Issues

**Common Problems:**
- Audiobookshelf behind reverse proxy
- SSL/TLS certificate issues
- Path rewriting problems

**Solutions:**
- Ensure API endpoints are properly proxied
- Verify SSL certificates are valid
- Test direct connection to backend if possible

## 📊 Logging and Debugging

### Enable Detailed Logging

**Docker:**
```bash
# View live logs
docker-compose logs -f shelfbridge

# View specific time range
docker-compose logs --since="1h" shelfbridge
```

**Node.js:**
```bash
# Check log files
tail -f logs/app.log

# View error logs specifically
grep "ERROR" logs/app.log
```

### Debug Mode

**Full Debug Output:**
```bash
# Debug all users with detailed output
node src/main.js debug

# Debug specific user
node src/main.js debug --user alice

# Combine with dry-run for safe testing
node src/main.js debug --user alice && node src/main.js sync --user alice --dry-run
```

## 🔄 Progress Regression Issues

### Unwanted Progress Regression Protection

**Symptoms:**
- Books not syncing even though they should
- "Progress regression detected" warnings
- New reading sessions created unexpectedly

**Check Settings:**
```yaml
global:
  prevent_progress_regression: true  # Current setting
  reread_detection:
    reread_threshold: 30
    regression_warn_threshold: 15
```

**Solutions:**

#### Disable Protection Temporarily
```yaml
global:
  prevent_progress_regression: false  # Disable protection
```

#### Adjust Thresholds
```yaml
global:
  reread_detection:
    reread_threshold: 10              # Lower threshold
    regression_warn_threshold: 25     # Higher warning threshold
```

#### Force Sync
```bash
# Force sync specific books
node src/main.js sync --force
```

## 🔧 Getting Help

### Information to Gather

When reporting issues, include:

1. **Configuration** (with tokens redacted):
```bash
node src/main.js config
```

2. **Debug output**:
```bash
node src/main.js debug --user your_username
```

3. **System information**:
```bash
# Node.js version
node --version

# Docker version
docker --version

# Operating system
uname -a  # Linux/Mac
ver       # Windows
```

4. **Logs** (recent relevant sections):
```bash
# Last 50 lines of logs
tail -50 logs/app.log

# Docker logs
docker-compose logs --tail=50 shelfbridge
```

### Where to Get Help

- **[GitHub Issues](https://github.com/rohit-purandare/ShelfBridge/issues)** - Bug reports and feature requests
- **[FAQ](FAQ.md)** - Quick answers to common questions
- **[Configuration Help](../admin/Configuration-Overview.md)** - Detailed configuration guide

## 🔗 Related Pages

- **[FAQ](FAQ.md)** - Quick answers to common questions
- **[Error Messages](Error-Messages.md)** - Specific error message explanations
- **[CLI Reference](../technical/CLI-Reference.md)** - Complete command documentation
- **[Configuration Overview](../admin/Configuration-Overview.md)** - Configuration help

---

**Still stuck?** Open an issue on [GitHub](https://github.com/rohit-purandare/ShelfBridge/issues) with the information gathered from this guide. 