import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  formatTimestampForDisplay,
  formatDateForHardcover,
} from '../src/utils/date-formatter.js';

describe('formatTimestampForDisplay', () => {
  it('returns N/A for falsy input', () => {
    assert.equal(formatTimestampForDisplay(null), 'N/A');
    assert.equal(formatTimestampForDisplay(undefined), 'N/A');
    assert.equal(formatTimestampForDisplay(''), 'N/A');
    assert.equal(formatTimestampForDisplay(0), 'N/A');
  });

  it('formats ISO string timestamp correctly in UTC', () => {
    const result = formatTimestampForDisplay('2024-01-15T14:30:00.000Z', 'UTC');
    assert.match(result, /2024-01-15 14:30:00/);
  });

  it('formats millisecond timestamp correctly', () => {
    const ts = new Date('2024-01-15T14:30:00.000Z').getTime();
    const result = formatTimestampForDisplay(ts, 'UTC');
    assert.match(result, /2024-01-15 14:30:00/);
  });

  it('formats string millisecond timestamp correctly', () => {
    const ts = String(new Date('2024-01-15T14:30:00.000Z').getTime());
    const result = formatTimestampForDisplay(ts, 'UTC');
    assert.match(result, /2024-01-15 14:30:00/);
  });

  it('handles SQL format dates', () => {
    const result = formatTimestampForDisplay('2024-01-15 14:30:00', 'UTC');
    // Should parse and format successfully (not return 'Invalid timestamp')
    assert.ok(!result.includes('Invalid'));
  });

  it('applies timezone conversion correctly', () => {
    // 03:00 UTC = 22:00 EST on previous day (UTC-5)
    const result = formatTimestampForDisplay(
      '2024-01-15T03:00:00.000Z',
      'America/New_York',
    );
    assert.match(result, /2024-01-14 22:00:00/);
  });

  it('returns Invalid timestamp for non-date strings without dashes or T', () => {
    assert.equal(formatTimestampForDisplay('not_a_date'), 'Invalid timestamp');
  });

  it('returns Invalid timestamp for non-string non-number', () => {
    assert.equal(
      formatTimestampForDisplay({ foo: 'bar' }),
      'Invalid timestamp',
    );
    assert.equal(formatTimestampForDisplay(true), 'Invalid timestamp');
  });

  it('defaults to UTC when no timezone provided', () => {
    const result = formatTimestampForDisplay('2024-01-15T14:30:00.000Z');
    assert.match(result, /14:30:00/);
    assert.match(result, /UTC/);
  });
});

describe('formatDateForHardcover', () => {
  it('returns null for falsy input', () => {
    assert.equal(formatDateForHardcover(null), null);
    assert.equal(formatDateForHardcover(undefined), null);
    assert.equal(formatDateForHardcover(''), null);
    assert.equal(formatDateForHardcover(0), null);
  });

  it('formats ISO string to YYYY-MM-DD', () => {
    const result = formatDateForHardcover('2024-01-15T14:30:00.000Z', 'UTC');
    assert.equal(result, '2024-01-15');
  });

  it('formats millisecond timestamp to YYYY-MM-DD', () => {
    const ts = new Date('2024-01-15T14:30:00.000Z').getTime();
    const result = formatDateForHardcover(ts, 'UTC');
    assert.equal(result, '2024-01-15');
  });

  it('formats string millisecond to YYYY-MM-DD', () => {
    const ts = String(new Date('2024-01-15T14:30:00.000Z').getTime());
    const result = formatDateForHardcover(ts, 'UTC');
    assert.equal(result, '2024-01-15');
  });

  it('applies timezone conversion (early UTC becomes previous day in west timezones)', () => {
    // 2024-01-15T01:00:00.000Z in UTC-5 is still Jan 14
    const result = formatDateForHardcover(
      '2024-01-15T01:00:00.000Z',
      'America/New_York',
    );
    assert.equal(result, '2024-01-14');
  });

  it('handles SQL format dates', () => {
    const result = formatDateForHardcover('2024-01-15 14:30:00', 'UTC');
    assert.equal(result, '2024-01-15');
  });

  it('returns null for unparseable values', () => {
    assert.equal(formatDateForHardcover('not-a-date'), null);
  });

  it('defaults to UTC when no timezone provided', () => {
    const result = formatDateForHardcover('2024-01-15T14:30:00.000Z');
    assert.equal(result, '2024-01-15');
  });

  it('handles numeric string that looks like milliseconds', () => {
    const ts = String(new Date('2024-06-15T12:00:00.000Z').getTime());
    const result = formatDateForHardcover(ts, 'UTC');
    assert.equal(result, '2024-06-15');
  });
});
