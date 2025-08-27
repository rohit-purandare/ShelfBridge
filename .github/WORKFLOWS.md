# GitHub Workflows

This project uses a simplified, industry-standard workflow architecture with three focused workflows:

## 🔄 CI Workflow (`ci.yml`)

**Triggers:** PRs and feature branch pushes  
**Purpose:** Tests and validates changes before merging

### What it does:

- ✅ Runs tests on Node.js 20.x and 22.x
- ✅ Runs linting and format checks
- ✅ Builds Docker image for testing (non-main branches only)
- ✅ Performs basic security checks
- ✅ Validates Docker image functionality

### Branch Testing:

- Feature branches get full CI validation including Docker builds
- Docker images are built locally and tested (not pushed to registry)
- Only AMD64 architecture for speed during development

## 🚀 Release Workflow (`release.yml`)

**Triggers:** Pushes to `main` branch  
**Purpose:** Automated versioning and publishing

### What it does:

- 📝 Uses Release Please for automatic changelog generation
- 🏷️ Creates semantic version tags based on conventional commits
- 🐳 Builds and publishes multi-architecture Docker images
- 📦 Publishes to GitHub Container Registry with multiple tags
- 🔒 Generates build attestations for security
- ✅ Verifies published images work correctly

### Version Tags Created:

- `latest` - Always points to newest release
- `v1.21.0` / `1.21.0` - Full version
- `v1.21` / `1.21` - Major.minor version
- `v1` / `1` - Major version only

## 🔍 Code Quality Workflow (`code-quality.yml`)

**Triggers:** PRs and pushes to `main`  
**Purpose:** Static analysis and quality checks

### What it does:

- 🧹 ESLint code analysis
- 📐 Format checking with Prettier
- 🔒 Security audit for dependencies
- ⚙️ Configuration validation
- 🔍 Checks for debug statements and secrets

## Key Improvements

### ✨ Simplified Architecture

- **Before:** 8 complex, interdependent workflow files
- **After:** 3 focused, independent workflows
- **Result:** Easier to understand, debug, and maintain

### 🎯 Clear Separation of Concerns

- **CI:** Test and validate changes
- **Release:** Version and publish releases
- **Quality:** Code analysis and standards

### 🐳 Reliable Docker Builds

- **Development:** Fast AMD64-only builds for testing
- **Production:** Multi-arch builds (AMD64 + ARM64) for releases
- **Verification:** All images tested before publication

### 🔄 Industry Standards

- Follows patterns from major OSS projects (Docker, Kubernetes, GitHub)
- Uses conventional commits for automatic versioning
- Proper security practices with attestations
- Multi-architecture support for broad compatibility

## Usage

### For Development:

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes and commit with conventional commit messages
3. Push branch - CI workflow validates your changes
4. Create PR - All workflows run for validation

### For Releases:

1. Merge PR to `main`
2. Release Please automatically creates release PR with changelog
3. Merge release PR to trigger publication
4. Docker images published automatically with proper tags

### Semantic Versioning (SemVer)

This project follows **strict semantic versioning** (semver.org):

- **MAJOR** (`1.0.0 → 2.0.0`): Breaking changes that require user action
- **MINOR** (`1.0.0 → 1.1.0`): New features that are backward compatible
- **PATCH** (`1.0.0 → 1.0.1`): Bug fixes and internal improvements

### Conventional Commit Examples:

```bash
# PATCH version bump - Bug fixes
git commit -m "fix: resolve search API timeout issues"
git commit -m "fix: handle empty response from Hardcover API"

# MINOR version bump - New features (backward compatible)
git commit -m "feat: add support for audiobook format detection"
git commit -m "feat: implement retry logic for failed requests"

# MAJOR version bump - Breaking changes
git commit -m "feat!: update API to v2 with new authentication"
git commit -m "fix!: change configuration file format to YAML"

# Additional types (bump appropriately):
git commit -m "perf: improve matching algorithm performance by 50%"  # MINOR
git commit -m "refactor: restructure matching logic for clarity"      # MINOR
git commit -m "security: update dependencies to fix vulnerabilities"  # PATCH
git commit -m "deps: update axios to v1.12.0"                         # PATCH

# Non-versioning commits (no version bump):
git commit -m "docs: update README with new configuration options"
git commit -m "test: add unit tests for matching algorithms"
git commit -m "ci: improve workflow reliability"
git commit -m "chore: update development dependencies"
```

### Version Tag Format:

- **Primary:** `v1.21.0` (with 'v' prefix)
- **Secondary:** `1.21.0` (without prefix)
- **Rolling:** `v1.21`, `v1`, `latest`

All Docker images support both AMD64 and ARM64 architectures.

## Migration Notes

**Removed Files:**

- `docker-build.yml` - Complex, unreliable conditions
- `docker-test.yml` - Merged into ci.yml
- `reusable-docker-validation.yml` - No longer needed
- `reusable-node-setup.yml` - No longer needed
- `version-and-release.yml` - Replaced by release.yml
- `labeler.yml` - Not essential

**Breaking Changes:** None - all existing functionality preserved with better reliability.
