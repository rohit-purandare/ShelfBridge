# Two-Stage Matching Test Suite

## Overview

This comprehensive test suite ensures the two-stage matching system works correctly and integrates properly with the rest of the ShelfBridge application. The tests cover all aspects of the new architecture from unit tests to end-to-end integration scenarios.

## Test Architecture

### 🏗️ **Core Components Tests**

#### 1. **Book Identification Scorer Tests** (`book-identification-scorer.test.js`)

- **Scope**: Stage 1 scoring logic
- **Coverage**:
  - Perfect title/author matches with bonuses
  - Series and publication year matching
  - Activity/popularity scoring
  - Penalties for short titles and author mismatches
  - Score overflow protection (caps at 100%)
  - Confidence level classifications
- **Key Scenarios**: Perfect matches, variations, edge cases, scoring boundaries

#### 2. **Edition Selector Tests** (`edition-selector.test.js`)

- **Scope**: Stage 2 edition selection logic
- **Coverage**:
  - Format preference scoring (audiobook, ebook, physical)
  - Popularity-based selection
  - Duration matching for audiobooks
  - Data completeness scoring
  - Intelligent fallbacks between formats
  - Score overflow protection
- **Key Scenarios**: Format preferences, fallback logic, popularity ranking, edge cases

### 🔧 **Integration Tests**

#### 3. **Format Detection Tests** (`format-detection.test.js`)

- **Scope**: Enhanced `detectUserBookFormat` function
- **Coverage**:
  - Audiobook detection (duration, narrator, audio files, progress)
  - Ebook detection (format, ebook files, pages)
  - Case-insensitive detection
  - Complex metadata structures
  - Real-world Audiobookshelf examples
- **Key Scenarios**: All detection methods, priority rules, edge cases

#### 4. **Two-Stage Integration Tests** (`two-stage-integration.test.js`)

- **Scope**: Complete TitleAuthorMatcher two-stage flow
- **Coverage**:
  - End-to-end two-stage matching process
  - Cache hit/miss scenarios
  - Edition lookup via API when needed
  - Format-specific user preferences
  - Error handling and graceful failures
  - Configuration compatibility
- **Key Scenarios**: Complete flows, cache integration, API fallbacks

#### 5. **Sync Manager Integration Tests** (`sync-manager-two-stage.test.js`)

- **Scope**: SyncManager integration with two-stage results
- **Coverage**:
  - Auto-add functionality with two-stage matches
  - Progress extraction and syncing
  - Cache integration during sync
  - Mixed legacy and two-stage results
  - Error handling in sync context
- **Key Scenarios**: Auto-add, sync flows, backward compatibility

#### 6. **Cache Integration Tests** (`cache-two-stage.test.js`)

- **Scope**: BookCache integration with two-stage matching
- **Coverage**:
  - Edition mapping storage and retrieval
  - Multi-user cache isolation
  - Performance with bulk operations
  - Data integrity and concurrent access
  - Special characters and edge data
- **Key Scenarios**: Storage, retrieval, performance, data integrity

### 🚀 **Quality Assurance Tests**

#### 7. **Performance Regression Tests** (`performance-regression.test.js`)

- **Scope**: Performance validation and regression detection
- **Coverage**:
  - Scoring performance (book vs legacy)
  - Edition selection scaling
  - Format detection efficiency
  - End-to-end performance
  - Memory usage validation
  - Concurrent request handling
- **Key Scenarios**: Performance benchmarks, scaling tests, memory analysis

#### 8. **Edge Cases & Error Handling Tests** (`edge-cases-error-handling.test.js`)

- **Scope**: Robustness and error resilience
- **Coverage**:
  - Input validation (null, empty, malformed data)
  - API error handling (network, timeout, malformed responses)
  - Cache error scenarios
  - Scoring edge cases (division by zero, extreme values)
  - Configuration edge cases
  - Concurrency and race conditions
- **Key Scenarios**: All failure modes, boundary conditions, stress tests

## Test Execution

### 🏃 **Running Tests**

#### Run All Tests

```bash
node scripts/run-two-stage-tests.js
```

#### Run Individual Test Suites

```bash
# Unit tests
npx jest tests/book-identification-scorer.test.js
npx jest tests/edition-selector.test.js
npx jest tests/format-detection.test.js

# Integration tests
npx jest tests/two-stage-integration.test.js
npx jest tests/sync-manager-two-stage.test.js
npx jest tests/cache-two-stage.test.js

# Quality assurance tests
npx jest tests/performance-regression.test.js
npx jest tests/edge-cases-error-handling.test.js
```

#### Coverage Analysis

```bash
node scripts/run-two-stage-tests.js --coverage
```

#### Linting Only

```bash
node scripts/run-two-stage-tests.js --lint
```

### 📊 **Expected Results**

The test suite includes **200+ individual test cases** covering:

- ✅ **Unit Tests**: 80+ tests for core components
- ✅ **Integration Tests**: 60+ tests for component interaction
- ✅ **Performance Tests**: 30+ tests for performance validation
- ✅ **Edge Case Tests**: 40+ tests for error handling

**Success Criteria**:

- All tests pass (100% success rate)
- Performance within acceptable limits
- No memory leaks or regressions
- Proper error handling for all failure modes

## Test Data & Mocking

### 🎭 **Mock Strategy**

- **HardcoverClient**: Mocked API responses for predictable testing
- **BookCache**: Mocked database operations for isolation
- **Configuration**: Configurable test scenarios
- **Network**: Simulated failures and edge cases

### 📝 **Test Data**

Tests use realistic book data including:

- "The Laws of the Skies" by Gregoire Courtois (real example from troubleshooting)
- Popular series books (Harry Potter, Foundation)
- Edge cases (short titles, special characters, extreme values)
- Various formats (audiobook, ebook, physical)

## Integration with CI/CD

### 🔄 **Automated Testing**

The test suite is designed to integrate with CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run Two-Stage Matching Tests
  run: node scripts/run-two-stage-tests.js

- name: Generate Coverage Report
  run: node scripts/run-two-stage-tests.js --coverage
```

### 📈 **Quality Gates**

- **Test Pass Rate**: 100% required
- **Performance**: No regression beyond 10%
- **Coverage**: Minimum 90% for new code
- **Linting**: Zero linting errors

## Maintenance

### 🔧 **Adding New Tests**

When adding new functionality:

1. **Unit Tests**: Add to appropriate component test file
2. **Integration Tests**: Add to `two-stage-integration.test.js`
3. **Performance**: Add benchmarks to `performance-regression.test.js`
4. **Edge Cases**: Add to `edge-cases-error-handling.test.js`

### 📊 **Test Monitoring**

Regular monitoring includes:

- Test execution time trends
- Flaky test identification
- Coverage regression detection
- Performance benchmark tracking

## Troubleshooting

### 🐛 **Common Issues**

#### Tests Failing

```bash
# Check for dependency issues
npm install

# Verify Jest configuration
npx jest --version

# Run with verbose output
npx jest --verbose
```

#### Performance Issues

```bash
# Run performance tests only
npx jest tests/performance-regression.test.js

# Check for memory leaks
node --expose-gc scripts/run-two-stage-tests.js
```

#### Mock Issues

- Ensure mocks are properly reset between tests
- Verify mock data matches expected API responses
- Check for mock call verification failures

### 📞 **Support**

For test-related issues:

1. Check test output for specific failure details
2. Review mock configurations and test data
3. Verify environment setup and dependencies
4. Run individual test suites to isolate problems

---

## Summary

This comprehensive test suite ensures the two-stage matching system is:

- ✅ **Functionally Correct**: All components work as designed
- ✅ **Well Integrated**: Components work together seamlessly
- ✅ **Performant**: No regressions in speed or memory usage
- ✅ **Robust**: Handles all edge cases and error conditions
- ✅ **Backward Compatible**: Works with existing ShelfBridge features

The test suite provides confidence that the two-stage matching implementation is production-ready and will improve book matching success rates without breaking existing functionality.
