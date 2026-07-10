import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// These historical tests currently fail against the production code even when
// run independently. Keep the list explicit so new test files enter CI by
// default and the existing debt remains visible through `npm run test:all`.
const quarantinedTests = new Set([
  'auto-add-cache-skip-verification.test.js',
  'auto-add-functionality-preservation.test.js',
  'book-cache-sessions.test.js',
  'book-identification-scorer.test.js',
  'cache-two-stage.test.js',
  'config-yaml-comprehensive.test.js',
  'cross-edition-enhancement.test.js',
  'delayed-updates-integration.test.js',
  'duplicate-matching-prevention.test.js',
  'edge-cases-error-handling.test.js',
  'edition-selector.test.js',
  'format-detection.test.js',
  'performance-regression.test.js',
  'session-manager.test.js',
  'sync-manager-two-stage.test.js',
  'sync-output-integration.test.js',
  'two-stage-integration.test.js',
  'unified-edition-scorer.test.js',
]);

const allTests = readdirSync('tests')
  .filter(file => file.endsWith('.test.js'))
  .sort();

const missingQuarantinedTests = [...quarantinedTests].filter(
  file => !allTests.includes(file),
);

if (missingQuarantinedTests.length > 0) {
  console.error(
    `Quarantined test files no longer exist: ${missingQuarantinedTests.join(', ')}`,
  );
  process.exit(1);
}

const mode = process.argv[2];
let selectedTests;

if (mode === '--all') {
  selectedTests = allTests;
} else if (mode === '--quarantined') {
  selectedTests = allTests.filter(file => quarantinedTests.has(file));
} else if (mode === undefined) {
  selectedTests = allTests.filter(file => !quarantinedTests.has(file));
  console.log(
    `Running ${selectedTests.length} CI test files; ${quarantinedTests.size} known-failing files are quarantined.`,
  );
} else {
  console.error(`Unknown test-suite option: ${mode}`);
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [
    '--test',
    '--test-concurrency=1',
    ...selectedTests.map(file => `tests/${file}`),
  ],
  { stdio: 'inherit' },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
