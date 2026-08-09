import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';

describe('Startup cache path', () => {
  it('uses the same shared cache for session recovery and normal syncs', () => {
    const mainSource = readFileSync('./src/main.js', 'utf8');
    const syncManagerSource = readFileSync('./src/sync-manager.js', 'utf8');

    assert.match(
      mainSource,
      /processStartupSessions[\s\S]*?const cache = new BookCache\(\);/,
    );
    assert.match(syncManagerSource, /this\.cache = new BookCache\(\);/);
    assert.doesNotMatch(mainSource, /\.book_cache_\$\{user\.id\}\.db/);
  });
});
