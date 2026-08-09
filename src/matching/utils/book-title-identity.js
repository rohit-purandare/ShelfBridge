import { normalizeTitle } from './text-matching.js';

const AUDIOBOOK_ANNOTATION_PATTERN =
  /\s*[[(]\s*(?:abridged|audio\s+drama|audio\s+edition|audiobook|dramatized\s+adaptation|full\s+cast(?:\s+production)?|graphic\s*audio|unabridged)\s*[\])]/gi;

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
  return normalizeTitle(withoutAnnotations.split(/[:–—]/, 1)[0]);
}

export function isCollectionTitle(title) {
  return COLLECTION_TITLE_PATTERN.test(String(title || ''));
}
