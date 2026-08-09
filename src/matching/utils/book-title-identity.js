import { normalizeTitle } from './text-matching.js';

const AUDIOBOOK_ANNOTATION_PATTERN =
  /\s*[[(]\s*(?:abridged|audio\s+drama|audio\s+edition|audiobook|dramatized\s+adaptation|full\s+cast(?:\s+production)?|graphic\s*audio|unabridged)\s*[\])]/gi;

const SAFE_CANONICAL_SUFFIX_PATTERN =
  /(?:\b(?:anniversary|special|revised|updated|expanded)\s+edition\b|\b(?:archive|chronicles|cycle|prequel|quartet|saga|series|trilogy)\b|^(?:a|an)\s+.+\b(?:adventure|novel|story)\b)/i;
const SPLIT_AUDIO_PART_PATTERN = /[[(]\s*\d+\s+of\s+\d+\s*[\])]/i;
const AUDIOBOOK_ANNOTATION_TEST_PATTERN =
  /[[(]\s*(?:abridged|audio\s+drama|audio\s+edition|audiobook|dramatized\s+adaptation|full\s+cast(?:\s+production)?|graphic\s*audio|unabridged)\s*[\])]/i;

export const COLLECTION_TITLE_PATTERN =
  /\b(?:box(?:ed)?\s+set|collection(?:\s+set)?|omnibus|bundle|(?:two|three|four|five|six|seven|eight|nine|\d+)\s+books?)\b/i;

export function stripAudiobookAnnotations(title) {
  return String(title || '').replace(AUDIOBOOK_ANNOTATION_PATTERN, ' ').trim();
}

export function normalizeIdentityTitle(title) {
  return normalizeTitle(stripAudiobookAnnotations(title));
}

export function normalizeWorkTitle(title) {
  const withoutAnnotations = stripAudiobookAnnotations(title);
  return normalizeTitle(withoutAnnotations.split(/[-:–—]/, 1)[0]);
}

export function isCanonicalTitleReductionSafe(title) {
  const rawTitle = String(title || '');
  const separatorIndex = rawTitle.search(/[-:–—]/);
  if (separatorIndex < 0) return true;

  const prefix = rawTitle.slice(0, separatorIndex);
  const suffix = rawTitle.slice(separatorIndex + 1).trim();
  if (!suffix) return false;

  return (
    AUDIOBOOK_ANNOTATION_TEST_PATTERN.test(prefix) ||
    SPLIT_AUDIO_PART_PATTERN.test(prefix) ||
    SAFE_CANONICAL_SUFFIX_PATTERN.test(suffix)
  );
}

export function isCollectionTitle(title) {
  return COLLECTION_TITLE_PATTERN.test(String(title || ''));
}
