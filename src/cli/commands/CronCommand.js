import { BaseCommand } from '../BaseCommand.js';
import { formatStartupMessage } from '../../utils/github-helper.js';
import { currentVersion } from '../../version.js';
import logger from '../../logger.js';
import cron from 'node-cron';

/**
 * Cron command - starts scheduled sync in background
 */
export class CronCommand extends BaseCommand {
  constructor(runScheduledSyncFn, showNextScheduledSyncFn) {
    super('cron', 'Start scheduled sync (runs in background)');
    this.runScheduledSync = runScheduledSyncFn;
    this.showNextScheduledSync = showNextScheduledSyncFn;
  }

  configure(program) {
    const command = program
      .command(this.name)
      .description(this.description)
      .action(async options => {
        try {
          await this.execute(options);
          // Do NOT call exitSuccess() - the process should keep running
          // The execute() method sets up the keep-alive mechanism
        } catch (error) {
          this.handleError(error, options);
        }
      });

    this.addOptions(command);
    return command;
  }

  async execute(_options) {
    // Show startup message
    console.log(formatStartupMessage('Cron Sync', currentVersion));

    // Validate configuration first
    await this.validateConfiguration(this.shouldSkipValidation());

    const { config } = this.getConfiguration();
    const cronConfig = config.getCronConfig();

    logger.info('Starting scheduled sync', {
      schedule: cronConfig.schedule,
      timezone: cronConfig.timezone,
    });

    // Run initial sync
    logger.info('Running initial sync...');
    await this.runScheduledSync(config);
    await this.showNextScheduledSync(cronConfig);

    // Schedule recurring sync
    cron.schedule(
      cronConfig.schedule,
      async () => {
        logger.info('Scheduled sync triggered');
        await this.runScheduledSync(config);
        await this.showNextScheduledSync(cronConfig);
      },
      {
        timezone: cronConfig.timezone,
      },
    );

    logger.info('Scheduled sync started. Press Ctrl+C to stop.');

    // Keep the process running
    process.on('SIGINT', () => {
      logger.info('Stopping scheduled sync...');
      this.exitSuccess();
    });

    // Keep alive
    setInterval(() => {
      // Do nothing, just keep the process alive
    }, 60000);
  }
}

/**
 * Start command - default scheduled sync behavior
 */
export class StartCommand extends BaseCommand {
  constructor(runScheduledSyncFn, showNextScheduledSyncFn) {
    super('start', 'Start scheduled sync (default behavior)');
    this.runScheduledSync = runScheduledSyncFn;
    this.showNextScheduledSync = showNextScheduledSyncFn;
    this.isDefault = true;
  }

  configure(program) {
    const command = program
      .command(this.name, { isDefault: true })
      .description(this.description)
      .action(async options => {
        try {
          await this.execute(options);
          // Do NOT call exitSuccess() - the process should keep running
          // The execute() method sets up the keep-alive mechanism
        } catch (error) {
          this.handleError(error, options);
        }
      });

    this.addOptions(command);
    return command;
  }

  async execute(_options) {
    // Show startup message
    console.log(formatStartupMessage('Scheduled Sync', currentVersion));

    // Validate configuration first
    await this.validateConfiguration(this.shouldSkipValidation());

    const { config } = this.getConfiguration();
    const cronConfig = config.getCronConfig();

    logger.info('Starting scheduled sync', {
      schedule: cronConfig.schedule,
      timezone: cronConfig.timezone,
    });

    // Run initial sync
    logger.info('Running initial sync...');
    await this.runScheduledSync(config);
    await this.showNextScheduledSync(cronConfig);

    // Schedule recurring sync
    cron.schedule(
      cronConfig.schedule,
      async () => {
        logger.info('Scheduled sync triggered');
        await this.runScheduledSync(config);
        await this.showNextScheduledSync(cronConfig);
      },
      {
        timezone: cronConfig.timezone,
      },
    );

    logger.info('Scheduled sync started. Press Ctrl+C to stop.');

    // Keep the process running
    process.on('SIGINT', () => {
      logger.info('Stopping scheduled sync...');
      this.exitSuccess();
    });

    // Keep alive
    setInterval(() => {
      // Do nothing, just keep the process alive
    }, 60000);
  }
}
