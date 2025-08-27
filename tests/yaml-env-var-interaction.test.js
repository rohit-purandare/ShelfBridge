import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { writeFileSync, unlinkSync } from 'fs';

import { Config } from '../src/config.js';

/**
 * Tests for YAML and environment variable interaction scenarios
 *
 * Validates priority, fallback behavior, and edge cases when both
 * YAML configuration files and environment variables are present
 */

describe('YAML and Environment Variable Interaction', () => {
  let originalEnv;
  const testConfigFile = 'test-interaction-config.yaml';

  beforeEach(() => {
    // Save original environment variables
    originalEnv = { ...process.env };

    // Clear all ShelfBridge environment variables
    for (const key in process.env) {
      if (key.startsWith('SHELFBRIDGE_')) {
        delete process.env[key];
      }
    }
  });

  afterEach(() => {
    // Restore original environment variables
    process.env = originalEnv;

    // Clean up test config file
    try {
      unlinkSync(testConfigFile);
    } catch (err) {
      // Ignore if file doesn't exist
    }
  });

  describe('Configuration Priority', () => {
    it('gives YAML highest priority over environment variables and defaults', () => {
      // Set environment variables
      process.env.SHELFBRIDGE_WORKERS = '3';
      process.env.SHELFBRIDGE_PARALLEL = 'false';
      process.env.SHELFBRIDGE_MIN_PROGRESS_THRESHOLD = '5.0';
      process.env.SHELFBRIDGE_DELAYED_UPDATES_ENABLED = 'false';

      const yamlContent = `
global:
  workers: 8                    # Override env var
  parallel: true                # Override env var
  min_progress_threshold: 2.5   # Override env var
  delayed_updates:
    enabled: true               # Override env var

users:
  - id: "priority_test_user"
    abs_url: "https://priority.example.com"
    abs_token: "priority_token"
    hardcover_token: "priority_hc"
`;

      writeFileSync(testConfigFile, yamlContent);
      const config = new Config(testConfigFile);

      const global = config.getGlobal();

      // YAML values should take precedence
      assert.strictEqual(global.workers, 8);
      assert.strictEqual(global.parallel, true);
      assert.strictEqual(global.min_progress_threshold, 2.5);
      assert.strictEqual(global.delayed_updates.enabled, true);

      // Other values not in YAML should use env vars or defaults
      assert.strictEqual(global.timezone, 'UTC'); // Default (no env var set)
    });

    it('uses environment variables when YAML values are missing', () => {
      // Set environment variables for missing YAML values
      process.env.SHELFBRIDGE_HARDCOVER_RATE_LIMIT = '45';
      process.env.SHELFBRIDGE_PAGE_SIZE = '150';
      process.env.SHELFBRIDGE_TIMEZONE = 'America/Chicago';
      process.env.SHELFBRIDGE_DELAYED_UPDATES_SESSION_TIMEOUT = '1800';

      const yamlContent = `
global:
  workers: 6
  parallel: true
  # hardcover_rate_limit, page_size, timezone not specified
  delayed_updates:
    enabled: true
    # session_timeout not specified

users:
  - id: "env_fallback_user"
    abs_url: "https://fallback.example.com"
    abs_token: "fallback_token"
    hardcover_token: "fallback_hc"
`;

      writeFileSync(testConfigFile, yamlContent);
      const config = new Config(testConfigFile);

      const global = config.getGlobal();

      // YAML values should be used
      assert.strictEqual(global.workers, 6);
      assert.strictEqual(global.parallel, true);
      assert.strictEqual(global.delayed_updates.enabled, true);

      // Environment variables should fill in missing values
      assert.strictEqual(global.hardcover_rate_limit, 45);
      assert.strictEqual(global.page_size, 150);
      assert.strictEqual(global.timezone, 'America/Chicago');
      assert.strictEqual(global.delayed_updates.session_timeout, 1800);

      // Unspecified values should use defaults
      assert.strictEqual(global.delayed_updates.max_delay, 3600); // Default
      assert.strictEqual(global.delayed_updates.immediate_completion, true); // Default
    });

    it('uses defaults when neither YAML nor environment variables specify values', () => {
      const yamlContent = `
global:
  workers: 4
  # Most other settings not specified

users:
  - id: "defaults_user"
    abs_url: "https://defaults.example.com"
    abs_token: "defaults_token"
    hardcover_token: "defaults_hc"
`;

      writeFileSync(testConfigFile, yamlContent);
      const config = new Config(testConfigFile);

      const global = config.getGlobal();

      // Specified YAML value
      assert.strictEqual(global.workers, 4);

      // All unspecified values should use defaults
      assert.strictEqual(global.min_progress_threshold, 5.0);
      assert.strictEqual(global.parallel, true);
      assert.strictEqual(global.timezone, 'UTC');
      assert.strictEqual(global.dry_run, false);
      assert.strictEqual(global.hardcover_rate_limit, 55);
      assert.strictEqual(global.audiobookshelf_rate_limit, 600);
      assert.strictEqual(global.page_size, 100);
      assert.strictEqual(global.delayed_updates.enabled, false);
      assert.strictEqual(global.delayed_updates.session_timeout, 900);
      assert.strictEqual(global.delayed_updates.max_delay, 3600);
      assert.strictEqual(global.delayed_updates.immediate_completion, true);
    });
  });

  describe('Alternative YAML Boolean Representations', () => {
    it('handles string representations of booleans in YAML correctly', () => {
      const yamlContent = `
global:
  parallel: "true"      # String representation
  dry_run: "false"      # String representation  
  force_sync: "1"       # String representation
  auto_add_books: "0"   # String representation

users:
  - id: "string_bool_user"
    abs_url: "https://stringbool.example.com"
    abs_token: "stringbool_token"
    hardcover_token: "stringbool_hc"
`;

      writeFileSync(testConfigFile, yamlContent);
      const config = new Config(testConfigFile);

      const global = config.getGlobal();

      // String booleans should be parsed correctly (they remain as strings from YAML)
      // The application should handle these appropriately
      assert.strictEqual(global.parallel, 'true');
      assert.strictEqual(global.dry_run, 'false');
      assert.strictEqual(global.force_sync, '1');
      assert.strictEqual(global.auto_add_books, '0');

      // Types should be strings (as YAML parsed them)
      assert.strictEqual(typeof global.parallel, 'string');
      assert.strictEqual(typeof global.dry_run, 'string');
      assert.strictEqual(typeof global.force_sync, 'string');
      assert.strictEqual(typeof global.auto_add_books, 'string');
    });

    it('handles YAML yes/no/on/off as strings (not converted to booleans)', () => {
      const yamlContent = `
global:
  parallel: yes        # YAML yes/no are parsed as strings by js-yaml
  dry_run: no
  force_sync: on
  auto_add_books: off

users:
  - id: "yaml_bool_user"  
    abs_url: "https://yamlbool.example.com"
    abs_token: "yamlbool_token"
    hardcover_token: "yamlbool_hc"
`;

      writeFileSync(testConfigFile, yamlContent);
      const config = new Config(testConfigFile);

      const global = config.getGlobal();

      // js-yaml doesn't auto-convert yes/no/on/off to booleans
      // They remain as strings
      assert.strictEqual(global.parallel, 'yes');
      assert.strictEqual(global.dry_run, 'no');
      assert.strictEqual(global.force_sync, 'on');
      assert.strictEqual(global.auto_add_books, 'off');

      // All should be strings
      assert.strictEqual(typeof global.parallel, 'string');
      assert.strictEqual(typeof global.dry_run, 'string');
      assert.strictEqual(typeof global.force_sync, 'string');
      assert.strictEqual(typeof global.auto_add_books, 'string');
    });
  });

  describe('User Configuration Priority', () => {
    it('prioritizes YAML user config over environment variables', () => {
      // Set user environment variables
      process.env.SHELFBRIDGE_USER_0_ID = 'env_user';
      process.env.SHELFBRIDGE_USER_0_ABS_URL = 'https://env.example.com';
      process.env.SHELFBRIDGE_USER_0_ABS_TOKEN = 'env_token';
      process.env.SHELFBRIDGE_USER_0_HARDCOVER_TOKEN = 'env_hc';

      const yamlContent = `
global:
  workers: 5

users:
  - id: "yaml_user"                      # Override env var
    abs_url: "https://yaml.example.com"  # Override env var
    abs_token: "yaml_token"             # Override env var
    hardcover_token: "yaml_hc"          # Override env var
`;

      writeFileSync(testConfigFile, yamlContent);
      const config = new Config(testConfigFile);

      const users = config.getUsers();

      // YAML user should take precedence over env vars
      assert.strictEqual(users.length, 1);
      assert.strictEqual(users[0].id, 'yaml_user');
      assert.strictEqual(users[0].abs_url, 'https://yaml.example.com');
      assert.strictEqual(users[0].abs_token, 'yaml_token');
      assert.strictEqual(users[0].hardcover_token, 'yaml_hc');
    });

    it('combines YAML and environment users correctly', () => {
      // Set environment user
      process.env.SHELFBRIDGE_USER_1_ID = 'env_user';
      process.env.SHELFBRIDGE_USER_1_ABS_URL = 'https://env.example.com';
      process.env.SHELFBRIDGE_USER_1_ABS_TOKEN = 'env_token';
      process.env.SHELFBRIDGE_USER_1_HARDCOVER_TOKEN = 'env_hc';

      const yamlContent = `
global:
  workers: 5

users:
  - id: "yaml_user"
    abs_url: "https://yaml.example.com"
    abs_token: "yaml_token"
    hardcover_token: "yaml_hc"
`;

      writeFileSync(testConfigFile, yamlContent);
      const config = new Config(testConfigFile);

      const users = config.getUsers();

      // Should have both YAML and environment users
      assert.strictEqual(users.length, 2);

      // YAML user (index 0)
      assert.strictEqual(users[0].id, 'yaml_user');
      assert.strictEqual(users[0].abs_url, 'https://yaml.example.com');

      // Environment user (index 1)
      assert.strictEqual(users[1].id, 'env_user');
      assert.strictEqual(users[1].abs_url, 'https://env.example.com');
    });
  });

  describe('Nested Configuration Priority', () => {
    it('handles partial nested configuration with environment variable fallback', () => {
      // Set environment variables for nested config
      process.env.SHELFBRIDGE_DELAYED_UPDATES_SESSION_TIMEOUT = '3600';
      process.env.SHELFBRIDGE_DELAYED_UPDATES_MAX_DELAY = '7200';

      const yamlContent = `
global:
  delayed_updates:
    enabled: true
    immediate_completion: false
    # session_timeout and max_delay not specified - should use env vars

users:
  - id: "nested_user"
    abs_url: "https://nested.example.com"
    abs_token: "nested_token"
    hardcover_token: "nested_hc"
`;

      writeFileSync(testConfigFile, yamlContent);
      const config = new Config(testConfigFile);

      const delayedUpdates = config.getGlobal().delayed_updates;

      // YAML values should be used
      assert.strictEqual(delayedUpdates.enabled, true);
      assert.strictEqual(delayedUpdates.immediate_completion, false);

      // Environment variables should fill in missing nested values
      assert.strictEqual(delayedUpdates.session_timeout, 3600);
      assert.strictEqual(delayedUpdates.max_delay, 7200);
    });

    it('gives YAML nested values precedence over environment variables', () => {
      // Set environment variables that should be overridden
      process.env.SHELFBRIDGE_DELAYED_UPDATES_ENABLED = 'false';
      process.env.SHELFBRIDGE_DELAYED_UPDATES_SESSION_TIMEOUT = '900';
      process.env.SHELFBRIDGE_DELAYED_UPDATES_MAX_DELAY = '3600';
      process.env.SHELFBRIDGE_DELAYED_UPDATES_IMMEDIATE_COMPLETION = 'true';

      const yamlContent = `
global:
  delayed_updates:
    enabled: true          # Override env var
    session_timeout: 1800  # Override env var
    max_delay: 7200       # Override env var
    immediate_completion: false  # Override env var

users:
  - id: "override_user"
    abs_url: "https://override.example.com"
    abs_token: "override_token"
    hardcover_token: "override_hc"
`;

      writeFileSync(testConfigFile, yamlContent);
      const config = new Config(testConfigFile);

      const delayedUpdates = config.getGlobal().delayed_updates;

      // All YAML values should override environment variables
      assert.strictEqual(delayedUpdates.enabled, true);
      assert.strictEqual(delayedUpdates.session_timeout, 1800);
      assert.strictEqual(delayedUpdates.max_delay, 7200);
      assert.strictEqual(delayedUpdates.immediate_completion, false);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('handles mixed valid YAML and invalid environment variables', () => {
      // Set some invalid environment variables
      process.env.SHELFBRIDGE_WORKERS = 'invalid_number';
      process.env.SHELFBRIDGE_PARALLEL = 'invalid_boolean';
      process.env.SHELFBRIDGE_HARDCOVER_RATE_LIMIT = '45'; // Valid

      const yamlContent = `
global:
  min_progress_threshold: 7.5  # Valid YAML value
  # workers and parallel not specified - should use defaults due to invalid env vars
  # hardcover_rate_limit not specified - should use valid env var

users:
  - id: "mixed_user"
    abs_url: "https://mixed.example.com"
    abs_token: "mixed_token"
    hardcover_token: "mixed_hc"
`;

      writeFileSync(testConfigFile, yamlContent);
      const config = new Config(testConfigFile);

      const global = config.getGlobal();

      // YAML value should be used
      assert.strictEqual(global.min_progress_threshold, 7.5);

      // Invalid env vars should trigger defaults
      assert.strictEqual(global.workers, 3); // Default
      assert.strictEqual(global.parallel, true); // Default

      // Valid env var should be used
      assert.strictEqual(global.hardcover_rate_limit, 45);
    });

    it('handles empty YAML sections with environment variable fallback', () => {
      // Set environment variables
      process.env.SHELFBRIDGE_WORKERS = '6';
      process.env.SHELFBRIDGE_DELAYED_UPDATES_ENABLED = 'true';

      const yamlContent = `
global:
  # Empty global section

users:
  # Empty users section
`;

      writeFileSync(testConfigFile, yamlContent);
      const config = new Config(testConfigFile);

      const global = config.getGlobal();
      const users = config.getUsers();

      // Should use environment variables and defaults
      assert.strictEqual(global.workers, 6); // From env var
      assert.strictEqual(global.delayed_updates.enabled, true); // From env var
      assert.strictEqual(global.parallel, true); // Default

      // No users from YAML, should have no users
      assert.strictEqual(users.length, 0);
    });
  });
});
