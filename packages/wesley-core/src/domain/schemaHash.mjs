/**
 * Schema Hash Computation (E1.2)
 *
 * Produces a deterministic SHA-256 hex digest of the canonical AST bytes.
 * Any semantic change to the schema changes the hash; formatting, field
 * order, and comments do not.
 *
 * Uses globalThis.crypto.subtle (available in Node 18+ and browsers)
 * so @wesley/core remains host-agnostic with zero external deps.
 */

import { canonicalize } from './canonicalize.mjs';

/**
 * Compute a deterministic SHA-256 hash of a GraphQL SDL schema.
 *
 * The SDL is first reduced to canonical bytes via `canonicalize()`,
 * then hashed with SHA-256. The result is a 64-character lowercase
 * hex string.
 *
 * @param {string} sdl - GraphQL SDL source text
 * @returns {Promise<string>} 64-char lowercase hex SHA-256 digest
 */
export async function schemaHash(sdl) {
  const bytes = canonicalize(sdl);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
