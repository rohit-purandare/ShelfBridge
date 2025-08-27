import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';

import { Config } from '../src/config.js';

/**
 * Tests for delayed updates environment variable parsing
 *
 * Validates that the new SHELFBRIDGE_DELAYED_UPDATES_* environment
 * variables are correctly parsed and applied to configuration
 */

describe('Delayed Updates Environment Variables', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment variables
    originalEnv = { ...process.env };

    // Clear any existing delayed updates env vars
    delete process.env.SHELFBRIDGE_DELAYED_UPDATES_ENABLED;
    delete process.env.SHELFBRIDGE_DELAYED_UPDATES_SESSION_TIMEOUT;
    delete process.env.SHELFBRIDGE_DELAYED_UPDATES_MAX_DELAY;
    delete process.env.SHELFBRIDGE_DELAYED_UPDATES_IMMEDIATE_COMPLETION;
  });

  afterEach(() => {
    // Restore original environment variables
    process.env = originalEnv;
  });

  describe('Environment Variable Parsing', () => {
    it('parses SHELFBRIDGE_DELAYED_UPDATES_ENABLED correctly', () => {
      // Test true value
      process.env.SHELFBRIDGE_DELAYED_UPDATES_ENABLED = 'true';
      const config1 = new Config('non-existent-config.yaml');
      assert.equal(config1.getGlobal().delayed_updates.enabled, true);

      // Test false value
      process.env.SHELFBRIDGE_DELAYED_UPDATES_ENABLED = 'false';
      const config2 = new Config('non-existent-config.yaml');
      assert.equal(config2.getGlobal().delayed_updates.enabled, false);

      // Test numeric true
      process.env.SHELFBRIDGE_DELAYED_UPDATES_ENABLED = '1';
      const config3 = new Config('non-existent-config.yaml');
      assert.equal(config3.getGlobal().delayed_updates.enabled, true);

      // Test numeric false
      process.env.SHELFBRIDGE_DELAYED_UPDATES_ENABLED = '0';
      const config4 = new Config('non-existent-config.yaml');
      assert.equal(config4.getGlobal().delayed_updates.enabled, false);
    });

    it('parses SHELFBRIDGE_DELAYED_UPDATES_SESSION_TIMEOUT correctly', () => {
      process.env.SHELFBRIDGE_DELAYED_UPDATES_SESSION_TIMEOUT = '1800';
      const config = new Config('non-existent-config.yaml');
      assert.equal(config.getGlobal().delayed_updates.session_timeout, 1800);
    });

    it('parses SHELFBRIDGE_DELAYED_UPDATES_MAX_DELAY correctly', () => {
      process.env.SHELFBRIDGE_DELAYED_UPDATES_MAX_DELAY = '7200';
      const config = new Config('non-existent-config.yaml');
      assert.equal(config.getGlobal().delayed_updates.max_delay, 7200);
    });

    it('parses SHELFBRIDGE_DELAYED_UPDATES_IMMEDIATE_COMPLETION correctly', () => {
      // Test false value
      process.env.SHELFBRIDGE_DELAYED_UPDATES_IMMEDIATE_COMPLETION = 'false';
      const config1 = new Config('non-existent-config.yaml');
      assert.equal(
        config1.getGlobal().delayed_updates.immediate_completion,
        false,
      );

      // Test true value
      process.env.SHELFBRIDGE_DELAYED_UPDATES_IMMEDIATE_COMPLETION = 'true';
      const config2 = new Config('non-existent-config.yaml');
      assert.equal(
        config2.getGlobal().delayed_updates.immediate_completion,
        true,
      );
    });

    it('handles invalid environment variable values gracefully', () => {
      // Invalid boolean
      process.env.SHELFBRIDGE_DELAYED_UPDATES_ENABLED = 'invalid';
      // Invalid numbers
      process.env.SHELFBRIDGE_DELAYED_UPDATES_SESSION_TIMEOUT = 'not-a-number';
      process.env.SHELFBRIDGE_DELAYED_UPDATES_MAX_DELAY = 'also-not-a-number';

      const config = new Config('non-existent-config.yaml');
      const delayedUpdates = config.getGlobal().delayed_updates;

      // Should fall back to defaults for invalid values
      assert.equal(delayedUpdates.enabled, false); // Default
      assert.equal(delayedUpdates.session_timeout, 900); // Default
      assert.equal(delayedUpdates.max_delay, 3600); // Default
      assert.equal(delayedUpdates.immediate_completion, true); // Default
    });
  });

  describe('Complete Configuration Examples', () => {
    it('applies docker-compose.yml example configuration correctly', () => {
      // Set environment variables as they would appear in docker-compose.yml
      process.env.SHELFBRIDGE_DELAYED_UPDATES_ENABLED = 'true';
      process.env.SHELFBRIDGE_DELAYED_UPDATES_SESSION_TIMEOUT = '1800';
      process.env.SHELFBRIDGE_DELAYED_UPDATES_MAX_DELAY = '7200';
      process.env.SHELFBRIDGE_DELAYED_UPDATES_IMMEDIATE_COMPLETION = 'true';

      const config = new Config('non-existent-config.yaml');
      const delayedUpdates = config.getGlobal().delayed_updates;

      assert.equal(delayedUpdates.enabled, true);
      assert.equal(delayedUpdates.session_timeout, 1800); // 30 minutes
      assert.equal(delayedUpdates.max_delay, 7200); // 2 hours
      assert.equal(delayedUpdates.immediate_completion, true);
    });

    it('applies default configuration when no env vars set', () => {
      // No delayed updates environment variables set
      const config = new Config('non-existent-config.yaml');
      const delayedUpdates = config.getGlobal().delayed_updates;

      // Should use defaults
      assert.equal(delayedUpdates.enabled, false);
      assert.equal(delayedUpdates.session_timeout, 900); // 15 minutes
      assert.equal(delayedUpdates.max_delay, 3600); // 1 hour
      assert.equal(delayedUpdates.immediate_completion, true);
    });

    it('mixes environment variables with defaults correctly', () => {
      // Set only some environment variables
      process.env.SHELFBRIDGE_DELAYED_UPDATES_ENABLED = 'true';
      process.env.SHELFBRIDGE_DELAYED_UPDATES_SESSION_TIMEOUT = '3600';
      // Leave max_delay and immediate_completion as defaults

      const config = new Config('non-existent-config.yaml');
      const delayedUpdates = config.getGlobal().delayed_updates;

      assert.equal(delayedUpdates.enabled, true); // From env var
      assert.equal(delayedUpdates.session_timeout, 3600); // From env var
      assert.equal(delayedUpdates.max_delay, 3600); // Default
      assert.equal(delayedUpdates.immediate_completion, true); // Default
    });
  });

  describe('Docker Deployment Scenarios', () => {
    it('supports production Docker deployment configuration', () => {
      // Simulate production Docker environment
      process.env.NODE_ENV = 'production';
      process.env.SHELFBRIDGE_DELAYED_UPDATES_ENABLED = 'true';
      process.env.SHELFBRIDGE_DELAYED_UPDATES_SESSION_TIMEOUT = '900';
      process.env.SHELFBRIDGE_DELAYED_UPDATES_MAX_DELAY = '3600';
      process.env.SHELFBRIDGE_DELAYED_UPDATES_IMMEDIATE_COMPLETION = 'true';

      const config = new Config('non-existent-config.yaml');
      const delayedUpdates = config.getGlobal().delayed_updates;

      assert.equal(delayedUpdates.enabled, true);
      assert.equal(delayedUpdates.session_timeout, 900);
      assert.equal(delayedUpdates.max_delay, 3600);
      assert.equal(delayedUpdates.immediate_completion, true);
    });

    it('supports development Docker deployment with longer delays', () => {
      // Simulate development environment with longer delays for testing
      process.env.NODE_ENV = 'development';
      process.env.SHELFBRIDGE_DELAYED_UPDATES_ENABLED = 'true';
      process.env.SHELFBRIDGE_DELAYED_UPDATES_SESSION_TIMEOUT = '60'; // 1 minute (minimum)
      process.env.SHELFBRIDGE_DELAYED_UPDATES_MAX_DELAY = '300'; // 5 minutes (minimum)
      process.env.SHELFBRIDGE_DELAYED_UPDATES_IMMEDIATE_COMPLETION = 'false';

      const config = new Config('non-existent-config.yaml');
      const delayedUpdates = config.getGlobal().delayed_updates;

      assert.equal(delayedUpdates.enabled, true);
      assert.equal(delayedUpdates.session_timeout, 60);
      assert.equal(delayedUpdates.max_delay, 300);
      assert.equal(delayedUpdates.immediate_completion, false);
    });

    it('supports aggressive API reduction configuration', () => {
      // Configuration for users who want maximum API call reduction
      process.env.SHELFBRIDGE_DELAYED_UPDATES_ENABLED = 'true';
      process.env.SHELFBRIDGE_DELAYED_UPDATES_SESSION_TIMEOUT = '7200'; // 2 hours (maximum)
      process.env.SHELFBRIDGE_DELAYED_UPDATES_MAX_DELAY = '86400'; // 24 hours (maximum)
      process.env.SHELFBRIDGE_DELAYED_UPDATES_IMMEDIATE_COMPLETION = 'false';

      const config = new Config('non-existent-config.yaml');
      const delayedUpdates = config.getGlobal().delayed_updates;

      assert.equal(delayedUpdates.enabled, true);
      assert.equal(delayedUpdates.session_timeout, 7200);
      assert.equal(delayedUpdates.max_delay, 86400);
      assert.equal(delayedUpdates.immediate_completion, false);
    });
  });

  describe('Environment Variable Priority', () => {
    it('respects environment variable precedence over defaults', () => {
      // Environment variables should override defaults
      process.env.SHELFBRIDGE_DELAYED_UPDATES_ENABLED = 'true';

      const config = new Config('non-existent-config.yaml');
      assert.equal(config.getGlobal().delayed_updates.enabled, true);
    });

    it('handles empty environment variable values', () => {
      // Empty values should fall back to defaults
      process.env.SHELFBRIDGE_DELAYED_UPDATES_ENABLED = '';
      process.env.SHELFBRIDGE_DELAYED_UPDATES_SESSION_TIMEOUT = '';

      const config = new Config('non-existent-config.yaml');
      const delayedUpdates = config.getGlobal().delayed_updates;

      assert.equal(delayedUpdates.enabled, false); // Default
      assert.equal(delayedUpdates.session_timeout, 900); // Default
    });

    it('handles whitespace in environment variable values', () => {
      // Values with whitespace should be trimmed and parsed
      process.env.SHELFBRIDGE_DELAYED_UPDATES_ENABLED = '  true  ';
      process.env.SHELFBRIDGE_DELAYED_UPDATES_SESSION_TIMEOUT = '  1800  ';

      const config = new Config('non-existent-config.yaml');
      const delayedUpdates = config.getGlobal().delayed_updates;

      assert.equal(delayedUpdates.enabled, true);
      assert.equal(delayedUpdates.session_timeout, 1800);
    });
  });

  describe('Type Conversion Validation', () => {
    it('correctly converts string numbers to actual numbers', () => {
      process.env.SHELFBRIDGE_DELAYED_UPDATES_SESSION_TIMEOUT = '1800';
      process.env.SHELFBRIDGE_DELAYED_UPDATES_MAX_DELAY = '7200';

      const config = new Config('non-existent-config.yaml');
      const delayedUpdates = config.getGlobal().delayed_updates;

      // Should be actual numbers, not strings
      assert.strictEqual(typeof delayedUpdates.session_timeout, 'number');
      assert.strictEqual(typeof delayedUpdates.max_delay, 'number');
      assert.strictEqual(delayedUpdates.session_timeout, 1800);
      assert.strictEqual(delayedUpdates.max_delay, 7200);
    });

    it('correctly converts string booleans to actual booleans', () => {
      process.env.SHELFBRIDGE_DELAYED_UPDATES_ENABLED = 'true';
      process.env.SHELFBRIDGE_DELAYED_UPDATES_IMMEDIATE_COMPLETION = 'false';

      const config = new Config('non-existent-config.yaml');
      const delayedUpdates = config.getGlobal().delayed_updates;

      // Should be actual booleans, not strings
      assert.strictEqual(typeof delayedUpdates.enabled, 'boolean');
      assert.strictEqual(typeof delayedUpdates.immediate_completion, 'boolean');
      assert.strictEqual(delayedUpdates.enabled, true);
      assert.strictEqual(delayedUpdates.immediate_completion, false);
    });
  });
});
