/**
 * Identifier resolution utility
 *
 * Resolves which identifier (ASIN, ISBN, or title_author) to use for a given
 * book, applying priority rules and optional match-type overrides.
 *
 * This consolidates duplicated identifier resolution logic that was repeated
 * across multiple methods in sync-manager.js.
 */

/**
 * Resolve the canonical identifier for a book
 *
 * Priority: asin > isbn > title_author fallback.
 * When matchType indicates a title/author match, forces title_author regardless
 * of available identifiers (to maintain cache consistency).
 *
 * @param {Object} identifiers - { asin: string|null, isbn: string|null } from extractBookIdentifiers()
 * @param {Object} [options={}]
 * @param {string|null} [options.titleAuthorId=null] - Pre-computed cache.generateTitleAuthorIdentifier() result
 * @param {string|null} [options.matchType=null] - hardcoverMatch._matchType value
 * @returns {{ identifierType: string|null, identifierValue: string|null }}
 */
export function resolveBookIdentifier(
  identifiers,
  { titleAuthorId = null, matchType = null } = {},
) {
  // Force title_author for title/author matches (preserves cache consistency)
  if (
    (matchType === 'title_author' || matchType === 'title_author_two_stage') &&
    titleAuthorId
  ) {
    return { identifierType: 'title_author', identifierValue: titleAuthorId };
  }

  // ASIN has highest priority
  const asin = identifiers?.asin;
  if (asin && typeof asin === 'string' && asin.trim() !== '') {
    return { identifierType: 'asin', identifierValue: asin };
  }

  // ISBN is second priority
  const isbn = identifiers?.isbn;
  if (isbn && typeof isbn === 'string' && isbn.trim() !== '') {
    return { identifierType: 'isbn', identifierValue: isbn };
  }

  // Fall back to title_author if provided
  if (titleAuthorId) {
    return { identifierType: 'title_author', identifierValue: titleAuthorId };
  }

  // Nothing available
  return { identifierType: null, identifierValue: null };
}
