# GitHub Workflows

This page documents all automated workflows that run on the ShelfBridge repository to ensure code quality, security, and reliable deployments.

## 📋 Overview

ShelfBridge uses **3 streamlined GitHub Actions workflows** following industry standards to automate:

- **Continuous Integration** - Testing and Docker builds for all changes
- **Release Management** - Automated versioning, changelogs, and Docker publishing
- **Code Quality** - Static analysis, linting, and security checks

## 🔄 Workflow Architecture

| Workflow                       | Trigger                     | Purpose                         | Status    |
| ------------------------------ | --------------------------- | ------------------------------- | --------- |
| [CI](#continuous-integration)  | PRs + feature branch pushes | Tests and Docker build testing  | ✅ Active |
| [Release](#release-management) | Pushes to main              | Automated releases + publishing | ✅ Active |
| [Code Quality](#code-quality)  | PRs + main pushes           | Linting and security analysis   | ✅ Active |

---

## 🧪 Continuous Integration

**File:** `.github/workflows/ci.yml`  
**Purpose:** Validate all code changes before merging

### Triggers

- Pull requests to `main` (primary validation)

### Jobs

#### 1. **Test Matrix**

- Runs on Node.js 20.x and 22.x
- Full test suite with `npm test`
- Linting and formatting checks (only on Node.js 20.x for efficiency)

#### 2. **Docker Build Test**

- **Condition:** Only for PRs (pull request validation)
- Builds AMD64 Docker image locally and publishes test images to GHCR
- **Test Image Publishing:**
  - `ghcr.io/rohit-purandare/shelfbridge:pr-{PR_NUMBER}` - Easy PR testing
  - `ghcr.io/rohit-purandare/shelfbridge:{COMMIT_SHA}` - Specific commit testing
- Validates image functionality:
  - Node.js runtime availability
  - Main entry point exists (`src/main.js`)
  - Basic smoke tests
- Uses GitHub Actions caching for performance
- **Usage:** `docker pull ghcr.io/rohit-purandare/shelfbridge:pr-123`
- **Note:** All images use GHCR registry for consistent authentication

#### 3. **Security & Quality**

- Security audit: `npm audit --audit-level=moderate`
- Secret scanning: Checks for hardcoded passwords/tokens
- Runs in parallel with tests for efficiency

### Performance Optimizations

- **Pull request focused**: Only runs on PRs for branch protection (no redundant push triggers)
- Full Git history (`fetch-depth: 0`) for reliable Git operations
- Matrix strategy for parallel testing
- Conditional job execution
- Docker layer caching

---

## 🚀 Release Management

**File:** `.github/workflows/release.yml`  
**Purpose:** Automated semantic versioning and Docker publishing

### Triggers

- Pushes to `main` branch only

### Jobs

#### 1. **Release Please**

- Uses Google's Release Please for automated versioning
- Analyzes conventional commits to determine version bump
- Generates structured changelogs
- Creates GitHub releases with release notes
- **Full git history** (`fetch-depth: 0`) for accurate versioning

#### 2. **Docker Publish**

- **Condition:** Only when a release is created
- **Multi-architecture builds:** AMD64 + ARM64
- **Security features:**
  - SBOM (Software Bill of Materials) generation
  - Provenance attestations
  - Build verification with runtime tests

#### 3. **Docker Tags Created**

```
ghcr.io/rohit-purandare/shelfbridge:latest
ghcr.io/rohit-purandare/shelfbridge:v1.21.0
ghcr.io/rohit-purandare/shelfbridge:1.21.0
ghcr.io/rohit-purandare/shelfbridge:v1.21
ghcr.io/rohit-purandare/shelfbridge:1.21
ghcr.io/rohit-purandare/shelfbridge:v1
ghcr.io/rohit-purandare/shelfbridge:1
```

#### 4. **Image Verification**

- Pulls published images to verify registry availability
- Tests basic functionality of published images
- Fails build if images are not accessible

#### 5. **Release Notification**

- Displays comprehensive release summary
- Lists all published Docker tags
- Provides usage examples

### Semantic Versioning Rules

- `feat:` → **MINOR** version bump (1.0.0 → 1.1.0)
- `fix:` → **PATCH** version bump (1.0.0 → 1.0.1)
- `feat!:` or `fix!:` → **MAJOR** version bump (1.0.0 → 2.0.0)
- `docs:`, `test:`, `chore:` → **No version bump**

---

## 🔍 Code Quality

**File:** `.github/workflows/code-quality.yml`  
**Purpose:** Maintain code standards and security

### Triggers

- Pull requests to `main` (primary validation)

### Checks Performed

#### 1. **ESLint Analysis**

```bash
npm run lint
```

#### 2. **Prettier Formatting**

```bash
npm run format:check
```

#### 3. **Security Audit**

```bash
npm audit --audit-level=high
```

#### 4. **Configuration Validation**

- Validates `config/config.yaml.example` is valid YAML
- Ensures required configuration structure

#### 5. **Code Issue Detection**

- **Debug statements:** Warns about `console.debug`, `console.trace`, `debugger`
- **Hardcoded secrets:** Scans for potential credentials (excluding `process.env` usage)
- **Fails build** if secrets detected

### Performance Features

- **Pull request focused**: Only runs on PRs (no redundant push triggers)
- Shallow clone for speed
- Node.js dependency caching
- Minimal permissions (`contents: read`)

---

## 🛡️ Security & Permissions

All workflows follow **principle of least privilege**:

### CI Workflow

- `test` job: `contents: read`
- `docker-build` job: `contents: read`, `actions: read` (for GitHub Actions cache)
- `security` job: `contents: read`

### Release Workflow

- `release-please` job: `contents: write`, `pull-requests: write`
- `docker-publish` job: `contents: read`, `packages: write`, `id-token: write`, `attestations: write`

### Code Quality Workflow

- `quality` job: `contents: read`

---

## 🏗️ Migration from Previous Architecture

### Removed Complex Workflows

- `docker-build.yml` - Replaced by streamlined CI workflow
- `docker-test.yml` - Integrated into CI workflow
- `reusable-docker-validation.yml` - No longer needed
- `reusable-node-setup.yml` - Simplified inline
- `version-and-release.yml` - Replaced by release.yml
- `labeler.yml` - Removed as non-essential

### Key Improvements

- **Simplified:** 3 workflows vs 8 complex files
- **Reliable:** Removed edge cases and complex conditions
- **Secure:** Modern attestations and minimal permissions
- **Fast:** Optimized caching and parallel execution
- **Standard:** Follows patterns from major OSS projects

### No Breaking Changes

All existing functionality preserved with better reliability and performance.

---

## 🔄 Workflow Execution Examples

### Feature Development

```bash
git checkout -b feature/new-matching
# Make changes, commit with conventional commits
git push origin feature/new-matching
# → CI workflow runs: tests + Docker build + security checks
# Create PR → All workflows validate the change
```

### Release Process

```bash
# Merge PR to main
git checkout main && git pull
# → Release workflow runs automatically
# → If conventional commits warrant a release:
#   1. Release Please creates PR with changelog
#   2. Merge release PR
#   3. Docker images published automatically
```

### Monitoring

- All workflow runs visible in **Actions** tab
- Failed builds block PR merging
- Release status shown in release notifications
- Docker images available immediately after release

---

## 📊 Performance Metrics

### Build Times (Typical)

- **CI Tests:** ~2-3 minutes (parallel Node.js versions)
- **CI Docker Build:** ~1-2 minutes (AMD64 only, cached)
- **Release Docker Build:** ~5-7 minutes (multi-arch)
- **Code Quality:** ~1 minute

### Reliability Improvements

- **Reduced failures:** Simplified conditions eliminate edge cases
- **Better error handling:** Explicit error messages and retry logic
- **Consistent behavior:** Standardized across all workflows

This architecture provides reliable, fast, and secure automation for the ShelfBridge project while following industry best practices.
