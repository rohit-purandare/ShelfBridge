import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/**
 * Debug Second Progress Check
 *
 * This test debugs the issue where the second progress check fails
 * for books that skip early optimization due to null identifier.
 */

describe('Debug Second Progress Check', () => {
  it('should trace the identifier setting logic for title/author books', () => {
    console.log('\n🔍 DEBUGGING SECOND PROGRESS CHECK ISSUE\n');

    // Simulate the scenario where early optimization skips a title/author book
    console.log('📚 SCENARIO: Title/author book that skipped early optimization');

    const identifiers = { isbn: null, asin: null }; // No identifiers
    const hardcoverMatch = null; // Null because early optimization skipped matching

    console.log(`  Identifiers: ${JSON.stringify(identifiers)}`);
    console.log(`  Hardcover match: ${hardcoverMatch}`);

    // This is the logic from sync-manager.js lines 956-957
    let identifier = identifiers.asin || identifiers.isbn;
    let identifierType = identifiers.asin ? 'asin' : 'isbn';

    console.log(`\n🔄 STEP 1: Initial identifier setting`);
    console.log(`  identifier = identifiers.asin || identifiers.isbn = ${identifier}`);
    console.log(`  identifierType = identifiers.asin ? 'asin' : 'isbn' = ${identifierType}`);

    // This is the logic from sync-manager.js lines 959-965
    if (!identifier && hardcoverMatch) {
      // This WON'T run because hardcoverMatch is null!
      identifier = 'title_author:would_be_generated';
      identifierType = 'title_author';
      console.log(`  ✅ Would set title/author identifier`);
    } else {
      console.log(`  ❌ Title/author identifier NOT set because:`);
      console.log(`    - identifier exists: ${!!identifier}`);
      console.log(`    - hardcoverMatch exists: ${!!hardcoverMatch}`);
      console.log(`    - Condition (!identifier && hardcoverMatch): ${!identifier && hardcoverMatch}`);
    }

    console.log(`\n🔄 STEP 2: Final identifier values for second progress check`);
    console.log(`  identifier: ${identifier}`);
    console.log(`  identifierType: ${identifierType}`);

    console.log(`\n🚨 PROBLEM IDENTIFIED:`);
    if (identifier === null) {
      console.log(`  ❌ identifier is null - second progress check will fail!`);
      console.log(`  ❌ This could cause the book to be re-processed incorrectly`);
    } else {
      console.log(`  ✅ identifier is set correctly`);
    }

    console.log(`\n💡 SOLUTION NEEDED:`);
    console.log(`  - Set title/author identifier even when hardcoverMatch is null`);
    console.log(`  - Ensure second progress check has valid identifier for all books`);
    console.log(`  - Handle early-optimized books correctly in subsequent logic`);
  });

  it('should show the correct fix for identifier setting', () => {
    console.log('\n🔧 DEMONSTRATING THE CORRECT FIX\n');

    const identifiers = { isbn: null, asin: null };
    const hardcoverMatch = null; // Early optimization skipped matching
    const title = 'Test Book';
    const author = 'Test Author';

    console.log('📚 Book details:');
    console.log(`  Title: "${title}"`);
    console.log(`  Author: "${author}"`);
    console.log(`  Identifiers: ${JSON.stringify(identifiers)}`);
    console.log(`  Hardcover match: ${hardcoverMatch}`);

    // CURRENT LOGIC (BROKEN):
    let identifier = identifiers.asin || identifiers.isbn;
    let identifierType = identifiers.asin ? 'asin' : 'isbn';

    if (!identifier && hardcoverMatch) {
      // This won't run for early-optimized books!
      identifier = 'would_set_title_author';
      identifierType = 'title_author';
    }

    console.log(`\n❌ CURRENT LOGIC RESULT:`);
    console.log(`  identifier: ${identifier}`);
    console.log(`  identifierType: ${identifierType}`);

    // FIXED LOGIC (SHOULD BE):
    let fixedIdentifier = identifiers.asin || identifiers.isbn;
    let fixedIdentifierType = identifiers.asin ? 'asin' : 'isbn';

    if (!fixedIdentifier) {
      // Set title/author identifier regardless of hardcoverMatch status
      // We have the title and author, so we can always generate this
      fixedIdentifier = `title_author:${title.toLowerCase().replace(/\\s+/g, '_')}|${author.toLowerCase().replace(/\\s+/g, '_')}`;
      fixedIdentifierType = 'title_author';
    }

    console.log(`\n✅ FIXED LOGIC RESULT:`);
    console.log(`  identifier: ${fixedIdentifier}`);
    console.log(`  identifierType: ${fixedIdentifierType}`);

    assert.strictEqual(fixedIdentifier !== null, true, 'Fixed identifier should never be null');
    assert.strictEqual(fixedIdentifierType === 'title_author', true, 'Should use title_author type for books without identifiers');

    console.log(`\n🎯 THE FIX:`);
    console.log(`  Change the condition from:`);
    console.log(`    if (!identifier && hardcoverMatch)`);
    console.log(`  To:`);
    console.log(`    if (!identifier) // Remove hardcoverMatch dependency`);
  });
});