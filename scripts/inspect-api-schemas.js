#!/usr/bin/env node
/**
 * Schema Inspection Script
 *
 * This script helps inspect actual API response structures from Hardcover
 * to understand what data is available and fix integration issues.
 */

import { HardcoverClient } from '../src/hardcover-client.js';
import { config } from '../src/config.js';
import logger from '../src/logger.js';

async function inspectSchemas() {
  console.log('🔍 Hardcover API Schema Inspection');
  console.log('='.repeat(50));

  const globalConfig = await config.load();
  const testUser = globalConfig.users[0];

  if (!testUser) {
    console.log('❌ No users configured. Please add a user to config.yaml');
    return;
  }

  const hardcover = new HardcoverClient(testUser.hardcover_token);

  console.log(`\n📚 Testing with user: ${testUser.id}`);

  // Test 1: Search by ASIN structure
  console.log('\n1️⃣ Testing searchBooksByAsin structure');
  console.log('-'.repeat(40));

  try {
    const asinResults = await hardcover.searchBooksByAsin('B09RQ3RD3K'); // Cleopatra ASIN
    console.log(`Results count: ${asinResults.length}`);

    if (asinResults.length > 0) {
      const firstResult = asinResults[0];
      console.log('First result structure:');
      console.log(`  - id: ${firstResult.id}`);
      console.log(
        `  - format: ${firstResult.format || firstResult.reading_format?.format || 'N/A'}`,
      );
      console.log(`  - hasBook: ${!!firstResult.book}`);
      console.log(`  - book.id: ${firstResult.book?.id || 'MISSING'}`);
      console.log(`  - book.title: ${firstResult.book?.title || 'MISSING'}`);
      console.log('\nComplete structure:');
      console.log(JSON.stringify(firstResult, null, 2));
    }
  } catch (error) {
    console.log(`❌ ASIN search failed: ${error.message}`);
  }

  // Test 2: Search by ISBN structure
  console.log('\n2️⃣ Testing searchBooksByIsbn structure');
  console.log('-'.repeat(40));

  try {
    const isbnResults = await hardcover.searchBooksByIsbn('9781635578362'); // Cleopatra ISBN
    console.log(`Results count: ${isbnResults.length}`);

    if (isbnResults.length > 0) {
      const firstResult = isbnResults[0];
      console.log('First result structure:');
      console.log(`  - id: ${firstResult.id}`);
      console.log(
        `  - format: ${firstResult.format || firstResult.reading_format?.format || 'N/A'}`,
      );
      console.log(`  - hasBook: ${!!firstResult.book}`);
      console.log(`  - book.id: ${firstResult.book?.id || 'MISSING'}`);
      console.log(`  - book.title: ${firstResult.book?.title || 'MISSING'}`);
      console.log('\nComplete structure:');
      console.log(JSON.stringify(firstResult, null, 2));
    }
  } catch (error) {
    console.log(`❌ ISBN search failed: ${error.message}`);
  }

  // Test 3: Book ID lookup from edition
  console.log('\n3️⃣ Testing getBookIdFromEdition');
  console.log('-'.repeat(40));

  try {
    const bookInfo = await hardcover.getBookIdFromEdition(30420670); // Cleopatra edition ID
    console.log('Book lookup result:');
    console.log(`  - bookId: ${bookInfo?.bookId || 'MISSING'}`);
    console.log(`  - title: ${bookInfo?.title || 'MISSING'}`);
    console.log(`  - hasEdition: ${!!bookInfo?.edition}`);
    console.log('\nComplete structure:');
    console.log(JSON.stringify(bookInfo, null, 2));
  } catch (error) {
    console.log(`❌ Book ID lookup failed: ${error.message}`);
  }

  // Test 4: User library structure
  console.log('\n4️⃣ Testing user library structure');
  console.log('-'.repeat(40));

  try {
    const userBooks = await hardcover.getUserBooks();
    console.log(`User library count: ${userBooks.length}`);

    // Find Cleopatra in user library
    const cleopatraInLibrary = userBooks.find(
      book =>
        book.book?.title?.includes('Cleopatra') ||
        book.book?.editions?.some(ed => ed.id === 30420670),
    );

    if (cleopatraInLibrary) {
      console.log('\nCleopatra found in user library:');
      console.log(`  - userBook.id: ${cleopatraInLibrary.id}`);
      console.log(`  - book.id: ${cleopatraInLibrary.book?.id}`);
      console.log(`  - book.title: ${cleopatraInLibrary.book?.title}`);
      console.log(
        `  - editions count: ${cleopatraInLibrary.book?.editions?.length || 0}`,
      );

      if (cleopatraInLibrary.book?.editions?.length > 0) {
        cleopatraInLibrary.book.editions.forEach((ed, i) => {
          console.log(
            `    Edition ${i + 1}: id=${ed.id}, format=${ed.reading_format?.format || ed.physical_format || 'unknown'}`,
          );
        });
      }
    } else {
      console.log('❌ Cleopatra NOT found in user library');
      console.log('   This explains why userBookId was null!');
    }
  } catch (error) {
    console.log(`❌ User library lookup failed: ${error.message}`);
  }

  console.log('\n🎯 Schema Inspection Complete');
  console.log('   Use this data to understand why auto-add and lookups fail');
}

// Run the inspection
inspectSchemas().catch(error => {
  console.error('❌ Schema inspection failed:', error.message);
  process.exit(1);
});
