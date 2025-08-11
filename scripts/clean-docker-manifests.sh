#!/bin/bash

# Script to clean up duplicate and malformed Docker manifests
# This addresses the issue with duplicate linux/amd64 entries and unknown/unknown architectures

set -e

REPO="rohit-purandare/shelfbridge"
REGISTRY="ghcr.io"

echo "🧹 Cleaning up Docker manifests for ${REGISTRY}/${REPO}"

# Check if gh CLI is available
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is required for this script"
    echo "   Install it from: https://cli.github.com/"
    exit 1
fi

# Authenticate check
if ! gh auth status &> /dev/null; then
    echo "❌ GitHub CLI not authenticated"
    echo "   Run: gh auth login"
    exit 1
fi

# Get package information
echo "📦 Fetching package information..."
PACKAGE_INFO=$(gh api \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "/users/rohit-purandare/packages/container/shelfbridge/versions" \
  --jq '.[] | select(.metadata.container.tags | length > 0) | {id: .id, tags: .metadata.container.tags, created_at: .created_at}' \
  2>/dev/null)

if [ -z "$PACKAGE_INFO" ]; then
    echo "❌ Could not fetch package information"
    echo "   Make sure you have appropriate permissions for the package"
    exit 1
fi

echo "📋 Found package versions with tags"

# For manual cleanup, we'll provide instructions since automated deletion
# requires careful consideration of which manifests to remove
echo ""
echo "🔍 To identify problematic manifests:"
echo "   1. Check current package at: https://github.com/users/rohit-purandare/packages/container/package/shelfbridge"
echo "   2. Look for duplicate linux/amd64 entries or unknown/unknown architectures"
echo "   3. Note the version IDs that need cleanup"
echo ""
echo "⚠️  Manual Action Required:"
echo "   Due to the complexity of manifest deletion, you should:"
echo "   1. Go to: https://github.com/users/rohit-purandare/packages/container/package/shelfbridge"
echo "   2. Delete versions with unknown/unknown architecture"
echo "   3. If you see duplicate linux/amd64 entries, keep the most recent one"
echo ""
echo "🔄 After cleanup, rebuild the affected tags using:"
echo "   git push --force-with-lease origin <branch-name>"
echo ""
echo "✅ Updated Docker build workflow to prevent future duplicates"
echo "   - Separated cache scopes for PR vs multi-arch builds"
echo "   - Added provenance: false and sbom: false to reduce manifest complexity"
echo "   - This should prevent the duplicate/unknown architecture issue going forward"
