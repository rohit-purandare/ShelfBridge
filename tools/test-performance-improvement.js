#!/usr/bin/env node

/**
 * Quick test script to verify HTTP keep-alive performance improvements
 * This script shows the difference between fresh connections vs. reused connections
 */

import { AudiobookshelfClient } from '../src/audiobookshelf-client.js';
import { HardcoverClient } from '../src/hardcover-client.js';
import { Config } from '../src/config.js';

async function testConnectionPerformance() {
    console.log('🔍 Testing HTTP Connection Performance');
    console.log('=====================================\n');

    try {
        const config = new Config();
        const users = config.getUsers();
        
        if (users.length === 0) {
            console.log('❌ No users configured in config.yaml');
            return;
        }

        const user = users[0];
        console.log(`Testing with user: ${user.id}\n`);

        // Test Audiobookshelf performance
        console.log('📚 Audiobookshelf Connection Tests');
        console.log('-'.repeat(40));
        
        const absClient = new AudiobookshelfClient(user.abs_url, user.abs_token, 1, null, 100);
        
        // Test multiple connection calls (simulating sync operations)
        const absTimings = [];
        for (let i = 1; i <= 5; i++) {
            const start = Date.now();
            const connected = await absClient.testConnection();
            const duration = Date.now() - start;
            absTimings.push(duration);
            
            const status = connected ? '✅' : '❌';
            console.log(`  ${i}. Connection test: ${duration}ms ${status}`);
        }
        
        // Clean up
        absClient.cleanup();

        console.log(`\n  Average: ${Math.round(absTimings.reduce((a, b) => a + b) / absTimings.length)}ms`);
        console.log(`  Range: ${Math.min(...absTimings)}ms - ${Math.max(...absTimings)}ms`);

        // Test Hardcover performance
        console.log('\n📖 Hardcover Connection Tests');
        console.log('-'.repeat(40));
        
        const hcClient = new HardcoverClient(user.hardcover_token);
        
        const hcTimings = [];
        for (let i = 1; i <= 5; i++) {
            const start = Date.now();
            const connected = await hcClient.testConnection();
            const duration = Date.now() - start;
            hcTimings.push(duration);
            
            const status = connected ? '✅' : '❌';
            console.log(`  ${i}. Connection test: ${duration}ms ${status}`);
        }
        
        // Clean up
        hcClient.cleanup();

        console.log(`\n  Average: ${Math.round(hcTimings.reduce((a, b) => a + b) / hcTimings.length)}ms`);
        console.log(`  Range: ${Math.min(...hcTimings)}ms - ${Math.max(...hcTimings)}ms`);

        // Analysis
        console.log('\n📊 Performance Analysis');
        console.log('-'.repeat(40));
        
        const absFirstCall = absTimings[0];
        const absSubsequentAvg = absTimings.slice(1).reduce((a, b) => a + b) / (absTimings.length - 1);
        const absSavings = absFirstCall - absSubsequentAvg;

        const hcFirstCall = hcTimings[0];
        const hcSubsequentAvg = hcTimings.slice(1).reduce((a, b) => a + b) / (hcTimings.length - 1);
        const hcSavings = hcFirstCall - hcSubsequentAvg;

        console.log(`Audiobookshelf connection reuse savings:`);
        console.log(`  First call: ${absFirstCall}ms`);
        console.log(`  Subsequent calls avg: ${Math.round(absSubsequentAvg)}ms`);
        console.log(`  Savings per call: ${Math.round(absSavings)}ms (${Math.round((absSavings/absFirstCall)*100)}%)`);

        console.log(`\nHardcover connection reuse savings:`);
        console.log(`  First call: ${hcFirstCall}ms`);
        console.log(`  Subsequent calls avg: ${Math.round(hcSubsequentAvg)}ms`);
        console.log(`  Savings per call: ${Math.round(hcSavings)}ms (${Math.round((hcSavings/hcFirstCall)*100)}%)`);

        console.log('\n💡 Impact for sync operations:');
        console.log('  - Multiple API calls per sync will now reuse connections');
        console.log('  - Especially beneficial for large libraries');
        console.log('  - Should eliminate timing differences between normal and interactive sync');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testConnectionPerformance().catch(console.error); 