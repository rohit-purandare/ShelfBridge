import { calculateTextSimilarity } from './text-matching.js';
import {
  getCollectionSize,
  getWorkNumberMarkers,
  isCollectionTitle,
  normalizeIdentityTitle,
  normalizeWorkTitle,
} from './book-title-identity.js';

const MIN_IDENTIFIER_TITLE_SIMILARITY = 0.75;

/**
 * Check that an identifier result still resembles the source work. Identifier
 * metadata can be attached to the wrong Hardcover record, so it should not
 * bypass basic book-level title validation.
 */
export function isIdentifierTitlePlausible(sourceTitle, candidateTitle) {
  if (!sourceTitle || !candidateTitle) return true;

  const sourceWorkNumbers = getWorkNumberMarkers(sourceTitle);
  const candidateWorkNumbers = getWorkNumberMarkers(candidateTitle);
  if (
    sourceWorkNumbers.length > 0 &&
    candidateWorkNumbers.length > 0 &&
    sourceWorkNumbers.join('|') !== candidateWorkNumbers.join('|')
  ) {
    return false;
  }

  const sourceIsCollection = isCollectionTitle(sourceTitle);
  const candidateIsCollection = isCollectionTitle(candidateTitle);
  if (sourceIsCollection !== candidateIsCollection) return false;

  const sourceCollectionSize = getCollectionSize(sourceTitle);
  const candidateCollectionSize = getCollectionSize(candidateTitle);
  if (
    sourceCollectionSize &&
    candidateCollectionSize &&
    sourceCollectionSize !== candidateCollectionSize
  ) {
    return false;
  }

  const normalizedSource = normalizeIdentityTitle(sourceTitle);
  const normalizedCandidate = normalizeIdentityTitle(candidateTitle);
  if (!normalizedSource || !normalizedCandidate) return true;
  if (normalizedSource === normalizedCandidate) return true;

  const sourceBase = normalizeWorkTitle(sourceTitle);
  const candidateBase = normalizeWorkTitle(candidateTitle);
  if (
    sourceBase &&
    sourceBase === candidateBase &&
    (normalizedSource === sourceBase || normalizedCandidate === candidateBase)
  ) {
    return true;
  }

  return (
    calculateTextSimilarity(normalizedSource, normalizedCandidate, 'title') >=
    MIN_IDENTIFIER_TITLE_SIMILARITY
  );
}
