# ShelfBridge Scripts

This directory contains utility scripts for maintaining and automating ShelfBridge.

## 🔧 Development & Debug Scripts

### `debug-title-author-match.js`

Debug script for troubleshooting title/author matching issues, specifically designed to help diagnose the "Cannot read properties of null (reading 'id')" error.

**Features:**

- Tests title/author search functionality for "The Primal Hunter 11"
- Attempts to add matched books to Hardcover library
- Checks if books are already in library (common cause of add failures)
- Provides detailed logging for debugging
- Shows complete search result structure

**Usage:**

```bash
node scripts/debug-title-author-match.js
```

**Use this script when:**

- Getting "Cannot read properties of null" errors during sync
- Title/author matching finds books but fails to add them
- Need to debug search result structure issues
- Want to test library addition process independently

### `pre-flight-check.js`

Performs comprehensive pre-flight checks before running ShelfBridge:

- Validates configuration file
- Tests Audiobookshelf connection and authentication
- Tests Hardcover connection and authentication
- Checks for required permissions and access
- Validates library access

```bash
node scripts/pre-flight-check.js
```

### `test-native-modules.js`

Quick native module compatibility check:

- Verifies better-sqlite3 can be loaded
- Tests basic database operations
- Enhanced system diagnostics for troubleshooting
- Useful for quick installation verification

```bash
node scripts/test-native-modules.js
# Or via npm script
npm run test:native
```

### `validate-better-sqlite3.js`

Comprehensive better-sqlite3 validation suite:

- 10 comprehensive test categories covering all functionality
- Module loading, database creation, CRUD operations
- Transaction support, large data handling, error scenarios
- Concurrent access simulation and edge case testing
- Production readiness certification

```bash
node scripts/validate-better-sqlite3.js
# Or via npm script
npm run validate:sqlite
```

## 📝 Changelog Management

### `update-changelog.sh`

Automatically generates and updates the `CHANGELOG.md` file based on git commit history.

**Features:**

- Follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format
- Categorizes commits using conventional commit patterns
- Auto-detects version from `package.json`
- Supports custom version ranges
- Dry-run mode for testing
- Automatic version link management

**Usage:**

```bash
# Auto-detect version and update changelog
./scripts/update-changelog.sh

# Specify version manually
./scripts/update-changelog.sh -v 1.16.1

# Dry run (preview without updating)
./scripts/update-changelog.sh --dry-run

# Generate changelog from specific tag
./scripts/update-changelog.sh -v 1.16.1 -t v1.16.0

# Using npm scripts
npm run changelog           # Update changelog
npm run changelog:preview   # Preview changes
```

**Commit Classification:**

- `feat:` commits → **Added** section
- `fix:` commits → **Fixed** section
- `perf:` commits → **Improved** section
- `refactor:` commits → **Changed** section
- Commits with "improve/enhance/better/optimize" → **Improved** section
- Commits with "add/implement/create" → **Added** section
- Commits with "change/update/modify" → **Changed** section
- Other commits → **Changed** section

## 🤖 Automatic Integration

The changelog is **automatically updated** on every release through GitHub Actions:

1. **When you push to `main`**: The `version-and-release.yml` workflow triggers
2. **Version detection**: Uses conventional commit patterns to determine bump type:
   - `feat:` → minor version bump
   - `fix:` → patch version bump
   - `BREAKING CHANGE` → major version bump
3. **Changelog generation**: Automatically categorizes commits and updates `CHANGELOG.md`
4. **Commit & release**: Creates version bump commit and GitHub release

### Manual Override

If you need to manually update the changelog:

```bash
# Test what would be generated
npm run changelog:preview

# Update changelog manually
npm run changelog

# Commit the changes
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG.md for v$(node -p "require('./package.json').version")"
```

## 🔧 Script Requirements

- **Git**: For commit history analysis
- **Node.js**: For version detection from `package.json`
- **Bash**: Shell environment (works on macOS, Linux, WSL)

## 📋 Best Practices

1. **Use conventional commits** for better categorization:

   ```
   feat: add title/author matching
   fix: resolve authentication timeout
   perf: optimize database queries
   ```

2. **Let automation handle it**: The GitHub workflow will update the changelog automatically

3. **Manual updates only when needed**: Use the script for testing or special cases

4. **Review before merging**: Check the generated changelog in PRs

## 🚀 Future Enhancements

Potential improvements for the changelog system:

- **Breaking change detection**: Better handling of `BREAKING CHANGE` commits
- **Scope grouping**: Group changes by component/module
- **Contributor attribution**: Include commit authors
- **Rich formatting**: Better markdown formatting for complex changes
- **Integration with GitHub**: Pull request links and issue references
