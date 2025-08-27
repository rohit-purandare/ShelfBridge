import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { DisplayLogger } from '../src/utils/display-logger.js';
import logger from '../src/logger.js';

describe('DisplayLogger', () => {
  let displayLogger;
  let originalConsole;
  let capturedMessages;
  let originalLoggerDebug, originalLoggerError, originalLoggerWarn;
  let capturedLogs;

  beforeEach(() => {
    displayLogger = new DisplayLogger();
    capturedMessages = [];
    capturedLogs = [];

    // Mock console methods
    originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
    };

    console.log = (message) => capturedMessages.push({ type: 'log', message });
    console.error = (message) => capturedMessages.push({ type: 'error', message });
    console.warn = (message) => capturedMessages.push({ type: 'warn', message });

    // Mock logger methods
    originalLoggerDebug = logger.debug;
    originalLoggerError = logger.error;
    originalLoggerWarn = logger.warn;

    logger.debug = (message) => capturedLogs.push({ type: 'debug', message });
    logger.error = (message) => capturedLogs.push({ type: 'error', message });
    logger.warn = (message) => capturedLogs.push({ type: 'warn', message });
  });

  afterEach(() => {
    // Restore original methods
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;

    logger.debug = originalLoggerDebug;
    logger.error = originalLoggerError;
    logger.warn = originalLoggerWarn;
  });

  describe('constructor', () => {
    test('detects test environment correctly', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      
      try {
        process.env.NODE_ENV = 'test';
        const testLogger = new DisplayLogger();
        assert.strictEqual(testLogger.isTestEnvironment, true);

        process.env.NODE_ENV = 'production';
        const prodLogger = new DisplayLogger();
        assert.strictEqual(prodLogger.isTestEnvironment, false);
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });
  });

  describe('info()', () => {
    test('logs to console and logger in non-test environment', () => {
      displayLogger.isTestEnvironment = false;
      displayLogger.info('Test message');

      assert.strictEqual(capturedMessages.length, 1);
      assert.deepStrictEqual(capturedMessages[0], { type: 'log', message: 'Test message' });
      
      assert.strictEqual(capturedLogs.length, 1);
      assert.deepStrictEqual(capturedLogs[0], { type: 'debug', message: '[DISPLAY] Test message' });
    });

    test('only logs to logger in test environment', () => {
      displayLogger.isTestEnvironment = true;
      displayLogger.info('Test message');

      assert.strictEqual(capturedMessages.length, 0);
      
      assert.strictEqual(capturedLogs.length, 1);
      assert.deepStrictEqual(capturedLogs[0], { type: 'debug', message: '[DISPLAY] Test message' });
    });
  });

  describe('error()', () => {
    test('logs to console.error and logger.error in non-test environment', () => {
      displayLogger.isTestEnvironment = false;
      displayLogger.error('Error message');

      assert.strictEqual(capturedMessages.length, 1);
      assert.deepStrictEqual(capturedMessages[0], { type: 'error', message: 'Error message' });
      
      assert.strictEqual(capturedLogs.length, 1);
      assert.deepStrictEqual(capturedLogs[0], { type: 'error', message: '[DISPLAY] Error message' });
    });

    test('only logs to logger.error in test environment', () => {
      displayLogger.isTestEnvironment = true;
      displayLogger.error('Error message');

      assert.strictEqual(capturedMessages.length, 0);
      
      assert.strictEqual(capturedLogs.length, 1);
      assert.deepStrictEqual(capturedLogs[0], { type: 'error', message: '[DISPLAY] Error message' });
    });
  });

  describe('warn()', () => {
    test('logs to console.warn and logger.warn in non-test environment', () => {
      displayLogger.isTestEnvironment = false;
      displayLogger.warn('Warning message');

      assert.strictEqual(capturedMessages.length, 1);
      assert.deepStrictEqual(capturedMessages[0], { type: 'warn', message: 'Warning message' });
      
      assert.strictEqual(capturedLogs.length, 1);
      assert.deepStrictEqual(capturedLogs[0], { type: 'warn', message: '[DISPLAY] Warning message' });
    });

    test('only logs to logger.warn in test environment', () => {
      displayLogger.isTestEnvironment = true;
      displayLogger.warn('Warning message');

      assert.strictEqual(capturedMessages.length, 0);
      
      assert.strictEqual(capturedLogs.length, 1);
      assert.deepStrictEqual(capturedLogs[0], { type: 'warn', message: '[DISPLAY] Warning message' });
    });
  });

  describe('header()', () => {
    test('displays header without duration', () => {
      displayLogger.isTestEnvironment = false;
      displayLogger.header('Test Header');

      assert.strictEqual(capturedMessages.length, 3);
      assert.strictEqual(capturedMessages[0].message, '═'.repeat(50));
      assert.strictEqual(capturedMessages[1].message, 'Test Header');
      assert.strictEqual(capturedMessages[2].message, '═'.repeat(50));
    });

    test('displays header with duration', () => {
      displayLogger.isTestEnvironment = false;
      displayLogger.header('Sync Complete', '5.2s');

      assert.strictEqual(capturedMessages.length, 3);
      assert.strictEqual(capturedMessages[0].message, '═'.repeat(50));
      assert.strictEqual(capturedMessages[1].message, 'Sync Complete (5.2s)');
      assert.strictEqual(capturedMessages[2].message, '═'.repeat(50));
    });

    test('logs to logger in test environment', () => {
      displayLogger.isTestEnvironment = true;
      displayLogger.header('Test Header');

      assert.strictEqual(capturedMessages.length, 0);
      assert.strictEqual(capturedLogs.length, 3);
      assert.strictEqual(capturedLogs[0].message, '[DISPLAY] ' + '═'.repeat(50));
      assert.strictEqual(capturedLogs[1].message, '[DISPLAY] Test Header');
      assert.strictEqual(capturedLogs[2].message, '[DISPLAY] ' + '═'.repeat(50));
    });
  });

  describe('footer()', () => {
    test('displays footer line and blank line', () => {
      displayLogger.isTestEnvironment = false;
      displayLogger.footer();

      assert.strictEqual(capturedMessages.length, 2);
      assert.strictEqual(capturedMessages[0].message, '═'.repeat(50));
      assert.strictEqual(capturedMessages[1].message, '');
    });
  });

  describe('section()', () => {
    test('displays section title with underline', () => {
      displayLogger.isTestEnvironment = false;
      displayLogger.section('Test Section');

      assert.strictEqual(capturedMessages.length, 2);
      assert.strictEqual(capturedMessages[0].message, '\nTest Section');
      assert.strictEqual(capturedMessages[1].message, '-'.repeat('Test Section'.length));
    });

    test('adjusts underline length to match title', () => {
      displayLogger.isTestEnvironment = false;
      displayLogger.section('A');

      assert.strictEqual(capturedMessages.length, 2);
      assert.strictEqual(capturedMessages[0].message, '\nA');
      assert.strictEqual(capturedMessages[1].message, '-');
    });
  });

  describe('blank()', () => {
    test('displays blank line', () => {
      displayLogger.isTestEnvironment = false;
      displayLogger.blank();

      assert.strictEqual(capturedMessages.length, 1);
      assert.strictEqual(capturedMessages[0].message, '');
    });
  });

  describe('singleton export', () => {
    test('default export provides singleton instance', async () => {
      const { default: defaultLogger } = await import('../src/utils/display-logger.js');
      assert(defaultLogger instanceof DisplayLogger);
      
      // Should be the same instance when imported again
      const { default: defaultLogger2 } = await import('../src/utils/display-logger.js');
      assert.strictEqual(defaultLogger, defaultLogger2);
    });
  });

  describe('integration with existing logger', () => {
    test('preserves logger functionality when logger methods exist', () => {
      displayLogger.isTestEnvironment = false;
      
      displayLogger.info('Info test');
      displayLogger.error('Error test');
      displayLogger.warn('Warn test');

      // Should call both console and logger methods
      assert.strictEqual(capturedMessages.length, 3);
      assert.strictEqual(capturedLogs.length, 3);
      
      assert.strictEqual(capturedLogs[0].type, 'debug');
      assert.strictEqual(capturedLogs[1].type, 'error');
      assert.strictEqual(capturedLogs[2].type, 'warn');
    });
  });

  describe('NODE_ENV handling', () => {
    test('respects NODE_ENV changes during runtime', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      
      try {
        // Test production mode
        process.env.NODE_ENV = 'production';
        const prodLogger = new DisplayLogger();
        prodLogger.info('Production message');
        
        assert.strictEqual(capturedMessages.length, 1, 'Should display in production');
        
        // Reset captured messages
        capturedMessages.length = 0;
        
        // Test development mode
        process.env.NODE_ENV = 'development';
        const devLogger = new DisplayLogger();
        devLogger.info('Development message');
        
        assert.strictEqual(capturedMessages.length, 1, 'Should display in development');
        
        // Reset captured messages
        capturedMessages.length = 0;
        
        // Test test mode
        process.env.NODE_ENV = 'test';
        const testLogger = new DisplayLogger();
        testLogger.info('Test message');
        
        assert.strictEqual(capturedMessages.length, 0, 'Should not display in test');
        
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });
  });
});