import { BookCache } from './book-cache.js';

// Test 1: Basic resource cleanup
console.log('=== Test 1: Basic Resource Cleanup ===');
const cache1 = new BookCache();

try {
    await cache1.storeEditionMapping(
        'test-user',
        '1234567890',
        'Test Book',
        1,
        'isbn',
        'Test Author'
    );
    console.log('✅ Dummy record inserted successfully');
} catch (error) {
    console.error('❌ Error inserting record:', error.message);
} finally {
    cache1.close();
    console.log('✅ Database connection closed in finally block');
}

// Test 2: Error scenario resource cleanup  
console.log('\n=== Test 2: Error Scenario Cleanup ===');
const cache2 = new BookCache();

try {
    // Force an error by passing invalid data
    await cache2.storeEditionMapping(
        null, // Invalid user_id
        '1234567890',
        'Test Book',
        1,
        'isbn',
        'Test Author'
    );
} catch (error) {
    console.log('✅ Expected error caught:', error.message);
} finally {
    cache2.close();
    console.log('✅ Database connection closed even after error');
}

console.log('\n=== Resource Leak Tests Completed ==='); 