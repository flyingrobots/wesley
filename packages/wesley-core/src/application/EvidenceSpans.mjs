export function lineSpanForContent(content) {
  const normalized = normalizeContent(content);
  const lineCount = countContentLines(normalized);
  return `1-${lineCount}`;
}

export function parseLineSpan(lines) {
  if (Array.isArray(lines) && lines.length >= 2) {
    const start = Number(lines[0]);
    const end = Number(lines[1]);
    if (Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= start) {
      return { start, end };
    }
    return null;
  }

  const value = String(lines ?? '').trim();
  const match = /^(\d+)-(\d+)$/.exec(value);
  if (!match) return null;

  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
    return null;
  }
  return { start, end };
}

export function isExactLineSpan(lines) {
  return parseLineSpan(lines) !== null;
}

export function extractContentForLineSpan(content, lines) {
  const range = parseLineSpan(lines);
  if (!range) return null;

  const visibleLines = toVisibleLines(content);
  if (range.end > visibleLines.length) return null;
  return visibleLines.slice(range.start - 1, range.end).join('\n');
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

function toVisibleLines(content) {
  const normalized = normalizeContent(content);
  if (normalized.length === 0) return [''];
  const lines = normalized.split('\n');
  return normalized.endsWith('\n') ? lines.slice(0, -1) : lines;
}
