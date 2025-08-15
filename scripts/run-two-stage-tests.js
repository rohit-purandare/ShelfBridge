#!/usr/bin/env node

/**
 * Two-Stage Matching Test Runner
 * 
 * Comprehensive test runner for all two-stage matching tests.
 * Provides detailed reporting and coverage analysis.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Test suites for two-stage matching
const testSuites = [
  {
    name: 'Book Identification Scorer',
    file: 'tests/book-identification-scorer.test.js',
    description: 'Unit tests for Stage 1 book identification scoring'
  },
  {
    name: 'Edition Selector', 
    file: 'tests/edition-selector.test.js',
    description: 'Unit tests for Stage 2 edition selection logic'
  },
  {
    name: 'Format Detection',
    file: 'tests/format-detection.test.js',
    description: 'Tests for enhanced audiobook vs ebook detection'
  },
  {
    name: 'Two-Stage Integration',
    file: 'tests/two-stage-integration.test.js',
    description: 'Integration tests for complete two-stage flow'
  },
  {
    name: 'Sync Manager Integration',
    file: 'tests/sync-manager-two-stage.test.js',
    description: 'Tests for sync-manager integration with two-stage results'
  },
  {
    name: 'Cache Integration',
    file: 'tests/cache-two-stage.test.js',
    description: 'Tests for cache integration with two-stage matching'
  },
  {
    name: 'Performance Regression',
    file: 'tests/performance-regression.test.js', 
    description: 'Performance tests to ensure no regression'
  },
  {
    name: 'Edge Cases & Error Handling',
    file: 'tests/edge-cases-error-handling.test.js',
    description: 'Edge cases and error handling scenarios'
  }
];

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, {
      stdio: 'pipe',
      cwd: rootDir,
      ...options
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });

    process.on('error', (error) => {
      reject(error);
    });
  });
}

async function runTestSuite(suite) {
  console.log(`\n🧪 Running ${suite.name}...`);
  console.log(`   ${suite.description}`);
  
  try {
    const startTime = Date.now();
    
    // Run Jest for specific test file
    const result = await runCommand('npx', ['jest', suite.file, '--verbose'], {
      env: { ...process.env, NODE_ENV: 'test' }
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ ${suite.name} completed in ${duration}ms`);
    
    // Parse Jest output for test counts
    const output = result.stdout;
    const passMatch = output.match(/(\d+) passed/);
    const failMatch = output.match(/(\d+) failed/);
    
    return {
      name: suite.name,
      passed: passMatch ? parseInt(passMatch[1]) : 0,
      failed: failMatch ? parseInt(failMatch[1]) : 0,
      duration,
      success: result.code === 0
    };
    
  } catch (error) {
    console.log(`❌ ${suite.name} failed: ${error.message}`);
    
    return {
      name: suite.name,
      passed: 0,
      failed: 1,
      duration: 0,
      success: false,
      error: error.message
    };
  }
}

async function runAllTests() {
  console.log('🚀 Starting Two-Stage Matching Test Suite');
  console.log('==========================================\n');
  
  const results = [];
  let totalPassed = 0;
  let totalFailed = 0;
  let totalDuration = 0;
  
  // Run each test suite
  for (const suite of testSuites) {
    const result = await runTestSuite(suite);
    results.push(result);
    
    totalPassed += result.passed;
    totalFailed += result.failed;
    totalDuration += result.duration;
  }
  
  // Print summary
  console.log('\n📊 Test Summary');
  console.log('================');
  
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    const tests = result.passed + result.failed;
    console.log(`${status} ${result.name}: ${result.passed}/${tests} passed (${result.duration}ms)`);
    
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  console.log('\n📈 Overall Results');
  console.log('==================');
  console.log(`Total Tests: ${totalPassed + totalFailed}`);
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed: ${totalFailed}`);
  console.log(`Success Rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`);
  console.log(`Total Duration: ${totalDuration}ms`);
  
  const allPassed = totalFailed === 0;
  
  if (allPassed) {
    console.log('\n🎉 All tests passed! Two-stage matching system is ready for production.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review and fix issues before deployment.');
  }
  
  return allPassed;
}

async function runCoverage() {
  console.log('\n📊 Running Coverage Analysis...');
  
  try {
    await runCommand('npx', ['jest', '--coverage', '--testPathPattern=two-stage'], {
      env: { ...process.env, NODE_ENV: 'test' }
    });
    
    console.log('✅ Coverage analysis completed');
  } catch (error) {
    console.log('⚠️  Coverage analysis failed:', error.message);
  }
}

async function runLinting() {
  console.log('\n🔍 Running ESLint on test files...');
  
  try {
    await runCommand('npx', ['eslint', 'tests/', '--ext', '.js']);
    console.log('✅ All test files pass linting');
  } catch (error) {
    console.log('⚠️  Linting issues found:', error.message);
  }
}

// Main execution
async function main() {
  try {
    // Check if Jest is available
    try {
      await runCommand('npx', ['jest', '--version']);
    } catch (error) {
      console.error('❌ Jest is not available. Please install Jest to run tests.');
      console.error('   Run: npm install --save-dev jest');
      process.exit(1);
    }
    
    // Run linting first
    await runLinting();
    
    // Run all test suites
    const success = await runAllTests();
    
    // Run coverage if all tests pass
    if (success) {
      await runCoverage();
    }
    
    // Exit with appropriate code
    process.exit(success ? 0 : 1);
    
  } catch (error) {
    console.error('💥 Test runner failed:', error.message);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log('Two-Stage Matching Test Runner');
  console.log('==============================');
  console.log('');
  console.log('Usage: node scripts/run-two-stage-tests.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --help, -h     Show this help message');
  console.log('  --coverage     Run with coverage analysis');
  console.log('  --lint         Run linting only');
  console.log('');
  console.log('Test Suites:');
  testSuites.forEach(suite => {
    console.log(`  • ${suite.name}: ${suite.description}`);
  });
  process.exit(0);
}

if (args.includes('--lint')) {
  runLinting().then(() => process.exit(0));
} else if (args.includes('--coverage')) {
  runCoverage().then(() => process.exit(0));
} else {
  main();
}

process.exit(0);
