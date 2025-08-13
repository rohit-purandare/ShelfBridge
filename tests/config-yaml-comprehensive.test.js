import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

import { Config } from '../src/config.js';

/**
 * Comprehensive tests for YAML configuration file reading and parsing
 *
 * Validates that YAML files are correctly parsed, types are converted properly,
 * defaults are applied correctly, and edge cases are handled gracefully
 */

describe('YAML Configuration File Validation', () => {
  let originalEnv;
  const testConfigFile = 'test-config.yaml';

  beforeEach(() => {
    // Save original environment variables
    originalEnv = { ...process.env };
    
    // Clear all ShelfBridge environment variables to ensure YAML takes precedence
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

  describe('Basic YAML Parsing', () => {
    it('parses complete YAML configuration correctly', () => {
      const yamlContent = `
global:
  min_progress_threshold: 7.5
  parallel: true
  workers: 5
  timezone: "America/New_York"
  dry_run: false
  sync_schedule: "0 */6 * * *"
  force_sync: true
  auto_add_books: true
  prevent_progress_regression: false
  hardcover_semaphore: 2
  hardcover_rate_limit: 45
  audiobookshelf_semaphore: 8
  audiobookshelf_rate_limit: 800
  page_size: 150
  max_books_to_fetch: 1000
  dump_failed_books: false

users:
  - id: "yaml_user_1"
    abs_url: "https://abs1.example.com"
    abs_token: "token1"
    hardcover_token: "hc1"
  - id: "yaml_user_2"
    abs_url: "https://abs2.example.com"
    abs_token: "token2"
    hardcover_token: "hc2"
`;

      writeFileSync(testConfigFile, yamlContent);
      const config = new Config(testConfigFile);
      
      const global = config.getGlobal();
      const users = config.getUsers();

      // Verify global configuration
      assert.strictEqual(global.min_progress_threshold, 7.5);
      assert.strictEqual(global.parallel, true);
      assert.strictEqual(global.workers, 5);
      assert.strictEqual(global.timezone, 'America/New_York');
      assert.strictEqual(global.dry_run, false);
      assert.strictEqual(global.sync_schedule, '0 */6 * * *');
      assert.strictEqual(global.force_sync, true);
      assert.strictEqual(global.auto_add_books, true);
      assert.strictEqual(global.prevent_progress_regression, false);
      assert.strictEqual(global.hardcover_semaphore, 2);
      assert.strictEqual(global.hardcover_rate_limit, 45);
      assert.strictEqual(global.audiobookshelf_semaphore, 8);
      assert.strictEqual(global.audiobookshelf_rate_limit, 800);
      assert.strictEqual(global.page_size, 150);
      assert.strictEqual(global.max_books_to_fetch, 1000);
      assert.strictEqual(global.dump_failed_books, false);

      // Verify types are correct
      assert.strictEqual(typeof global.min_progress_threshold, 'number');
      assert.strictEqual(typeof global.parallel, 'boolean');
      assert.strictEqual(typeof global.workers, 'number');
      assert.strictEqual(typeof global.timezone, 'string');
      assert.strictEqual(typeof global.dry_run, 'boolean');

      // Verify users
      assert.strictEqual(users.length, 2);
      assert.strictEqual(users[0].id, 'yaml_user_1');
      assert.strictEqual(users[0].abs_url, 'https://abs1.example.com');
      assert.strictEqual(users[0].abs_token, 'token1');
      assert.strictEqual(users[0].hardcover_token, 'hc1');
      assert.strictEqual(users[1].id, 'yaml_user_2');
      assert.strictEqual(users[1].abs_url, 'https://abs2.example.com');
      assert.strictEqual(users[1].abs_token, 'token2');
      assert.strictEqual(users[1].hardcover_token, 'hc2');
    });

    it('handles minimal YAML configuration with defaults', () => {
      const yamlContent = `
global:
  # Only specify a few settings, rest should use defaults
  workers: 7
  timezone: "Europe/London"

users:
  - id: "minimal_user"
    abs_url: "https://minimal.example.com"
    abs_token: "minimal_token"
    hardcover_token: "minimal_hc"
`;

      writeFileSync(testConfigFile, yamlContent);
      const config = new Config(testConfigFile);
      
      const global = config.getGlobal();
      const users = config.getUsers();

      // Explicit values should be set
      assert.strictEqual(global.workers, 7);
      assert.strictEqual(global.timezone, 'Europe/London');

      // Defaults should be applied for unspecified values
      assert.strictEqual(global.min_progress_threshold, 5.0); // Default
      assert.strictEqual(global.parallel, true); // Default
      assert.strictEqual(global.dry_run, false); // Default
      assert.strictEqual(global.sync_schedule, '0 3 * * *'); // Default
      assert.strictEqual(global.hardcover_rate_limit, 55); // Default
      assert.strictEqual(global.page_size, 100); // Default

      // User should be parsed correctly
      assert.strictEqual(users.length, 1);
      assert.strictEqual(users[0].id, 'minimal_user');
    });

    it('parses delayed_updates nested configuration correctly', () => {
      const yamlContent = `
global:
  delayed_updates:
    enabled: true
    session_timeout: 1800
    max_delay: 7200
    immediate_completion: false

users:
  - id: "delayed_user"
    abs_url: "https://delayed.example.com"
    abs_token: "delayed_token"
    hardcover_token: "delayed_hc"
`;

      writeFileSync(testConfigFile, yamlContent);
      const config = new Config(testConfigFile);
      
      const delayedUpdates = config.getGlobal().delayed_updates;

      // Verify nested object is parsed correctly
      assert.strictEqual(typeof delayedUpdates, 'object');
      assert.strictEqual(delayedUpdates.enabled, true);
      assert.strictEqual(delayedUpdates.session_timeout, 1800);
      assert.strictEqual(delayedUpdates.max_delay, 7200);
      assert.strictEqual(delayedUpdates.immediate_completion, false);

      // Verify types
      assert.strictEqual(typeof delayedUpdates.enabled, 'boolean');
      assert.strictEqual(typeof delayedUpdates.session_timeout, 'number');
      assert.strictEqual(typeof delayedUpdates.max_delay, 'number');
      assert.strictEqual(typeof delayedUpdates.immediate_completion, 'boolean');
    });

    it('handles partial delayed_updates configuration with defaults', () => {
      const yamlContent = `
global:
  delayed_updates:
    enabled: true
    session_timeout: 3600
    # max_delay and immediate_completion should use defaults

users:
  - id: "partial_delayed_user"
    abs_url: "https://partial.example.com"
    abs_token: "partial_token"
    hardcover_token: "partial_hc"
`;

      writeFileSync(testConfigFile, yamlContent);
      const config = new Config(testConfigFile);
      
      const delayedUpdates = config.getGlobal().delayed_updates;

      // Specified values should be set
      assert.strictEqual(delayedUpdates.enabled, true);
      assert.strictEqual(delayedUpdates.session_timeout, 3600);

      // Unspecified values should use defaults
      assert.strictEqual(delayedUpdates.max_delay, 3600); // Default
      assert.strictEqual(delayedUpdates.immediate_completion, true); // Default
    });
  });

  describe('YAML Type Conversion', () => {
    it('correctly converts YAML boolean values', () => {
      const yamlContent = `
global:
  parallel: true
  dry_run: false
  force_sync: true      # Use explicit true/false in YAML
  auto_add_books: false # js-yaml doesn't auto-convert yes/no/on/off
  prevent_progress_regression: true
  dump_failed_books: false

users:
  - id: "bool_user"
    abs_url: "https://bool.example.com"
    abs_token: "bool_token"
    hardcover_token: "bool_hc"
`;

      writeFileSync(testConfigFile, yamlContent);
      const config = new Config(testConfigFile);
      
      const global = config.getGlobal();

      // All should be converted to JavaScript booleans
      assert.strictEqual(global.parallel, true);
      assert.strictEqual(global.dry_run, false);
      assert.strictEqual(global.force_sync, true);
      assert.strictEqual(global.auto_add_books, false);
      assert.strictEqual(global.prevent_progress_regression, true);
      assert.strictEqual(global.dump_failed_books, false);

      // Verify all are actual booleans
      assert.strictEqual(typeof global.parallel, 'boolean');
      assert.strictEqual(typeof global.dry_run, 'boolean');
      assert.strictEqual(typeof global.force_sync, 'boolean');
      assert.strictEqual(typeof global.auto_add_books, 'boolean');
      assert.strictEqual(typeof global.prevent_progress_regression, 'boolean');
      assert.strictEqual(typeof global.dump_failed_books, 'boolean');
    });

    it('correctly converts YAML numeric values', () => {
      const yamlContent = `
global:
  min_progress_threshold: 7.5
  workers: 10
  hardcover_semaphore: 2
  hardcover_rate_limit: 45
  audiobookshelf_rate_limit: 1000
  page_size: 200
  max_books_to_fetch: 500

users:
  - id: "numeric_user"
    abs_url: "https://numeric.example.com"
    abs_token: "numeric_token"
    hardcover_token: "numeric_hc"
`;

      writeFileSync(testConfigFile, yamlContent);
      const config = new Config(testConfigFile);
      
      const global = config.getGlobal();

      // Verify numeric values and types
      assert.strictEqual(global.min_progress_threshold, 7.5);
      assert.strictEqual(typeof global.min_progress_threshold, 'number');
      
      assert.strictEqual(global.workers, 10);
      assert.strictEqual(typeof global.workers, 'number');
      
      assert.strictEqual(global.hardcover_semaphore, 2);
      assert.strictEqual(typeof global.hardcover_semaphore, 'number');
      
      assert.strictEqual(global.hardcover_rate_limit, 45);
      assert.strictEqual(typeof global.hardcover_rate_limit, 'number');
      
      assert.strictEqual(global.audiobookshelf_rate_limit, 1000);
      assert.strictEqual(typeof global.audiobookshelf_rate_limit, 'number');
      
      assert.strictEqual(global.page_size, 200);
      assert.strictEqual(typeof global.page_size, 'number');
      
      assert.strictEqual(global.max_books_to_fetch, 500);
      assert.strictEqual(typeof global.max_books_to_fetch, 'number');
    });

    it('correctly handles YAML string values with quotes and special characters', () => {
      const yamlContent = `
global:
  timezone: "America/New_York"
  sync_schedule: "0 */6 * * *"
  
users:
  - id: "string_user"
    abs_url: "https://string.example.com:8080"
    abs_token: "token_with_special_chars!@#$%"
    hardcover_token: "hc_token_with-dashes_and.dots"
`;

      writeFileSync(testConfigFile, yamlContent);
      const config = new Config(testConfigFile);
      
      const global = config.getGlobal();
      const users = config.getUsers();

      // Verify string values are preserved correctly
      assert.strictEqual(global.timezone, 'America/New_York');
      assert.strictEqual(global.sync_schedule, '0 */6 * * *');
      assert.strictEqual(typeof global.timezone, 'string');
      assert.strictEqual(typeof global.sync_schedule, 'string');

      assert.strictEqual(users[0].abs_url, 'https://string.example.com:8080');
      assert.strictEqual(users[0].abs_token, 'token_with_special_chars!@#$%');
      assert.strictEqual(users[0].hardcover_token, 'hc_token_with-dashes_and.dots');
    });
  });

  describe('YAML Priority and Environment Variable Interaction', () => {
    it('gives YAML precedence over environment variables', () => {
      // Set environment variables
      process.env.SHELFBRIDGE_WORKERS = '3';
      process.env.SHELFBRIDGE_PARALLEL = 'false';
      process.env.SHELFBRIDGE_TIMEZONE = 'UTC';

      const yamlContent = `
global:
  workers: 8          # Should override env var
  parallel: true      # Should override env var
  timezone: "Asia/Tokyo"  # Should override env var

users:
  - id: "priority_user"
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
      assert.strictEqual(global.timezone, 'Asia/Tokyo');
    });

    it('uses environment variables for values not specified in YAML', () => {
      // Set environment variables
      process.env.SHELFBRIDGE_HARDCOVER_RATE_LIMIT = '45';
      process.env.SHELFBRIDGE_PAGE_SIZE = '150';
      process.env.SHELFBRIDGE_DELAYED_UPDATES_ENABLED = 'true';

      const yamlContent = `
global:
  workers: 6
  parallel: true
  # hardcover_rate_limit, page_size, and delayed_updates not specified

users:
  - id: "mixed_user"
    abs_url: "https://mixed.example.com"
    abs_token: "mixed_token"
    hardcover_token: "mixed_hc"
`;

      writeFileSync(testConfigFile, yamlContent);
      const config = new Config(testConfigFile);
      
      const global = config.getGlobal();

      // YAML values should be used
      assert.strictEqual(global.workers, 6);
      assert.strictEqual(global.parallel, true);

      // Environment variables should fill in missing values
      assert.strictEqual(global.hardcover_rate_limit, 45);
      assert.strictEqual(global.page_size, 150);
      assert.strictEqual(global.delayed_updates.enabled, true);
    });

    it('uses defaults when neither YAML nor environment variables specify values', () => {
      const yamlContent = `
global:
  workers: 4
  # Most settings not specified

users:
  - id: "default_user"
    abs_url: "https://default.example.com"
    abs_token: "default_token"
    hardcover_token: "default_hc"
`;

      writeFileSync(testConfigFile, yamlContent);
      const config = new Config(testConfigFile);
      
      const global = config.getGlobal();

      // Specified value should be used
      assert.strictEqual(global.workers, 4);

      // Defaults should be applied
      assert.strictEqual(global.min_progress_threshold, 5.0);
      assert.strictEqual(global.parallel, true);
      assert.strictEqual(global.timezone, 'UTC');
      assert.strictEqual(global.dry_run, false);
      assert.strictEqual(global.hardcover_rate_limit, 55);
      assert.strictEqual(global.delayed_updates.enabled, false);
    });
  });

  describe('YAML Error Handling and Edge Cases', () => {
    it('handles empty YAML file gracefully', () => {
      const yamlContent = '';

      writeFileSync(testConfigFile, yamlContent);
      const config = new Config(testConfigFile);
      
      const global = config.getGlobal();
      const users = config.getUsers();

      // Should use all defaults
      assert.strictEqual(global.min_progress_threshold, 5.0);
      assert.strictEqual(global.parallel, true);
      assert.strictEqual(global.workers, 3);
      assert.strictEqual(global.timezone, 'UTC');
      assert.strictEqual(global.delayed_updates.enabled, false);

      // No users should be defined
      assert.strictEqual(users.length, 0);
    });

    it('handles YAML with only global section', () => {
      const yamlContent = `
global:
  workers: 8
  timezone: "America/Chicago"
`;

      writeFileSync(testConfigFile, yamlContent);
      const config = new Config(testConfigFile);
      
      const global = config.getGlobal();
      const users = config.getUsers();

      // Global values should be set
      assert.strictEqual(global.workers, 8);
      assert.strictEqual(global.timezone, 'America/Chicago');

      // No users should be defined
      assert.strictEqual(users.length, 0);
    });

    it('handles YAML with only users section', () => {
      const yamlContent = `
users:
  - id: "only_user"
    abs_url: "https://only.example.com"
    abs_token: "only_token"
    hardcover_token: "only_hc"
`;

      writeFileSync(testConfigFile, yamlContent);
      const config = new Config(testConfigFile);
      
      const global = config.getGlobal();
      const users = config.getUsers();

      // Global should use all defaults
      assert.strictEqual(global.workers, 3);
      assert.strictEqual(global.parallel, true);
      assert.strictEqual(global.timezone, 'UTC');

      // User should be parsed
      assert.strictEqual(users.length, 1);
      assert.strictEqual(users[0].id, 'only_user');
    });

    it('handles YAML comments and formatting correctly', () => {
      const yamlContent = `
# This is a comment
global:
  # Global configuration
  workers: 5        # Number of workers
  parallel: true    # Enable parallel processing
  
  # Delayed updates configuration
  delayed_updates:
    enabled: true   # Enable the feature
    session_timeout: 1800  # 30 minutes

# User configuration
users:
  - id: "comment_user"
    abs_url: "https://comment.example.com"  # Server URL
    abs_token: "comment_token"             # API token
    hardcover_token: "comment_hc"          # Hardcover token
`;

      writeFileSync(testConfigFile, yamlContent);
      const config = new Config(testConfigFile);
      
      const global = config.getGlobal();
      const users = config.getUsers();

      // Values should be parsed correctly despite comments
      assert.strictEqual(global.workers, 5);
      assert.strictEqual(global.parallel, true);
      assert.strictEqual(global.delayed_updates.enabled, true);
      assert.strictEqual(global.delayed_updates.session_timeout, 1800);

      assert.strictEqual(users.length, 1);
      assert.strictEqual(users[0].id, 'comment_user');
    });

    it('handles invalid YAML syntax gracefully', () => {
      const yamlContent = `
global:
  workers: 5
  invalid_yaml_syntax: [unclosed bracket
users:
  - id: "syntax_user"
    abs_url: "https://syntax.example.com"
`;

      writeFileSync(testConfigFile, yamlContent);
      
      // Should throw an error or handle gracefully
      // The exact behavior depends on the YAML parser
      try {
        const config = new Config(testConfigFile);
        // If it doesn't throw, verify it at least partially works
        const global = config.getGlobal();
        // Should have some sensible values even if parsing partially failed
        assert.strictEqual(typeof global.workers, 'number');
      } catch (error) {
        // It's acceptable for invalid YAML to throw an error
        assert(error instanceof Error);
      }
    });
  });

  describe('Real-World YAML Scenarios', () => {
    it('simulates production YAML configuration', () => {
      const yamlContent = `
# Production ShelfBridge Configuration
global:
  # Performance settings
  min_progress_threshold: 3.0
  parallel: true
  workers: 8
  
  # Scheduling
  timezone: "America/New_York"
  sync_schedule: "0 */4 * * *"  # Every 4 hours
  
  # API rate limiting
  hardcover_semaphore: 2
  hardcover_rate_limit: 50
  audiobookshelf_semaphore: 6
  audiobookshelf_rate_limit: 900
  
  # Features
  auto_add_books: true
  prevent_progress_regression: true
  
  # Delayed updates for API efficiency
  delayed_updates:
    enabled: true
    session_timeout: 1800      # 30 minutes
    max_delay: 7200           # 2 hours
    immediate_completion: true

# Multi-user family setup
users:
  - id: "mom"
    abs_url: "https://family-audiobooks.local"
    abs_token: "mom_abs_token_here"
    hardcover_token: "mom_hc_token_here"
    
  - id: "dad"
    abs_url: "https://family-audiobooks.local"
    abs_token: "dad_abs_token_here"
    hardcover_token: "dad_hc_token_here"
    
  - id: "teen"
    abs_url: "https://family-audiobooks.local"
    abs_token: "teen_abs_token_here"
    hardcover_token: "teen_hc_token_here"
`;

      writeFileSync(testConfigFile, yamlContent);
      const config = new Config(testConfigFile);
      
      const global = config.getGlobal();
      const users = config.getUsers();

      // Verify production configuration
      assert.strictEqual(global.min_progress_threshold, 3.0);
      assert.strictEqual(global.parallel, true);
      assert.strictEqual(global.workers, 8);
      assert.strictEqual(global.timezone, 'America/New_York');
      assert.strictEqual(global.sync_schedule, '0 */4 * * *');
      assert.strictEqual(global.hardcover_semaphore, 2);
      assert.strictEqual(global.hardcover_rate_limit, 50);
      assert.strictEqual(global.audiobookshelf_semaphore, 6);
      assert.strictEqual(global.audiobookshelf_rate_limit, 900);
      assert.strictEqual(global.auto_add_books, true);
      assert.strictEqual(global.prevent_progress_regression, true);

      // Verify delayed updates
      assert.strictEqual(global.delayed_updates.enabled, true);
      assert.strictEqual(global.delayed_updates.session_timeout, 1800);
      assert.strictEqual(global.delayed_updates.max_delay, 7200);
      assert.strictEqual(global.delayed_updates.immediate_completion, true);

      // Verify multi-user setup
      assert.strictEqual(users.length, 3);
      assert.strictEqual(users[0].id, 'mom');
      assert.strictEqual(users[1].id, 'dad');
      assert.strictEqual(users[2].id, 'teen');

      // All users should have same server URL
      assert.strictEqual(users[0].abs_url, 'https://family-audiobooks.local');
      assert.strictEqual(users[1].abs_url, 'https://family-audiobooks.local');
      assert.strictEqual(users[2].abs_url, 'https://family-audiobooks.local');
    });

    it('simulates single-user optimized configuration', () => {
      const yamlContent = `
global:
  # Optimized for single heavy user
  min_progress_threshold: 2.0
  parallel: false             # No need for parallelism
  workers: 1                  # Single worker
  
  # Aggressive sync schedule
  sync_schedule: "*/15 * * * *"  # Every 15 minutes
  
  # Conservative API usage
  hardcover_rate_limit: 30
  audiobookshelf_rate_limit: 300
  
  # Delayed updates for efficiency
  delayed_updates:
    enabled: true
    session_timeout: 3600      # 1 hour
    max_delay: 14400          # 4 hours
    immediate_completion: true

users:
  - id: "power_user"
    abs_url: "https://personal-audiobooks.com"
    abs_token: "personal_abs_token"
    hardcover_token: "personal_hc_token"
`;

      writeFileSync(testConfigFile, yamlContent);
      const config = new Config(testConfigFile);
      
      const global = config.getGlobal();
      const users = config.getUsers();

      // Verify single-user optimization
      assert.strictEqual(global.min_progress_threshold, 2.0);
      assert.strictEqual(global.parallel, false);
      assert.strictEqual(global.workers, 1);
      assert.strictEqual(global.sync_schedule, '*/15 * * * *');
      assert.strictEqual(global.hardcover_rate_limit, 30);
      assert.strictEqual(global.audiobookshelf_rate_limit, 300);

      // Verify delayed updates configuration
      assert.strictEqual(global.delayed_updates.enabled, true);
      assert.strictEqual(global.delayed_updates.session_timeout, 3600);
      assert.strictEqual(global.delayed_updates.max_delay, 14400);

      // Single user
      assert.strictEqual(users.length, 1);
      assert.strictEqual(users[0].id, 'power_user');
    });
  });
});
