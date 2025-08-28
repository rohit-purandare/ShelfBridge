# GitHub Actions Troubleshooting Guide

## Common Issues and Solutions

### 1. Status Checks Stuck in "Waiting for status to be reported"

**Symptoms:**

- PR shows required checks as "Expected — Waiting for status to be reported"
- Workflows appear to be completed successfully but don't reflect in PR status
- Status checks remain pending indefinitely

**Root Cause:**
GitHub's internal synchronization between workflow runs and PR status checks can occasionally get out of sync.

**Solutions (in order of preference):**

#### Quick Fix - Use Recovery Script

```bash
# Run the automated recovery script
./.github/scripts/refresh-status-checks.sh
```

#### Manual Fix - Empty Commit Method

```bash
# Create an empty commit to trigger fresh workflows
git commit --allow-empty -m "chore: trigger status checks refresh"
git push
```

#### Manual Workflow Trigger (if dispatch enabled)

```bash
# Trigger workflows manually via GitHub CLI
gh workflow run "CI" --ref your-branch-name
gh workflow run "Code Quality" --ref your-branch-name
```

#### GitHub UI Method

1. Go to Actions tab in your repository
2. Select the stuck workflow
3. Click "Re-run jobs" if available
4. Or close/reopen the PR to trigger fresh checks

### 2. Workflows Not Triggering at All

**Symptoms:**

- No workflow runs appear in the Actions tab
- PR has no status checks

**Common Causes & Solutions:**

#### Branch Protection Rules

- Check repository settings → Branches → Branch protection rules
- Ensure required status checks are properly configured
- Verify workflow names match exactly

#### Workflow File Issues

```bash
# Validate workflow syntax
gh workflow list
gh workflow view "CI"
```

#### Permission Issues

- Verify `GITHUB_TOKEN` has necessary permissions
- Check workflow permissions in `.github/workflows/*.yml`

### 3. Intermittent Workflow Failures

**Solutions:**

- Add retry mechanisms to workflows
- Increase timeout values for flaky tests
- Use matrix strategies for better reliability

## Prevention Strategies

### 1. Workflow Dispatch Triggers

Add `workflow_dispatch` to allow manual triggering:

```yaml
on:
  pull_request:
    branches: [main]
  workflow_dispatch:
    inputs:
      reason:
        description: 'Reason for manual trigger'
        required: false
        default: 'Manual workflow trigger'
```

### 2. Status Check Monitoring

Monitor workflow health with:

```bash
# Check recent workflow runs
gh run list --limit 10

# Check specific PR status
gh pr checks PR_NUMBER

# View workflow details
gh run view RUN_ID
```

### 3. Robust Workflow Configuration

- Use specific action versions (not @latest)
- Add appropriate timeouts
- Include failure handling
- Use concurrency controls

### 4. Regular Maintenance

- Update actions dependencies monthly
- Monitor workflow performance trends
- Review failed runs for patterns

## Emergency Contacts

If these solutions don't work:

1. Check GitHub Status: https://www.githubstatus.com/
2. GitHub Support: https://support.github.com/
3. Repository maintainers

## Useful Commands

```bash
# View all workflows
gh workflow list

# Check PR status
gh pr status

# View recent runs
gh run list --limit 5

# View specific run details
gh run view RUN_ID --log

# Manually trigger workflow
gh workflow run "WORKFLOW_NAME"

# Re-run failed jobs
gh run rerun RUN_ID --failed
```

## Related Documentation

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub CLI Documentation](https://cli.github.com/manual/)
- [Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
