import { LINE_CHARS, LINE_WIDTHS } from './display-constants.js';

export function formatLine({
  char = LINE_CHARS.primary,
  width = LINE_WIDTHS.header,
  newline = false,
} = {}) {
  const line = char.repeat(width);
  return newline ? `\n${line}` : line;
}

export function formatHeader(
  title,
  {
    char = LINE_CHARS.heavy,
    width = LINE_WIDTHS.header,
    duration = null,
    newline = false,
  } = {},
) {
  const line = formatLine({ char, width, newline });
  const titleText = duration ? `${title} (${duration})` : title;
  return [line, titleText, formatLine({ char, width })];
}

export function formatSection(title, { char = '-' } = {}) {
  return [title, formatLine({ char, width: title.length })];
}
