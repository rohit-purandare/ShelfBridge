import { BaseCommand } from '../BaseCommand.js';
import logger from '../../logger.js';

/**
 * Debug command - shows debug information for users
 */
export class DebugCommand extends BaseCommand {
  constructor(debugUserFn) {
    super('debug', 'Show debug information');
    this.debugUser = debugUserFn;
  }

  addOptions(command) {
    command.option('-u, --user <userId>', 'Debug specific user');
  }

  async execute(options) {
    // Validate configuration first
    await this.validateConfiguration(this.shouldSkipValidation());

    const { config, users } = this.getConfiguration();

    if (options.user) {
      const user = config.getUser(options.user);
      await this.debugUser(user);
    } else {
      for (const user of users) {
        logger.info('Starting debug for user', { user_id: user.id });
        await this.debugUser(user);
      }
    }
  }
}
