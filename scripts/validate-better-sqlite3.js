#!/usr/bin/env node

/**
 * Comprehensive better-sqlite3 Validation Script
 *
 * This script performs extensive testing of better-sqlite3 functionality
 * to ensure the module works correctly in all scenarios.
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, unlinkSync } from 'fs';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('🔍 Comprehensive better-sqlite3 Validation');
console.log('='.repeat(60));

let Database;
let testsPassed = 0;
let testsFailed = 0;

function runTest(testName, testFn) {
  process.stdout.write(`${testName}... `);
  try {
    testFn();
    console.log('✅ PASS');
    testsPassed++;
  } catch (error) {
    console.log('❌ FAIL');
    console.log(`   Error: ${error.message}`);
    testsFailed++;
  }
}

async function validateBetterSqlite3() {
  // Test 1: Module Loading
  runTest('Module loading', () => {
    Database = require('better-sqlite3');
    if (typeof Database !== 'function') {
      throw new Error('better-sqlite3 did not export a constructor function');
    }
  });

  // Test 2: In-memory database creation
  runTest('In-memory database creation', () => {
    const db = new Database(':memory:');
    if (!db) throw new Error('Failed to create in-memory database');
    db.close();
  });

  // Test 3: File database creation
  const testDbPath = '/tmp/test-validation.db';
  runTest('File database creation', () => {
    // Clean up any existing test file
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }

    const db = new Database(testDbPath);
    if (!db) throw new Error('Failed to create file database');
    db.close();

    if (!existsSync(testDbPath)) {
      throw new Error('Database file was not created');
    }
  });

  // Test 4: Table creation and schema operations
  runTest('Table creation and schema operations', () => {
    const db = new Database(':memory:');

    // Create tables with various column types
    db.exec(`
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE,
                age INTEGER,
                balance REAL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                active BOOLEAN DEFAULT 1
            )
        `);

    db.exec(`
            CREATE TABLE posts (
                id INTEGER PRIMARY KEY,
                user_id INTEGER,
                title TEXT,
                content TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        `);

    // Check if tables were created
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all();
    const tableNames = tables.map(t => t.name);

    if (!tableNames.includes('users') || !tableNames.includes('posts')) {
      throw new Error('Tables were not created properly');
    }

    db.close();
  });

  // Test 5: Basic CRUD operations
  runTest('Basic CRUD operations', () => {
    const db = new Database(':memory:');

    db.exec(`
            CREATE TABLE test_crud (
                id INTEGER PRIMARY KEY,
                name TEXT,
                value INTEGER
            )
        `);

    // INSERT
    const insertStmt = db.prepare(
      'INSERT INTO test_crud (name, value) VALUES (?, ?)',
    );
    const result = insertStmt.run('test1', 100);
    if (result.changes !== 1) throw new Error('Insert failed');

    // SELECT
    const selectStmt = db.prepare('SELECT * FROM test_crud WHERE name = ?');
    const row = selectStmt.get('test1');
    if (!row || row.name !== 'test1' || row.value !== 100) {
      throw new Error('Select failed');
    }

    // UPDATE
    const updateStmt = db.prepare(
      'UPDATE test_crud SET value = ? WHERE name = ?',
    );
    const updateResult = updateStmt.run(200, 'test1');
    if (updateResult.changes !== 1) throw new Error('Update failed');

    // Verify update
    const updatedRow = selectStmt.get('test1');
    if (updatedRow.value !== 200) throw new Error('Update verification failed');

    // DELETE
    const deleteStmt = db.prepare('DELETE FROM test_crud WHERE name = ?');
    const deleteResult = deleteStmt.run('test1');
    if (deleteResult.changes !== 1) throw new Error('Delete failed');

    // Verify delete
    const deletedRow = selectStmt.get('test1');
    if (deletedRow !== undefined) throw new Error('Delete verification failed');

    db.close();
  });

  // Test 6: Prepared statements and parameter binding
  runTest('Prepared statements and parameter binding', () => {
    const db = new Database(':memory:');

    db.exec(`
            CREATE TABLE test_params (
                id INTEGER PRIMARY KEY,
                text_val TEXT,
                int_val INTEGER,
                real_val REAL,
                blob_val BLOB
            )
        `);

    const stmt = db.prepare(`
            INSERT INTO test_params (text_val, int_val, real_val, blob_val) 
            VALUES (?, ?, ?, ?)
        `);

    // Test different data types
    const testData = [
      ['hello world', 42, 3.14159, Buffer.from('binary data')],
      ['unicode: 你好世界', -100, -2.5, Buffer.from([1, 2, 3, 4])],
      [null, null, null, null], // Test NULL values
    ];

    testData.forEach((data, index) => {
      const result = stmt.run(...data);
      if (result.changes !== 1) {
        throw new Error(`Failed to insert test data row ${index + 1}`);
      }
    });

    // Verify data
    const selectAll = db.prepare('SELECT * FROM test_params ORDER BY id').all();
    if (selectAll.length !== testData.length) {
      throw new Error('Not all test data was inserted');
    }

    db.close();
  });

  // Test 7: Transaction support
  runTest('Transaction support', () => {
    const db = new Database(':memory:');

    db.exec(`
            CREATE TABLE test_transactions (
                id INTEGER PRIMARY KEY,
                value INTEGER
            )
        `);

    const insertStmt = db.prepare(
      'INSERT INTO test_transactions (value) VALUES (?)',
    );

    // Test successful transaction
    const successTransaction = db.transaction(() => {
      insertStmt.run(1);
      insertStmt.run(2);
      insertStmt.run(3);
    });

    successTransaction();

    const count1 = db
      .prepare('SELECT COUNT(*) as count FROM test_transactions')
      .get().count;
    if (count1 !== 3) throw new Error('Successful transaction failed');

    // Test rollback on error
    const failTransaction = db.transaction(() => {
      insertStmt.run(4);
      insertStmt.run(5);
      throw new Error('Intentional error for rollback test');
    });

    try {
      failTransaction();
      throw new Error('Transaction should have failed');
    } catch (error) {
      if (error.message !== 'Intentional error for rollback test') {
        throw error;
      }
    }

    const count2 = db
      .prepare('SELECT COUNT(*) as count FROM test_transactions')
      .get().count;
    if (count2 !== 3) throw new Error('Transaction rollback failed');

    db.close();
  });

  // Test 8: Large data handling
  runTest('Large data handling', () => {
    const db = new Database(':memory:');

    db.exec(`
            CREATE TABLE test_large (
                id INTEGER PRIMARY KEY,
                large_text TEXT,
                large_blob BLOB
            )
        `);

    // Create large text (1MB)
    const largeText = 'A'.repeat(1024 * 1024);

    // Create large blob (1MB)
    const largeBlob = Buffer.alloc(1024 * 1024, 0xff);

    const insertStmt = db.prepare(
      'INSERT INTO test_large (large_text, large_blob) VALUES (?, ?)',
    );
    const result = insertStmt.run(largeText, largeBlob);

    if (result.changes !== 1) throw new Error('Failed to insert large data');

    const selectStmt = db.prepare('SELECT * FROM test_large WHERE id = ?');
    const row = selectStmt.get(result.lastInsertRowid);

    if (
      !row ||
      row.large_text.length !== largeText.length ||
      row.large_blob.length !== largeBlob.length
    ) {
      throw new Error('Large data verification failed');
    }

    db.close();
  });

  // Test 9: Concurrent access simulation
  runTest('Concurrent access simulation', () => {
    const db = new Database(':memory:');

    db.exec(`
            CREATE TABLE test_concurrent (
                id INTEGER PRIMARY KEY,
                thread_id INTEGER,
                operation_id INTEGER
            )
        `);

    const insertStmt = db.prepare(
      'INSERT INTO test_concurrent (thread_id, operation_id) VALUES (?, ?)',
    );

    // Simulate multiple "threads" performing operations
    for (let thread = 1; thread <= 5; thread++) {
      for (let op = 1; op <= 100; op++) {
        insertStmt.run(thread, op);
      }
    }

    const totalCount = db
      .prepare('SELECT COUNT(*) as count FROM test_concurrent')
      .get().count;
    if (totalCount !== 500) throw new Error('Concurrent operations failed');

    // Verify data integrity
    const threadCounts = db
      .prepare(
        `
            SELECT thread_id, COUNT(*) as count 
            FROM test_concurrent 
            GROUP BY thread_id 
            ORDER BY thread_id
        `,
      )
      .all();

    if (
      threadCounts.length !== 5 ||
      threadCounts.some(tc => tc.count !== 100)
    ) {
      throw new Error('Concurrent data integrity check failed');
    }

    db.close();
  });

  // Test 10: Error handling and edge cases
  runTest('Error handling and edge cases', () => {
    const db = new Database(':memory:');

    // Test SQL syntax error
    try {
      db.exec('INVALID SQL SYNTAX');
      throw new Error('Should have thrown syntax error');
    } catch (error) {
      if (!error.message.includes('syntax error')) {
        throw new Error('Unexpected error type for syntax error');
      }
    }

    // Test constraint violation
    db.exec(`
            CREATE TABLE test_constraints (
                id INTEGER PRIMARY KEY,
                unique_value TEXT UNIQUE
            )
        `);

    const insertStmt = db.prepare(
      'INSERT INTO test_constraints (unique_value) VALUES (?)',
    );
    insertStmt.run('test');

    try {
      insertStmt.run('test'); // Should fail due to unique constraint
      throw new Error('Should have thrown constraint error');
    } catch (error) {
      if (!error.message.includes('UNIQUE constraint failed')) {
        throw new Error('Unexpected error type for constraint violation');
      }
    }

    db.close();
  });

  // Clean up test files
  if (existsSync(testDbPath)) {
    unlinkSync(testDbPath);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`📊 Test Results: ${testsPassed} passed, ${testsFailed} failed`);

  if (testsFailed === 0) {
    console.log('🎉 ALL TESTS PASSED - better-sqlite3 is fully functional!');
    console.log('✅ The module is ready for production use.');
    process.exit(0);
  } else {
    console.log('❌ SOME TESTS FAILED - better-sqlite3 has issues!');
    console.log('🚨 Do not deploy - fix the issues above.');
    process.exit(1);
  }
}

// Run validation
validateBetterSqlite3().catch(error => {
  console.error('💥 Validation script failed:', error);
  process.exit(1);
});

// Ensure process exits properly
process.exit(0);
