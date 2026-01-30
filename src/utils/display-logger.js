/**
 * Display logger for user-facing output
 * Separates user display from debug/system logging
 */
import logger from '../logger.js';
import { LINE_CHARS, LINE_WIDTHS } from './display-constants.js';
import { formatHeader, formatLine, formatSection } from './display-format.js';

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
    const [top, body, bottom] = formatHeader(title, { duration });
    this.info(top);
    this.info(body);
    this.info(bottom);
  }

  /**
   * Display footer
   */
  footer() {
    this.info(
      formatLine({ char: LINE_CHARS.heavy, width: LINE_WIDTHS.header }),
    );
    this.info('');
  }

  /**
   * Display section header
   */
  section(title) {
    const [titleLine, underline] = formatSection(title);
    this.info(`\n${titleLine}`);
    this.info(underline);
  }

  /**
   * Display separator line
   */
  line({
    char = LINE_CHARS.primary,
    width = LINE_WIDTHS.header,
    newline = false,
  } = {}) {
    this.info(formatLine({ char, width, newline }));
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
