import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  formatHeader,
  formatLine,
  formatSection,
} from '../src/utils/display-format.js';

test('formatLine defaults and newline option', () => {
  assert.equal(formatLine(), '='.repeat(50));
  assert.equal(formatLine({ char: '-', width: 3, newline: true }), '\n---');
});

test('formatHeader formats header lines', () => {
  const [top, body, bottom] = formatHeader('Title', {
    char: '*',
    width: 5,
    duration: '1s',
    newline: true,
  });
  assert.equal(top, '\n*****');
  assert.equal(body, 'Title (1s)');
  assert.equal(bottom, '*****');
});

test('formatSection formats section lines', () => {
  const [title, underline] = formatSection('Hello', { char: '-' });
  assert.equal(title, 'Hello');
  assert.equal(underline, '-----');
});
