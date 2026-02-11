/**
 * Registry Hash Computation (E1.3)
 *
 * Produces a deterministic SHA-256 hex digest of the canonical JSON
 * serialization of a registry data object. Any change to the generated
 * registry output changes the hash; key insertion order does not.
 *
 * Uses globalThis.crypto.subtle (available in Node 18+ and browsers)
 * so @wesley/core remains host-agnostic with zero external deps.
 */

const encoder = new TextEncoder();

/**
 * Recursively serialize a value to canonical JSON.
 *
 * - Object keys are sorted lexicographically at every nesting level
 * - Arrays preserve element order
 * - Compact (no whitespace)
 *
 * @param {*} value - The value to serialize
 * @returns {string} Canonical JSON string
 */
export function canonicalizeJSON(value) {
  return JSON.stringify(value, sortedKeysReplacer);
}

/**
 * JSON.stringify replacer that ensures object keys are sorted
 * at every nesting level for deterministic output.
 *
 * @param {string} _key
 * @param {*} value
 * @returns {*}
 */
function sortedKeysReplacer(_key, value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const sorted = Object.create(null);
    for (const k of Object.keys(value).sort()) {
      sorted[k] = value[k];
    }
    return sorted;
  }
  return value;
}

/**
 * Compute a deterministic SHA-256 hash of a registry data object.
 *
 * The object is serialized to canonical JSON (sorted keys, compact),
 * then hashed with SHA-256. The result is a 64-character lowercase
 * hex string.
 *
 * @param {object} registryData - The registry data object to hash
 * @returns {Promise<string>} 64-char lowercase hex SHA-256 digest
 */
export async function registryHash(registryData) {
  const json = canonicalizeJSON(registryData);
  const bytes = encoder.encode(json);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
