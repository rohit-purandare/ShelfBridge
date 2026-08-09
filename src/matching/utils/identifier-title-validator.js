import { calculateTextSimilarity } from './text-matching.js';
import {
  hasConflictingExplicitWorkParts,
  isCollectionTitle,
  normalizeIdentityTitle,
  normalizeWorkTitle,
} from './book-title-identity.js';

/**
 * Check that an identifier result still resembles the source work. Identifier
 * metadata can be attached to the wrong Hardcover record, so it should not
 * bypass basic book-level title validation.
 */
export function isIdentifierTitlePlausible(sourceTitle, candidateTitle) {
  if (!sourceTitle || !candidateTitle) return true;
  if (hasConflictingExplicitWorkParts(sourceTitle, candidateTitle)) {
    return false;
  }

  const normalizedSource = normalizeIdentityTitle(sourceTitle);
  const normalizedCandidate = normalizeIdentityTitle(candidateTitle);
  if (!normalizedSource || !normalizedCandidate) return true;
  if (normalizedSource === normalizedCandidate) return true;

  const sourceIsCollection = isCollectionTitle(sourceTitle);
  const candidateIsCollection = isCollectionTitle(candidateTitle);
  if (candidateIsCollection && !sourceIsCollection) return false;

  const sourceBase = normalizeWorkTitle(sourceTitle);
  const candidateBase = normalizeWorkTitle(candidateTitle);
  if (sourceBase && sourceBase === candidateBase) return true;

  return (
    calculateTextSimilarity(normalizedSource, normalizedCandidate, 'title') >=
    0.55
  );
}
