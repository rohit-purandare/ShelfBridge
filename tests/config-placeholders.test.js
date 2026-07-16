import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as yaml from 'js-yaml';

import {
  findUserPlaceholderValues,
  isPlaceholderValue,
} from '../src/config-placeholders.js';

describe('configuration placeholder detection', () => {
  it('ignores placeholder text outside configured user fields', () => {
    const config = yaml.load(`
users:
  - id: rohit
    abs_url: https://audiobooks.example.net
    abs_token: real-abs-token
    hardcover_token: real-hardcover-token
    # Run 'node src/main.js debug -u your_username' for help
`);

    assert.deepEqual(findUserPlaceholderValues(config.users), []);
  });

  it('reports placeholders in each supported user field', () => {
    const users = [
      {
        id: 'your_username',
        abs_url: 'https://your-audiobookshelf-server.com',
        abs_token: 'your_audiobookshelf_api_token_here',
        hardcover_token: 'your_hardcover_api_token_here',
      },
    ];

    assert.deepEqual(
      findUserPlaceholderValues(users).map(({ field }) => field),
      ['abs_url', 'abs_token', 'hardcover_token', 'id'],
    );
  });

  it('matches placeholder values case-insensitively', () => {
    assert.equal(
      isPlaceholderValue('Bearer YOUR_HARDCOVER_API_TOKEN', 'tokens'),
      true,
    );
  });
});
