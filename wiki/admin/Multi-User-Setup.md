# 👥 Multi-User Setup

ShelfBridge supports multiple users in a single configuration, allowing families, friends, or organizations to sync reading progress for multiple people. This guide covers everything you need to know about multi-user setups.

## 🎯 Overview

Multi-user support allows you to:

- Sync multiple Hardcover accounts from one Audiobookshelf server
- Handle different users with different preferences
- Manage family reading accounts
- Separate sync schedules per user
- Maintain individual user privacy

## 🏗️ Basic Multi-User Configuration

### Simple Family Setup

```yaml
global:
  min_progress_threshold: 5.0
  auto_add_books: false
  prevent_progress_regression: true
  sync_schedule: '0 3 * * *'
  timezone: 'America/New_York'

users:
  - id: alice
    abs_url: https://abs.example.com
    abs_token: alice_abs_token
    hardcover_token: alice_hardcover_token

  - id: bob
    abs_url: https://abs.example.com
    abs_token: bob_abs_token
    hardcover_token: bob_hardcover_token

  - id: charlie
    abs_url: https://abs.example.com
    abs_token: charlie_abs_token
    hardcover_token: charlie_hardcover_token
```

### Different Servers Setup

```yaml
global:
  min_progress_threshold: 5.0
  auto_add_books: false
  prevent_progress_regression: true

users:
  - id: alice
    abs_url: https://abs-home.example.com
    abs_token: alice_abs_token
    hardcover_token: alice_hardcover_token

  - id: bob
    abs_url: https://abs-office.example.com
    abs_token: bob_abs_token
    hardcover_token: bob_hardcover_token
```

## 🔧 User-Specific Settings

### Individual User Overrides

Each user can override global settings:

```yaml
global:
  min_progress_threshold: 5.0
  auto_add_books: false
  prevent_progress_regression: true
  sync_schedule: '0 3 * * *'

users:
  - id: alice
    # Alice uses global settings
    abs_url: https://abs.example.com
    abs_token: alice_abs_token
    hardcover_token: alice_hardcover_token

  - id: bob
    # Bob has custom preferences
    min_progress_threshold: 10.0 # More conservative
    auto_add_books: true # Auto-add enabled
    sync_schedule: '0 4 * * *' # Different schedule
    abs_url: https://abs.example.com
    abs_token: bob_abs_token
    hardcover_token: bob_hardcover_token

  - id: charlie
    # Charlie is permissive
    min_progress_threshold: 1.0 # Very low threshold
    auto_add_books: true # Auto-add enabled
    prevent_progress_regression: false # Disabled
    abs_url: https://abs.example.com
    abs_token: charlie_abs_token
    hardcover_token: charlie_hardcover_token
```

### User-Specific Sync Schedules

```yaml
global:
  sync_schedule: '0 3 * * *' # Default: 3 AM daily

users:
  - id: alice
    sync_schedule: '0 2 * * *' # Alice: 2 AM daily
    abs_url: https://abs.example.com
    abs_token: alice_abs_token
    hardcover_token: alice_hardcover_token

  - id: bob
    sync_schedule: '0 */6 * * *' # Bob: Every 6 hours
    abs_url: https://abs.example.com
    abs_token: bob_abs_token
    hardcover_token: bob_hardcover_token

  - id: charlie
    sync_schedule: '0 3 * * 0' # Charlie: Weekly on Sunday
    abs_url: https://abs.example.com
    abs_token: charlie_abs_token
    hardcover_token: charlie_hardcover_token
```

## 🎨 User Profiles and Preferences

### Reading Behavior Profiles

Configure users based on reading habits:

```yaml
global:
  sync_schedule: '0 3 * * *'
  timezone: 'America/New_York'

users:
  # Heavy reader - syncs everything
  - id: bookworm
    min_progress_threshold: 1.0
    auto_add_books: true
    sync_schedule: '0 */4 * * *' # Every 4 hours
    abs_url: https://abs.example.com
    abs_token: bookworm_abs_token
    hardcover_token: bookworm_hardcover_token

  # Casual reader - conservative sync
  - id: casual
    min_progress_threshold: 25.0
    auto_add_books: false
    sync_schedule: '0 3 * * 0' # Weekly
    abs_url: https://abs.example.com
    abs_token: casual_abs_token
    hardcover_token: casual_hardcover_token

  # Child account - strict controls
  - id: kid
    min_progress_threshold: 10.0
    auto_add_books: false
    prevent_progress_regression: true
    sync_schedule: '0 20 * * *' # 8 PM daily
    abs_url: https://abs.example.com
    abs_token: kid_abs_token
    hardcover_token: kid_hardcover_token
```

## 🔐 API Token Management

### Obtaining Multiple Tokens

**Audiobookshelf Tokens:**

1. Each user needs their own Audiobookshelf account
2. Each account generates its own API token
3. Admin can generate tokens for other users (if admin)

**Hardcover Tokens:**

1. Each user needs their own Hardcover account
2. Each account generates its own API token
3. Tokens cannot be shared between accounts

### Token Security

```yaml
# Good practices for token management
users:
  - id: alice
    abs_url: https://abs.example.com
    abs_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' # Alice's token
    hardcover_token: 'hc_sk_alice_1234567890...' # Alice's token

  - id: bob
    abs_url: https://abs.example.com
    abs_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' # Bob's token
    hardcover_token: 'hc_sk_bob_9876543210...' # Bob's token
```

**Security notes:**

- Never share tokens between users
- Store tokens securely
- Rotate tokens regularly
- Use environment variables for sensitive deployments

## 🎯 Use Case Scenarios

### Family Home Server

```yaml
# Family of 4 sharing one Audiobookshelf server
global:
  min_progress_threshold: 5.0
  auto_add_books: false
  prevent_progress_regression: true
  timezone: 'America/New_York'

users:
  - id: mom
    sync_schedule: '0 6 * * *' # 6 AM (early riser)
    abs_url: https://abs.home.local
    abs_token: mom_abs_token
    hardcover_token: mom_hardcover_token

  - id: dad
    sync_schedule: '0 23 * * *' # 11 PM (night owl)
    abs_url: https://abs.home.local
    abs_token: dad_abs_token
    hardcover_token: dad_hardcover_token

  - id: teen
    min_progress_threshold: 10.0
    sync_schedule: '0 16 * * *' # 4 PM (after school)
    abs_url: https://abs.home.local
    abs_token: teen_abs_token
    hardcover_token: teen_hardcover_token

  - id: kid
    min_progress_threshold: 15.0
    auto_add_books: false
    sync_schedule: '0 19 * * *' # 7 PM (bedtime story)
    abs_url: https://abs.home.local
    abs_token: kid_abs_token
    hardcover_token: kid_hardcover_token
```

### Multi-Location Setup

```yaml
# Users in different locations with different servers
global:
  min_progress_threshold: 5.0
  auto_add_books: false
  prevent_progress_regression: true
  sync_schedule: '0 3 * * *'

users:
  - id: alice_home
    abs_url: https://abs-home.example.com
    abs_token: alice_home_token
    hardcover_token: alice_hardcover_token

  - id: alice_office
    abs_url: https://abs-office.example.com
    abs_token: alice_office_token
    hardcover_token: alice_hardcover_token # Same Hardcover account

  - id: bob_mobile
    abs_url: https://abs-mobile.example.com
    abs_token: bob_mobile_token
    hardcover_token: bob_hardcover_token
```

### Reading Group / Book Club

```yaml
# Book club with shared reading goals
global:
  min_progress_threshold: 5.0
  auto_add_books: true # Add all books for group reading
  prevent_progress_regression: true
  sync_schedule: '0 9 * * *' # Morning sync for group discussions

users:
  - id: member1
    abs_url: https://abs.bookclub.org
    abs_token: member1_abs_token
    hardcover_token: member1_hardcover_token

  - id: member2
    abs_url: https://abs.bookclub.org
    abs_token: member2_abs_token
    hardcover_token: member2_hardcover_token

  - id: member3
    abs_url: https://abs.bookclub.org
    abs_token: member3_abs_token
    hardcover_token: member3_hardcover_token
```

## 🔄 Managing Multiple Users

### Running Syncs

```bash
# Sync all users
docker exec -it shelfbridge node src/main.js sync

# Sync specific user
docker exec -it shelfbridge node src/main.js sync --user alice

# Sync multiple specific users
docker exec -it shelfbridge node src/main.js sync --user alice --user bob

# Dry run for all users
docker exec -it shelfbridge node src/main.js sync --dry-run
```

### User Management Commands

```bash
# Debug specific user
docker exec -it shelfbridge node src/main.js debug --user alice

# Validate specific user configuration
docker exec -it shelfbridge node src/main.js validate --user alice

# Check cache for specific user
docker exec -it shelfbridge node src/main.js cache --stats --user alice
```

## 📊 Monitoring Multiple Users

### Sync Results by User

```bash
# View logs for all users
docker-compose logs -f shelfbridge

# Filter logs for specific user
docker-compose logs shelfbridge | grep "User: alice"

# Check sync results
docker exec -it shelfbridge node src/main.js sync --dry-run | grep -A 5 "User:"
```

### Performance Considerations

```yaml
# Optimize for multiple users
global:
  # Reduce parallel workers to be gentle on APIs
  workers: 2

  # Stagger sync times to avoid conflicts
  users:
    - id: alice
      sync_schedule: '0 3 * * *'
    - id: bob
      sync_schedule: '15 3 * * *' # 15 minutes later
    - id: charlie
      sync_schedule: '30 3 * * *' # 30 minutes later
```

## 🎛️ Advanced Multi-User Features

### Conditional User Sync

```yaml
# Environment-based user selection
users:
  - id: alice
    enabled: true # Always sync
    abs_url: https://abs.example.com
    abs_token: alice_abs_token
    hardcover_token: alice_hardcover_token

  - id: bob
    enabled: false # Temporarily disabled
    abs_url: https://abs.example.com
    abs_token: bob_abs_token
    hardcover_token: bob_hardcover_token
```

### User Groups

```yaml
# Organize users into groups
global:
  user_groups:
    family:
      - alice
      - bob
      - charlie
    friends:
      - david
      - eve

users:
  - id: alice
    group: family
    abs_url: https://abs.example.com
    abs_token: alice_abs_token
    hardcover_token: alice_hardcover_token

  - id: david
    group: friends
    abs_url: https://abs-friends.example.com
    abs_token: david_abs_token
    hardcover_token: david_hardcover_token
```

## 🔍 Troubleshooting Multi-User Setups

### Common Issues

**"User not found"**

- Check user ID spelling
- Verify user exists in configuration
- Ensure proper YAML indentation

**"Token authentication failed"**

- Verify each user has correct tokens
- Check that tokens belong to correct accounts
- Ensure tokens are not expired

**"Different sync results per user"**

- Check user-specific overrides
- Verify library access per user
- Review individual thresholds

### Debugging Multi-User Issues

```bash
# Test individual user configurations
docker exec -it shelfbridge node src/main.js validate --user alice
docker exec -it shelfbridge node src/main.js validate --user bob

# Compare user settings
docker exec -it shelfbridge node src/main.js debug --user alice
docker exec -it shelfbridge node src/main.js debug --user bob

# Check user-specific cache
docker exec -it shelfbridge node src/main.js cache --stats --user alice
```

## 📈 Best Practices

### Configuration Management

1. **Use consistent naming**: `alice`, `bob`, `charlie` (not `Alice`, `Bob_User`, `charlie123`)
2. **Document user purposes**: Add comments explaining each user
3. **Group similar users**: Keep family members together in config
4. **Test incrementally**: Add users one at a time

### Performance Optimization

1. **Stagger sync times**: Avoid all users syncing simultaneously
2. **Adjust worker counts**: Reduce workers for many users
3. **Use appropriate thresholds**: Higher thresholds for casual readers
4. **Monitor resource usage**: Check CPU/memory with multiple users

### Security Considerations

1. **Separate tokens**: Never share tokens between users
2. **Regular rotation**: Update tokens periodically
3. **Access control**: Ensure users only access their own data
4. **Audit regularly**: Review user access and permissions

## 🎯 Next Steps

1. **[Progress Regression Protection](Progress-Regression-Protection.md)** - Protect user progress
2. **[Cache Management](Cache-Management.md)** - Optimize multi-user cache
3. **[Troubleshooting Guide](../troubleshooting/Troubleshooting-Guide.md)** - Solve common issues

## 🆘 Need Help?

- **Configuration Issues**: [Troubleshooting Guide](../troubleshooting/Troubleshooting-Guide.md)
- **User Management**: [Configuration Guide](Configuration-Guide.md)
- **General Questions**: [FAQ](../troubleshooting/FAQ.md)

---

**Multi-user setups make ShelfBridge perfect for families and groups!** 👥📚
