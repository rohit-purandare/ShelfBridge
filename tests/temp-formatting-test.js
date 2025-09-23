import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('Temp Formatting Test', () => {
  it('should have bad formatting initially', () => {
    const badlyFormattedCode = { foo: 'bar', baz: 'qux' };
    const result = badlyFormattedCode;
    assert.ok(result);
  });
});
