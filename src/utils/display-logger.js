/**
 * Display logger for user-facing output
 * Separates user display from debug/system logging
 */
import logger from '../logger.js';

/**
 * Display logger that handles user-facing output
 * Uses console for immediate display while also logging for debugging
 */
export class DisplayLogger {
  constructor() {
    this.isTestEnvironment = process.env.NODE_ENV === 'test';
  }

  /**
   * Display info message to user
   */
  info(message) {
    if (!this.isTestEnvironment) {
      console.log(message);
    }
    logger.debug(`[DISPLAY] ${message}`);
  }

  /**
   * Display error message to user
   */
  error(message) {
    if (!this.isTestEnvironment) {
      console.error(message);
    }
    logger.error(`[DISPLAY] ${message}`);
  }

  /**
   * Display warning message to user
   */
  warn(message) {
    if (!this.isTestEnvironment) {
      console.warn(message);
    }
    logger.warn(`[DISPLAY] ${message}`);
  }

  /**
   * Display header with decorative formatting
   */
  header(title, duration = null) {
    const line = '═'.repeat(50);
    const titleText = duration ? `${title} (${duration})` : title;

    this.info(line);
    this.info(titleText);
    this.info(line);
  }

  /**
   * Display footer
   */
  footer() {
    this.info('═'.repeat(50));
    this.info('');
  }

  /**
   * Display section header
   */
  section(title) {
    this.info(`\n${title}`);
    this.info('-'.repeat(title.length));
  }

  /**
   * Display blank line
   */
  blank() {
    this.info('');
  }
}

// Export singleton instance
export default new DisplayLogger();
