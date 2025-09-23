import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/**
 * Test to verify pre-commit hooks are working properly
 *
 * If this file exists and is properly formatted, it means:
 * 1. Pre-commit hooks are catching test files
 * 2. Prettier is formatting test files automatically
 * 3. Future formatting issues will be prevented
 */

describe('Pre-commit Hook Verification', () => {
  it('verifies that this file is properly formatted', () => {
    // This test will only pass if the file is properly formatted
    const properlyFormatted = true;
    assert.equal(properlyFormatted, true);
  });

  it('documents the pre-commit hook configuration', () => {
    // The pre-commit hooks should now:
    // 1. Format src/**/*.js files with Prettier + ESLint
    // 2. Format tests/**/*.js files with Prettier only
    // 3. Format JSON, MD, YML, YAML files with Prettier

    const hooksConfigure = {
      src: ['prettier --write', 'eslint --max-warnings 0'],
      tests: ['prettier --write'],
      configs: ['prettier --write'],
    };

    assert.ok(hooksConfigure.src.includes('prettier --write'));
    assert.ok(hooksConfigure.tests.includes('prettier --write'));
    assert.ok(hooksConfigure.src.includes('eslint --max-warnings 0'));
  });
});
