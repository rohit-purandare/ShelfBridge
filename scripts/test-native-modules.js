#!/usr/bin/env node

/**
 * Native Module Compatibility Test
 * 
 * This script tests whether all required native modules are working correctly.
 * Run this to diagnose issues without going through the full Docker startup.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

console.log('🔍 ShelfBridge Native Module Compatibility Test');
console.log('='.repeat(50));

// System information
console.log('\n📋 System Information:');
console.log(`Node.js version: ${process.version}`);
console.log(`Platform: ${process.platform}`);
console.log(`Architecture: ${process.arch}`);
console.log(`Working directory: ${process.cwd()}`);

// List of native modules we depend on
const nativeModules = [
    {
        name: 'better-sqlite3',
        test: () => {
            const Database = require('better-sqlite3');
            
            // Test 1: In-memory database creation (basic test)
            const memDb = new Database(':memory:');
            memDb.exec('CREATE TABLE test (id INTEGER)');
            memDb.close();
            
            // Test 2: File database creation (matches real app usage)
            const fs = require('fs');
            const path = require('path');
            const tmpDir = '/tmp';
            const testDbPath = path.join(tmpDir, 'test-native-modules.db');
            
            // Clean up any existing test file
            try {
                fs.unlinkSync(testDbPath);
            } catch (e) {
                // File doesn't exist, that's fine
            }
            
            // Test actual file database creation (this is what fails in the app)
            const fileDb = new Database(testDbPath);
            fileDb.exec('CREATE TABLE books (id INTEGER PRIMARY KEY, title TEXT)');
            fileDb.prepare('INSERT INTO books (title) VALUES (?)').run('Test Book');
            
            const result = fileDb.prepare('SELECT * FROM books WHERE title = ?').get('Test Book');
            if (!result || result.title !== 'Test Book') {
                throw new Error('Database operation failed');
            }
            
            fileDb.close();
            
            // Clean up test file
            try {
                fs.unlinkSync(testDbPath);
            } catch (e) {
                // Cleanup failed, but test passed
            }
            
            return true;
        }
    }
];

console.log('\n🧪 Testing Native Modules:');
console.log('-'.repeat(30));

let allPassed = true;

for (const module of nativeModules) {
    try {
        console.log(`\n📦 Testing ${module.name}...`);
        
        // Test module loading
        const startTime = Date.now();
        const result = module.test();
        const loadTime = Date.now() - startTime;
        
        if (result) {
            console.log(`   ✅ ${module.name}: OK (${loadTime}ms)`);
        } else {
            console.log(`   ❌ ${module.name}: Test failed`);
            allPassed = false;
        }
    } catch (error) {
        console.log(`   ❌ ${module.name}: FAILED`);
        console.log(`   📝 Error: ${error.message}`);
        
        // Additional debugging for common issues
        if (error.message.includes('NODE_MODULE_VERSION')) {
            console.log('   💡 This is a Node.js version mismatch. Rebuild required.');
        } else if (error.message.includes('cannot open shared object file')) {
            console.log('   💡 Missing system dependencies. Install build tools.');
        } else if (error.message.includes('GLIBC')) {
            console.log('   💡 libc version mismatch. Check container base image.');
        }
        
        allPassed = false;
    }
}

console.log('\n' + '='.repeat(50));

if (allPassed) {
    console.log('🎉 All native modules are working correctly!');
    console.log('✅ ShelfBridge should start without issues.');
    process.exit(0);
} else {
    console.log('❌ One or more native modules failed to load.');
    console.log('\n🔧 Suggested fixes:');
    console.log('1. Rebuild native modules: npm rebuild');
    console.log('2. Clear cache and reinstall: rm -rf node_modules package-lock.json && npm install');
    console.log('3. For Docker: rebuild with --no-cache');
    console.log('4. Check system dependencies (python3, make, g++)');
    process.exit(1);
} 