import { BaseCommand } from '../BaseCommand.js';
import { Semaphore } from '../../utils/concurrency.js';
import { formatStartupMessage } from '../../utils/github-helper.js';
import { currentVersion } from '../../version.js';
import logger from '../../logger.js';

/**
 * Sync command - synchronizes reading progress
 */
export class SyncCommand extends BaseCommand {
  constructor(syncUserFn) {
    super('sync', 'Sync reading progress');
    this.syncUser = syncUserFn;
  }

  addOptions(command) {
    command
      .option('--all-users', 'Sync all users')
      .option('-u, --user <userId>', 'Sync specific user')
      .option('--force', 'Force sync even if progress unchanged (ignores cache)');
  }

  async execute(options) {
    // Validate configuration first
    await this.validateConfiguration(this.shouldSkipValidation());

    const { config, globalConfig, users } = this.getConfiguration();

    // Override dry_run from config if --dry-run flag is used
    if (options.dryRun || this.isDryRun()) {
      globalConfig.dry_run = true;
    }

    // Add force flag to global config
    if (options.force) {
      globalConfig.force_sync = true;
    }

    // Show startup information
    console.log(formatStartupMessage('Sync', currentVersion));

    logger.debug('Starting sync', {
      users: users.length,
      dryRun: globalConfig.dry_run,
      minProgressThreshold: globalConfig.min_progress_threshold,
    });

    if (options.user) {
      // Sync specific user
      const user = config.getUser(options.user);
      await this.syncUser(user, globalConfig, this.isVerbose());
    } else {
      // Sync all users
      if (globalConfig.parallel) {
        const workers = globalConfig.workers || 3;
        logger.debug('Running user syncs in parallel mode', { workers });
        const semaphore = new Semaphore(workers);

        await Promise.all(
          users.map(async user => {
            await semaphore.acquire();
            try {
              await this.syncUser(user, globalConfig, this.isVerbose());
            } finally {
              semaphore.release();
            }
          })
        );
      } else {
        for (const user of users) {
          await this.syncUser(user, globalConfig, this.isVerbose());
        }
      }
    }
  }
}
