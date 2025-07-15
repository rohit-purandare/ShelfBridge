# ❓ Frequently Asked Questions

Quick answers to the most common questions about ShelfBridge.

## 🚀 Getting Started

### What is ShelfBridge?
ShelfBridge automatically syncs your reading progress between Audiobookshelf (your personal audiobook server) and Hardcover (a social reading platform). It matches books using ISBN/ASIN identifiers and keeps your reading progress in sync.

### Do I need both services?
Yes, you need:
- **Audiobookshelf server** with books and reading progress
- **Hardcover account** with API access enabled

### Is ShelfBridge free?
Yes, ShelfBridge is completely free and open source. Both Audiobookshelf and Hardcover also have free tiers.

### What book formats are supported?
ShelfBridge works with any format that Audiobookshelf can track progress for:
- **Audiobooks**: MP3, M4A, M4B, etc.
- **Ebooks**: EPUB, PDF, etc. (if Audiobookshelf supports them)

## 🔧 Setup and Configuration

### Why do I need API tokens?
API tokens allow ShelfBridge to:
- Read your reading progress from Audiobookshelf
- Update your progress on Hardcover
- Operate without storing your passwords

### How often does sync happen?
**Default**: Once daily at 3 AM
**Configurable**: Set any schedule using cron format
**Manual**: Run anytime with `npm run sync`

### Can I sync multiple users?
Yes! Add multiple users to your configuration:
```yaml
users:
  - id: alice
    abs_url: https://audiobookshelf.com
    abs_token: alice_token
    hardcover_token: alice_hardcover_token
  - id: bob
    abs_url: https://audiobookshelf.com
    abs_token: bob_token
    hardcover_token: bob_hardcover_token
```

### What's the minimum progress needed to sync?
**Default**: 5% (configurable)
**Why**: Prevents syncing accidental book opens
**Customize**: Change `min_progress_threshold` in config

## 📚 Book Matching and Sync

### How does book matching work?
1. **ASIN first**: Preferred for audiobooks (Amazon identifier)
2. **ISBN fallback**: For books without ASIN
3. **No match**: Book is skipped or auto-added (depending on settings)

### Why aren't all my books syncing?
Common reasons:
- **Below threshold**: Progress less than `min_progress_threshold`
- **No identifier**: Book missing ISBN/ASIN metadata
- **Not in Hardcover**: Book not in your Hardcover library and `auto_add_books` is false
- **No progress change**: Cache shows progress hasn't changed since last sync

### What does "auto-add books" do?
When enabled (`auto_add_books: true`):
- Books not found in Hardcover are automatically added
- All books with progress are synced

When disabled (`auto_add_books: false`):
- Only adds books with significant progress
- Books already in Hardcover always sync

### Can I sync the same book multiple times?
Yes! ShelfBridge detects re-reading and creates new reading sessions for:
- **Completed books** being started again
- **High progress books** dropped to very low progress

## 🔄 Progress and Completion

### How is progress calculated?
- **Audiobooks**: Based on time (minutes listened / total minutes)
- **Ebooks**: Based on pages (current page / total pages)
- **Completion**: ≥95% progress or Audiobookshelf completion flag

### Will my completion status be overwritten?
No! Progress regression protection prevents:
- Completed books being marked as incomplete
- High progress being accidentally reset
- Creates new reading sessions for re-reads

### What if I'm re-reading a book?
ShelfBridge automatically detects re-reading and:
- Creates a new reading session
- Preserves your original completion
- Tracks the new progress separately

### Can I sync backwards (Hardcover → Audiobookshelf)?
No, ShelfBridge only syncs **from** Audiobookshelf **to** Hardcover. This is because:
- Audiobookshelf is the "source of truth" for listening progress
- Hardcover is primarily for tracking and social features

## 🐳 Docker and Deployment

### Should I use Docker or Node.js?
**Docker** (recommended for most users):
- Easier setup and updates
- Isolated environment
- Built-in scheduling

**Node.js** (for developers):
- Direct control
- Easier customization
- Development environment

### Where are my files stored in Docker?
**Configuration**: `shelfbridge-config` volume (`/app/config/`)
**Cache/Data**: `shelfbridge-data` volume (`/app/data/`)
**Logs**: Inside container at `/app/logs/`

### I get "permission denied" when Docker tries to copy the example config file
This issue has been automatically resolved in recent versions of ShelfBridge. The container now automatically fixes volume permissions on startup.

**If you're still experiencing this issue:**

**Quick Fix:**
```bash
# Update to latest version
docker-compose pull
docker-compose up -d
```

**If that doesn't work:**
```bash
# Manual fix for legacy versions
docker exec -u root -it shelfbridge chown -R node:node /app/config
docker-compose restart shelfbridge
```

**Last resort:**
```bash
# Recreate volumes (WARNING: deletes your config)
docker-compose down
docker volume rm shelfbridge-config shelfbridge-data
docker-compose up -d
```

See the [Troubleshooting Guide](Troubleshooting-Guide.md#permission-issues) for detailed solutions.

### How do I update ShelfBridge?
**Docker Compose**:
```bash
docker-compose pull
docker-compose up -d
```

**Node.js**:
```bash
git pull
npm install
```

### Can I run ShelfBridge on a schedule?
Yes, several options:
- **Built-in**: Use `npm start` (respects `sync_schedule` config)
- **Docker**: Container runs automatically
- **System cron**: Add to your system's cron jobs
- **Manual**: Run `npm run sync` whenever you want

## 🛡️ Security and Privacy

### Is my data secure?
- **No passwords stored**: Only API tokens are used
- **Local processing**: All matching and caching happens locally
- **No third parties**: Data only goes to your chosen services
- **Open source**: Code is publicly auditable

### Where are API tokens stored?
- **Configuration file**: Stored in your local config
- **Docker**: Inside the named volume (not in the image)
- **Best practice**: Keep backups secure, rotate tokens regularly

### What data is sent to each service?
**To Audiobookshelf**: Nothing (only reads data)
**To Hardcover**: Only reading progress and book identifiers

## 💾 Cache and Performance

### What is the cache for?
The SQLite cache:
- **Speeds up syncs**: Only processes changed books
- **Preserves state**: Remembers what was already synced
- **Multi-user**: Separates data by user
- **Persistence**: Survives restarts

### How big does the cache get?
Typically:
- **100 books**: ~1-2 MB
- **1000 books**: ~10-20 MB
- **Very efficient**: Only metadata is stored

### When should I clear the cache?
- **Troubleshooting**: If sync results seem wrong
- **Major config changes**: Changing user IDs or thresholds
- **Fresh start**: Want to re-sync everything
- **Corruption**: If you see database errors

### Does clearing cache affect my reading progress?
No! Clearing cache only removes local optimization data:
- Your progress in Audiobookshelf is unchanged
- Your progress in Hardcover is unchanged
- Next sync will rebuild the cache

## 🚨 Troubleshooting

### Sync shows 0 books processed
Check:
1. **API access**: Can you log into both services?
2. **Library permissions**: Does your Audiobookshelf user have library access?
3. **Reading progress**: Have you actually listened to books?
4. **Configuration**: Are your API tokens correct?

### Books are auto-added instead of syncing existing ones
This usually means:
- **Different editions**: Your Audiobookshelf book has different ISBN/ASIN than Hardcover
- **Missing metadata**: Books lack ISBN/ASIN information
- **Not in library**: Books aren't actually in your Hardcover library

### Sync is very slow
Try:
1. **Reduce workers**: Lower `workers` setting (default: 3)
2. **Check network**: Slow connection to services
3. **Clear cache**: If cache is corrupted
4. **Check logs**: Look for timeout errors

### Why am I seeing rate limiting messages?
ShelfBridge respects API limits for both services:
- **Hardcover**: 55 requests per minute
- **Audiobookshelf**: 600 requests per minute

You'll see:
- **⚠️ Rate limit warning**: When approaching 80% of limits (normal)
- **⚠️ Rate limit exceeded**: When limit reached, requests are queued (normal)

**This is expected behavior** for:
- **Large libraries**: 100+ books may hit rate limits
- **Initial syncs**: First sync processes all books
- **Bulk operations**: Many books syncing at once

**Rate limiting means:**
- **Sync takes longer**: But completes successfully
- **No data loss**: Requests are queued, not dropped
- **API protection**: Prevents errors from exceeding limits

**Recent Fix (v1.7.1+)**: Fixed shared rate limit buckets that were causing incorrect request counts. Each service now has its own separate rate limit tracking.

### How can I test with just a few books to avoid rate limiting?
Use the new `max_books_to_process` setting to limit how many books are processed:

```yaml
global:
  # Test with just 5 books first
  max_books_to_process: 5
  
  # Conservative settings for testing
  workers: 1
  parallel: false
  audiobookshelf_semaphore: 1
  hardcover_semaphore: 1
```

**Testing progression**:
1. **Start small**: `max_books_to_process: 5` with `dry_run: true`
2. **Increase gradually**: Try 10, then 20 books
3. **Go live**: Remove `dry_run` when confident
4. **Full sync**: Remove `max_books_to_process` for complete sync

**Perfect for**:
- **Rate limiting issues**: Test without overwhelming APIs
- **New setups**: Verify configuration works
- **Large libraries**: Process in manageable batches
- **Debugging**: Focus on problematic books

### Progress isn't updating
Possible causes:
- **Below threshold**: Progress change is too small
- **Regression protection**: Large progress drop was blocked
- **API errors**: Check logs for GraphQL errors
- **Cache issue**: Try clearing cache

## 🔧 Advanced Usage

### Can I run multiple instances?
Not recommended with the same cache:
- **Cache conflicts**: SQLite doesn't handle concurrent access well
- **API rate limits**: Multiple instances might hit rate limits
- **Data consistency**: Could cause sync issues

### Can I customize the book matching?
Limited customization:
- **Thresholds**: Adjust `min_progress_threshold`
- **Auto-add behavior**: Enable/disable `auto_add_books`
- **Metadata**: Add ISBN/ASIN to your Audiobookshelf books

### Can I exclude certain books?
Not directly, but you can:
- **Adjust threshold**: Set higher `min_progress_threshold`
- **Remove progress**: Reset progress in Audiobookshelf
- **Manual Hardcover**: Manage some books manually

### Can I sync to multiple Hardcover accounts?
Yes, create multiple user configurations with different `hardcover_token` values.

## 🛠️ Development and Contribution

### How can I contribute?
- **Report bugs**: Use GitHub Issues
- **Feature requests**: Describe your use case
- **Code contributions**: See Contributing Guide
- **Documentation**: Help improve the wiki

### Can I modify ShelfBridge for my needs?
Yes! ShelfBridge is open source:
- **Fork the repository**: Make your own version
- **Submit improvements**: Share useful changes back
- **Custom integrations**: Add support for other services

### Where can I get help?
1. **This FAQ**: Most common questions
2. **Troubleshooting Guide**: Detailed problem solving
3. **GitHub Issues**: Bug reports and community help
4. **Documentation**: Comprehensive guides

## 🔗 Related Resources

- **[Quick Start Guide](../user-guides/Quick-Start.md)** - Get running in 5 minutes
- **[Troubleshooting Guide](Troubleshooting-Guide.md)** - Solve specific problems
- **[Configuration Overview](../admin/Configuration-Overview.md)** - All configuration options
- **[CLI Reference](../technical/CLI-Reference.md)** - Complete command documentation

---

**Don't see your question?** Check the [Troubleshooting Guide](Troubleshooting-Guide.md) or [open an issue](https://github.com/rohit-purandare/ShelfBridge/issues) on GitHub. 