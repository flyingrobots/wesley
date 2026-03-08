/**
 * Hash Chain Computation (E1.4)
 *
 * Produces a full provenance hash chain tracing SDL → canonical AST →
 * IR → registry → output bundle.  Every stage is SHA-256 (64-char
 * lowercase hex), computed via globalThis.crypto.subtle so @wesley/core
 * stays host-agnostic with zero external deps.
 */

import { canonicalizeJSON } from './registryHash.mjs';

const encoder = new TextEncoder();

/**
 * Convert a SHA-256 ArrayBuffer to a 64-char lowercase hex string.
 *
 * @param {ArrayBuffer} buf
 * @returns {string}
 */
function hexFromBuffer(buf) {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Compute SHA-256 of raw SDL bytes (exact bytes, no normalization).
 *
 * @param {string} sdl - Raw SDL source text
 * @returns {Promise<string>} 64-char lowercase hex SHA-256 digest
 */
export async function computeSdlHash(sdl) {
  const bytes = encoder.encode(sdl);
  const buf = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return hexFromBuffer(buf);
}

/**
 * Compute SHA-256 of IR data using canonical JSON serialization.
 *
 * Canonical JSON: sorted keys at every level, compact (no whitespace),
 * no trailing newline, UTF-8 encoded.
 *
 * @param {object} irData - The IR data object
 * @returns {Promise<string>} 64-char lowercase hex SHA-256 digest
 */
export async function computeIrHash(irData) {
  const json = canonicalizeJSON(irData);
  const bytes = encoder.encode(json);
  const buf = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return hexFromBuffer(buf);
}

/**
 * Compute SHA-256 of the complete output bundle.
 *
 * Algorithm:
 * 1. Sort artifact keys (paths) lexicographically
 * 2. For each path: encode `path + "\0" + contentBytes`
 * 3. Concatenate all segments
 * 4. SHA-256 the concatenation
 *
 * Path separators MUST be `/` (forward slash).
 *
 * @param {Record<string, string | Uint8Array>} artifacts - Map of path → content
 * @returns {Promise<string>} 64-char lowercase hex SHA-256 digest
 */
export async function computeBundleHash(artifacts) {
  const paths = Object.keys(artifacts).sort();

  // Compute total byte length for pre-allocation
  /** @type {Uint8Array[]} */
  const segments = [];

  for (const path of paths) {
    const normalizedPath = path.replace(/\\/g, '/');
    const pathBytes = encoder.encode(normalizedPath + '\0');
    const content = artifacts[path];
    const contentBytes = typeof content === 'string'
      ? encoder.encode(content)
      : content;

    segments.push(pathBytes);
    segments.push(contentBytes);
  }

  // Concatenate all segments
  let totalLength = 0;
  for (const seg of segments) {
    totalLength += seg.byteLength;
  }
  const concatenated = new Uint8Array(totalLength);
  let offset = 0;
  for (const seg of segments) {
    concatenated.set(seg, offset);
    offset += seg.byteLength;
  }

  const buf = await globalThis.crypto.subtle.digest('SHA-256', concatenated);
  return hexFromBuffer(buf);
}

/**
 * Compute the full provenance hash chain.
 *
 * @param {object} params
 * @param {string} params.sdl - Raw SDL input bytes (as string)
 * @param {Uint8Array} params.canonicalBytes - Canonical AST bytes from canonicalize()
 * @param {object} params.irData - IR data object (before hash metadata injection)
 * @param {object} params.registryData - Registry data object
 * @param {Record<string, string | Uint8Array>} params.artifacts - Output bundle artifacts
 * @returns {Promise<{sdl_hash: string, schema_hash: string, ir_hash: string, registry_hash: string, bundle_hash: string}>}
 */
export async function computeHashChain({ sdl, canonicalBytes, irData, registryData, artifacts }) {
  const [sdl_hash, schema_hash_buf, ir_hash, registry_hash_buf, bundle_hash] = await Promise.all([
    computeSdlHash(sdl),
    globalThis.crypto.subtle.digest('SHA-256', canonicalBytes),
    computeIrHash(irData),
    globalThis.crypto.subtle.digest('SHA-256', encoder.encode(canonicalizeJSON(registryData))),
    computeBundleHash(artifacts)
  ]);

  return {
    sdl_hash,
    schema_hash: hexFromBuffer(schema_hash_buf),
    ir_hash,
    registry_hash: hexFromBuffer(registry_hash_buf),
    bundle_hash
  };
}
