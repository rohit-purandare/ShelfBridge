# 🐛 Debug Commands Guide

This guide provides detailed information about debugging ShelfBridge issues using the built-in debug command and other troubleshooting tools.

## 🎯 Quick Start

The fastest way to diagnose issues is to run the debug command:

```bash
# Debug all users
node src/main.js debug

# Debug specific user
node src/main.js debug --user alice
```

## 📋 Debug Command Overview

The `debug` command provides comprehensive diagnostic information organized into six main sections:

### 1. 📋 User Configuration

- **Purpose**: Validates your user setup
- **Checks**: Required fields, API tokens, URLs
- **Security**: Masks sensitive tokens

### 2. 🔌 Connection Testing

- **Purpose**: Tests API connectivity
- **Tests**: Both Audiobookshelf and Hardcover APIs
- **Information**: Server details, user information, library statistics

### 3. 💾 Cache Information

- **Purpose**: Shows cache status and performance
- **Data**: Total books, cache size, recent activity
- **User Data**: Books specific to the user being debugged

### 4. 🔍 Sample API Calls

- **Purpose**: Tests actual data flow
- **Tests**: Book fetching, identifier matching
- **Validation**: ISBN/ASIN matching between services

### 5. 🖥️ System Information

- **Purpose**: Shows runtime environment
- **Data**: Node.js version, platform, memory usage
- **Performance**: Process uptime, resource usage

### 6. ⚙️ Configuration Check

- **Purpose**: Validates global settings
- **Settings**: Sync behavior, scheduling, automation
- **Modes**: Dry run, thresholds, protection settings

## 🔧 Common Debug Scenarios

### Configuration Issues

If you're having trouble with your setup:

```bash
# Check configuration
node src/main.js debug --user YOUR_USER_ID
```

**Look for:**

- ❌ Missing required fields
- ❌ Invalid API tokens
- ❌ Incorrect URLs

### Connection Problems

If sync is failing with network errors:

```bash
# Test connections
node src/main.js validate --connections
node src/main.js debug --user YOUR_USER_ID
```

**Look for:**

- ❌ API connection failures
- ❌ Authentication errors
- ❌ Server unreachable

### Sync Issues

If books aren't syncing properly:

```bash
# Debug sync process
node src/main.js debug --user YOUR_USER_ID
node src/main.js sync --user YOUR_USER_ID --dry-run
```

**Look for:**

- ❌ No books found in either service
- ❌ Book matching failures
- ❌ Identifier problems (ISBN/ASIN)

### Performance Problems

If sync is slow or using too much memory:

```bash
# Check system resources
node src/main.js debug
node src/main.js cache --stats
```

**Look for:**

- 🔍 High memory usage
- 🔍 Large cache size
- 🔍 Long processing times

## 🎨 Reading Debug Output

### Status Indicators

| Symbol | Meaning            |
| ------ | ------------------ |
| ✅     | Success/Working    |
| ❌     | Error/Failed       |
| 🔍     | Information        |
| ⏱️     | Timing/Performance |

### Common Patterns

#### Successful Configuration

```
📋 USER CONFIGURATION
------------------------------
User ID: alice
Audiobookshelf URL: https://abs.example.com
Audiobookshelf Token: abcd1234...
Hardcover Token: wxyz5678...
✅ All required fields present
```

#### Connection Issues

```
🔌 CONNECTION TESTING
------------------------------
Testing Audiobookshelf connection...
Audiobookshelf: ❌ Error - Connection refused
Testing Hardcover connection...
Hardcover: ❌ Error - Invalid token
```

#### Cache Problems

```
💾 CACHE INFORMATION
------------------------------
Cache error: SQLITE_BUSY: database is locked
```

## 🔍 Advanced Debugging

### Verbose Logging

For more detailed information, check the logs:

```bash
# View recent logs
tail -f logs/app.log

# Debug level logging
DEBUG=* node src/main.js debug
```

### Database Debugging

If you suspect cache issues:

```bash
# Check cache stats
node src/main.js cache --stats

# View cache contents
node src/main.js cache --show

# Export cache for analysis
node src/main.js cache --export debug-cache.json
```

### Network Debugging

For network-related issues:

```bash
# Test connections separately
node src/main.js validate --connections

# Check specific endpoints
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://abs.example.com/api/me
```

## 📊 Interpreting Results

### Healthy System

A properly configured system should show:

- ✅ All required fields present
- ✅ Both APIs connected
- ✅ Cache functioning normally
- ✅ Sample API calls working
- 🔍 Reasonable memory usage

### Common Issues and Solutions

#### Missing Configuration

```
❌ Missing required fields: hardcover_token
```

**Solution**: Add the missing field to your `config.yaml`

#### API Connection Failed

```
Audiobookshelf: ❌ Error - Connection refused
```

**Solutions**:

- Check if server is running
- Verify URL is correct
- Check firewall settings
- Validate API token

#### Invalid Token

```
Hardcover: ❌ Error - Invalid token
```

**Solutions**:

- Regenerate API token
- Check token hasn't expired
- Verify token format

#### Cache Issues

```
Cache error: SQLITE_BUSY: database is locked
```

**Solutions**:

- Stop other ShelfBridge instances
- Clear cache: `node src/main.js cache --clear`
- Check file permissions

#### No Books Found

```
Found 0 books in ABS
```

**Solutions**:

- Check library permissions
- Verify books exist in Audiobookshelf
- Check user has access to libraries

## 🛠️ Troubleshooting Workflow

### Step 1: Basic Validation

```bash
node src/main.js validate --connections
```

### Step 2: User-Specific Debug

```bash
node src/main.js debug --user YOUR_USER_ID
```

### Step 3: Test Dry Run

```bash
node src/main.js sync --user YOUR_USER_ID --dry-run
```

### Step 4: Check Logs

```bash
tail -f logs/app.log
```

### Step 5: Cache Analysis

```bash
node src/main.js cache --stats
node src/main.js cache --show
```

## 📞 Getting Help

When requesting help, include:

1. **Full debug output** (with tokens masked)
2. **Relevant log excerpts**
3. **System information** (OS, Node.js version)
4. **Configuration details** (sanitized)
5. **Steps to reproduce** the issue

### Sanitizing Debug Output

Before sharing debug output, ensure you:

- ✅ Tokens are already masked by the debug command
- ✅ Remove any personal server URLs if needed
- ✅ Keep diagnostic information intact

## 🔗 Related Commands

- **[CLI Reference](CLI-Reference.md)** - All available commands
- **[Configuration](../admin/Configuration-Reference.md)** - Setup and configuration
- **[Troubleshooting](../troubleshooting/Troubleshooting-Guide.md)** - Common issues and solutions
- **[Cache Management](../admin/Cache-Management.md)** - Understanding the cache system

## 💡 Pro Tips

### Quick Health Check

```bash
# One-liner to check everything
node src/main.js debug --user $(head -1 config/config.yaml | grep -o 'id:.*' | cut -d: -f2 | tr -d ' ')
```

### Automation-Friendly Debug

```bash
# JSON output for scripts (if needed)
node src/main.js debug --user alice 2>&1 | tee debug-output.txt
```

### Performance Monitoring

```bash
# Time the debug command
time node src/main.js debug --user alice
```

### Before/After Comparison

```bash
# Before changes
node src/main.js cache --export before.json

# After changes
node src/main.js cache --export after.json

# Compare
diff before.json after.json
```

---

**Need more help?** Check the [Troubleshooting Guide](../troubleshooting/Troubleshooting-Guide.md) or open an issue on GitHub.
