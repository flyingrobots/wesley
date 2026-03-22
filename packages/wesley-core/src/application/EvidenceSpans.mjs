export function lineSpanForContent(content) {
  const normalized = normalizeContent(content);
  const lineCount = countContentLines(normalized);
  return `1-${lineCount}`;
}

export function countContentLines(content) {
  const normalized = normalizeContent(content);
  if (normalized.length === 0) return 1;

  const segmentCount = normalized.split('\n').length;
  const trailingTerminator = normalized.endsWith('\n') ? 1 : 0;
  return Math.max(1, segmentCount - trailingTerminator);
}

function normalizeContent(content) {
  return String(content ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}
