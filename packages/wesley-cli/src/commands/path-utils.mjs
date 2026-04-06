import path from 'node:path';

export function joinPath(...parts) {
  const filtered = parts
    .filter((part) => part != null && String(part).length > 0)
    .map((part) => String(part));

  return filtered.length === 0 ? '' : path.posix.join(...filtered);
}
