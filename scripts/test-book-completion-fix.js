#!/usr/bin/env node

/**
 * Integration test script for book completion atomic fix
 * 
 * This script helps verify that the fix works correctly by:
 * 1. Testing the HardcoverClient markBookCompleted method directly
 * 2. Simulating various failure scenarios
 * 3. Providing clear output about what's working vs broken
 * 
 * Usage: node scripts/test-book-completion-fix.js
 */

import { HardcoverClient } from '../src/hardcover-client.js';

// Test configuration
const TEST_CONFIG = {
  // Use a dummy token for testing (won't make real API calls)
  token: 'dummy-test-token',
  mockUserBookId: 12345,
  mockEditionId: 67890,
  mockTotalPages: 350,
  mockTotalSeconds: 28800, // 8 hours
  mockReadId: 99999
};

console.log('🧪 Testing Book Completion Atomic Fix');
console.log('=====================================\n');

/**
 * Test helper to create a HardcoverClient with mocked methods
 */
function createTestClient(mocks = {}) {
  const client = new HardcoverClient(TEST_CONFIG.token);
  
  // Apply mocks
  Object.keys(mocks).forEach(method => {
    client[method] = mocks[method];
  });
  
  return client;
}

/**
 * Test 1: Success scenario - both progress and status updates work
 */
async function testSuccessScenario() {
  console.log('📋 Test 1: Success Scenario');
  console.log('Testing when both progress and status updates succeed...');
  
  const client = createTestClient({
    getBookCurrentProgress: async () => ({
      latest_read: { id: TEST_CONFIG.mockReadId }
    }),
    
    _executeQuery: async (mutation, variables) => {
      console.log('  ✅ Progress update: SUCCESS');
      return {
        update_user_book_read: {
          user_book_read: {
            id: TEST_CONFIG.mockReadId,
            progress_pages: TEST_CONFIG.mockTotalPages,
            finished_at: '2024-01-15',
            edition_id: TEST_CONFIG.mockEditionId
          }
        }
      };
    },
    
    updateBookStatus: async (userBookId, statusId) => {
      console.log(`  ✅ Status update: SUCCESS (userBookId=${userBookId}, statusId=${statusId})`);
      return { id: userBookId, status_id: statusId };
    }
  });
  
  try {
    const result = await client.markBookCompleted(
      TEST_CONFIG.mockUserBookId,
      TEST_CONFIG.mockEditionId,
      TEST_CONFIG.mockTotalPages
    );
    
    if (result && result.progress_pages === TEST_CONFIG.mockTotalPages) {
      console.log('  🎯 RESULT: SUCCESS - Book marked as completed\n');
      return true;
    } else {
      console.log('  ❌ RESULT: UNEXPECTED - Should have succeeded\n');
      return false;
    }
  } catch (error) {
    console.log(`  ❌ RESULT: ERROR - ${error.message}\n`);
    return false;
  }
}

/**
 * Test 2: Progress update fails
 */
async function testProgressFailureScenario() {
  console.log('📋 Test 2: Progress Update Failure');
  console.log('Testing when progress update fails...');
  
  const client = createTestClient({
    getBookCurrentProgress: async () => ({
      latest_read: { id: TEST_CONFIG.mockReadId }
    }),
    
    _executeQuery: async () => {
      console.log('  ❌ Progress update: FAILED');
      return null; // Simulate failure
    },
    
    updateBookStatus: async () => {
      console.log('  ⚠️  Status update: Should NOT be called');
      return { id: TEST_CONFIG.mockUserBookId, status_id: 3 };
    }
  });
  
  try {
    const result = await client.markBookCompleted(
      TEST_CONFIG.mockUserBookId,
      TEST_CONFIG.mockEditionId,
      TEST_CONFIG.mockTotalPages
    );
    
    if (result === false) {
      console.log('  🎯 RESULT: CORRECTLY FAILED - Operation failed atomically\n');
      return true;
    } else {
      console.log('  ❌ RESULT: UNEXPECTED - Should have failed\n');
      return false;
    }
  } catch (error) {
    console.log(`  🎯 RESULT: CORRECTLY FAILED - ${error.message}\n`);
    return true;
  }
}

/**
 * Test 3: Status update fails (the main bug we're fixing)
 */
async function testStatusFailureScenario() {
  console.log('📋 Test 3: Status Update Failure (Main Bug Fix)');
  console.log('Testing when progress succeeds but status update fails...');
  
  let progressUpdateCalled = false;
  let statusUpdateCalled = false;
  
  const client = createTestClient({
    getBookCurrentProgress: async () => ({
      latest_read: { id: TEST_CONFIG.mockReadId }
    }),
    
    _executeQuery: async () => {
      progressUpdateCalled = true;
      console.log('  ✅ Progress update: SUCCESS');
      return {
        update_user_book_read: {
          user_book_read: {
            id: TEST_CONFIG.mockReadId,
            progress_pages: TEST_CONFIG.mockTotalPages,
            finished_at: '2024-01-15',
            edition_id: TEST_CONFIG.mockEditionId
          }
        }
      };
    },
    
    updateBookStatus: async () => {
      statusUpdateCalled = true;
      console.log('  ❌ Status update: FAILED');
      return false; // Simulate status update failure
    }
  });
  
  try {
    const result = await client.markBookCompleted(
      TEST_CONFIG.mockUserBookId,
      TEST_CONFIG.mockEditionId,
      TEST_CONFIG.mockTotalPages
    );
    
    if (result === false && progressUpdateCalled && statusUpdateCalled) {
      console.log('  🎯 RESULT: CORRECTLY FAILED - Atomic operation failed despite progress success');
      console.log('  🛡️  FIX VERIFIED: No more silent partial failures!\n');
      return true;
    } else if (result !== false) {
      console.log('  ❌ RESULT: BUG STILL EXISTS - Should have failed when status update failed');
      console.log('  🚨 OLD BEHAVIOR: This would cause books to show 100% progress but "Currently Reading" status\n');
      return false;
    } else {
      console.log('  ❌ RESULT: UNEXPECTED - Check test setup\n');
      return false;
    }
  } catch (error) {
    console.log(`  🎯 RESULT: CORRECTLY FAILED - ${error.message}\n`);
    return true;
  }
}

/**
 * Test 4: Audiobook format test
 */
async function testAudiobookScenario() {
  console.log('📋 Test 4: Audiobook Format');
  console.log('Testing audiobook completion with seconds...');
  
  const client = createTestClient({
    getBookCurrentProgress: async () => ({
      latest_read: { id: TEST_CONFIG.mockReadId }
    }),
    
    _executeQuery: async (mutation, variables) => {
      if (mutation.includes('progress_seconds')) {
        console.log('  ✅ Progress update: SUCCESS (audiobook format)');
        return {
          update_user_book_read: {
            user_book_read: {
              id: TEST_CONFIG.mockReadId,
              progress_seconds: TEST_CONFIG.mockTotalSeconds,
              finished_at: '2024-01-15',
              edition_id: TEST_CONFIG.mockEditionId
            }
          }
        };
      }
      return null;
    },
    
    updateBookStatus: async () => {
      console.log('  ✅ Status update: SUCCESS');
      return { id: TEST_CONFIG.mockUserBookId, status_id: 3 };
    }
  });
  
  try {
    const result = await client.markBookCompleted(
      TEST_CONFIG.mockUserBookId,
      TEST_CONFIG.mockEditionId,
      TEST_CONFIG.mockTotalSeconds,
      true, // useSeconds = true for audiobook
      '2024-01-15',
      '2024-01-01'
    );
    
    if (result && result.progress_seconds === TEST_CONFIG.mockTotalSeconds) {
      console.log('  🎯 RESULT: SUCCESS - Audiobook marked as completed\n');
      return true;
    } else {
      console.log('  ❌ RESULT: FAILED - Audiobook completion failed\n');
      return false;
    }
  } catch (error) {
    console.log(`  ❌ RESULT: ERROR - ${error.message}\n`);
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  const tests = [
    testSuccessScenario,
    testProgressFailureScenario,
    testStatusFailureScenario,
    testAudiobookScenario
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    const result = await test();
    if (result) {
      passed++;
    } else {
      failed++;
    }
  }
  
  console.log('📊 Test Results');
  console.log('===============');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! The atomic completion fix is working correctly.');
    console.log('🛡️  Books will no longer get stuck in "Currently Reading" status when completed.');
  } else {
    console.log('\n🚨 Some tests failed! The fix may not be working as expected.');
    console.log('🔍 Review the failed tests above to identify issues.');
  }
  
  return failed === 0;
}

// Run the tests
runAllTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
