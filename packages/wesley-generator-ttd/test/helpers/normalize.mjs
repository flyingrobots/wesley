/**
 * Output normalization helpers for deterministic testing
 *
 * Ensures generator outputs can be compared byte-for-byte across runs
 * by normalizing OS-specific differences, timestamps, and formatting.
 */

/**
 * Normalize generator output tree for deterministic comparison
 *
 * @param {Array<{path: string, content: string|Buffer|Uint8Array}>} files
 * @param {Object} options
 * @param {boolean} options.freezeTimestamps - Replace timestamps with placeholder (default: true)
 * @param {boolean} options.canonicalizeJson - Re-serialize JSON with stable ordering (default: true)
 * @returns {Array<{path: string, content: string}>} Normalized files sorted by path
 */
export function normalizeOutputTree(files, options = {}) {
  const {
    freezeTimestamps = true,
    canonicalizeJson = true
  } = options;

  return files
    .map(f => ({
      path: normalizePath(f.path),
      content: normalizeContent(f.content, f.path, { freezeTimestamps, canonicalizeJson })
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Normalize file path (forward slashes, no absolute paths)
 */
function normalizePath(p) {
  // Convert backslashes to forward slashes
  let normalized = p.replace(/\\/g, '/');

  // Strip absolute path prefixes, replace with <ROOT>
  normalized = normalized.replace(/^\/[^/]+\/[^/]+\/[^/]+\//, '<ROOT>/');
  normalized = normalized.replace(/^[A-Z]:\\[^\\]+\\[^\\]+\\/, '<ROOT>/');

  return normalized;
}

/**
 * Normalize file content
 */
function normalizeContent(content, path, options) {
  // Convert Buffer/Uint8Array to string
  let str = coerceToString(content);

  // Normalize line endings to LF
  str = str.replace(/\r\n/g, '\n');

  // Freeze timestamps if requested
  if (options.freezeTimestamps) {
    str = freezeTimestamps(str);
  }

  // Canonicalize JSON if requested and file is JSON
  if (options.canonicalizeJson && isJsonFile(path)) {
    str = canonicalizeJson(str);
  }

  return str;
}

/**
 * Coerce content to string safely
 */
function coerceToString(content) {
  if (typeof content === 'string') {
    return content;
  }
  if (content instanceof Uint8Array || Buffer.isBuffer(content)) {
    return new TextDecoder('utf-8').decode(content);
  }
  if (content === null || content === undefined) {
    return '';
  }
  return String(content);
}

/**
 * Freeze all timestamp patterns with a stable placeholder
 *
 * Handles:
 * - "generatedAt": "2026-01-25T..."
 * - "generated_at": "2026-01-25T..."
 * - "generatedAt": 1700000000
 * - "generatedAtMs": 1700000000000
 * - // Generated at: 2026-01-25
 */
function freezeTimestamps(str) {
  // JSON string timestamps (ISO format)
  str = str.replace(
    /"(generatedAt|generated_at|generatedAtMs|timestamp|createdAt|created_at)":\s*"[0-9T:.\-Z+]+"/gi,
    '"$1": "<TIMESTAMP>"'
  );

  // JSON numeric timestamps (unix seconds or milliseconds)
  str = str.replace(
    /"(generatedAt|generated_at|generatedAtMs|timestamp|createdAt|created_at)":\s*\d{10,13}/gi,
    '"$1": 0'
  );

  // Comment timestamps (// Generated at: ...)
  str = str.replace(
    /\/\/\s*(Generated|Created)\s*(at|on)?:?\s*\d{4}-\d{2}-\d{2}[T\s]?[\d:.\-Z]*/gi,
    '// $1 at: <TIMESTAMP>'
  );

  // Markdown/text timestamps (Generated: 2026-01-25)
  str = str.replace(
    /\b(Generated|Created)\s*(at|on)?:?\s*\d{4}-\d{2}-\d{2}[T\s]?[\d:.\-Z]*/gi,
    '$1 at: <TIMESTAMP>'
  );

  return str;
}

/**
 * Check if file is JSON based on extension
 */
function isJsonFile(path) {
  return /\.json$/i.test(path);
}

/**
 * Canonicalize JSON content
 *
 * - Parse and re-serialize with sorted keys
 * - Use consistent 2-space indentation
 * - Ensure arrays of objects are sorted by 'id', 'name', or 'op_id' if present
 */
function canonicalizeJson(str) {
  try {
    const obj = JSON.parse(str);
    const canonical = sortObjectKeys(obj);
    return JSON.stringify(canonical, null, 2);
  } catch {
    // Not valid JSON, return as-is
    return str;
  }
}

/**
 * Recursively sort object keys and array elements
 */
function sortObjectKeys(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    // Sort array elements if they're objects with sortable keys
    const sorted = obj.map(sortObjectKeys);

    // Try to sort by common identifier fields
    if (sorted.length > 0 && typeof sorted[0] === 'object' && sorted[0] !== null) {
      const sortKey = findSortKey(sorted[0]);
      if (sortKey) {
        sorted.sort((a, b) => {
          const aVal = a[sortKey];
          const bVal = b[sortKey];
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return aVal - bVal;
          }
          return String(aVal).localeCompare(String(bVal));
        });
      }
    }

    return sorted;
  }

  // Sort object keys alphabetically
  const sortedKeys = Object.keys(obj).sort();
  const result = {};
  for (const key of sortedKeys) {
    result[key] = sortObjectKeys(obj[key]);
  }
  return result;
}

/**
 * Find a suitable sort key for array elements
 */
function findSortKey(obj) {
  const candidates = ['id', 'op_id', 'name', 'code', 'path', 'typeName'];
  for (const key of candidates) {
    if (key in obj) {
      return key;
    }
  }
  return null;
}

/**
 * Assert that content contains no absolute paths
 * Throws if absolute paths are found
 */
export function assertNoAbsolutePaths(files) {
  const absolutePathPatterns = [
    /^\/Users\//,
    /^\/home\//,
    /^\/tmp\//,
    /^[A-Z]:\\/,
    /\/var\/folders\//
  ];

  for (const file of files) {
    const content = coerceToString(file.content);
    for (const pattern of absolutePathPatterns) {
      if (pattern.test(content)) {
        throw new Error(
          `Absolute path found in ${file.path}: matches ${pattern}`
        );
      }
    }
  }
}

/**
 * Compare two normalized output trees
 * Returns detailed diff info if different
 */
export function compareOutputTrees(tree1, tree2) {
  const paths1 = new Set(tree1.map(f => f.path));
  const paths2 = new Set(tree2.map(f => f.path));

  const onlyIn1 = [...paths1].filter(p => !paths2.has(p));
  const onlyIn2 = [...paths2].filter(p => !paths1.has(p));
  const common = [...paths1].filter(p => paths2.has(p));

  const contentDiffs = [];
  for (const path of common) {
    const content1 = tree1.find(f => f.path === path).content;
    const content2 = tree2.find(f => f.path === path).content;
    if (content1 !== content2) {
      contentDiffs.push({ path, content1, content2 });
    }
  }

  const identical = onlyIn1.length === 0 && onlyIn2.length === 0 && contentDiffs.length === 0;

  return {
    identical,
    onlyIn1,
    onlyIn2,
    contentDiffs
  };
}
