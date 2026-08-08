import { calculateTextSimilarity, normalizeTitle } from './text-matching.js';

const COLLECTION_TITLE_PATTERN =
  /\b(?:box(?:ed)?\s+set|collection(?:\s+set)?|omnibus|bundle|(?:two|three|four|five|six|seven|eight|nine|\d+)\s+books?)\b/i;

function normalizeBaseTitle(title) {
  return normalizeTitle(String(title).split(/[-:–—]/, 1)[0]);
}

/**
 * Check that an identifier result still resembles the source work. Identifier
 * metadata can be attached to the wrong Hardcover record, so it should not
 * bypass basic book-level title validation.
 */
export function isIdentifierTitlePlausible(sourceTitle, candidateTitle) {
  if (!sourceTitle || !candidateTitle) return true;

  const normalizedSource = normalizeTitle(sourceTitle);
  const normalizedCandidate = normalizeTitle(candidateTitle);
  if (!normalizedSource || !normalizedCandidate) return true;
  if (normalizedSource === normalizedCandidate) return true;

  const sourceIsCollection = COLLECTION_TITLE_PATTERN.test(sourceTitle);
  const candidateIsCollection = COLLECTION_TITLE_PATTERN.test(candidateTitle);
  if (candidateIsCollection && !sourceIsCollection) return false;

  const sourceBase = normalizeBaseTitle(sourceTitle);
  const candidateBase = normalizeBaseTitle(candidateTitle);
  if (sourceBase && sourceBase === candidateBase) return true;

  return (
    calculateTextSimilarity(normalizedSource, normalizedCandidate, 'title') >=
    0.55
  );
}
