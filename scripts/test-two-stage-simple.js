#!/usr/bin/env node

/**
 * Simple Two-Stage Matching Test Runner
 *
 * A lightweight test runner that validates the core two-stage functionality
 * using the existing project structure without requiring additional dependencies.
 */

import { calculateBookIdentificationScore } from '../src/matching/scoring/book-identification-scorer.js';
import { selectBestEdition } from '../src/matching/edition-selector.js';
import { detectUserBookFormat } from '../src/matching/utils/audiobookshelf-extractor.js';

class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, testFn) {
    this.tests.push({ name, testFn });
  }

  assertEqual(actual, expected, message = '') {
    if (actual !== expected) {
      throw new Error(
        `Assertion failed: ${message}\n  Expected: ${expected}\n  Actual: ${actual}`,
      );
    }
  }

  assertTrue(value, message = '') {
    if (!value) {
      throw new Error(
        `Assertion failed: ${message}\n  Expected truthy value, got: ${value}`,
      );
    }
  }

  assertGreaterThan(actual, expected, message = '') {
    if (actual <= expected) {
      throw new Error(
        `Assertion failed: ${message}\n  Expected ${actual} > ${expected}`,
      );
    }
  }

  assertLessThan(actual, expected, message = '') {
    if (actual >= expected) {
      throw new Error(
        `Assertion failed: ${message}\n  Expected ${actual} < ${expected}`,
      );
    }
  }

  assertNotNull(value, message = '') {
    if (value === null || value === undefined) {
      throw new Error(
        `Assertion failed: ${message}\n  Expected non-null value, got: ${value}`,
      );
    }
  }

  async run() {
    console.log('🚀 Running Two-Stage Matching Core Tests');
    console.log('==========================================\n');

    for (const test of this.tests) {
      try {
        console.log(`🧪 Running: ${test.name}`);
        await test.testFn();
        console.log(`✅ PASSED: ${test.name}`);
        this.passed++;
      } catch (error) {
        console.log(`❌ FAILED: ${test.name}`);
        console.log(`   Error: ${error.message}\n`);
        this.failed++;
      }
    }

    console.log('\n📊 Test Results');
    console.log('================');
    console.log(`Total Tests: ${this.tests.length}`);
    console.log(`Passed: ${this.passed}`);
    console.log(`Failed: ${this.failed}`);
    console.log(
      `Success Rate: ${((this.passed / this.tests.length) * 100).toFixed(1)}%`,
    );

    if (this.failed === 0) {
      console.log(
        '\n🎉 All core tests passed! Two-stage matching system is working correctly.',
      );
    } else {
      console.log('\n⚠️  Some tests failed. Please review the errors above.');
    }

    return this.failed === 0;
  }
}

const runner = new TestRunner();

// Book Identification Scorer Tests
runner.test('Book Identification - Perfect Match', () => {
  const searchResult = {
    title: 'The Laws of the Skies',
    author_names: ['Gregoire Courtois'],
    activity: 100,
  };

  const result = calculateBookIdentificationScore(
    searchResult,
    'The Laws of the Skies',
    'Gregoire Courtois',
    {},
  );

  runner.assertGreaterThan(
    result.totalScore,
    70,
    'Perfect match should have high score',
  );
  runner.assertTrue(result.isBookMatch, 'Should be identified as a book match');
  runner.assertEqual(result.confidence, 'high', 'Should have high confidence');
});

runner.test('Book Identification - Score Overflow Protection', () => {
  const extremeResult = {
    title: 'Perfect Match',
    author_names: ['Perfect Author'],
    series: [{ name: 'Perfect Series', sequence: 1 }],
    activity: 100000,
    publication_year: 2023,
  };

  const result = calculateBookIdentificationScore(
    extremeResult,
    'Perfect Match',
    'Perfect Author',
    {
      series: [{ name: 'Perfect Series', sequence: 1 }],
      publicationYear: 2023,
    },
  );

  runner.assertLessThan(
    result.totalScore,
    100.1,
    'Score should be capped at 100',
  );
  runner.assertGreaterThan(
    result.totalScore,
    90,
    'Perfect match should still be very high',
  );
});

runner.test('Book Identification - Null Input Handling', () => {
  const result = calculateBookIdentificationScore(
    null,
    'Test Title',
    'Test Author',
  );

  runner.assertEqual(
    result.totalScore,
    0,
    'Null input should return zero score',
  );
  runner.assertEqual(
    result.isBookMatch,
    false,
    'Null input should not be a match',
  );
  runner.assertEqual(
    result.confidence,
    'none',
    'Null input should have no confidence',
  );
});

// Edition Selector Tests
runner.test('Edition Selection - Format Preference', () => {
  const mockBook = {
    id: 'test_book',
    title: 'Test Book',
    editions: [
      {
        id: 'audiobook_edition',
        reading_format: { format: 'audiobook' },
        users_count: 100,
        audio_seconds: 43200,
      },
      {
        id: 'ebook_edition',
        reading_format: { format: 'ebook' },
        users_count: 150,
        pages: 300,
      },
    ],
  };

  const result = selectBestEdition(mockBook, { duration: 43200 }, 'audiobook');

  runner.assertNotNull(result, 'Should select an edition');
  runner.assertEqual(
    result.edition.id,
    'audiobook_edition',
    'Should prefer audiobook for audiobook user',
  );
});

runner.test('Edition Selection - Fallback Logic', () => {
  const bookWithoutAudiobook = {
    id: 'ebook_only_book',
    title: 'Ebook Only Book',
    editions: [
      {
        id: 'ebook_edition',
        reading_format: { format: 'ebook' },
        users_count: 100,
        pages: 300,
      },
    ],
  };

  const result = selectBestEdition(
    bookWithoutAudiobook,
    { duration: 43200 },
    'audiobook',
  );

  runner.assertNotNull(
    result,
    'Should select an edition even without preferred format',
  );
  runner.assertEqual(
    result.edition.id,
    'ebook_edition',
    'Should fall back to ebook',
  );
});

runner.test('Edition Selection - Empty Editions', () => {
  const emptyBook = {
    id: 'empty_book',
    title: 'Empty Book',
    editions: [],
  };

  const result = selectBestEdition(emptyBook, {}, 'audiobook');

  runner.assertEqual(
    result,
    null,
    'Should return null for book with no editions',
  );
});

// Format Detection Tests
runner.test('Format Detection - Audiobook Detection', () => {
  const audiobookMetadata = {
    duration: 43200,
    narrator: 'Test Narrator',
  };

  const result = detectUserBookFormat(audiobookMetadata);

  runner.assertEqual(
    result,
    'audiobook',
    'Should detect audiobook from duration and narrator',
  );
});

runner.test('Format Detection - Ebook Detection', () => {
  const ebookMetadata = {
    format: 'epub',
    pages: 350,
  };

  const result = detectUserBookFormat(ebookMetadata);

  runner.assertEqual(
    result,
    'ebook',
    'Should detect ebook from format and pages',
  );
});

runner.test('Format Detection - Default Fallback', () => {
  const result = detectUserBookFormat({});

  runner.assertEqual(
    result,
    'ebook',
    'Should default to ebook for empty metadata',
  );
});

runner.test('Format Detection - Null Input', () => {
  const result = detectUserBookFormat(null);

  runner.assertEqual(result, 'ebook', 'Should default to ebook for null input');
});

// Integration Test - "The Laws of the Skies" Scenario
runner.test('Integration - Laws of the Skies Scenario', () => {
  const mockSearchResult = {
    id: 'book_511122',
    title: 'The Laws of the Skies',
    author_names: ['Gregoire Courtois'],
    activity: 45,
    editions: [
      {
        id: 'edition_audiobook',
        reading_format: { format: 'audiobook' },
        users_count: 45,
        audio_seconds: 43200,
        asin: 'B123456789',
      },
    ],
  };

  const audiobookshelfMetadata = {
    title: 'The Laws of the Skies',
    author: 'Gregoire Courtois',
    duration: 43200,
    narrator: 'Test Narrator',
  };

  // Stage 1: Book Identification
  const bookScore = calculateBookIdentificationScore(
    mockSearchResult,
    audiobookshelfMetadata.title,
    audiobookshelfMetadata.author,
    audiobookshelfMetadata,
  );

  runner.assertGreaterThan(
    bookScore.totalScore,
    70,
    'Laws of the Skies should pass book identification',
  );
  runner.assertTrue(
    bookScore.isBookMatch,
    'Should be identified as a book match',
  );

  // Stage 2: Edition Selection
  const editionResult = selectBestEdition(
    mockSearchResult,
    audiobookshelfMetadata,
    detectUserBookFormat(audiobookshelfMetadata),
  );

  runner.assertNotNull(editionResult, 'Should select an edition');
  runner.assertEqual(
    editionResult.edition.id,
    'edition_audiobook',
    'Should select the audiobook edition',
  );

  console.log(
    `   📈 Book Identification Score: ${bookScore.totalScore.toFixed(1)}%`,
  );
  console.log(
    `   📚 Selected Edition: ${editionResult.edition.id} (${editionResult.edition.reading_format.format})`,
  );
});

// Performance Test
runner.test('Performance - Scoring Operations', () => {
  const testData = {
    title: 'Performance Test Book',
    author_names: ['Performance Author'],
    activity: 1000,
  };

  const iterations = 1000;
  const startTime = performance.now();

  for (let i = 0; i < iterations; i++) {
    calculateBookIdentificationScore(
      testData,
      'Performance Test Book',
      'Performance Author',
      {},
    );
  }

  const endTime = performance.now();
  const averageTime = (endTime - startTime) / iterations;

  runner.assertLessThan(
    averageTime,
    2,
    'Average scoring time should be less than 2ms',
  );

  console.log(`   ⚡ Average scoring time: ${averageTime.toFixed(3)}ms`);
});

// Run all tests
runner
  .run()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Test runner failed:', error.message);
    process.exit(1);
  });
