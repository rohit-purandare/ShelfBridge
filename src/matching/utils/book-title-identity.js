import { normalizeTitle } from './text-matching.js';

const AUDIOBOOK_ANNOTATION_PATTERN =
  /\s*[[(]\s*(?:abridged|audio\s+drama|audio\s+edition|audiobook|dramatized\s+adaptation|full\s+cast(?:\s+production)?|graphic\s*audio|unabridged)\s*[\])]/gi;

const WORK_NUMBER_PATTERN =
  /\b(act|book|bk\.?|part|pt\.?|volume|vol\.?)\s*(\d+|[ivx]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b/gi;

const COLLECTION_SIZE_PATTERN =
  /\b(\d+|two|three|four|five|six|seven|eight|nine)\s+books?\b/i;

export const COLLECTION_TITLE_PATTERN =
  /\b(?:box(?:ed)?\s+set|collection(?:\s+set)?|omnibus|bundle|(?:two|three|four|five|six|seven|eight|nine|\d+)\s+books?)\b/i;

export function stripAudiobookAnnotations(title) {
  return String(title || '')
    .replace(AUDIOBOOK_ANNOTATION_PATTERN, ' ')
    .trim();
}

export function normalizeIdentityTitle(title) {
  return normalizeTitle(stripAudiobookAnnotations(title));
}

export function normalizeWorkTitle(title) {
  const withoutAnnotations = stripAudiobookAnnotations(title);
  return normalizeTitle(withoutAnnotations.split(/[:–—]/, 1)[0]);
}

export function getWorkNumberMarkers(title) {
  return [...String(title || '').matchAll(WORK_NUMBER_PATTERN)]
    .map(([, type, number]) => {
      const normalizedType = {
        bk: 'book',
        pt: 'part',
        vol: 'volume',
      }[type.toLowerCase().replace('.', '')];

      return `${normalizedType || type.toLowerCase()}:${normalizeTitle(number)}`;
    })
    .sort();
}

export function getCollectionSize(title) {
  const match = String(title || '').match(COLLECTION_SIZE_PATTERN);
  return match ? normalizeTitle(match[1]) : null;
}

export function isCollectionTitle(title) {
  return COLLECTION_TITLE_PATTERN.test(String(title || ''));
}
