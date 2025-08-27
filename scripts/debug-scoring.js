#!/usr/bin/env node

/**
 * Debug Scoring Issues
 *
 * Let's debug what's happening with the scoring calculations
 */

import { calculateBookIdentificationScore } from '../src/matching/scoring/book-identification-scorer.js';
import { calculateTextSimilarity } from '../src/matching/utils/similarity.js';
import {
  normalizeTitle,
  normalizeAuthor,
} from '../src/matching/utils/normalization.js';

console.log('🔍 Debugging Scoring Issues');
console.log('============================\n');

// Test the exact scenario from our failing test
const searchResult = {
  title: 'The Laws of the Skies',
  author_names: ['Gregoire Courtois'],
  activity: 100,
};

const targetTitle = 'The Laws of the Skies';
const targetAuthor = 'Gregoire Courtois';

console.log('📚 Test Data:');
console.log('  Target Title:', targetTitle);
console.log('  Target Author:', targetAuthor);
console.log('  Search Result Title:', searchResult.title);
console.log('  Search Result Author:', searchResult.author_names[0]);
console.log('');

// Test normalization
const normalizedTargetTitle = normalizeTitle(targetTitle);
const normalizedResultTitle = normalizeTitle(searchResult.title);
const normalizedTargetAuthor = normalizeAuthor(targetAuthor);
const normalizedResultAuthor = normalizeAuthor(searchResult.author_names[0]);

console.log('🔧 After Normalization:');
console.log('  Target Title:', normalizedTargetTitle);
console.log('  Result Title:', normalizedResultTitle);
console.log('  Target Author:', normalizedTargetAuthor);
console.log('  Result Author:', normalizedResultAuthor);
console.log('');

// Test similarity calculations
const titleSimilarity = calculateTextSimilarity(
  normalizedTargetTitle,
  normalizedResultTitle,
);
const authorSimilarity = calculateTextSimilarity(
  normalizedTargetAuthor,
  normalizedResultAuthor,
);

console.log('📊 Similarity Scores:');
console.log(
  '  Title Similarity:',
  titleSimilarity.toFixed(4),
  `(${(titleSimilarity * 100).toFixed(1)}%)`,
);
console.log(
  '  Author Similarity:',
  authorSimilarity.toFixed(4),
  `(${(authorSimilarity * 100).toFixed(1)}%)`,
);
console.log('');

// Test the full scoring
const result = calculateBookIdentificationScore(
  searchResult,
  targetTitle,
  targetAuthor,
  {},
);

console.log('🎯 Book Identification Score Result:');
console.log('  Total Score:', result.totalScore.toFixed(2) + '%');
console.log('  Confidence:', result.confidence);
console.log('  Is Book Match:', result.isBookMatch);
console.log('');

console.log('📋 Score Breakdown:');
Object.entries(result.breakdown).forEach(([key, value]) => {
  console.log(
    `  ${key}:`,
    value.score?.toFixed(2) || 'N/A',
    value.weight ? `(weight: ${value.weight})` : '',
    value.reason || value.comparison || '',
  );
});

// Test a simpler case
console.log('\n🧪 Testing Simple Exact Match:');
const simpleResult = calculateTextSimilarity('test', 'test');
console.log(
  '  "test" vs "test":',
  simpleResult,
  `(${(simpleResult * 100).toFixed(1)}%)`,
);

const simpleResult2 = calculateTextSimilarity(
  'The Laws of the Skies',
  'The Laws of the Skies',
);
console.log(
  '  Exact title match:',
  simpleResult2,
  `(${(simpleResult2 * 100).toFixed(1)}%)`,
);

const simpleResult3 = calculateTextSimilarity(
  'Gregoire Courtois',
  'Gregoire Courtois',
);
console.log(
  '  Exact author match:',
  simpleResult3,
  `(${(simpleResult3 * 100).toFixed(1)}%)`,
);
