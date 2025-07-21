# ShelfBridge Development Guide

This guide covers development workflows, automation, and contribution guidelines for ShelfBridge.

## 🚀 Release Automation

ShelfBridge uses fully automated releases with changelog generation.

### How It Works

1. **Push to main**: Any functional commit to `main` triggers the release workflow
2. **Version detection**: Uses conventional commit patterns:
   - `feat:` → minor version bump (1.16.0 → 1.17.0)
   - `fix:` → patch version bump (1.16.0 → 1.16.1)
   - `BREAKING CHANGE` → major version bump (1.16.0 → 2.0.0)
3. **Automatic changelog**: Generates structured changelog entry
4. **Version bump**: Updates `package.json` and `CHANGELOG.md`
5. **GitHub release**: Creates release with generated notes

### Conventional Commits

Use conventional commit format for better automation:

```bash
# Features (minor version bump)
feat: add title/author matching
feat(sync): implement parallel processing

# Bug fixes (patch version bump)
fix: resolve authentication timeout
fix(docker): correct permission issues

# Performance improvements
perf: optimize database queries
perf(cache): reduce memory usage

# Breaking changes (major version bump)
feat!: redesign configuration format
feat: remove deprecated API endpoints

BREAKING CHANGE: Configuration format has changed
```

### Skipped Commits

These commit types are excluded from releases:
- `docs:` - Documentation changes
- `chore:` - Maintenance tasks
- `test:` - Test-only changes
- `ci:` - CI/CD changes
- `style:` - Code style changes

### Manual Changelog Updates

If needed, you can manually update the changelog:

```bash
# Preview what would be generated
npm run changelog:preview

# Update changelog for current version
npm run changelog

# Update changelog for specific version
./scripts/update-changelog.sh -v 1.16.1

# Generate from specific tag range
./scripts/update-changelog.sh -v 1.16.1 -t v1.16.0
```

## 📋 Development Workflow

### 1. Feature Development

```bash
# Create feature branch
git checkout -b feat/new-feature

# Make changes with conventional commits
git commit -m "feat: add new awesome feature"

# Push and create PR
git push origin feat/new-feature
```

### 2. Testing

```bash
# Run tests
npm test

# Test configuration
npm run config

# Test with dry run
node src/main.js sync --dry-run
```

### 3. Release Process

**Automatic (Recommended):**
1. Merge PR to `main`
2. Automation handles version bump and changelog
3. GitHub release created automatically

**Manual (If needed):**
1. Update version: `npm version patch|minor|major`
2. Update changelog: `npm run changelog`
3. Commit and push
4. Create GitHub release

## 🔧 Scripts and Tools

### Available Scripts

```bash
# Application
npm start              # Start scheduled sync
npm run sync           # Run sync once
npm run interactive    # Interactive CLI mode
npm test              # Test configuration

# Development
npm run dev           # Development mode with auto-restart
npm run changelog     # Update changelog
npm run changelog:preview  # Preview changelog changes

# Cache management
npm run cache         # Cache utilities
```

### Utility Scripts

- **`scripts/update-changelog.sh`**: Automated changelog generation
- **`scripts/README.md`**: Script documentation

## 📦 Build and Deploy

### Docker

```bash
# Build image
docker build -t shelfbridge .

# Run with docker-compose
docker-compose up -d

# View logs
docker-compose logs -f
```

### GitHub Actions

- **CI**: Tests across Node.js versions
- **Code Quality**: ESLint and security checks
- **Version & Release**: Automated releases
- **Docker Build**: Multi-platform container builds

## 🔍 Debugging

### Debug Commands

```bash
# Comprehensive debug info
node src/main.js debug

# Test API connections
node src/main.js test

# Validate configuration
node src/main.js validate

# Cache inspection
node src/main.js cache --show
```

### Logging

- **Location**: `logs/` directory
- **Rotation**: Daily rotation with 14-day retention
- **Levels**: Error, Warn, Info, Debug

## 📊 Project Structure

```
ShelfBridge/
├── src/                    # Source code
│   ├── main.js            # CLI entry point
│   ├── sync-manager.js    # Core sync logic
│   ├── config.js          # Configuration management
│   └── ...
├── scripts/               # Utility scripts
│   ├── update-changelog.sh
│   └── README.md
├── .github/workflows/     # GitHub Actions
├── config/                # Configuration templates
├── docs/                  # Documentation
├── logs/                  # Application logs
└── CHANGELOG.md          # Generated changelog
```

## 🎯 Contribution Guidelines

### Before Contributing

1. Read the [Contributing Guide](wiki/developer/Contributing.md)
2. Check existing [Issues](https://github.com/rohit-purandare/ShelfBridge/issues)
3. Review the [Feature Overview](wiki/user-guides/Feature-Overview.md)

### Code Style

- Use ESLint configuration
- Follow conventional commit format
- Write clear, descriptive commit messages
- Update documentation for new features

### Testing

- Test manually with `--dry-run` flag
- Verify configuration validation works
- Test with real API calls if possible
- Update tests for new features

## 🚀 Release Checklist

For major releases, verify:

- [ ] All tests pass
- [ ] Documentation updated
- [ ] CHANGELOG.md reflects changes
- [ ] Docker image builds successfully
- [ ] Configuration examples updated
- [ ] Breaking changes documented
- [ ] Migration guide provided (if needed)

## 📝 Documentation

- **User Guides**: `wiki/user-guides/`
- **Technical Docs**: `wiki/technical/`
- **API Reference**: `wiki/technical/CLI-Reference.md`
- **Troubleshooting**: `wiki/troubleshooting/`

Keep documentation updated with code changes! 