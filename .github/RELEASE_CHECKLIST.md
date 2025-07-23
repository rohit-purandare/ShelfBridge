# Release Checklist

This checklist ensures quality and prevents critical issues like the v1.18.8 native module compatibility problem.

**⚠️ ZERO TOLERANCE POLICY: ANY test failure blocks the build/deployment immediately.**

## Pre-Release Validation

### ✅ Code Quality (MANDATORY - BUILD FAILS IF BROKEN)
- [ ] All CI checks pass (lint, format, tests) ⚠️ BLOCKS MERGE
- [ ] Security scan passes ⚠️ BLOCKS MERGE
- [ ] No high-severity vulnerabilities in `npm audit` ⚠️ BLOCKS MERGE
- [ ] **ALL TESTS MUST PASS - NO EXCEPTIONS**

### ✅ Native Module Compatibility (MANDATORY - BUILD FAILS IF BROKEN)
- [ ] `npm run test:native` passes locally ⚠️ REQUIRED
- [ ] CI native module tests pass on all Node versions ⚠️ BLOCKS MERGE
- [ ] Docker image native module tests pass ⚠️ BLOCKS PUSH
- [ ] Health check validates native modules ⚠️ PREVENTS DEPLOYMENT
- [ ] **NO BROKEN IMAGES CAN BE PUSHED TO REGISTRY**

### ✅ Application Tests (MANDATORY - BUILD FAILS IF BROKEN)
- [ ] `npm test` passes completely ⚠️ BLOCKS MERGE
- [ ] Cache functionality tests pass ⚠️ BLOCKS MERGE
- [ ] Main entry point tests pass ⚠️ BLOCKS MERGE
- [ ] All required files present ⚠️ BLOCKS MERGE
- [ ] **NO TEST TIMEOUTS OR FAILURES ALLOWED**

### ✅ Multi-Architecture Testing (MANDATORY - BUILD FAILS IF BROKEN)
- [ ] Docker builds successfully for linux/amd64 ⚠️ BLOCKS PUSH
- [ ] Docker builds successfully for linux/arm64 ⚠️ BLOCKS PUSH
- [ ] Both architectures pass native module tests ⚠️ BLOCKS PUSH
- [ ] **ALL PLATFORMS MUST WORK IDENTICALLY**

### ✅ Functionality Testing (MANDATORY - BUILD FAILS IF BROKEN)
- [ ] Main application starts without errors ⚠️ BLOCKS MERGE
- [ ] Configuration validation works ⚠️ BLOCKS MERGE
- [ ] Cache operations work ⚠️ BLOCKS MERGE
- [ ] Core sync functionality works (at least `--dry-run`) ⚠️ BLOCKS MERGE

### ✅ Docker Validation (MANDATORY - BUILD FAILS IF BROKEN)
- [ ] Docker container starts successfully ⚠️ BLOCKS PUSH
- [ ] Health check passes ⚠️ PREVENTS DEPLOYMENT
- [ ] Volume mounts work correctly ⚠️ BLOCKS PUSH
- [ ] Environment variable configuration works ⚠️ BLOCKS PUSH

## Dependency Updates

If this release includes dependency updates:

### ✅ Native Dependencies (MANDATORY - BUILD FAILS IF BROKEN)
- [ ] `better-sqlite3` compiles on all supported platforms ⚠️ BLOCKS PUSH
- [ ] Native modules pass compatibility tests ⚠️ BLOCKS PUSH
- [ ] No NODE_MODULE_VERSION mismatches ⚠️ BLOCKS PUSH
- [ ] **NATIVE MODULE FAILURES = IMMEDIATE BUILD FAILURE**

### ✅ Security Updates (MANDATORY - BUILD FAILS IF BROKEN)
- [ ] All security vulnerabilities resolved ⚠️ BLOCKS MERGE
- [ ] No new vulnerabilities introduced ⚠️ BLOCKS MERGE
- [ ] Dependency licenses are compatible ⚠️ BLOCKS MERGE

## Release Execution

### ✅ Version Management
- [ ] Version follows semantic versioning
- [ ] Changelog is automatically updated
- [ ] Git tags are properly created

### ✅ Distribution
- [ ] Docker images are built and pushed
- [ ] GitHub release is created
- [ ] Release notes are comprehensive

## Post-Release Validation

### ✅ Deployment Verification
- [ ] Docker pull works from registry
- [ ] Latest tag points to new version
- [ ] Users can update without manual intervention

### ✅ Monitoring
- [ ] Monitor for error reports in first 24 hours
- [ ] Check GitHub issues for update problems
- [ ] Verify health checks in production

## Emergency Response

If critical issues are discovered:

### ✅ Hotfix Process
- [ ] Identify root cause
- [ ] Create minimal fix
- [ ] Test fix thoroughly with `npm run pre-flight`
- [ ] Release hotfix immediately
- [ ] Update prevention strategies

## Pre-Push Validation Tool

**🚀 ALWAYS run before pushing:**

```bash
npm run pre-flight
```

This replicates ALL CI checks locally and will catch failures before they reach CI.

---

## ⚠️ CRITICAL PRINCIPLES

1. **ZERO TOLERANCE**: ANY test failure blocks build/deployment
2. **NO EXCEPTIONS**: Even "minor" test failures block everything
3. **FAIL FAST**: Tests fail immediately when broken
4. **NO WORKAROUNDS**: Fix the root cause, don't mask failures
5. **ALL PLATFORMS**: Every architecture must work identically

**💡 TIP**: Use `npm run pre-flight` locally before pushing any changes.

**🚫 NEVER**: Skip checks, allow failures, or push broken code "temporarily" 