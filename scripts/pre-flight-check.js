#!/usr/bin/env node

/**
 * Pre-Flight Check Script
 * 
 * Run this before pushing changes to catch issues early and prevent CI failures.
 * This replicates the key checks that CI will perform.
 * ALL TESTS MUST PASS - NO EXCEPTIONS!
 */

import { createRequire } from 'module';
import { spawn, execSync } from 'child_process';
import { existsSync } from 'fs';
const require = createRequire(import.meta.url);

console.log('🚀 ShelfBridge Pre-Flight Check');
console.log('='.repeat(50));
console.log('💡 Run this before pushing to catch issues early');
console.log('⚠️  ALL TESTS MUST PASS - BUILD WILL FAIL OTHERWISE');
console.log('');

let allChecksPassed = true;
const results = [];

// Helper function to run commands and capture output
function runCommand(command, description, timeout = 60000) {
    console.log(`🔍 ${description}...`);
    try {
        const output = execSync(command, { 
            encoding: 'utf8', 
            stdio: 'pipe',
            timeout: timeout
        });
        console.log(`   ✅ ${description}: PASSED`);
        results.push({ check: description, status: 'PASSED', details: 'OK' });
        return true;
    } catch (error) {
        console.log(`   ❌ ${description}: FAILED`);
        console.log(`   📝 Error: ${error.message}`);
        results.push({ 
            check: description, 
            status: 'FAILED', 
            details: error.message.substring(0, 100) + '...' 
        });
        allChecksPassed = false;
        return false;
    }
}

// Helper function to check if files exist
function checkFiles(files, description) {
    console.log(`🔍 ${description}...`);
    const missing = files.filter(file => !existsSync(file));
    if (missing.length === 0) {
        console.log(`   ✅ ${description}: PASSED`);
        results.push({ check: description, status: 'PASSED', details: 'All files present' });
        return true;
    } else {
        console.log(`   ❌ ${description}: FAILED`);
        console.log(`   📝 Missing: ${missing.join(', ')}`);
        results.push({ 
            check: description, 
            status: 'FAILED', 
            details: `Missing: ${missing.join(', ')}` 
        });
        allChecksPassed = false;
        return false;
    }
}

console.log('📦 Checking Dependencies...');
console.log('-'.repeat(30));

// Check if node_modules exists
if (!existsSync('node_modules')) {
    console.log('❌ node_modules not found. Run: npm install');
    process.exit(1);
}

// 1. Native Module Compatibility (CRITICAL)
console.log('\n🧪 CRITICAL: Native Module Tests...');
console.log('-'.repeat(30));
runCommand('npm run test:native', 'Native module compatibility');

// 2. Application Tests (CRITICAL)
console.log('\n🧪 CRITICAL: Application Tests...');
console.log('-'.repeat(30));
runCommand('timeout 60s npm test', 'Application functionality', 65000);

// 3. Cache Functionality (CRITICAL) 
console.log('\n🧪 CRITICAL: Cache Tests...');
console.log('-'.repeat(30));
runCommand('npm run cache -- --show', 'Cache functionality');

// 4. Code Quality Checks (CRITICAL)
console.log('\n🎨 CRITICAL: Code Quality...');
console.log('-'.repeat(30));
runCommand('npm run lint', 'ESLint validation');
runCommand('npm run format:check', 'Prettier formatting');

// 5. Security Checks (CRITICAL)
console.log('\n🔒 CRITICAL: Security...');
console.log('-'.repeat(30));
runCommand('npm audit --audit-level=high', 'Security vulnerabilities');

// 6. Main Entry Point (CRITICAL)
console.log('\n🚀 CRITICAL: Entry Point...');
console.log('-'.repeat(30));
runCommand('node src/main.js --help', 'Main application loads');

// 7. Required Files (CRITICAL)
console.log('\n📋 CRITICAL: Required Files...');
console.log('-'.repeat(30));
checkFiles([
    'config/config.yaml.example',
    'docker-entrypoint.sh',
    'Dockerfile',
    'package.json'
], 'Required project files');

// 8. Docker Validation (CRITICAL if available)
console.log('\n🐳 CRITICAL: Docker Tests...');
console.log('-'.repeat(30));
try {
    execSync('docker --version', { stdio: 'pipe' });
    console.log('🔍 Docker build test...');
    
    // Quick Docker build test (single platform)
    try {
        execSync('docker build -t shelfbridge:test .', { 
            stdio: 'pipe', 
            timeout: 120000 // 2 minute timeout
        });
        console.log('   ✅ Docker build: PASSED');
        results.push({ check: 'Docker build', status: 'PASSED', details: 'Build successful' });
        
        // Test the built image (CRITICAL)
        try {
            execSync(`docker run --rm \\
                -e ABS_URL=https://test.example.com \\
                -e ABS_TOKEN=test_token \\
                -e HARDCOVER_TOKEN=test_token \\
                --entrypoint="" \\
                shelfbridge:test \\
                npm run test:native`, { 
                stdio: 'pipe',
                timeout: 30000 
            });
            console.log('   ✅ Docker native modules: PASSED');
            results.push({ check: 'Docker native modules', status: 'PASSED', details: 'Container test successful' });
        } catch (error) {
            console.log('   ❌ Docker native modules: FAILED');
            console.log(`   📝 Error: ${error.message}`);
            results.push({ 
                check: 'Docker native modules', 
                status: 'FAILED', 
                details: 'Container test failed' 
            });
            allChecksPassed = false;
        }
        
        // Cleanup
        try {
            execSync('docker rmi shelfbridge:test', { stdio: 'pipe' });
        } catch (e) {
            // Cleanup failure is not critical
        }
        
    } catch (error) {
        console.log('   ❌ Docker build: FAILED');
        console.log(`   📝 Error: ${error.message}`);
        results.push({ 
            check: 'Docker build', 
            status: 'FAILED', 
            details: 'Build failed' 
        });
        allChecksPassed = false;
    }
} catch (error) {
    console.log('   ⚠️  Docker not available - will skip in CI too');
    results.push({ check: 'Docker tests', status: 'SKIPPED', details: 'Docker not available' });
}

// Results Summary
console.log('\n' + '='.repeat(50));
console.log('📊 PRE-FLIGHT CHECK RESULTS');
console.log('='.repeat(50));

const passed = results.filter(r => r.status === 'PASSED').length;
const failed = results.filter(r => r.status === 'FAILED').length;
const skipped = results.filter(r => r.status === 'SKIPPED').length;

console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`⏭️  Skipped: ${skipped}`);

if (failed > 0) {
    console.log('\n❌ FAILED CHECKS:');
    results.filter(r => r.status === 'FAILED').forEach(result => {
        console.log(`   • ${result.check}: ${result.details}`);
    });
}

console.log('\n' + '='.repeat(50));

if (allChecksPassed) {
    console.log('🎉 ALL CHECKS PASSED!');
    console.log('✅ Safe to push - CI should pass');
    console.log('🚀 Ready for: git add . && git commit && git push');
    process.exit(0);
} else {
    console.log('❌ SOME CHECKS FAILED!');
    console.log('🚫 DO NOT PUSH - Fix issues first');
    console.log('💡 CI WILL FAIL with these issues');
    console.log('⚠️  NO EXCEPTIONS - ALL TESTS MUST PASS');
    console.log('\n🔧 Common fixes:');
    console.log('   • npm install         (dependency issues)');
    console.log('   • npm run lint:fix     (code quality)');
    console.log('   • npm run format       (formatting)');
    console.log('   • npm rebuild          (native modules)');
    console.log('   • Check error logs above for specific issues');
    process.exit(1);
} 