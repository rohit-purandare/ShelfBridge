import { normalizeAuthor } from './text-matching.js';
import {
  hasConflictingExplicitWorkParts,
  isCanonicalTitleReductionSafe,
  isCollectionTitle,
  normalizeIdentityTitle,
  normalizeWorkTitle,
} from './book-title-identity.js';

function getCandidateAuthorNames(searchResult) {
  const contributions = [
    ...(searchResult?.contributions || []),
    ...(searchResult?.book?.contributions || []),
  ];
  const contributionNames = contributions
    .map(contribution =>
      contribution?.person?.name || contribution?.author?.name,
    )
    .filter(Boolean);

  if (contributionNames.length > 0) return contributionNames;
  if (Array.isArray(searchResult?.author_names)) {
    return searchResult.author_names.filter(Boolean);
  }
  return searchResult?.author ? [searchResult.author] : [];
}

function hasAuthorOverlap(targetAuthor, candidateAuthors) {
  const normalizedTarget = normalizeAuthor(targetAuthor || '');
  if (!normalizedTarget) return false;

  return candidateAuthors.some(candidateAuthor => {
    const normalizedCandidate = normalizeAuthor(candidateAuthor);
    if (normalizedCandidate.length < 4) return false;
    return (
      normalizedTarget.includes(normalizedCandidate) ||
      normalizedCandidate.includes(normalizedTarget)
    );
  });
}

/**
 * Identify deterministic title/author evidence that is safe to use alongside
 * the configured fuzzy score. This does not lower the score threshold: it only
 * handles exact work titles obscured by source subtitles or missing Hardcover
 * author metadata.
 */
export function evaluateStrongBookIdentity(
  searchResult,
  targetTitle,
  targetAuthor,
) {
  const candidateTitle = searchResult?.title || '';
  const sourceTitle = normalizeIdentityTitle(targetTitle);
  const candidateIdentityTitle = normalizeIdentityTitle(candidateTitle);
  const sourceWorkTitle = normalizeWorkTitle(targetTitle);

  const fullTitleMatch =
    !!sourceTitle && sourceTitle === candidateIdentityTitle;
  const canonicalTitleMatch =
    !!sourceWorkTitle && sourceWorkTitle === candidateIdentityTitle;
  const safeCanonicalTitleMatch =
    canonicalTitleMatch && isCanonicalTitleReductionSafe(targetTitle);
  const titleMatch = fullTitleMatch || safeCanonicalTitleMatch;
  const collectionConflict =
    isCollectionTitle(candidateTitle) && !isCollectionTitle(targetTitle);
  const explicitWorkPartConflict = hasConflictingExplicitWorkParts(
    targetTitle,
    candidateTitle,
  );

  const candidateAuthors = getCandidateAuthorNames(searchResult);
  const authorOverlap = hasAuthorOverlap(targetAuthor, candidateAuthors);
  const candidateAuthorMissing = candidateAuthors.length === 0;
  const titleWords = candidateIdentityTitle.split(/\s+/).filter(Boolean);
  const distinctiveExactTitle =
    fullTitleMatch &&
    candidateIdentityTitle.length >= 15 &&
    titleWords.length >= 3;

  const matches =
    titleMatch &&
    !collectionConflict &&
    !explicitWorkPartConflict &&
    (authorOverlap || (candidateAuthorMissing && distinctiveExactTitle));

  let reason = 'insufficient deterministic evidence';
  if (explicitWorkPartConflict) {
    reason = 'source and candidate have conflicting volume or part numbers';
  } else if (collectionConflict) {
    reason = 'candidate is a collection but source is a single work';
  } else if (!titleMatch) {
    reason = canonicalTitleMatch
      ? 'canonical title reduction discarded an unverified work suffix'
      : 'candidate is neither the exact nor canonical source title';
  } else if (authorOverlap) {
    reason = fullTitleMatch
      ? 'exact title with overlapping author'
      : 'canonical source title with overlapping author';
  } else if (candidateAuthorMissing && distinctiveExactTitle) {
    reason = 'distinctive exact title with missing candidate author metadata';
  } else {
    reason = 'title evidence lacks author support';
  }

  return {
    matches,
    reason,
    fullTitleMatch,
    canonicalTitleMatch,
    safeCanonicalTitleMatch,
    explicitWorkPartConflict,
    authorOverlap,
    candidateAuthorMissing,
  };
}
