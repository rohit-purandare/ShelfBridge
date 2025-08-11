import { BaseCommand } from '../BaseCommand.js';
import logger from '../../logger.js';

/**
 * Config command - shows current configuration
 */
export class ConfigCommand extends BaseCommand {
  constructor(showConfigFn) {
    super('config', 'Show configuration');
    this.showConfig = showConfigFn;
  }

  async execute(options) {
    try {
      // Validate configuration first
      await this.validateConfiguration(this.shouldSkipValidation());

      const { config } = this.getConfiguration();
      this.showConfig(config);
    } catch (error) {
      logger.error('Config check failed', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }
}
