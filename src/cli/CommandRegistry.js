import { SyncCommand } from './commands/SyncCommand.js';
import { InteractiveCommand } from './commands/InteractiveCommand.js';
import { TestCommand } from './commands/TestCommand.js';
import { ValidateCommand } from './commands/ValidateCommand.js';
import { ConfigCommand } from './commands/ConfigCommand.js';
import { CacheCommand } from './commands/CacheCommand.js';
import { DebugCommand } from './commands/DebugCommand.js';
import { SchemaCommand, SchemaDetailCommand, SchemaInputsCommand } from './commands/SchemaCommands.js';
import { CronCommand, StartCommand } from './commands/CronCommand.js';

/**
 * Registry for all CLI commands
 * Handles command registration and provides access to command instances
 */
export class CommandRegistry {
  constructor() {
    this.commands = new Map();
  }

  /**
   * Register all commands with their dependencies
   */
  registerCommands(dependencies) {
    const {
      syncUserFn,
      registerCleanupFn,
      testUserFn,
      testAllConnectionsFn,
      showConfigFn,
      debugUserFn,
      runScheduledSyncFn,
      showNextScheduledSyncFn,
    } = dependencies;

    // Register all commands
    this.register(new SyncCommand(syncUserFn));
    this.register(new InteractiveCommand(syncUserFn, registerCleanupFn));
    this.register(new TestCommand(testUserFn));
    this.register(new ValidateCommand(testAllConnectionsFn));
    this.register(new ConfigCommand(showConfigFn));
    this.register(new CacheCommand(registerCleanupFn));
    this.register(new DebugCommand(debugUserFn));
    this.register(new SchemaCommand());
    this.register(new SchemaDetailCommand());
    this.register(new SchemaInputsCommand());
    this.register(new CronCommand(runScheduledSyncFn, showNextScheduledSyncFn));
    this.register(new StartCommand(runScheduledSyncFn, showNextScheduledSyncFn));
  }

  /**
   * Register a single command
   */
  register(command) {
    this.commands.set(command.name, command);
  }

  /**
   * Get a command by name
   */
  getCommand(name) {
    return this.commands.get(name);
  }

  /**
   * Get all registered commands
   */
  getAllCommands() {
    return Array.from(this.commands.values());
  }

  /**
   * Configure all commands with commander.js program
   */
  configureCommands(program) {
    for (const command of this.getAllCommands()) {
      command.configure(program);
    }
  }
}
