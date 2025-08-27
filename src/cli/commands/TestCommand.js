import { BaseCommand } from '../BaseCommand.js';
import logger from '../../logger.js';

/**
 * Test command - tests API connections for configured users
 */
export class TestCommand extends BaseCommand {
  constructor(testUserFn) {
    super('test', 'Test API connections');
    this.testUser = testUserFn;
  }

  addOptions(command) {
    command.option('-u, --user <userId>', 'Test specific user');
  }

  async execute(options) {
    // Validate configuration first
    await this.validateConfiguration(this.shouldSkipValidation());

    const { config, users } = this.getConfiguration();

    // Control logging verbosity based on --verbose flag
    const originalLevel = logger.level;
    if (!this.isVerbose()) {
      logger.level = 'error';
    }

    try {
      if (options.user) {
        const user = config.getUser(options.user);
        console.log(`\n=== Testing connections for user: ${user.id} ===`);
        const success = await this.testUser(user);
        console.log(
          success
            ? '✅ All connections successful!'
            : '❌ One or more connections failed.',
        );
      } else {
        for (const user of users) {
          console.log(`\n=== Testing connections for user: ${user.id} ===`);
          const success = await this.testUser(user);
          console.log(
            success
              ? '✅ All connections successful!'
              : '❌ One or more connections failed.',
          );
        }
      }
    } finally {
      // Restore original logger level
      logger.level = originalLevel;
    }
  }
}
