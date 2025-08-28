#!/bin/bash
# GitHub Actions Status Check Recovery Script
# 
# This script helps recover from stuck GitHub Actions status checks
# by creating an empty commit to trigger fresh workflow runs.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    print_error "GitHub CLI (gh) is not installed. Please install it first."
    exit 1
fi

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "Not in a git repository."
    exit 1
fi

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
print_info "Current branch: $CURRENT_BRANCH"

# Check if there's an associated PR
PR_NUMBER=$(gh pr view --json number --jq .number 2>/dev/null || echo "")

if [[ -z "$PR_NUMBER" ]]; then
    print_warning "No pull request found for current branch."
    print_info "You may need to create a PR first, or switch to the correct branch."
    exit 1
fi

print_info "Found PR #$PR_NUMBER"

# Check current status checks
print_info "Checking current status checks..."
if gh pr checks $PR_NUMBER 2>/dev/null | grep -q "pending\|Expected"; then
    print_warning "Found stuck status checks. Attempting to refresh..."
    
    # Create empty commit to trigger workflows
    print_info "Creating empty commit to trigger fresh workflow runs..."
    git commit --allow-empty -m "chore: refresh GitHub Actions status checks

This empty commit resolves stuck status check issues by triggering
fresh workflow runs. See: .github/scripts/refresh-status-checks.sh"
    
    # Push the commit
    print_info "Pushing empty commit..."
    git push
    
    print_success "Empty commit pushed successfully!"
    print_info "Workflow runs should start within 30 seconds."
    print_info "Monitor progress at: https://github.com/$(gh repo view --json owner,name --jq '.owner.login + "/" + .name')/pull/$PR_NUMBER"
    
    # Wait and check status
    print_info "Waiting 30 seconds for workflows to start..."
    sleep 30
    
    print_info "Current workflow status:"
    gh pr checks $PR_NUMBER 2>/dev/null || print_warning "Unable to fetch status checks"
    
else
    print_success "No stuck status checks detected!"
    print_info "Current status:"
    gh pr checks $PR_NUMBER 2>/dev/null || print_warning "Unable to fetch status checks"
fi

print_info "Script completed. If issues persist, try:"
print_info "1. Manually trigger workflows via GitHub Actions tab"
print_info "2. Close and reopen the PR"
print_info "3. Contact repository maintainers"