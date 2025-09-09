import assert from 'node:assert/strict';
import { describe, it, before, beforeEach } from 'node:test';
import { TimestampFormatter } from '../src/sync/utils/TimestampFormatter.js';

/**
 * Comprehensive unit tests for TimestampFormatter
 * 
 * Tests all extracted functionality from SyncManager:
 * - formatForDisplay() - extracted from _formatTimestampForDisplay()
 * - formatForHardcover() - extracted from _formatDateForHardcover()
 * - convertUTCMillisToLocal() - new helper method
 * - isValidTimestamp() - new validation method
 * - timezone management methods
 * 
 * Each test verifies the exact same behavior as the original SyncManager methods
 */

describe('TimestampFormatter', () => {
  let formatter;
  const testTimezone = 'America/New_York';
  const testISOString = '2024-01-15T14:30:00.000Z';
  const testMillis = 1705329000000; // Same as testISOString

  beforeEach(() => {
    formatter = new TimestampFormatter(testTimezone);
  });

  describe('constructor', () => {
    it('should use provided timezone', () => {
      const customFormatter = new TimestampFormatter('Europe/London');
      assert.strictEqual(customFormatter.getTimezone(), 'Europe/London');
    });

    it('should default to UTC when no timezone provided', () => {
      const defaultFormatter = new TimestampFormatter();
      assert.strictEqual(defaultFormatter.getTimezone(), 'UTC');
    });
  });

  describe('formatForDisplay()', () => {
    it('should format ISO string timestamps correctly', () => {
      const result = formatter.formatForDisplay(testISOString);
      
      // Should contain year, time separator, and timezone
      assert(result.includes('2024'), 'Should include year');
      assert(result.includes(':'), 'Should include time separator');
      assert(result.includes('-05') || result.includes('-04') || result.includes('EST'), 'Should include EST timezone info');
      assert(result.length > 10, 'Should be properly formatted');
    });

    it('should format millisecond timestamps correctly', () => {
      const result = formatter.formatForDisplay(testMillis);
      
      assert(typeof result === 'string', 'Should return string');
      assert(result.includes('2024'), 'Should include correct year');
      assert(result.includes(':'), 'Should include time separator');
      assert(result.length > 10, 'Should be formatted string');
    });

    it('should format numeric string timestamps correctly', () => {
      const result = formatter.formatForDisplay(testMillis.toString());
      
      assert(typeof result === 'string', 'Should return string');
      assert(result.includes('2024'), 'Should include correct year');
      assert(!result.includes('Invalid'), 'Should not be invalid');
    });

    it('should handle SQL format strings', () => {
      const sqlFormat = '2024-01-15 14:30:00';
      const result = formatter.formatForDisplay(sqlFormat);
      
      assert(typeof result === 'string', 'Should return string');
      assert(result.includes('2024'), 'Should include year');
    });

    it('should return N/A for null/undefined', () => {
      assert.strictEqual(formatter.formatForDisplay(null), 'N/A');
      assert.strictEqual(formatter.formatForDisplay(undefined), 'N/A');
      assert.strictEqual(formatter.formatForDisplay(''), 'N/A');
    });

    it('should return Invalid timestamp for invalid inputs', () => {
      assert.strictEqual(formatter.formatForDisplay('invalid-date'), 'Invalid timestamp');
      assert.strictEqual(formatter.formatForDisplay('not-a-number'), 'Invalid timestamp');
      assert.strictEqual(formatter.formatForDisplay({}), 'Invalid timestamp');
      assert.strictEqual(formatter.formatForDisplay([]), 'Invalid timestamp');
    });

    it('should respect timezone configuration', () => {
      const utcFormatter = new TimestampFormatter('UTC');
      const nyFormatter = new TimestampFormatter('America/New_York');
      
      const utcResult = utcFormatter.formatForDisplay(testISOString);
      const nyResult = nyFormatter.formatForDisplay(testISOString);
      
      // Results should be different due to timezone
      assert.notStrictEqual(utcResult, nyResult, 'Different timezones should produce different results');
      assert(utcResult.includes('UTC') || utcResult.includes('+00') || utcResult.includes('Z'), 'UTC result should show UTC timezone');
      assert(nyResult.includes('-05') || nyResult.includes('-04') || nyResult.includes('EST'), 'NY result should show EST timezone');
    });
  });

  describe('formatForHardcover()', () => {
    it('should format ISO string to YYYY-MM-DD', () => {
      const result = formatter.formatForHardcover(testISOString);
      
      assert(result.match(/^\d{4}-\d{2}-\d{2}$/), 'Should match YYYY-MM-DD format');
      assert(result.includes('2024'), 'Should include correct year');
      assert.strictEqual(result.length, 10, 'Should be exactly 10 characters');
    });

    it('should format milliseconds to YYYY-MM-DD', () => {
      const result = formatter.formatForHardcover(testMillis);
      
      assert(result.match(/^\d{4}-\d{2}-\d{2}$/), 'Should match YYYY-MM-DD format');
      assert(result.includes('2024'), 'Should include correct year');
    });

    it('should format numeric string timestamps', () => {
      const result = formatter.formatForHardcover(testMillis.toString());
      
      assert(result.match(/^\d{4}-\d{2}-\d{2}$/), 'Should match YYYY-MM-DD format');
      assert(result.includes('2024'), 'Should include correct year');
    });

    it('should handle SQL format dates', () => {
      const sqlDate = '2024-01-15 14:30:00';
      const result = formatter.formatForHardcover(sqlDate);
      
      assert(result.match(/^\d{4}-\d{2}-\d{2}$/), 'Should match YYYY-MM-DD format');
      assert.strictEqual(result, '2024-01-15', 'Should return correct date');
    });

    it('should return null for invalid inputs', () => {
      assert.strictEqual(formatter.formatForHardcover(null), null);
      assert.strictEqual(formatter.formatForHardcover(undefined), null);
      assert.strictEqual(formatter.formatForHardcover(''), null);
      assert.strictEqual(formatter.formatForHardcover('invalid'), null);
    });

    it('should handle JavaScript Date strings', () => {
      const jsDate = new Date(testISOString).toString();
      const result = formatter.formatForHardcover(jsDate);
      
      // Should still parse and format correctly
      assert(result !== null, 'Should not return null for valid date string');
      assert(result.includes('2024'), 'Should include correct year');
    });

    it('should respect timezone for date boundaries', () => {
      // Test with a date that would be different depending on timezone
      const lateNightUTC = '2024-01-15T23:30:00.000Z'; // 11:30 PM UTC
      
      const utcFormatter = new TimestampFormatter('UTC');
      const nyFormatter = new TimestampFormatter('America/New_York'); // 6:30 PM EST (same day)
      const tokyoFormatter = new TimestampFormatter('Asia/Tokyo'); // 8:30 AM next day
      
      const utcDate = utcFormatter.formatForHardcover(lateNightUTC);
      const nyDate = nyFormatter.formatForHardcover(lateNightUTC);
      const tokyoDate = tokyoFormatter.formatForHardcover(lateNightUTC);
      
      assert.strictEqual(utcDate, '2024-01-15', 'UTC should be Jan 15');
      assert.strictEqual(nyDate, '2024-01-15', 'NY should be Jan 15 (still same day)');
      assert.strictEqual(tokyoDate, '2024-01-16', 'Tokyo should be Jan 16 (next day)');
    });
  });

  describe('convertUTCMillisToLocal()', () => {
    it('should convert UTC millis to local ISO string', () => {
      const result = formatter.convertUTCMillisToLocal(testMillis);
      
      assert(typeof result === 'string', 'Should return string');
      assert(result.includes('T'), 'Should be ISO format');
      assert(result.includes('2024'), 'Should include correct year');
    });

    it('should respect timezone configuration', () => {
      const utcFormatter = new TimestampFormatter('UTC');
      const nyFormatter = new TimestampFormatter('America/New_York');
      
      const utcResult = utcFormatter.convertUTCMillisToLocal(testMillis);
      const nyResult = nyFormatter.convertUTCMillisToLocal(testMillis);
      
      assert.notStrictEqual(utcResult, nyResult, 'Different timezones should produce different results');
    });

    it('should return null for invalid inputs', () => {
      assert.strictEqual(formatter.convertUTCMillisToLocal(null), null);
      assert.strictEqual(formatter.convertUTCMillisToLocal(undefined), null);
      assert.strictEqual(formatter.convertUTCMillisToLocal('invalid'), null);
      assert.strictEqual(formatter.convertUTCMillisToLocal({}), null);
    });
  });

  describe('isValidTimestamp()', () => {
    it('should validate ISO string timestamps', () => {
      assert.strictEqual(formatter.isValidTimestamp(testISOString), true);
      assert.strictEqual(formatter.isValidTimestamp('2024-01-15T14:30:00Z'), true);
      assert.strictEqual(formatter.isValidTimestamp('2024-01-15 14:30:00'), true);
    });

    it('should validate millisecond timestamps', () => {
      assert.strictEqual(formatter.isValidTimestamp(testMillis), true);
      assert.strictEqual(formatter.isValidTimestamp(Date.now()), true);
    });

    it('should validate string representations of milliseconds', () => {
      assert.strictEqual(formatter.isValidTimestamp(testMillis.toString()), true);
    });

    it('should reject invalid timestamps', () => {
      assert.strictEqual(formatter.isValidTimestamp(null), false);
      assert.strictEqual(formatter.isValidTimestamp(undefined), false);
      assert.strictEqual(formatter.isValidTimestamp(''), false);
      assert.strictEqual(formatter.isValidTimestamp('invalid'), false);
      assert.strictEqual(formatter.isValidTimestamp({}), false);
      assert.strictEqual(formatter.isValidTimestamp([]), false);
      assert.strictEqual(formatter.isValidTimestamp(NaN), false);
    });
  });

  describe('timezone management', () => {
    it('should get current timezone', () => {
      assert.strictEqual(formatter.getTimezone(), testTimezone);
    });

    it('should set new timezone', () => {
      formatter.setTimezone('Europe/London');
      assert.strictEqual(formatter.getTimezone(), 'Europe/London');
    });

    it('should apply new timezone to formatting', () => {
      const originalResult = formatter.formatForDisplay(testISOString);
      
      formatter.setTimezone('UTC');
      const newResult = formatter.formatForDisplay(testISOString);
      
      assert.notStrictEqual(originalResult, newResult, 'Changing timezone should affect output');
    });
  });

  describe('error handling', () => {
    it('should handle malformed ISO strings gracefully', () => {
      const malformed = '2024-13-45T25:70:90.000Z'; // Invalid month, day, hour, minute, second
      
      assert.strictEqual(formatter.formatForDisplay(malformed), 'Invalid timestamp');
      assert.strictEqual(formatter.formatForHardcover(malformed), null);
      assert.strictEqual(formatter.isValidTimestamp(malformed), false);
    });

    it('should handle extremely large/small timestamps', () => {
      const veryLarge = Number.MAX_SAFE_INTEGER;
      const verySmall = -Number.MAX_SAFE_INTEGER;
      
      // Should not throw errors, might return valid or invalid depending on DateTime limits
      assert.doesNotThrow(() => formatter.formatForDisplay(veryLarge));
      assert.doesNotThrow(() => formatter.formatForDisplay(verySmall));
      assert.doesNotThrow(() => formatter.formatForHardcover(veryLarge));
      assert.doesNotThrow(() => formatter.formatForHardcover(verySmall));
    });

    it('should handle timezone changes mid-operation', () => {
      const result1 = formatter.formatForDisplay(testISOString);
      formatter.setTimezone('Asia/Tokyo');
      const result2 = formatter.formatForDisplay(testISOString);
      
      assert.notStrictEqual(result1, result2, 'Timezone changes should be reflected immediately');
    });
  });
});

describe('TimestampFormatter Integration with Original SyncManager', () => {
  it('should produce identical results to original SyncManager methods', async () => {
    // Import both old and new implementations
    const { SyncManager } = await import('../src/sync-manager.js');
    
    // Create instances for comparison
    const mockUser = {
      id: 'test-user',
      abs_url: 'http://test.com',
      abs_token: 'token',
      hardcover_token: 'hc-token'
    };
    const mockConfig = { timezone: 'America/New_York' };
    
    const syncManager = new SyncManager(mockUser, mockConfig);
    const formatter = new TimestampFormatter('America/New_York');
    
    // Test cases to verify identical behavior
    const testCases = [
      '2024-01-15T14:30:00.000Z',
      1705329000000,
      '1705329000000',
      '2024-01-15 14:30:00',
      null,
      undefined,
      'invalid-date'
    ];
    
    for (const testCase of testCases) {
      // Compare display formatting
      const originalDisplay = syncManager._formatTimestampForDisplay(testCase);
      const newDisplay = formatter.formatForDisplay(testCase);
      assert.strictEqual(newDisplay, originalDisplay, 
        `formatForDisplay should match original for input: ${testCase}`);
      
      // Compare Hardcover formatting  
      const originalHardcover = syncManager._formatDateForHardcover(testCase);
      const newHardcover = formatter.formatForHardcover(testCase);
      assert.strictEqual(newHardcover, originalHardcover, 
        `formatForHardcover should match original for input: ${testCase}`);
    }
  });
});