import { Config } from '../config.js';
import { ConfigValidator } from '../config-validator.js';
import logger from '../logger.js';
import fs from 'fs';

/**
 * Abstract base class for CLI commands
 * Provides common functionality like configuration validation,
 * error handling, and process management
 */
export class BaseCommand {
  constructor(name, description) {
    this.name = name;
    this.description = description;
    this.program = null;
  }

  /**
   * Configure the command with commander.js
   * Subclasses should override this to add options and set up the command
   */
  configure(program) {
    this.program = program;
    const command = program
      .command(this.name)
      .description(this.description)
      .action(async options => {
        try {
          await this.execute(options);
          this.exitSuccess();
        } catch (error) {
          this.handleError(error, options);
        }
      });

    this.addOptions(command);
    return command;
  }

  /**
   * Add command-specific options
   * Subclasses should override this method
   */
  addOptions(_command) {
    // Default: no additional options
  }

  /**
   * Execute the command
   * Subclasses must implement this method
   */
  async execute(_options) {
    throw new Error(`Command ${this.name} must implement execute() method`);
  }

  /**
   * Validate configuration on startup
   */
  async validateConfiguration(skipValidation = false) {
    if (skipValidation) {
      logger.debug('Skipping configuration validation');
      return;
    }

    try {
      logger.debug('Validating configuration...');

      const config = new Config();
      const validator = new ConfigValidator();

      // Validate configuration structure
      const validationResult = await validator.validateConfiguration(config);

      if (!validationResult.valid) {
        logger.error('Configuration validation failed');
        console.error(validator.formatErrors(validationResult));

        // Show help for fixing configuration
        console.log('\n' + '='.repeat(50));
        console.log('Configuration Help:');
        console.log('='.repeat(50));
        console.log(validator.generateHelpText());

        this.exitError();
      }

      logger.debug('Configuration validation passed');
    } catch (error) {
      logger.logErrorWithIssueLink('Configuration validation failed', error, {
        operation: 'config_validation',
        command: this.name,
        component: 'config_validator',
        config_file_exists: fs.existsSync('config/config.yaml'),
        env_config_detected: !!process.env.SHELFBRIDGE_USER_0_ID,
        severity: 'high',
      });

      console.error(
        '\nPlease check your config/config.yaml file and try again.',
      );
      this.exitError();
    }
  }

  /**
   * Get configuration instances
   */
  getConfiguration() {
    const config = new Config();
    return {
      config,
      globalConfig: config.getGlobal(),
      users: config.getUsers(),
    };
  }

  /**
   * Handle command errors
   */
  handleError(error, options = {}) {
    logger.logErrorWithIssueLink(`${this.name} command failed`, error, {
      operation: this.name.toLowerCase().replace(' ', '_'),
      command: this.name,
      options: JSON.stringify(options),
      severity: 'high',
    });
    this.exitError();
  }

  /**
   * Exit successfully
   */
  exitSuccess() {
    process.exit(0);
  }

  /**
   * Exit with error
   */
  exitError() {
    process.exit(1);
  }

  /**
   * Get global program options (like --verbose, --dry-run)
   */
  getGlobalOptions() {
    return this.program ? this.program.opts() : {};
  }

  /**
   * Check if verbose mode is enabled
   */
  isVerbose() {
    return this.getGlobalOptions().verbose || false;
  }

  /**
   * Check if dry run mode is enabled
   */
  isDryRun() {
    return this.getGlobalOptions().dryRun || false;
  }

  /**
   * Check if validation should be skipped
   */
  shouldSkipValidation() {
    return this.getGlobalOptions().skipValidation || false;
  }
}
