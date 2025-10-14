import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Smart console usage for CLI tools
      'no-console': [
        'error',
        {
          allow: ['error', 'warn', 'info', 'log'], // Allow user-facing output
        },
      ],

      // Strict unused variables - these indicate real issues
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      'prefer-const': 'error',
      'no-var': 'error',

      // ShelfBridge specific rules
      'no-process-exit': 'off', // Allow process.exit in CLI tools
      camelcase: ['error', { properties: 'never' }], // Allow snake_case for API responses

      // Async/await best practices
      'no-async-promise-executor': 'error',
      'require-atomic-updates': 'off', // Can be noisy with legitimate async patterns

      // Security-related rules
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },
  {
    files: ['src/main.js'],
    rules: {
      'no-console': 'off', // CLI entry point needs console output
    },
  },
  {
    files: ['src/test-*.js'],
    rules: {
      'no-console': 'off', // Allow console.log in test files
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off', // Allow console.log in test files
      'no-unused-vars': 'off', // Test files may have unused imports for mocking
    },
  },
];
