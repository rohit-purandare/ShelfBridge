export function formatLine({ char = '=', width = 50, newline = false } = {}) {
  const line = char.repeat(width);
  return newline ? `\n${line}` : line;
}

export function formatHeader(
  title,
  { char = '═', width = 50, duration = null, newline = false } = {},
) {
  const line = formatLine({ char, width, newline });
  const titleText = duration ? `${title} (${duration})` : title;
  return [line, titleText, formatLine({ char, width })];
}

export function formatSection(title, { char = '-' } = {}) {
  return [title, formatLine({ char, width: title.length })];
}
