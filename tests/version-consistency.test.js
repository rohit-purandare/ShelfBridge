import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { currentVersion } from '../src/version.js';

describe('Version consistency', () => {
  it('reads the application version from package.json', () => {
    const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));

    assert.equal(currentVersion, packageJson.version);
  });

  it('uses the shared version for per-user sync logs', () => {
    const syncManagerSource = readFileSync('./src/sync-manager.js', 'utf8');

    assert.match(
      syncManagerSource,
      /import \{ currentVersion \} from '\.\/version\.js';/,
    );
    assert.match(
      syncManagerSource,
      /logger\.info\('Starting sync for user', \{[\s\S]*?version: currentVersion,/,
    );
  });
});
