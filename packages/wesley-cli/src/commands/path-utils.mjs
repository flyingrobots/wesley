import path from 'node:path';

/**
 * Join path segments using POSIX separators.
 *
 * Unlike `path.posix.join()`, this deliberately returns an empty string when
 * every input is nullish or empty after string coercion. That keeps callers
 * from accidentally materializing `.` when no path segments were provided.
 */
export function joinPath(...parts) {
  const filtered = [];
  for (const part of parts) {
    if (part == null) {
      continue;
    }
    const text = String(part);
    if (text.length > 0) {
      filtered.push(text);
    }
  }

  return filtered.length === 0 ? '' : path.posix.join(...filtered);
}

export function canonicalizeSchemaPath(schemaPath) {
  if (schemaPath == null) {
    return null;
  }

  const text = String(schemaPath).trim();
  if (text.length === 0 || text === '-' || text === '<stdin>') {
    return null;
  }

  return path.resolve(text);
}
