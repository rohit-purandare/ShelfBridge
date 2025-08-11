import { SyncCommand } from './commands/SyncCommand.js';
import { InteractiveCommand } from './commands/InteractiveCommand.js';

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
      // Add other dependencies as needed
    } = dependencies;

    // Register commands
    this.register(new SyncCommand(syncUserFn));
    this.register(new InteractiveCommand(syncUserFn, registerCleanupFn));

    // TODO: Register other commands as they are extracted
    // this.register(new TestCommand(...));
    // this.register(new ValidateCommand(...));
    // this.register(new ConfigCommand(...));
    // this.register(new CacheCommand(...));
    // this.register(new CronCommand(...));
    // this.register(new DebugCommand(...));
    // this.register(new SchemaCommand(...));
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
