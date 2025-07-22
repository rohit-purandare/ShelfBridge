# 🤝 Contributing Guide

Welcome to ShelfBridge! We're excited to have you contribute to this project. This guide covers everything you need to know to get started as a contributor.

## 🎯 Ways to Contribute

### 🐛 Bug Reports

- **Found a bug?** Open a [GitHub Issue](https://github.com/rohit-purandare/ShelfBridge/issues)
- **Include details**: OS, Node.js version, configuration (redacted), logs
- **Reproduction steps**: Clear steps to recreate the issue

### 💡 Feature Requests

- **Have an idea?** Open a [GitHub Issue](https://github.com/rohit-purandare/ShelfBridge/issues) with the "enhancement" label
- **Describe the use case**: Why is this feature needed?
- **Consider alternatives**: What other solutions have you considered?

### 📝 Documentation

- **Improve the wiki**: Fix typos, add examples, clarify instructions
- **Add tutorials**: New setup guides, troubleshooting tips
- **Code comments**: Make the code more understandable

### 💻 Code Contributions

- **Bug fixes**: Fix reported issues
- **New features**: Implement approved feature requests
- **Performance improvements**: Optimize existing code
- **Testing**: Add or improve test coverage

## 🏗️ Development Setup

### Prerequisites

- **Node.js**: 18.0.0 or higher
- **npm**: Latest version
- **Git**: For version control
- **Docker**: Optional, for container testing

### Initial Setup

```bash
# Fork the repository on GitHub
# Then clone your fork
git clone https://github.com/YOUR_USERNAME/ShelfBridge.git
cd ShelfBridge

# Install dependencies
npm install

# Copy configuration template
cp config/config.yaml.example config/config.yaml

# Edit configuration with your test tokens
nano config/config.yaml
```

### Development Configuration

Create a development configuration for testing:

```yaml
global:
  min_progress_threshold: 1.0 # Lower for testing
  dry_run: true # Start with dry runs
  auto_add_books: false
  workers: 2 # Fewer workers for development

users:
  - id: dev_user
    abs_url: https://your-test-audiobookshelf.com
    abs_token: your_test_abs_token
    hardcover_token: your_test_hardcover_token
```

**⚠️ Important**: Use test accounts/tokens, not your production data!

### Available Scripts

```bash
# Start development mode with auto-restart
npm run dev

# Run sync once
npm run sync

# Run tests (when available)
npm test

# Code Quality & Formatting
npm run lint              # ESLint code checking
npm run lint:fix          # Auto-fix ESLint issues
npm run format            # Format code with Prettier
npm run format:check      # Check if files need formatting

# Run specific commands
node src/main.js debug
node src/main.js validate
node src/main.js cache --stats
```

### Code Formatting Setup

ShelfBridge uses **Prettier** for consistent code formatting and **ESLint** for code quality. The pre-commit hook automatically formats code before committing.

#### Configuration Files

- **`.prettierrc`** - Prettier formatting rules
- **`.prettierignore`** - Files excluded from formatting
- **`eslint.config.js`** - ESLint configuration

#### Pre-commit Hook

When you commit code, the following happens automatically:

1. 🎨 **Prettier** formats your staged files
2. 🔍 **ESLint** checks for code quality issues
3. 🔒 **Gitleaks** scans for secrets
4. 📚 **Wiki check** ensures documentation stays updated

#### Manual Formatting

```bash
# Format all files
npm run format

# Check which files need formatting
npm run format:check

# Fix linting issues
npm run lint:fix
```

#### Editor Integration

Install the Prettier extension for your editor:

- **VS Code**: Prettier - Code formatter
- **IntelliJ/WebStorm**: Built-in Prettier support
- **Vim/Neovim**: prettier.nvim

Configure your editor to format on save for the best experience.

## 🔀 Git Workflow

### Branch Naming Convention

- `feature/description` - New features
- `bugfix/issue-number` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring
- `test/description` - Adding tests

### Example Workflow

```bash
# Create feature branch
git checkout -b feature/add-goodreads-support

# Make your changes
# ... code, test, commit ...

# Push to your fork
git push origin feature/add-goodreads-support

# Open a Pull Request on GitHub
```

### Commit Message Format

Use conventional commit format:

```
type(scope): description

Longer description if needed

- List specific changes
- Reference issues: Fixes #123
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

**Examples:**

```
feat(sync): add progress regression protection

- Detect when high progress drops significantly
- Create new reading sessions for re-reads
- Add configuration options for thresholds

Fixes #45
```

```
fix(cache): handle database connection errors gracefully

- Add try-catch around SQLite operations
- Provide clear error messages for users
- Fallback to no-cache mode if database fails

Fixes #67
```

## 🏛️ Code Architecture

### Project Structure

```
ShelfBridge/
├── src/
│   ├── main.js              # CLI entry point
│   ├── sync-manager.js      # Core sync logic
│   ├── audiobookshelf-client.js  # ABS API integration
│   ├── hardcover-client.js  # Hardcover API integration
│   ├── book-cache.js        # SQLite cache management
│   ├── config.js            # Configuration loader
│   ├── config-validator.js  # Configuration validation
│   ├── logger.js            # Logging setup
│   └── utils.js             # Utility functions
├── config/
│   └── config.yaml.example  # Configuration template
├── data/                    # Cache and runtime data
├── logs/                    # Application logs
├── test/                    # Test files (future)
├── wiki/                    # Documentation
├── docker-compose.yml       # Docker deployment
├── Dockerfile              # Container definition
└── package.json            # Dependencies and scripts
```

### Core Components

**Entry Point** (`main.js`):

- CLI argument parsing
- Command routing
- Configuration validation
- Error handling

**Sync Manager** (`sync-manager.js`):

- Orchestrates sync process
- Book matching logic
- Progress calculations
- Cache integration

**API Clients**:

- `audiobookshelf-client.js`: REST API wrapper
- `hardcover-client.js`: GraphQL API wrapper
- Rate limiting and error handling

**Book Cache** (`book-cache.js`):

- SQLite database operations
- Performance optimization
- Data persistence

### Design Principles

1. **Separation of Concerns**: Each module has a clear responsibility
2. **Error Handling**: Graceful failure and informative messages
3. **Performance**: Efficient caching and parallel processing
4. **Configuration**: Flexible, validated configuration system
5. **Logging**: Comprehensive logging for debugging
6. **Testing**: (Future) Comprehensive test coverage

## 🧪 Testing Guidelines

### Manual Testing

**Before submitting a PR:**

1. **Configuration validation**:

   ```bash
   node src/main.js validate --connections
   ```

2. **Dry run testing**:

   ```bash
   node src/main.js sync --dry-run
   ```

3. **Cache operations**:

   ```bash
   node src/main.js cache --stats
   node src/main.js cache --clear
   ```

4. **Debug output**:

   ```bash
   node src/main.js debug
   ```

5. **Docker testing** (if applicable):
   ```bash
   docker build -t shelfbridge-dev .
   docker run --rm -v $(pwd)/config:/app/config shelfbridge-dev npm run sync
   ```

### Test Scenarios

**Happy Path:**

- Valid configuration
- Books with progress in Audiobookshelf
- Books already in Hardcover library
- Normal sync operations

**Edge Cases:**

- Empty libraries
- Books without ISBN/ASIN
- Network failures
- Invalid API tokens
- Large libraries (performance)
- Progress regression scenarios

**Error Conditions:**

- Invalid configuration
- API failures
- Cache corruption
- Permission issues

## 🎨 Code Style

### JavaScript Style

Follow existing code style:

```javascript
// Use ES6+ features
import { SomeClass } from './some-module.js';

// Use descriptive names
const bookMatchingResults = await findBookMatches(audiobookshelfBooks);

// Use async/await over promises
async function syncBooks() {
  try {
    const books = await this.audiobookshelf.getReadingProgress();
    // ... process books
  } catch (error) {
    logger.error('Failed to fetch books', { error: error.message });
    throw error;
  }
}

// Document complex functions
/**
 * Extract book identifiers from Audiobookshelf book data
 * @param {Object} bookData - Raw book data from Audiobookshelf
 * @returns {Object} Object with isbn and asin properties
 */
function extractBookIdentifiers(bookData) {
  // Implementation...
}
```

### Logging Standards

```javascript
// Use structured logging
logger.info('Starting sync for user', {
  userId: user.id,
  bookCount: books.length,
});

// Include context in errors
logger.error('Failed to update book progress', {
  bookTitle: book.title,
  userBookId: userBook.id,
  error: error.message,
  stack: error.stack,
});

// Use appropriate log levels
logger.debug('Cache hit for book', { identifier: book.isbn });
logger.info('Sync completed successfully', { duration: '2.3s' });
logger.warn('Book missing ISBN', { title: book.title });
logger.error('API request failed', { error: error.message });
```

### Configuration Validation

When adding new config options:

```javascript
// Add to schema in config-validator.js
const schema = {
    global: {
        new_option: {
            type: 'string',
            default: 'default_value',
            description: 'What this option does'
        }
    }
};

// Add validation logic if needed
validateCustom(fieldName, value, validationType) {
    if (validationType === 'new_validation') {
        // Custom validation logic
        return value.match(/pattern/) ? null : 'Invalid format';
    }
}
```

## 📋 Pull Request Process

### Before Submitting

1. **Test thoroughly**: Manual testing with real data
2. **Update documentation**: README, wiki, or code comments
3. **Check existing issues**: Reference related issues
4. **Consider breaking changes**: Document any API changes

### PR Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactoring
- [ ] Performance improvement

## Testing

- [ ] Manual testing completed
- [ ] Configuration validation passes
- [ ] Docker build succeeds (if applicable)

## Checklist

- [ ] Code follows existing style
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
- [ ] Related issues referenced

## Screenshots/Output

Include relevant command output or screenshots
```

### Review Process

1. **Automated checks**: Linting, basic validation
2. **Manual review**: Code quality, design decisions
3. **Testing**: Reviewer may test changes
4. **Discussion**: Address feedback and suggestions
5. **Approval**: Maintainer approval required
6. **Merge**: Squash and merge to main branch

## 🐛 Debugging Tips

### Common Development Issues

**"No books found" during development:**

```bash
# Check API connection
node src/main.js debug --user your_test_user

# Verify configuration
node src/main.js validate --connections

# Check raw API response
curl -H "Authorization: Bearer YOUR_TOKEN" "YOUR_ABS_URL/api/me"
```

**Cache issues:**

```bash
# Clear cache and restart
node src/main.js cache --clear
node src/main.js sync --dry-run

# Check cache contents
node src/main.js cache --show
```

**Configuration validation errors:**

```bash
# Show detailed help
node src/main.js validate --help-config

# Check YAML syntax
python -c "import yaml; yaml.safe_load(open('config/config.yaml'))"
```

### Debugging Techniques

**Add temporary logging:**

```javascript
// Temporary debug logging
console.log('DEBUG: Book data:', JSON.stringify(book, null, 2));

// Use logger for permanent debugging
logger.debug('Processing book', { title: book.title, progress: book.progress });
```

**Use debugger:**

```javascript
// Add breakpoint
debugger;

// Run with debugger
node --inspect src/main.js sync --dry-run
```

**Test specific functions:**

```javascript
// Create test script in project root
const { extractIsbn } = require('./src/utils.js');

const testBook = {
  /* test data */
};
console.log('ISBN:', extractIsbn(testBook));
```

## 🚀 Release Process

### Version Numbering

ShelfBridge follows [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (1.1.0): New features, backwards compatible
- **PATCH** (1.1.1): Bug fixes, backwards compatible

### Release Checklist

1. **Update version** in `package.json`
2. **Update CHANGELOG.md** with changes
3. **Test thoroughly** with real data
4. **Update documentation** if needed
5. **Create Git tag** (`git tag v1.2.3`)
6. **Push tag** (`git push origin v1.2.3`)
7. **Create GitHub release** with release notes
8. **Update Docker images** (automated via CI/CD)

## 🤝 Community Guidelines

### Code of Conduct

- **Be respectful**: Treat everyone with respect and kindness
- **Be collaborative**: Work together towards common goals
- **Be patient**: Remember that everyone is learning
- **Be constructive**: Provide helpful feedback and suggestions

### Communication

- **GitHub Issues**: For bug reports and feature requests
- **Pull Requests**: For code discussions
- **Discussions**: For general questions and ideas
- **Wiki**: For documentation improvements

### Getting Help

**Stuck on something?**

1. Check existing issues and documentation
2. Search closed issues for similar problems
3. Open a new issue with details
4. Tag relevant maintainers if urgent

**Want to chat?**

- Comment on relevant issues
- Open a discussion thread
- Mention `@rohit-purandare` for urgent matters

## 🎯 Contribution Ideas

### Easy First Contributions

- Fix typos in documentation
- Add examples to configuration guide
- Improve error messages
- Add more validation to configuration
- Write troubleshooting guides

### Medium Difficulty

- Add support for new book metadata fields
- Improve book matching logic
- Add performance monitoring
- Enhance logging and debugging
- Create automated tests

### Advanced Projects

- Add support for additional book services
- Implement bidirectional sync
- Add web interface for configuration
- Create backup/restore functionality
- Add monitoring and alerting

## 🔗 Related Resources

- **[Architecture Overview](../technical/Architecture-Overview.md)** - Understand the codebase
- **[Code Structure](Code-Structure.md)** - Detailed code organization
- **[Development Setup](Development-Setup.md)** - Setting up development environment
- **[GitHub Repository](https://github.com/rohit-purandare/ShelfBridge)** - Source code and issues

---

**Ready to contribute?** Start by forking the repository and making your first contribution! Every contribution, no matter how small, helps make ShelfBridge better for everyone. 🚀
