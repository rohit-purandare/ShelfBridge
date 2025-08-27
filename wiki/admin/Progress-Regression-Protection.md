# 🛡️ Progress Regression Protection

Progress regression protection is one of ShelfBridge's most important features. It prevents accidental loss of reading progress and handles re-reading scenarios intelligently. This guide explains how it works and how to configure it.

## 🎯 What is Progress Regression Protection?

Progress regression protection prevents:

- ✅ Completed books from being marked as incomplete
- ✅ High progress from being accidentally reset
- ✅ Loss of reading history during re-reads
- ✅ Overwriting finish dates with partial progress

Instead, it creates new reading sessions for re-reads while preserving your original completion.

## 🔧 How It Works

### Without Protection (Dangerous)

```
Book: "The Hobbit"
Original: 100% completed on 2024-01-15
Current ABS: 25% progress (re-reading)
Result: ❌ Completion lost, marked as 25% incomplete
```

### With Protection (Safe)

```
Book: "The Hobbit"
Original: 100% completed on 2024-01-15
Current ABS: 25% progress (re-reading)
Result: ✅ Original completion preserved
        ✅ New reading session created for re-read
```

## ⚙️ Configuration Options

### Basic Configuration

```yaml
global:
  # Enable progress regression protection (recommended)
  prevent_progress_regression: true
```

### Advanced Configuration

```yaml
global:
  # Enable protection
  prevent_progress_regression: true

  # Fine-tune protection behavior
  reread_detection:
    enabled: true

    # Progress threshold for detecting re-reads (30% or below = re-read)
    reread_threshold: 30.0

    # High progress threshold (85% or above = high progress)
    high_progress_threshold: 85.0

    # Block progress drops larger than this (50 percentage points)
    regression_block_threshold: 50.0

    # Warn about progress drops larger than this (15 percentage points)
    regression_warn_threshold: 15.0

    # Create new reading sessions for re-reads
    create_new_sessions: true
```

## 🔍 Detection Scenarios

### Scenario 1: Re-reading Detection

**Situation**: You completed a book and are now re-reading it

```
# Example book state
Book: "Foundation" by Isaac Asimov
Previous: 100% completed on 2024-01-15
Current: 15% progress on 2024-03-01
```

**Protection Action**:

```
🔄 Re-read detected for "Foundation"
✅ Preserving original completion (100% on 2024-01-15)
✅ Creating new reading session for current progress (15%)
```

### Scenario 2: High Progress Protection

**Situation**: You have high progress but it dropped significantly

```
# Example book state
Book: "Dune" by Frank Herbert
Previous: 92% progress
Current: 35% progress
```

**Protection Action**:

```
🛡️ High progress drop detected for "Dune"
⚠️ Progress drop: 92% → 35% (57 percentage points)
🚫 Blocking progress update to prevent data loss
💡 If intentional, use --force flag to override
```

### Scenario 3: Warning Threshold

**Situation**: Moderate progress drop that triggers warning

```
# Example book state
Book: "The Martian" by Andy Weir
Previous: 45% progress
Current: 25% progress
```

**Protection Action**:

```
⚠️ Progress regression warning for "The Martian"
📉 Progress drop: 45% → 25% (20 percentage points)
✅ Allowing update but flagging for attention
```

## 🎛️ Threshold Configuration

### Understanding Thresholds

```yaml
global:
  reread_detection:
    # When is something considered a re-read?
    reread_threshold: 30.0 # 30% or below = likely re-read

    # When is progress considered "high"?
    high_progress_threshold: 85.0 # 85% or above = high progress

    # When should we block updates?
    regression_block_threshold: 50.0 # Block drops >50 percentage points

    # When should we warn?
    regression_warn_threshold: 15.0 # Warn about drops >15 percentage points
```

### Threshold Examples

| Previous | Current | Threshold Check        | Action                |
| -------- | ------- | ---------------------- | --------------------- |
| 100%     | 15%     | Below reread_threshold | ✅ Create new session |
| 95%      | 20%     | Below reread_threshold | ✅ Create new session |
| 90%      | 25%     | Above block_threshold  | 🚫 Block update       |
| 60%      | 40%     | Above warn_threshold   | ⚠️ Warn but allow     |
| 50%      | 45%     | Below warn_threshold   | ✅ Normal update      |

## 🎨 Customization Examples

### Conservative Protection

```yaml
global:
  prevent_progress_regression: true
  reread_detection:
    enabled: true
    reread_threshold: 40.0 # Higher threshold for re-reads
    high_progress_threshold: 75.0 # Lower threshold for high progress
    regression_block_threshold: 30.0 # Block smaller drops
    regression_warn_threshold: 10.0 # Warn about small drops
    create_new_sessions: true
```

**Use case**: Protect against any significant progress loss

### Permissive Protection

```yaml
global:
  prevent_progress_regression: true
  reread_detection:
    enabled: true
    reread_threshold: 20.0 # Lower threshold for re-reads
    high_progress_threshold: 90.0 # Higher threshold for high progress
    regression_block_threshold: 70.0 # Only block large drops
    regression_warn_threshold: 30.0 # Only warn about large drops
    create_new_sessions: true
```

**Use case**: Allow most progress changes but protect completed books

### Minimal Protection

```yaml
global:
  prevent_progress_regression: true
  reread_detection:
    enabled: true
    reread_threshold: 10.0 # Only very low progress = re-read
    high_progress_threshold: 95.0 # Only near-completion = high progress
    regression_block_threshold: 80.0 # Only block massive drops
    regression_warn_threshold: 50.0 # Only warn about huge drops
    create_new_sessions: true
```

**Use case**: Minimal protection, maximum flexibility

## 🔄 Re-reading Sessions

### How New Sessions Work

When re-reading is detected, ShelfBridge creates a new reading session:

```
Original Session:
  Book: "The Hobbit"
  Progress: 100%
  Completed: 2024-01-15
  Status: ✅ Completed

New Session:
  Book: "The Hobbit"
  Progress: 25%
  Started: 2024-03-01
  Status: 📖 In Progress
```

### Session Management

```yaml
global:
  reread_detection:
    # Create new sessions for re-reads
    create_new_sessions: true

    # Preserve original completion dates
    preserve_completion_dates: true

    # Mark new sessions appropriately
    mark_as_reread: true
```

## 🎯 Per-User Configuration

### Different Protection Levels

```yaml
global:
  prevent_progress_regression: true # Default for all users

users:
  - id: alice
    # Alice uses default protection
    abs_url: https://abs.example.com
    abs_token: alice_token
    hardcover_token: alice_hardcover_token

  - id: bob
    # Bob wants more aggressive protection
    prevent_progress_regression: true
    reread_detection:
      reread_threshold: 40.0
      regression_block_threshold: 25.0
    abs_url: https://abs.example.com
    abs_token: bob_token
    hardcover_token: bob_hardcover_token

  - id: charlie
    # Charlie wants minimal protection
    prevent_progress_regression: true
    reread_detection:
      reread_threshold: 15.0
      regression_block_threshold: 75.0
    abs_url: https://abs.example.com
    abs_token: charlie_token
    hardcover_token: charlie_hardcover_token
```

## 🔍 Debugging Protection Issues

### Understanding Protection Messages

**Re-read Detection**:

```
🔄 Re-read detected for "Book Title"
🔸 Previous: 100% completed on 2024-01-15
🔸 Current: 15% progress on 2024-03-01
🔸 Action: Creating new reading session
```

**High Progress Protection**:

```
🛡️ High progress drop detected for "Book Title"
🔸 Previous: 92% progress
🔸 Current: 35% progress
🔸 Drop: 57 percentage points (> 50 threshold)
🔸 Action: Blocking update
```

**Warning Threshold**:

```
⚠️ Progress regression warning for "Book Title"
🔸 Previous: 45% progress
🔸 Current: 25% progress
🔸 Drop: 20 percentage points (> 15 threshold)
🔸 Action: Allowing update with warning
```

### Debug Commands

```bash
# Check protection behavior for specific user
docker exec -it shelfbridge node src/main.js debug --user alice

# Run dry run to see protection decisions
docker exec -it shelfbridge node src/main.js sync --dry-run

# Check cache for book progress history
docker exec -it shelfbridge node src/main.js cache --show | grep "Book Title"
```

## 🚨 Override Protection

### When to Override

Sometimes you need to override protection:

- Correcting wrong completion status
- Resetting progress intentionally
- Fixing sync errors

### Override Methods

```bash
# Force sync ignoring protection
docker exec -it shelfbridge node src/main.js sync --force

# Disable protection temporarily
# Edit config.yaml: prevent_progress_regression: false
# Run sync, then re-enable protection
```

### User-Specific Override

```yaml
users:
  - id: alice
    # Temporarily disable protection for Alice
    prevent_progress_regression: false
    abs_url: https://abs.example.com
    abs_token: alice_token
    hardcover_token: alice_hardcover_token
```

## 📊 Common Scenarios

### Scenario: Family Sharing

**Problem**: Multiple family members reading the same book

```yaml
# Solution: Different user configurations
users:
  - id: parent
    # Parent wants strict protection
    prevent_progress_regression: true
    reread_detection:
      reread_threshold: 30.0
      regression_block_threshold: 40.0

  - id: child
    # Child might restart books frequently
    prevent_progress_regression: true
    reread_detection:
      reread_threshold: 50.0 # Higher re-read threshold
      regression_block_threshold: 60.0 # Allow more flexibility
```

### Scenario: Testing/Development

**Problem**: Testing sync with same books repeatedly

```yaml
# Solution: Disable protection for testing
users:
  - id: test_user
    prevent_progress_regression: false # Disable for testing
    abs_url: https://abs-test.example.com
    abs_token: test_token
    hardcover_token: test_hardcover_token
```

### Scenario: Library Cleanup

**Problem**: Cleaning up incorrect progress data

```yaml
# Solution: Temporarily disable protection
global:
  prevent_progress_regression: false  # Disable globally

# After cleanup, re-enable:
global:
  prevent_progress_regression: true
```

## 📈 Best Practices

### Recommended Settings

**For most users:**

```yaml
global:
  prevent_progress_regression: true
  reread_detection:
    enabled: true
    reread_threshold: 30.0
    high_progress_threshold: 85.0
    regression_block_threshold: 50.0
    regression_warn_threshold: 15.0
    create_new_sessions: true
```

**For heavy re-readers:**

```yaml
global:
  prevent_progress_regression: true
  reread_detection:
    enabled: true
    reread_threshold: 40.0 # Higher threshold
    regression_block_threshold: 40.0 # More protection
    create_new_sessions: true
```

**For casual readers:**

```yaml
global:
  prevent_progress_regression: true
  reread_detection:
    enabled: true
    reread_threshold: 25.0 # Lower threshold
    regression_block_threshold: 60.0 # Less strict
    create_new_sessions: true
```

### Monitoring Protection

```bash
# Check protection activity in logs
docker-compose logs shelfbridge | grep -i "protection\|regression\|re-read"

# Monitor sync results for protection actions
docker exec -it shelfbridge node src/main.js sync --dry-run | grep -A 5 "protection\|regression"
```

## 🎯 Next Steps

1. **[Auto-Add Books](Auto-Add-Books.md)** - Understand automatic book addition
2. **[Book Matching Logic](Book-Matching-Logic.md)** - Learn how books are matched
3. **[Cache Management](Cache-Management.md)** - Optimize cache performance

## 🆘 Need Help?

- **Protection Issues**: [Troubleshooting Guide](../troubleshooting/Troubleshooting-Guide.md)
- **Configuration Help**: [Configuration Overview](Configuration-Reference.md)
- **General Questions**: [FAQ](../troubleshooting/FAQ.md)

---

**Progress regression protection keeps your reading history safe!** 🛡️📚
