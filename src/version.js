import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the current version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, '..', 'package.json');

let currentVersion = 'unknown';
try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    currentVersion = packageJson.version;
} catch (error) {
    console.warn('Could not read version from package.json:', error.message);
}

export { currentVersion }; 