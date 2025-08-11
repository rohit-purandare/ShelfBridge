import { BaseCommand } from '../BaseCommand.js';
import { ConfigValidator } from '../../config-validator.js';

/**
 * Validate command - validates configuration and optionally tests connections
 */
export class ValidateCommand extends BaseCommand {
  constructor(testAllConnectionsFn) {
    super('validate', 'Validate configuration without running sync');
    this.testAllConnections = testAllConnectionsFn;
  }

  addOptions(command) {
    command
      .option('--connections', 'Test API connections')
      .option('--help-config', 'Show configuration help');
  }

  async execute(options) {
    if (options.helpConfig) {
      const validator = new ConfigValidator();
      console.log(validator.generateHelpText());
      return;
    }

    // Always validate configuration for this command
    await this.validateConfiguration(false);

    if (options.connections) {
      const success = await this.testAllConnections();
      if (!success) {
        this.exitError();
      }
    }

    console.log('✅ Configuration validation completed successfully');
  }
}
