#!/bin/bash

# Update CHANGELOG.md script
# This script can be used to manually update the changelog or test the automated process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -v, --version VERSION    Specify version (e.g., 1.16.1)"
    echo "  -t, --tag TAG           Use specific git tag as starting point"
    echo "  -d, --dry-run           Show what would be added without updating file"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -v 1.16.1                    # Update changelog for version 1.16.1"
    echo "  $0 -v 1.16.1 -t v1.16.0         # Generate changelog from v1.16.0 to current"
    echo "  $0 -d                           # Dry run with auto-detected version"
}

# Parse command line arguments
VERSION=""
START_TAG=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        -t|--tag)
            START_TAG="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Get current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

print_status "Updating changelog in: $REPO_ROOT"

# Auto-detect version if not provided
if [ -z "$VERSION" ]; then
    if [ -f "package.json" ]; then
        VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "")
    fi
    
    if [ -z "$VERSION" ]; then
        print_error "Could not auto-detect version. Please specify with -v option."
        exit 1
    fi
    
    print_status "Auto-detected version: $VERSION"
fi

# Validate version format
if ! echo "$VERSION" | grep -E '^[0-9]+\.[0-9]+\.[0-9]+' > /dev/null; then
    print_error "Invalid version format: $VERSION (expected: X.Y.Z)"
    exit 1
fi

# Get the last tag if not specified
if [ -z "$START_TAG" ]; then
    START_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    if [ -n "$START_TAG" ]; then
        print_status "Using last tag as starting point: $START_TAG"
    else
        print_status "No previous tags found, generating from first commit"
    fi
fi

# Get current date
CURRENT_DATE=$(date +'%Y-%m-%d')
print_status "Using date: $CURRENT_DATE"

# Get commits since last tag
print_status "Analyzing commits..."
if [ -z "$START_TAG" ]; then
    COMMITS=$(git log --pretty=format:"%s" --no-merges)
else
    COMMITS=$(git log ${START_TAG}..HEAD --pretty=format:"%s" --no-merges)
fi

if [ -z "$COMMITS" ]; then
    print_warning "No commits found since $START_TAG"
    if [ "$DRY_RUN" = false ]; then
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Aborted."
            exit 0
        fi
    fi
fi

# Categorize commits
ADDED=""
CHANGED=""
FIXED=""
IMPROVED=""

print_status "Categorizing commits..."
while IFS= read -r commit; do
    if [ -z "$commit" ]; then
        continue
    fi
    
    if echo "$commit" | grep -E "^feat(\(.+\))?!?:" > /dev/null; then
        FEATURE=$(echo "$commit" | sed 's/^feat[^:]*: */- **/' | sed 's/$/**/')
        ADDED="${ADDED}${FEATURE}\n"
        print_status "  Added: $commit"
    elif echo "$commit" | grep -E "^fix(\(.+\))?!?:" > /dev/null; then
        FIX=$(echo "$commit" | sed 's/^fix[^:]*: */- /')
        FIXED="${FIXED}${FIX}\n"
        print_status "  Fixed: $commit"
    elif echo "$commit" | grep -E "^perf(\(.+\))?!?:" > /dev/null; then
        PERF=$(echo "$commit" | sed 's/^perf[^:]*: */- /')
        IMPROVED="${IMPROVED}${PERF}\n"
        print_status "  Improved: $commit"
    elif echo "$commit" | grep -E "^refactor(\(.+\))?!?:" > /dev/null; then
        REFACTOR=$(echo "$commit" | sed 's/^refactor[^:]*: */- /')
        CHANGED="${CHANGED}${REFACTOR}\n"
        print_status "  Changed: $commit"
    else
        # Handle non-conventional commits
        if echo "$commit" | grep -iE "improve|enhance|better|optimi[sz]e" > /dev/null; then
            IMPROVEMENT=$(echo "$commit" | sed 's/^/- /')
            IMPROVED="${IMPROVED}${IMPROVEMENT}\n"
            print_status "  Improved: $commit"
        elif echo "$commit" | grep -iE "add|implement|create" > /dev/null; then
            ADDITION=$(echo "$commit" | sed 's/^/- /')
            ADDED="${ADDED}${ADDITION}\n"
            print_status "  Added: $commit"
        elif echo "$commit" | grep -iE "change|update|modify" > /dev/null; then
            CHANGE=$(echo "$commit" | sed 's/^/- /')
            CHANGED="${CHANGED}${CHANGE}\n"
            print_status "  Changed: $commit"
        else
            # Default to Changed for other commits
            CHANGE=$(echo "$commit" | sed 's/^/- /')
            CHANGED="${CHANGED}${CHANGE}\n"
            print_status "  Changed: $commit"
        fi
    fi
done <<< "$COMMITS"

# Create changelog entry
print_status "Generating changelog entry..."
CHANGELOG_ENTRY="## [$VERSION] - $CURRENT_DATE\n\n"

if [ -n "$ADDED" ]; then
    CHANGELOG_ENTRY="${CHANGELOG_ENTRY}### Added\n"
    CHANGELOG_ENTRY="${CHANGELOG_ENTRY}${ADDED}\n"
fi

if [ -n "$CHANGED" ]; then
    CHANGELOG_ENTRY="${CHANGELOG_ENTRY}### Changed\n"
    CHANGELOG_ENTRY="${CHANGELOG_ENTRY}${CHANGED}\n"
fi

if [ -n "$FIXED" ]; then
    CHANGELOG_ENTRY="${CHANGELOG_ENTRY}### Fixed\n"
    CHANGELOG_ENTRY="${CHANGELOG_ENTRY}${FIXED}\n"
fi

if [ -n "$IMPROVED" ]; then
    CHANGELOG_ENTRY="${CHANGELOG_ENTRY}### Improved\n"
    CHANGELOG_ENTRY="${CHANGELOG_ENTRY}${IMPROVED}\n"
fi

# Show preview
print_status "Changelog entry preview:"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "$CHANGELOG_ENTRY"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$DRY_RUN" = true ]; then
    print_success "Dry run completed. CHANGELOG.md was not modified."
    exit 0
fi

# Create CHANGELOG.md if it doesn't exist
if [ ! -f "CHANGELOG.md" ]; then
    print_warning "CHANGELOG.md not found. Creating new file..."
    cat > CHANGELOG.md << 'EOF'
# Changelog

All notable changes to ShelfBridge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

EOF
fi

# Ask for confirmation
read -p "Update CHANGELOG.md with this entry? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_status "Aborted."
    exit 0
fi

# Create temporary file with new entry
print_status "Updating CHANGELOG.md..."
echo -e "$CHANGELOG_ENTRY" > /tmp/changelog_entry.md

# Insert new changelog entry after [Unreleased] section
awk '
    /^## \[Unreleased\]/ {
        print $0
        print ""
        while ((getline line < "/tmp/changelog_entry.md") > 0) {
            print line
        }
        close("/tmp/changelog_entry.md")
        next
    }
    {print}
' CHANGELOG.md > CHANGELOG_temp.md

mv CHANGELOG_temp.md CHANGELOG.md

# Update version links if they exist
if grep -q "\[Unreleased\]:" CHANGELOG.md; then
    REPO_URL=$(git remote get-url origin | sed 's/\.git$//' | sed 's/git@github.com:/https:\/\/github.com\//')
    
    # Update existing links
    sed -i.bak "s|\[Unreleased\]:.*|[Unreleased]: ${REPO_URL}/compare/v${VERSION}...HEAD|" CHANGELOG.md
    
    # Add new version link if not already present
    if ! grep -q "\[${VERSION}\]:" CHANGELOG.md; then
        # Find the last version in links and insert new one
        LAST_VERSION=$(grep -o '\[v\?[0-9]\+\.[0-9]\+\.[0-9]\+\]:' CHANGELOG.md | head -1 | sed 's/\[\|]://g' | sed 's/^v//')
        if [ -n "$LAST_VERSION" ] && [ "$LAST_VERSION" != "$VERSION" ]; then
            sed -i.bak "/\[Unreleased\]:/a\\
[${VERSION}]: ${REPO_URL}/compare/v${LAST_VERSION}...v${VERSION}" CHANGELOG.md
        else
            sed -i.bak "/\[Unreleased\]:/a\\
[${VERSION}]: ${REPO_URL}/releases/tag/v${VERSION}" CHANGELOG.md
        fi
    fi
    
    # Remove backup file
    rm -f CHANGELOG.md.bak
fi

# Clean up temporary file
rm -f /tmp/changelog_entry.md

print_success "CHANGELOG.md updated successfully!"
print_status "You can now commit the changes:"
print_status "  git add CHANGELOG.md"
print_status "  git commit -m \"docs: update CHANGELOG.md for v$VERSION\"" 