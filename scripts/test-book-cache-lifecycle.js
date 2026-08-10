#!/usr/bin/env node

/**
 * Native BookCache lifecycle regression test.
 *
 * This intentionally relies on natural Node.js process teardown. Calling
 * process.exit() would hide native finalization failures that occur after the
 * JavaScript checks have completed.
 */

import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const originalWorkingDirectory = process.cwd();
const tempDirectory = mkdtempSync(
  path.join(tmpdir(), 'shelfbridge-native-lifecycle-'),
);
const lifecycleCount = 25;
let activeCache = null;

try {
  // Force logger initialization to fall back to console-only output. Keeping
  // rotating-file transports open while deleting their temporary directory
  // would make Winston set a nonzero exit code after this test has passed.
  const readOnlyLinuxDirectory = '/sys';
  if (existsSync(readOnlyLinuxDirectory)) {
    // Linux mounts /sys read-only in containers, including for root.
    process.chdir(readOnlyLinuxDirectory);
  } else {
    const unwritableWorkingDirectory = path.join(tempDirectory, 'runtime');
    mkdirSync(unwritableWorkingDirectory);
    chmodSync(unwritableWorkingDirectory, 0o555);
    process.chdir(unwritableWorkingDirectory);
  }
  process.env.LOG_LEVEL = 'error';

  const { BookCache } = await import('../src/book-cache.js');

  for (let index = 0; index < lifecycleCount; index++) {
    const cache = new BookCache(
      path.join(tempDirectory, `book-cache-${index}.db`),
    );
    activeCache = cache;

    await cache.init();
    await cache.storeProgress(
      'native-test-user',
      `native-test-id-${index}`,
      `Native lifecycle book ${index}`,
      41,
      'asin',
      null,
      null,
      2,
      123,
    );

    const progress = await cache.getLastProgress(
      'native-test-user',
      `native-test-id-${index}`,
      `Native lifecycle book ${index}`,
      'asin',
    );
    assert.equal(progress, 41);

    cache.close();
    activeCache = null;
  }

  console.log(
    `✅ BookCache native lifecycle passed (${lifecycleCount} initialize/write/close cycles)`,
  );
} catch (error) {
  console.error('❌ BookCache native lifecycle failed:', error);
  process.exitCode = 1;
} finally {
  activeCache?.close();
  process.chdir(originalWorkingDirectory);
  rmSync(tempDirectory, { recursive: true, force: true });
}
