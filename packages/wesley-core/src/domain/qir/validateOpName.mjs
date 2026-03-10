/**
 * Shared op name validation and sanitization for QIR operations.
 *
 * Used by both QirPlugin (core) and the CLI's compileOpFile to ensure
 * consistent safety checks: non-empty, no path traversal, valid identifier
 * characters, and byte-length within the dialect's identifier limit.
 *
 * Collision/duplicate detection is the caller's responsibility since it
 * requires tracking state across a batch of operations.
 */

/**
 * Validate a raw op name for safety.
 * Throws if the name is empty, non-string, or contains path-traversal patterns.
 *
 * @param {unknown} name
 * @throws {Error} if the name is invalid
 */
export function assertSafeOpName(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('Op name must be a non-empty string');
  }
  if (/[/\\]|\.\./.test(name)) {
    throw new Error(`Op name "${name}" contains path-traversal characters`);
  }
}

/**
 * Sanitize a raw op name into a safe SQL identifier base.
 * - NFKD-normalizes and strips diacritics
 * - Lowercases, replaces non-alphanumeric runs with underscores
 * - Ensures the result doesn't start with a digit
 * - Falls back to 'unnamed' for empty input
 *
 * @param {string} name
 * @returns {string} sanitized identifier base
 */
export function sanitizeOpName(name) {
  const normalized = (name ?? 'unnamed').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const raw = normalized.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  let sanitized = raw || 'unnamed';
  if (/^[0-9]/.test(sanitized)) sanitized = `_${sanitized}`;
  return sanitized;
}

/**
 * Derive the prefixed SQL identifier (e.g. 'op_my_query') from a sanitized base name.
 *
 * @param {string} baseName - Output of sanitizeOpName()
 * @returns {string} prefixed identifier
 */
export function derivePrefixedOpName(baseName) {
  const normalized = String(baseName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const effective = normalized || 'op';
  const suffix = effective === 'op' ? 'unnamed' : effective;
  return `op_${suffix}`;
}

/**
 * Validate that a sanitized op name and its prefixed form fit within a byte-length limit.
 * Throws with a descriptive message if either exceeds the limit.
 *
 * @param {string} baseName - Output of sanitizeOpName()
 * @param {number} limit - Max byte length (e.g. 63 for PostgreSQL)
 * @param {string} [source] - Optional source path for error context
 * @throws {Error} if either the base or prefixed name exceeds the limit
 */
export function assertOpNameFitsLimit(baseName, limit, source) {
  const baseBytes = byteLength(baseName);
  if (baseBytes > limit) {
    const ctx = source ? ` from ${source}` : '';
    throw Object.assign(
      new Error(`Sanitized op name "${baseName}"${ctx} exceeds identifier limit (bytes=${baseBytes}, limit=${limit})`),
      { code: 'OPS_IDENTIFIER_TOO_LONG', meta: { sanitized: baseName, bytes: baseBytes, limit, file: source } }
    );
  }
  const prefixed = derivePrefixedOpName(baseName);
  const prefixedBytes = byteLength(prefixed);
  if (prefixedBytes > limit) {
    const ctx = source ? ` from ${source}` : '';
    throw Object.assign(
      new Error(`Prefixed op identifier "${prefixed}"${ctx} exceeds identifier limit (bytes=${prefixedBytes}, limit=${limit})`),
      { code: 'OPS_IDENTIFIER_TOO_LONG', meta: { sanitized: prefixed, base: baseName, bytes: prefixedBytes, limit, file: source } }
    );
  }
}

function byteLength(s) {
  // TextEncoder is available in all supported runtimes (Node 18+, Bun, Deno, browsers).
  // Avoids Buffer dependency so this module stays host-agnostic.
  return new TextEncoder().encode(s).byteLength;
}
