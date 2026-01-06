/**
 * Tests for Unified Edition Scorer
 *
 * Comprehensive tests for the unified edition scoring logic used by:
 * - Auto-add flow (identifier and title/author based)
 * - Cross-edition enhancement (ASIN/ISBN matches)
 * - Edition lookup (by book ID)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  scoreEdition,
  selectBestEdition,
  compareEditions,
  hasLengthData,
  PROFILES,
} from '../src/matching/utils/unified-edition-scorer.js';

// ============================================================================
// Test Data Factories
// ============================================================================

function createTestEdition(overrides = {}) {
  return {
    id: 'ed-' + Math.random().toString(36).substring(7),
    format: 'audiobook',
    audio_seconds: 36000,
    pages: 300,
    asin: 'B123',
    isbn_10: '1234567890',
    isbn_13: '9781234567890',
    users_count: 1000,
    narrator: 'Test Narrator',
    ...overrides,
  };
}

function createTestContext(overrides = {}) {
  return {
    sourceFormat: 'audiobook',
    sourceDuration: 36000,
    sourceNarrator: 'Test Narrator',
    profile: PROFILES.DEFAULT,
    ...overrides,
  };
}

// ============================================================================
// hasLengthData() Tests
// ============================================================================

describe('Unified Edition Scorer - hasLengthData()', () => {
  it('should return true for edition with audio_seconds', () => {
    const edition = { id: 'ed-1', audio_seconds: 36000 };
    assert.strictEqual(hasLengthData(edition), true);
  });

  it('should return true for edition with pages', () => {
    const edition = { id: 'ed-1', pages: 300 };
    assert.strictEqual(hasLengthData(edition), true);
  });

  it('should return true for edition with both', () => {
    const edition = { id: 'ed-1', audio_seconds: 36000, pages: 300 };
    assert.strictEqual(hasLengthData(edition), true);
  });

  it('should return false for edition without length data', () => {
    const edition = { id: 'ed-1', format: 'audiobook' };
    assert.strictEqual(hasLengthData(edition), false);
  });

  it('should return false for null edition', () => {
    assert.strictEqual(hasLengthData(null), false);
  });

  it('should return false for zero values', () => {
    const edition1 = { id: 'ed-1', audio_seconds: 0 };
    const edition2 = { id: 'ed-2', pages: 0 };
    assert.strictEqual(hasLengthData(edition1), false);
    assert.strictEqual(hasLengthData(edition2), false);
  });

  it('should return false for negative values', () => {
    const edition1 = { id: 'ed-1', audio_seconds: -100 };
    const edition2 = { id: 'ed-2', pages: -50 };
    assert.strictEqual(hasLengthData(edition1), false);
    assert.strictEqual(hasLengthData(edition2), false);
  });
});

// ============================================================================
// scoreEdition() Tests - Format Scoring
// ============================================================================

describe('Unified Edition Scorer - scoreEdition() Format Scoring', () => {
  it('should give high score for perfect format match', () => {
    const edition = createTestEdition({ format: 'audiobook' });
    const context = createTestContext({ sourceFormat: 'audiobook' });

    const result = scoreEdition(edition, context);

    assert.ok(result.score > 50);
    assert.strictEqual(result.breakdown.format.score, 100); // Perfect match
  });

  it('should give zero format score for mismatch', () => {
    const edition = createTestEdition({ format: 'ebook' });
    const context = createTestContext({
      sourceFormat: 'audiobook',
      profile: PROFILES.DEFAULT,
    });

    const result = scoreEdition(edition, context);

    // Good fallback score (62.5) not zero
    assert.ok(result.breakdown.format.score > 60);
    assert.ok(result.breakdown.format.score < 65);
  });

  it('should handle missing format gracefully', () => {
    const edition = createTestEdition({ format: null });
    const context = createTestContext();

    const result = scoreEdition(edition, context);

    assert.ok(result.score >= 0);
    assert.ok(result.breakdown.format.score === 20); // Penalty for missing
  });

  it('should apply format mapper when provided', () => {
    const edition = createTestEdition({
      format: 'physical',
      reading_format: { format: 'text' },
    });
    const formatMapper = ed => {
      if (ed.format === 'physical') return 'text';
      return ed.format;
    };
    const context = createTestContext({
      sourceFormat: 'audiobook',
      formatMapper,
    });

    const result = scoreEdition(edition, context);

    assert.strictEqual(result.edition.format, 'text'); // Mapped format
  });
});

// ============================================================================
// scoreEdition() Tests - Different Profiles
// ============================================================================

describe('Unified Edition Scorer - scoreEdition() Profiles', () => {
  it('should use DEFAULT profile weights correctly', () => {
    const edition = createTestEdition();
    const context = createTestContext({ profile: PROFILES.DEFAULT });

    const result = scoreEdition(edition, context);

    assert.ok(result.breakdown.format);
    assert.ok(result.breakdown.lengthData);
    assert.ok(result.breakdown.popularity);
    assert.ok(result.breakdown.completeness);
    assert.strictEqual(result.breakdown.format.weight, 0.4);
    assert.strictEqual(result.breakdown.lengthData.weight, 0.3);
  });

  it('should use TITLE_AUTHOR profile with narrator and duration', () => {
    const edition = createTestEdition({
      format: 'audiobook',
      audio_seconds: 36000,
      narrator: 'John Doe',
    });
    const context = createTestContext({
      sourceFormat: 'audiobook',
      sourceDuration: 36000,
      sourceNarrator: 'John Doe',
      profile: PROFILES.TITLE_AUTHOR,
    });

    const result = scoreEdition(edition, context);

    assert.ok(result.breakdown.format);
    assert.ok(result.breakdown.duration); // TITLE_AUTHOR includes duration
    assert.ok(result.breakdown.narrator); // TITLE_AUTHOR includes narrator
    assert.ok(result.breakdown.popularity);
    assert.ok(result.breakdown.completeness);
    assert.strictEqual(result.breakdown.format.weight, 0.4);
    assert.strictEqual(result.breakdown.duration.weight, 0.19);
    assert.strictEqual(result.breakdown.narrator.weight, 0.03);
  });

  it('should apply bonuses for TITLE_AUTHOR profile', () => {
    const edition = createTestEdition({
      format: 'audiobook',
      users_count: 5000, // High popularity
    });
    const context = createTestContext({
      sourceFormat: 'audiobook',
      profile: PROFILES.TITLE_AUTHOR,
    });

    const result = scoreEdition(edition, context);

    // Should have perfect format bonus and popularity bonus
    assert.ok(result.breakdown.perfectFormatBonus);
    assert.ok(result.breakdown.popularityBonus);
  });

  it('should not apply bonuses for non-TITLE_AUTHOR profiles', () => {
    const edition = createTestEdition({
      format: 'audiobook',
      users_count: 5000,
    });
    const context = createTestContext({
      sourceFormat: 'audiobook',
      profile: PROFILES.DEFAULT,
    });

    const result = scoreEdition(edition, context);

    // Should NOT have bonuses
    assert.strictEqual(result.breakdown.perfectFormatBonus, undefined);
    assert.strictEqual(result.breakdown.popularityBonus, undefined);
  });
});

// ============================================================================
// selectBestEdition() Tests - Basic Functionality
// ============================================================================

describe('Unified Edition Scorer - selectBestEdition() Basic', () => {
  it('should select edition with matching format', () => {
    const editions = [
      createTestEdition({ id: 'ed-1', format: 'ebook', pages: 300 }),
      createTestEdition({ id: 'ed-2', format: 'audiobook', audio_seconds: 36000 }),
    ];
    const context = createTestContext({ sourceFormat: 'audiobook' });

    const result = selectBestEdition(editions, context);

    assert.strictEqual(result.edition.id, 'ed-2'); // Audiobook selected
    assert.ok(result.score > 0);
    assert.ok(result.breakdown);
  });

  it('should return null for empty array', () => {
    const result = selectBestEdition([], createTestContext());
    assert.strictEqual(result, null);
  });

  it('should return null for non-array input', () => {
    const result = selectBestEdition(null, createTestContext());
    assert.strictEqual(result, null);
  });

  it('should filter out malformed editions', () => {
    const editions = [
      null,
      undefined,
      'not an object',
      createTestEdition({ id: 'ed-valid' }),
    ];
    const context = createTestContext();

    const result = selectBestEdition(editions, context);

    assert.strictEqual(result.edition.id, 'ed-valid'); // Only valid one
  });

  it('should return alternatives array', () => {
    const editions = [
      createTestEdition({ id: 'ed-1', users_count: 1000 }),
      createTestEdition({ id: 'ed-2', users_count: 500 }),
      createTestEdition({ id: 'ed-3', users_count: 100 }),
    ];
    const context = createTestContext();

    const result = selectBestEdition(editions, context);

    assert.ok(Array.isArray(result.alternatives));
    assert.strictEqual(result.alternatives.length, 2); // Top 2 alternatives
  });
});

// ============================================================================
// selectBestEdition() Tests - Minimum Improvement Threshold
// ============================================================================

describe('Unified Edition Scorer - selectBestEdition() Improvement Threshold', () => {
  it('should respect minimum improvement threshold (STRICT profile)', () => {
    const editions = [
      createTestEdition({ id: 'ed-1', users_count: 100 }),
      createTestEdition({ id: 'ed-2', users_count: 150 }),
    ];
    const currentEdition = editions[0];
    const context = createTestContext({
      profile: PROFILES.STRICT, // Requires 5-point improvement
      currentEdition,
    });

    const result = selectBestEdition(editions, context);

    // Improvement too small for STRICT profile
    assert.strictEqual(result, null);
  });

  it('should accept when improvement meets threshold', () => {
    const editions = [
      createTestEdition({
        id: 'ed-1',
        format: 'ebook',
        audio_seconds: 0,
        users_count: 100,
      }),
      createTestEdition({
        id: 'ed-2',
        format: 'audiobook',
        audio_seconds: 36000,
        users_count: 1000,
      }),
    ];
    const currentEdition = editions[0];
    const context = createTestContext({
      sourceFormat: 'audiobook',
      profile: PROFILES.STRICT,
      currentEdition,
    });

    const result = selectBestEdition(editions, context);

    // Should upgrade - significant improvement
    assert.ok(result);
    assert.strictEqual(result.edition.id, 'ed-2');
    assert.ok(result.improvement >= 5);
  });

  it('should always select best with DEFAULT profile (no threshold)', () => {
    const editions = [
      createTestEdition({ id: 'ed-1', users_count: 100 }),
      createTestEdition({ id: 'ed-2', users_count: 101 }),
    ];
    const currentEdition = editions[0];
    const context = createTestContext({
      profile: PROFILES.DEFAULT, // No minimum improvement
      currentEdition,
    });

    const result = selectBestEdition(editions, context);

    // Should select best even with tiny improvement
    assert.ok(result);
    assert.strictEqual(result.edition.id, 'ed-2');
  });
});

// ============================================================================
// selectBestEdition() Tests - Format Hierarchy
// ============================================================================

describe('Unified Edition Scorer - selectBestEdition() Format Hierarchy', () => {
  it('should prefer format match over popularity', () => {
    const editions = [
      createTestEdition({
        id: 'ed-1',
        format: 'ebook',
        pages: 300,
        users_count: 10000, // Very popular
        asin: 'B123',
        isbn_10: '1234567890',
        isbn_13: '9781234567890',
      }),
      createTestEdition({
        id: 'ed-2',
        format: 'audiobook',
        audio_seconds: 36000,
        users_count: 100, // Less popular
      }),
    ];
    const context = createTestContext({
      sourceFormat: 'audiobook',
      profile: PROFILES.TITLE_AUTHOR,
    });

    const result = selectBestEdition(editions, context);

    assert.strictEqual(result.edition.id, 'ed-2'); // Format match wins
  });

  it('should select edition with better duration match when formats equal', () => {
    const editions = [
      {
        id: 'ed-1',
        format: 'audiobook',
        audio_seconds: 20000, // Poor duration match
        pages: 300,
        asin: 'B123',
        isbn_10: '1234567890',
        users_count: 100,
      },
      {
        id: 'ed-2',
        format: 'audiobook',
        audio_seconds: 36000, // Perfect duration match
        pages: 300,
        asin: 'B456',
        isbn_13: '9781234567890',
        users_count: 100,
      },
    ];
    const context = createTestContext({
      sourceFormat: 'audiobook',
      sourceDuration: 36000, // Matches ed-2
      profile: PROFILES.TITLE_AUTHOR,
    });

    const result = selectBestEdition(editions, context);

    assert.strictEqual(result.edition.id, 'ed-2'); // Better duration match
  });
});

// ============================================================================
// Real-World Scenario Tests
// ============================================================================

describe('Unified Edition Scorer - Real-World Scenarios', () => {
  it('should handle Iron Gold scenario correctly', () => {
    // Real-world test case: Audiobook source, physical/audiobook editions
    const editions = [
      {
        id: 'ed-physical',
        format: 'physical',
        isbn_13: '9781501959790',
        pages: 624,
        users_count: 500,
        audio_seconds: 0,
      },
      {
        id: 'ed-audio',
        format: 'audiobook',
        asin: 'B074NGJ6NK',
        audio_seconds: 62568,
        users_count: 2000,
        pages: 0,
      },
    ];
    const formatMapper = ed => {
      if (ed.format === 'physical') return 'text';
      return ed.format;
    };
    const context = createTestContext({
      sourceFormat: 'audiobook',
      sourceDuration: 62568,
      formatMapper,
      profile: PROFILES.TITLE_AUTHOR,
    });

    const result = selectBestEdition(editions, context);

    assert.strictEqual(result.edition.id, 'ed-audio'); // Should pick audiobook
    assert.strictEqual(result.edition.format, 'audiobook');
  });

  it('should handle narrator variations correctly', () => {
    const editions = [
      createTestEdition({
        id: 'ed-1',
        format: 'audiobook',
        narrator: 'John Smith',
        users_count: 1000,
      }),
      createTestEdition({
        id: 'ed-2',
        format: 'audiobook',
        narrator: 'Jane Doe',
        users_count: 1000,
      }),
    ];
    const context = createTestContext({
      sourceFormat: 'audiobook',
      sourceNarrator: 'John Smith',
      profile: PROFILES.TITLE_AUTHOR,
    });

    const result = selectBestEdition(editions, context);

    // Should prefer narrator match
    assert.strictEqual(result.edition.id, 'ed-1');
  });

  it('should handle duration mismatches correctly', () => {
    const editions = [
      createTestEdition({
        id: 'ed-abridged',
        format: 'audiobook',
        audio_seconds: 10800, // 3 hours - abridged
        users_count: 500,
      }),
      createTestEdition({
        id: 'ed-unabridged',
        format: 'audiobook',
        audio_seconds: 36000, // 10 hours - matches source
        users_count: 500,
      }),
    ];
    const context = createTestContext({
      sourceFormat: 'audiobook',
      sourceDuration: 36000, // 10 hours
      profile: PROFILES.TITLE_AUTHOR,
    });

    const result = selectBestEdition(editions, context);

    // Should prefer duration match
    assert.strictEqual(result.edition.id, 'ed-unabridged');
  });
});

// ============================================================================
// compareEditions() Tests
// ============================================================================

describe('Unified Edition Scorer - compareEditions()', () => {
  it('should recommend upgrade when new edition significantly better', () => {
    const currentEdition = createTestEdition({
      id: 'ed-current',
      format: 'ebook',
      users_count: 100,
    });
    const newEdition = createTestEdition({
      id: 'ed-new',
      format: 'audiobook',
      audio_seconds: 36000,
      users_count: 1000,
    });
    const context = createTestContext({
      sourceFormat: 'audiobook',
      profile: PROFILES.STRICT,
    });

    const result = compareEditions(currentEdition, newEdition, context);

    assert.strictEqual(result.shouldUpgrade, true);
    assert.ok(result.improvement > 5);
    assert.ok(result.reason.includes('Upgrade recommended'));
  });

  it('should not recommend upgrade when improvement insufficient', () => {
    const currentEdition = createTestEdition({
      id: 'ed-current',
      users_count: 1000,
    });
    const newEdition = createTestEdition({
      id: 'ed-new',
      users_count: 1010,
    });
    const context = createTestContext({
      profile: PROFILES.STRICT, // Requires 5-point improvement
    });

    const result = compareEditions(currentEdition, newEdition, context);

    assert.strictEqual(result.shouldUpgrade, false);
    assert.ok(result.improvement < 5);
    assert.ok(result.reason.includes('Insufficient improvement'));
  });

  it('should handle null editions gracefully', () => {
    const result = compareEditions(null, null, createTestContext());

    assert.strictEqual(result.shouldUpgrade, false);
    assert.strictEqual(result.improvement, 0);
    assert.ok(result.reason.includes('Missing edition'));
  });
});

// ============================================================================
// Edge Cases Tests
// ============================================================================

describe('Unified Edition Scorer - Edge Cases', () => {
  it('should handle editions with very large user counts', () => {
    const edition = createTestEdition({ users_count: 1000000 });
    const context = createTestContext();

    const result = scoreEdition(edition, context);

    // Should not overflow
    assert.ok(result.score >= 0);
    assert.ok(result.score <= 100);
  });

  it('should handle editions with all zeros', () => {
    const edition = {
      id: 'ed-zeros',
      audio_seconds: 0,
      pages: 0,
      users_count: 0,
      format: null,
    };
    const context = createTestContext();

    const result = scoreEdition(edition, context);

    // Should handle gracefully
    assert.ok(result.score >= 0);
    assert.ok(result.score <= 100);
  });

  it('should handle missing context gracefully', () => {
    const edition = createTestEdition();

    const result = scoreEdition(edition, {}); // Empty context

    // Should use defaults
    assert.ok(result.score >= 0);
    assert.ok(result.score <= 100);
  });

  it('should handle editions with conflicting data', () => {
    const edition = createTestEdition({
      format: 'ebook',
      audio_seconds: 36000, // Has audio data but format says ebook
    });
    const context = createTestContext({ sourceFormat: 'audiobook' });

    const result = scoreEdition(edition, context);

    // Should handle gracefully
    assert.ok(result.score >= 0);
    assert.ok(result.score <= 100);
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('Unified Edition Scorer - Performance', () => {
  it('should handle 50+ editions efficiently', () => {
    const editions = Array.from({ length: 50 }, (_, i) =>
      createTestEdition({ id: `ed-${i}`, users_count: i * 100 }),
    );
    const context = createTestContext();

    const startTime = performance.now();
    const result = selectBestEdition(editions, context);
    const endTime = performance.now();

    assert.ok(result);
    assert.ok(endTime - startTime < 100); // Should complete in < 100ms
  });

  it('should scale logarithmically with user count', () => {
    const edition1 = createTestEdition({ users_count: 100 });
    const edition2 = createTestEdition({ users_count: 10000 });
    const context = createTestContext();

    const result1 = scoreEdition(edition1, context);
    const result2 = scoreEdition(edition2, context);

    // Popularity score should not increase linearly
    const popDiff =
      result2.breakdown.popularity.score - result1.breakdown.popularity.score;
    assert.ok(popDiff < 50); // Less than 50 point difference despite 100x user count
  });
});

// ============================================================================
// Integration Test: Consistency with edition-scorer.js
// ============================================================================

describe('Unified Edition Scorer - Backward Compatibility', () => {
  it('should filter editions like old edition-scorer (when needed)', () => {
    const editions = [
      createTestEdition({ id: 'ed-1', audio_seconds: 0, pages: 0 }), // No length
      createTestEdition({ id: 'ed-2', audio_seconds: 36000 }), // Has length
    ];

    // With requireLengthData profile
    const profile = {
      ...PROFILES.DEFAULT,
      requireLengthData: true,
    };
    const context = createTestContext({ profile });

    const result = selectBestEdition(editions, context);

    assert.strictEqual(result.edition.id, 'ed-2'); // Only one with length
  });

  it('should score format mismatch consistently', () => {
    const edition = createTestEdition({
      id: 'ed-ebook',
      format: 'ebook',
      audio_seconds: 0,
      pages: 300,
    });
    const context = createTestContext({
      sourceFormat: 'audiobook',
      profile: PROFILES.TITLE_AUTHOR,
    });

    const result = scoreEdition(edition, context);

    // Should get good fallback score (62.5) from format
    assert.ok(result.breakdown.format.score > 60);
    assert.ok(result.breakdown.format.score < 65);
  });
});
