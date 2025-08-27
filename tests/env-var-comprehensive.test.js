import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';

import { Config } from '../src/config.js';

/**
 * Comprehensive tests for ALL environment variable validation and parsing
 *
 * Validates that the whitespace trimming, type conversion, and default
 * merging fixes apply to every environment variable in ShelfBridge
 */

describe('Comprehensive Environment Variable Validation', () => {
  let originalEnv;

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
  });

  describe('Global Configuration Environment Variables', () => {
    it('parses all boolean environment variables with whitespace trimming', () => {
      // Set boolean environment variables with whitespace
      process.env.SHELFBRIDGE_PARALLEL = '  true  ';
      process.env.SHELFBRIDGE_DRY_RUN = '  false  ';
      process.env.SHELFBRIDGE_FORCE_SYNC = '  1  ';
      process.env.SHELFBRIDGE_AUTO_ADD_BOOKS = '  0  ';
      process.env.SHELFBRIDGE_PREVENT_PROGRESS_REGRESSION = '  TRUE  ';
      process.env.SHELFBRIDGE_DUMP_FAILED_BOOKS = '  FALSE  ';

      const config = new Config('non-existent-config.yaml');
      const global = config.getGlobal();

      // Verify all booleans are correctly parsed
      assert.strictEqual(global.parallel, true);
      assert.strictEqual(global.dry_run, false);
      assert.strictEqual(global.force_sync, true);
      assert.strictEqual(global.auto_add_books, false);
      assert.strictEqual(global.prevent_progress_regression, true);
      assert.strictEqual(global.dump_failed_books, false);

      // Verify types are actual booleans, not strings
      assert.strictEqual(typeof global.parallel, 'boolean');
      assert.strictEqual(typeof global.dry_run, 'boolean');
      assert.strictEqual(typeof global.force_sync, 'boolean');
      assert.strictEqual(typeof global.auto_add_books, 'boolean');
      assert.strictEqual(typeof global.prevent_progress_regression, 'boolean');
      assert.strictEqual(typeof global.dump_failed_books, 'boolean');
    });

    it('parses all numeric environment variables with whitespace trimming', () => {
      // Set numeric environment variables with whitespace
      process.env.SHELFBRIDGE_MIN_PROGRESS_THRESHOLD = '  7.5  ';
      process.env.SHELFBRIDGE_WORKERS = '  5  ';
      process.env.SHELFBRIDGE_MAX_BOOKS_TO_PROCESS = '  100  ';
      process.env.SHELFBRIDGE_HARDCOVER_SEMAPHORE = '  2  ';
      process.env.SHELFBRIDGE_HARDCOVER_RATE_LIMIT = '  50  ';
      process.env.SHELFBRIDGE_AUDIOBOOKSHELF_SEMAPHORE = '  10  ';
      process.env.SHELFBRIDGE_AUDIOBOOKSHELF_RATE_LIMIT = '  1000  ';
      process.env.SHELFBRIDGE_MAX_BOOKS_TO_FETCH = '  500  ';
      process.env.SHELFBRIDGE_PAGE_SIZE = '  150  ';

      const config = new Config('non-existent-config.yaml');
      const global = config.getGlobal();

      // Verify all numbers are correctly parsed
      assert.strictEqual(global.min_progress_threshold, 7.5);
      assert.strictEqual(global.workers, 5);
      assert.strictEqual(global.max_books_to_process, 100);
      assert.strictEqual(global.hardcover_semaphore, 2);
      assert.strictEqual(global.hardcover_rate_limit, 50);
      assert.strictEqual(global.audiobookshelf_semaphore, 10);
      assert.strictEqual(global.audiobookshelf_rate_limit, 1000);
      assert.strictEqual(global.max_books_to_fetch, 500);
      assert.strictEqual(global.page_size, 150);

      // Verify types are actual numbers, not strings
      assert.strictEqual(typeof global.min_progress_threshold, 'number');
      assert.strictEqual(typeof global.workers, 'number');
      assert.strictEqual(typeof global.max_books_to_process, 'number');
      assert.strictEqual(typeof global.hardcover_semaphore, 'number');
      assert.strictEqual(typeof global.hardcover_rate_limit, 'number');
      assert.strictEqual(typeof global.audiobookshelf_semaphore, 'number');
      assert.strictEqual(typeof global.audiobookshelf_rate_limit, 'number');
      assert.strictEqual(typeof global.max_books_to_fetch, 'number');
      assert.strictEqual(typeof global.page_size, 'number');
    });

    it('parses string environment variables with whitespace trimming', () => {
      // Set string environment variables with whitespace
      process.env.SHELFBRIDGE_TIMEZONE = '  America/New_York  ';
      process.env.SHELFBRIDGE_SYNC_SCHEDULE = '  0 3 * * *  ';

      const config = new Config('non-existent-config.yaml');
      const global = config.getGlobal();

      // Verify strings are trimmed correctly
      assert.strictEqual(global.timezone, 'America/New_York');
      assert.strictEqual(global.sync_schedule, '0 3 * * *');

      // Verify types are strings
      assert.strictEqual(typeof global.timezone, 'string');
      assert.strictEqual(typeof global.sync_schedule, 'string');
    });

    it('handles invalid values gracefully with fallback to defaults', () => {
      // Set invalid values
      process.env.SHELFBRIDGE_WORKERS = 'invalid_number';
      process.env.SHELFBRIDGE_PARALLEL = 'invalid_boolean';
      process.env.SHELFBRIDGE_MIN_PROGRESS_THRESHOLD = 'not_a_float';

      const config = new Config('non-existent-config.yaml');
      const global = config.getGlobal();

      // Should fallback to defaults for invalid values
      assert.strictEqual(global.workers, 3); // Default
      assert.strictEqual(global.parallel, true); // Default
      assert.strictEqual(global.min_progress_threshold, 5.0); // Default
    });

    it('handles empty and whitespace-only values correctly', () => {
      // Set empty and whitespace-only values
      process.env.SHELFBRIDGE_WORKERS = '';
      process.env.SHELFBRIDGE_PARALLEL = '   ';
      process.env.SHELFBRIDGE_TIMEZONE = '\t\n  \r';

      const config = new Config('non-existent-config.yaml');
      const global = config.getGlobal();

      // Should fallback to defaults for empty values
      assert.strictEqual(global.workers, 3); // Default
      assert.strictEqual(global.parallel, true); // Default
      assert.strictEqual(global.timezone, 'UTC'); // Default
    });
  });

  describe('User Configuration Environment Variables', () => {
    it('parses user environment variables with whitespace trimming', () => {
      // Set user environment variables with whitespace
      process.env.SHELFBRIDGE_USER_0_ID = '  test_user  ';
      process.env.SHELFBRIDGE_USER_0_ABS_URL = '  https://abs.example.com  ';
      process.env.SHELFBRIDGE_USER_0_ABS_TOKEN = '  token123  ';
      process.env.SHELFBRIDGE_USER_0_HARDCOVER_TOKEN = '  hc_token456  ';

      const config = new Config('non-existent-config.yaml');
      const users = config.getUsers();

      // Should create one user with trimmed values
      assert.strictEqual(users.length, 1);
      assert.strictEqual(users[0].id, 'test_user');
      assert.strictEqual(users[0].abs_url, 'https://abs.example.com');
      assert.strictEqual(users[0].abs_token, 'token123');
      assert.strictEqual(users[0].hardcover_token, 'hc_token456');
    });

    it('handles multiple users with whitespace trimming', () => {
      // Set multiple users with whitespace
      process.env.SHELFBRIDGE_USER_0_ID = '  alice  ';
      process.env.SHELFBRIDGE_USER_0_ABS_URL = '  https://abs1.com  ';
      process.env.SHELFBRIDGE_USER_0_ABS_TOKEN = '  token1  ';
      process.env.SHELFBRIDGE_USER_0_HARDCOVER_TOKEN = '  hc1  ';

      process.env.SHELFBRIDGE_USER_1_ID = '  bob  ';
      process.env.SHELFBRIDGE_USER_1_ABS_URL = '  https://abs2.com  ';
      process.env.SHELFBRIDGE_USER_1_ABS_TOKEN = '  token2  ';
      process.env.SHELFBRIDGE_USER_1_HARDCOVER_TOKEN = '  hc2  ';

      const config = new Config('non-existent-config.yaml');
      const users = config.getUsers();

      // Should create two users with trimmed values
      assert.strictEqual(users.length, 2);

      assert.strictEqual(users[0].id, 'alice');
      assert.strictEqual(users[0].abs_url, 'https://abs1.com');
      assert.strictEqual(users[0].abs_token, 'token1');
      assert.strictEqual(users[0].hardcover_token, 'hc1');

      assert.strictEqual(users[1].id, 'bob');
      assert.strictEqual(users[1].abs_url, 'https://abs2.com');
      assert.strictEqual(users[1].abs_token, 'token2');
      assert.strictEqual(users[1].hardcover_token, 'hc2');
    });

    it('skips incomplete user configurations', () => {
      // Set incomplete user configuration (missing required fields)
      process.env.SHELFBRIDGE_USER_0_ID = '  incomplete_user  ';
      process.env.SHELFBRIDGE_USER_0_ABS_URL = '  https://abs.com  ';
      // Missing ABS_TOKEN and HARDCOVER_TOKEN

      const config = new Config('non-existent-config.yaml');
      const users = config.getUsers();

      // Should not create any users due to missing required fields
      assert.strictEqual(users.length, 0);
    });
  });

  describe('Nested Object Environment Variables', () => {
    it('properly merges delayed_updates environment variables with defaults', () => {
      // Set only some delayed_updates environment variables
      process.env.SHELFBRIDGE_DELAYED_UPDATES_ENABLED = '  true  ';
      process.env.SHELFBRIDGE_DELAYED_UPDATES_SESSION_TIMEOUT = '  1800  ';
      // Leave max_delay and immediate_completion to use defaults

      const config = new Config('non-existent-config.yaml');
      const delayedUpdates = config.getGlobal().delayed_updates;

      // Should have set values for provided env vars and defaults for others
      assert.strictEqual(delayedUpdates.enabled, true); // From env var
      assert.strictEqual(delayedUpdates.session_timeout, 1800); // From env var
      assert.strictEqual(delayedUpdates.max_delay, 3600); // Default
      assert.strictEqual(delayedUpdates.immediate_completion, true); // Default

      // Verify complete nested object structure exists
      assert.strictEqual(typeof delayedUpdates, 'object');
      assert.strictEqual(Object.keys(delayedUpdates).length, 4);
    });

    it('handles all delayed_updates environment variables with whitespace', () => {
      // Set all delayed_updates environment variables with whitespace
      process.env.SHELFBRIDGE_DELAYED_UPDATES_ENABLED = '  true  ';
      process.env.SHELFBRIDGE_DELAYED_UPDATES_SESSION_TIMEOUT = '  3600  ';
      process.env.SHELFBRIDGE_DELAYED_UPDATES_MAX_DELAY = '  7200  ';
      process.env.SHELFBRIDGE_DELAYED_UPDATES_IMMEDIATE_COMPLETION =
        '  false  ';

      const config = new Config('non-existent-config.yaml');
      const delayedUpdates = config.getGlobal().delayed_updates;

      // All values should be correctly parsed and trimmed
      assert.strictEqual(delayedUpdates.enabled, true);
      assert.strictEqual(delayedUpdates.session_timeout, 3600);
      assert.strictEqual(delayedUpdates.max_delay, 7200);
      assert.strictEqual(delayedUpdates.immediate_completion, false);

      // Verify correct types
      assert.strictEqual(typeof delayedUpdates.enabled, 'boolean');
      assert.strictEqual(typeof delayedUpdates.session_timeout, 'number');
      assert.strictEqual(typeof delayedUpdates.max_delay, 'number');
      assert.strictEqual(typeof delayedUpdates.immediate_completion, 'boolean');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles mixed valid and invalid environment variables', () => {
      // Mix of valid and invalid values
      process.env.SHELFBRIDGE_WORKERS = '  5  '; // Valid
      process.env.SHELFBRIDGE_PARALLEL = 'invalid'; // Invalid boolean
      process.env.SHELFBRIDGE_MIN_PROGRESS_THRESHOLD = '  7.5  '; // Valid
      process.env.SHELFBRIDGE_HARDCOVER_RATE_LIMIT = 'not_a_number'; // Invalid number

      const config = new Config('non-existent-config.yaml');
      const global = config.getGlobal();

      // Valid values should be parsed, invalid should use defaults
      assert.strictEqual(global.workers, 5); // Parsed from env
      assert.strictEqual(global.parallel, true); // Default (invalid ignored)
      assert.strictEqual(global.min_progress_threshold, 7.5); // Parsed from env
      assert.strictEqual(global.hardcover_rate_limit, 55); // Default (invalid ignored)
    });

    it('handles extreme whitespace scenarios', () => {
      // Extreme whitespace scenarios
      process.env.SHELFBRIDGE_WORKERS = '\t\n  3  \r\n  ';
      process.env.SHELFBRIDGE_PARALLEL = '\t  true  \n';
      process.env.SHELFBRIDGE_USER_0_ID = '\r\n  extreme_whitespace_user  \t\r';

      const config = new Config('non-existent-config.yaml');
      const global = config.getGlobal();

      // Should handle extreme whitespace correctly
      assert.strictEqual(global.workers, 3);
      assert.strictEqual(global.parallel, true);
      assert.strictEqual(typeof global.workers, 'number');
      assert.strictEqual(typeof global.parallel, 'boolean');
    });

    it('maintains original behavior when no environment variables are set', () => {
      // No environment variables set - should use all defaults
      const config = new Config('non-existent-config.yaml');
      const global = config.getGlobal();

      // Should have all default values
      assert.strictEqual(global.workers, 3);
      assert.strictEqual(global.parallel, true);
      assert.strictEqual(global.min_progress_threshold, 5.0);
      assert.strictEqual(global.dry_run, false);
      assert.strictEqual(global.timezone, 'UTC');
      assert.strictEqual(global.sync_schedule, '0 3 * * *');

      // delayed_updates should have complete default structure
      assert.strictEqual(typeof global.delayed_updates, 'object');
      assert.strictEqual(global.delayed_updates.enabled, false);
      assert.strictEqual(global.delayed_updates.session_timeout, 900);
      assert.strictEqual(global.delayed_updates.max_delay, 3600);
      assert.strictEqual(global.delayed_updates.immediate_completion, true);
    });
  });

  describe('Real-World Docker Scenarios', () => {
    it('simulates complete Docker Compose environment variable setup', () => {
      // Simulate a complete Docker Compose setup
      process.env.NODE_ENV = 'production';

      // User configuration
      process.env.SHELFBRIDGE_USER_0_ID = '  docker_user  ';
      process.env.SHELFBRIDGE_USER_0_ABS_URL =
        '  https://audiobookshelf.local  ';
      process.env.SHELFBRIDGE_USER_0_ABS_TOKEN = '  abs_token_with_spaces  ';
      process.env.SHELFBRIDGE_USER_0_HARDCOVER_TOKEN =
        '  hc_token_with_spaces  ';

      // Global configuration with delayed updates
      process.env.SHELFBRIDGE_WORKERS = '  5  ';
      process.env.SHELFBRIDGE_PARALLEL = '  true  ';
      process.env.SHELFBRIDGE_MIN_PROGRESS_THRESHOLD = '  3.0  ';
      process.env.SHELFBRIDGE_SYNC_SCHEDULE = '  0 */6 * * *  ';
      process.env.SHELFBRIDGE_AUTO_ADD_BOOKS = '  true  ';
      process.env.SHELFBRIDGE_DELAYED_UPDATES_ENABLED = '  true  ';
      process.env.SHELFBRIDGE_DELAYED_UPDATES_SESSION_TIMEOUT = '  1800  ';
      process.env.SHELFBRIDGE_DELAYED_UPDATES_MAX_DELAY = '  7200  ';

      const config = new Config('non-existent-config.yaml');
      const global = config.getGlobal();
      const users = config.getUsers();

      // Verify complete configuration parsing
      assert.strictEqual(users.length, 1);
      assert.strictEqual(users[0].id, 'docker_user');
      assert.strictEqual(users[0].abs_url, 'https://audiobookshelf.local');
      assert.strictEqual(users[0].abs_token, 'abs_token_with_spaces');
      assert.strictEqual(users[0].hardcover_token, 'hc_token_with_spaces');

      assert.strictEqual(global.workers, 5);
      assert.strictEqual(global.parallel, true);
      assert.strictEqual(global.min_progress_threshold, 3.0);
      assert.strictEqual(global.sync_schedule, '0 */6 * * *');
      assert.strictEqual(global.auto_add_books, true);

      assert.strictEqual(global.delayed_updates.enabled, true);
      assert.strictEqual(global.delayed_updates.session_timeout, 1800);
      assert.strictEqual(global.delayed_updates.max_delay, 7200);
      assert.strictEqual(global.delayed_updates.immediate_completion, true); // Default
    });

    it('handles production environment with extensive configuration', () => {
      // Production setup with all performance and rate limiting options
      process.env.SHELFBRIDGE_WORKERS = '  10  ';
      process.env.SHELFBRIDGE_HARDCOVER_SEMAPHORE = '  2  ';
      process.env.SHELFBRIDGE_HARDCOVER_RATE_LIMIT = '  45  ';
      process.env.SHELFBRIDGE_AUDIOBOOKSHELF_SEMAPHORE = '  8  ';
      process.env.SHELFBRIDGE_AUDIOBOOKSHELF_RATE_LIMIT = '  800  ';
      process.env.SHELFBRIDGE_PAGE_SIZE = '  200  ';
      process.env.SHELFBRIDGE_MAX_BOOKS_TO_FETCH = '  1000  ';
      process.env.SHELFBRIDGE_PREVENT_PROGRESS_REGRESSION = '  true  ';
      process.env.SHELFBRIDGE_DUMP_FAILED_BOOKS = '  true  ';

      const config = new Config('non-existent-config.yaml');
      const global = config.getGlobal();

      // Verify all production settings are correctly parsed
      assert.strictEqual(global.workers, 10);
      assert.strictEqual(global.hardcover_semaphore, 2);
      assert.strictEqual(global.hardcover_rate_limit, 45);
      assert.strictEqual(global.audiobookshelf_semaphore, 8);
      assert.strictEqual(global.audiobookshelf_rate_limit, 800);
      assert.strictEqual(global.page_size, 200);
      assert.strictEqual(global.max_books_to_fetch, 1000);
      assert.strictEqual(global.prevent_progress_regression, true);
      assert.strictEqual(global.dump_failed_books, true);

      // Verify all are correct types
      assert.strictEqual(typeof global.workers, 'number');
      assert.strictEqual(typeof global.hardcover_semaphore, 'number');
      assert.strictEqual(typeof global.hardcover_rate_limit, 'number');
      assert.strictEqual(typeof global.audiobookshelf_semaphore, 'number');
      assert.strictEqual(typeof global.audiobookshelf_rate_limit, 'number');
      assert.strictEqual(typeof global.page_size, 'number');
      assert.strictEqual(typeof global.max_books_to_fetch, 'number');
      assert.strictEqual(typeof global.prevent_progress_regression, 'boolean');
      assert.strictEqual(typeof global.dump_failed_books, 'boolean');
    });
  });
});
