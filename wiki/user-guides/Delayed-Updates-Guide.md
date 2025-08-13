# 🔄 Delayed Updates Guide

Session-based delayed updates reduce Hardcover API calls by intelligently delaying progress updates until your listening sessions naturally end. This guide explains how to understand, configure, and use this efficiency feature.

## 🎯 What Are Delayed Updates?

### Traditional Sync Behavior

Without delayed updates, ShelfBridge syncs progress to Hardcover every time it runs:

- **Every sync cycle** (e.g., every 15 minutes)
- **Every progress change** detected
- **Immediate API calls** regardless of listening activity

### With Delayed Updates

With delayed updates enabled, ShelfBridge becomes smarter:

- **Detects active listening sessions** and delays updates
- **Waits for natural session breaks** before syncing to Hardcover
- **Reduces API calls** while maintaining complete accuracy
- **Zero data loss** with automatic recovery systems

## 📈 How It Works

### Session Detection Logic

1. **Active Session Start**: When ShelfBridge detects new progress for a book
2. **Session Monitoring**: Tracks continued progress changes during subsequent sync cycles
3. **Session End Detection**: When no new progress is detected for the configured timeout period
4. **Delayed Sync**: Only then does ShelfBridge push the final progress to Hardcover

### Example Timeline

```
9:00 AM - Start listening to audiobook (25% progress)
         ShelfBridge detects activity → Starts session, delays API call

9:15 AM - Sync cycle runs (30% progress)
         Still listening → Updates local cache only, delays API call

9:30 AM - Sync cycle runs (35% progress)
         Still listening → Updates local cache only, delays API call

9:45 AM - Finished listening session (40% progress)
         No new progress after 15 min timeout → Syncs 40% to Hardcover

Result: 1 API call instead of 4, but Hardcover still gets accurate 40% progress
```

### Smart Override Scenarios

Delayed updates include intelligent overrides for important events:

- **📖 Book Completion**: Always synced immediately regardless of session state
- **⏰ Maximum Delay**: Safety mechanism prevents indefinite delays
- **📊 Significant Progress**: Large progress jumps (>5%) can trigger immediate sync
- **🎯 Milestone Progress**: Crossing 25%, 50%, 75%, 90%, 95% thresholds

## ⚙️ Configuration Options

### Basic Configuration

| Setting                | Description                                | Default         | Range          |
| ---------------------- | ------------------------------------------ | --------------- | -------------- |
| `enabled`              | Enable/disable delayed updates             | `false`         | `true`/`false` |
| `session_timeout`      | Time to wait for more progress (seconds)   | `900` (15 min)  | 60-7200        |
| `max_delay`            | Maximum time before forcing sync (seconds) | `3600` (1 hour) | 300-86400      |
| `immediate_completion` | Always sync book completion immediately    | `true`          | `true`/`false` |

### YAML Configuration

```yaml
global:
  delayed_updates:
    enabled: true
    session_timeout: 1800 # 30 minutes
    max_delay: 7200 # 2 hours
    immediate_completion: true
```

### Environment Variables (Docker)

```bash
SHELFBRIDGE_DELAYED_UPDATES_ENABLED=true
SHELFBRIDGE_DELAYED_UPDATES_SESSION_TIMEOUT=1800
SHELFBRIDGE_DELAYED_UPDATES_MAX_DELAY=7200
SHELFBRIDGE_DELAYED_UPDATES_IMMEDIATE_COMPLETION=true
```

## 🚀 Use Cases & Recommendations

### Ideal Scenarios

**✅ Heavy Listeners**

- Listen for 2+ hours continuously
- Want to reduce Hardcover API usage
- Prefer efficiency over immediate updates

**✅ API-Conscious Users**

- Concerned about rate limiting
- Running multiple sync services
- Want to be respectful to Hardcover's API

**✅ Long Reading Sessions**

- Audiobook marathons
- Extended commutes
- Weekend reading binges

### Not Ideal For

**❌ Casual Listeners**

- Listen in short bursts (< 30 minutes)
- Want immediate progress reflection
- Prefer real-time sync behavior

**❌ Shared Device Users**

- Multiple family members using same device
- Want immediate progress visibility
- Prefer traditional sync behavior

## 🔧 Configuration Examples

### Conservative Setup (Recommended)

```yaml
# Good for most users wanting efficiency without sacrificing responsiveness
delayed_updates:
  enabled: true
  session_timeout: 900 # 15 minutes
  max_delay: 3600 # 1 hour
  immediate_completion: true
```

### Aggressive API Reduction

```yaml
# Maximum efficiency for heavy listeners
delayed_updates:
  enabled: true
  session_timeout: 3600 # 1 hour
  max_delay: 14400 # 4 hours
  immediate_completion: true # Still sync completions immediately
```

### Quick Response Setup

```yaml
# Minimal delays while still gaining some efficiency
delayed_updates:
  enabled: true
  session_timeout: 300 # 5 minutes
  max_delay: 1800 # 30 minutes
  immediate_completion: true
```

## 📊 Performance Benefits

### API Call Reduction

**Example: 4-hour listening session with 15-minute sync schedule**

| Configuration                    | API Calls | Reduction |
| -------------------------------- | --------- | --------- |
| Traditional sync                 | 16 calls  | 0%        |
| Delayed updates (15 min timeout) | 1 call    | 94%       |
| Delayed updates (30 min timeout) | 1 call    | 94%       |

**Example: Multiple short sessions throughout day**

| Configuration                    | API Calls | Reduction |
| -------------------------------- | --------- | --------- |
| Traditional sync                 | 24 calls  | 0%        |
| Delayed updates (15 min timeout) | 8 calls   | 67%       |
| Delayed updates (30 min timeout) | 6 calls   | 75%       |

### Real-World Impact

- **Reduced server load** on Hardcover
- **Lower chance of hitting rate limits**
- **Improved sync reliability** under high usage
- **Better resource utilization** for your server

## 🛡️ Safety Features

### Data Protection

**✅ Zero Data Loss**

- All progress changes are stored locally
- Failed syncs are automatically retried
- Database persistence ensures durability

**✅ Startup Recovery**

- Active sessions detected after app restart
- Automatic processing of interrupted sessions
- Complete progress history maintained

**✅ Maximum Delay Safety**

- Prevents indefinite delays
- Forces sync after configured maximum time
- Ensures progress never gets "stuck"

### Monitoring & Visibility

**Session State Tracking**

```bash
# Check delayed update status
shelfbridge debug --user your_username

# Look for delayed update information in logs
docker logs shelfbridge | grep "delayed\|session"
```

**Sync Result Indicators**

- `books_delayed` counter in sync results
- `expired_sessions_processed` during startup
- Session state information in debug output

## 🔍 Troubleshooting

### Common Issues

**❓ Progress Not Syncing**

```bash
# Check if delayed updates are enabled
shelfbridge config show | grep delayed_updates

# Verify session timeout isn't too long
# Consider reducing session_timeout value
```

**❓ Still Too Many API Calls**

```bash
# Check your listening patterns
# Consider increasing session_timeout for longer sessions
# Verify max_delay isn't too short
```

**❓ Progress Appears Stale**

```bash
# This is expected behavior during active sessions
# Check that immediate_completion is enabled for finished books
# Verify max_delay isn't too long for your needs
```

### Debug Commands

```bash
# Show current configuration
shelfbridge config show

# Check session state for specific user
shelfbridge debug --user your_username

# View detailed sync information
shelfbridge sync --verbose --user your_username
```

## 📝 Migration Guide

### Enabling Delayed Updates

1. **Backup Your Configuration**

   ```bash
   cp config/config.yaml config/config.yaml.backup
   ```

2. **Enable Feature**

   ```yaml
   global:
     delayed_updates:
       enabled: true
   ```

3. **Test Configuration**

   ```bash
   shelfbridge validate
   ```

4. **Monitor First Sessions**
   ```bash
   shelfbridge sync --verbose --user your_username
   ```

### Disabling Delayed Updates

1. **Set enabled to false**

   ```yaml
   global:
     delayed_updates:
       enabled: false
   ```

2. **Process any pending sessions**
   ```bash
   # Run a final sync to clear any pending sessions
   shelfbridge sync --user your_username
   ```

## 💡 Best Practices

### Configuration Tips

1. **Start Conservative**: Use default settings initially
2. **Monitor Usage**: Watch API call reduction in logs
3. **Adjust Gradually**: Increase timeouts based on listening patterns
4. **Keep Completion Sync**: Leave `immediate_completion: true` enabled

### Listening Behavior

1. **Consistent Sessions**: Works best with regular listening patterns
2. **Natural Breaks**: Take advantage of session timeout detection
3. **Completion Awareness**: Books are still synced immediately when finished

### Monitoring

1. **Check Logs**: Monitor delayed update activity
2. **Sync Results**: Watch for `books_delayed` counters
3. **Debug Output**: Use debug commands to understand session state

---

**Next Steps:**

- [Configure delayed updates](../admin/Configuration-Reference.md#delayed_updates)
- [Monitor sync results](Understanding-Sync-Results.md)
- [Troubleshoot issues](../troubleshooting/Troubleshooting-Guide.md)
