import fs from 'node:fs';
import * as yaml from 'js-yaml';

import { findUserPlaceholderValues } from '../src/config-placeholders.js';

const configPath = process.argv[2];

if (!configPath) {
  console.error('Usage: node scripts/check-config-placeholders.js <config>');
  process.exit(2);
}

try {
  const config = yaml.load(fs.readFileSync(configPath, 'utf8')) || {};
  const placeholders = findUserPlaceholderValues(config.users);

  if (placeholders.length > 0) {
    for (const { index, field } of placeholders) {
      console.error(`Placeholder detected in users[${index}].${field}`);
    }
    process.exit(1);
  }

  process.exit(0);
} catch (error) {
  console.error(`Unable to inspect configuration: ${error.message}`);
  process.exit(2);
}
