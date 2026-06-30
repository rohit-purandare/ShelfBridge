import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BaseCommand } from '../src/cli/BaseCommand.js';

class TestCommand extends BaseCommand {
  constructor() {
    super('test-command', 'Test command');
  }

  exitError() {
    throw new Error('Unexpected command exit');
  }
}

describe('BaseCommand configuration loading', () => {
  it('reuses the configuration instance validated at startup', async () => {
    const globalConfig = {
      min_progress_threshold: 5,
      parallel: true,
      workers: 3,
      dry_run: false,
      timezone: 'UTC',
      hardcover_semaphore: 1,
      hardcover_rate_limit: 55,
      audiobookshelf_semaphore: 5,
      audiobookshelf_rate_limit: 600,
      page_size: 100,
    };
    const users = [
      {
        id: 'user-1',
        abs_url: 'https://abs.test.internal',
        abs_token: 'a'.repeat(10),
        hardcover_token: 'b'.repeat(10),
      },
    ];
    const validatedConfig = {
      getGlobal: () => globalConfig,
      getUsers: () => users,
    };

    const command = new TestCommand();
    command._config = validatedConfig;

    await command.validateConfiguration(false);
    const loaded = command.getConfiguration();

    assert.equal(loaded.config, validatedConfig);
    assert.equal(loaded.globalConfig, globalConfig);
    assert.equal(loaded.users, users);
  });
});
