/**
 * TTD Canonical Hasher
 *
 * Provides deterministic hashing for TTD schema fragments and maps the
 * public TTD schema hash onto the shared core canonical schema hash.
 */

import { defaultCrypto } from '../ports/crypto.mjs';
import { schemaHashWithCrypto } from '../domain/schemaHash.mjs';

/**
 * Compute SHA-256 hash of a string
 * @param {string} str - String to hash
 * @param {Object} deps - Dependencies
 * @param {import('../ports/crypto.mjs').CryptoPort} deps.crypto - Crypto port
 */
export function hashString(str, deps = {}) {
  const crypto = deps.crypto ?? defaultCrypto;
  return crypto.sha256(str);
}

/**
 * Canonicalize an object by sorting keys recursively
 */
export function canonicalizeObject(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => canonicalizeObject(item));
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  const sortedKeys = Object.keys(obj).sort();
  const result = {};

  for (const key of sortedKeys) {
    const value = obj[key];
    if (value !== undefined) {
      result[key] = canonicalizeObject(value);
    }
  }

  return result;
}

/**
 * Hash a type definition
 * @param {Object} typeDef - Type definition to hash
 * @param {Object} deps - Dependencies
 * @param {import('../ports/crypto.mjs').CryptoPort} deps.crypto - Crypto port
 */
export function hashType(typeDef, deps = {}) {
  // Sort fields by name for consistent hashing
  const normalized = {
    name: typeDef.name,
    fields: [...(typeDef.fields || [])].sort((a, b) => a.name.localeCompare(b.name))
  };

  const canonical = canonicalizeObject(normalized);
  return hashString(JSON.stringify(canonical), deps);
}

/**
 * Hash an operation definition
 * @param {Object} op - Operation to hash
 * @param {Object} deps - Dependencies
 * @param {import('../ports/crypto.mjs').CryptoPort} deps.crypto - Crypto port
 */
export function hashOp(op, deps = {}) {
  // Sort args by name for consistent hashing
  const normalized = {
    name: op.name,
    args: [...(op.args || [])].sort((a, b) => a.name.localeCompare(b.name)),
    resultType: op.resultType
  };

  const canonical = canonicalizeObject(normalized);
  return hashString(JSON.stringify(canonical), deps);
}

/**
 * Hash a channel definition
 * @param {Object} channel - Channel to hash
 * @param {Object} deps - Dependencies
 * @param {import('../ports/crypto.mjs').CryptoPort} deps.crypto - Crypto port
 */
export function hashChannel(channel, deps = {}) {
  // Sort event types for consistent hashing
  const normalized = {
    name: channel.name,
    version: channel.version,
    eventTypes: [...(channel.eventTypes || [])].sort(),
    ordered: channel.ordered,
    persistent: channel.persistent
  };

  const canonical = canonicalizeObject(normalized);
  return hashString(JSON.stringify(canonical), deps);
}

/**
 * Hash a GraphQL SDL schema
 *
 * The hash is computed from the shared canonical AST payload, which means:
 * - Whitespace differences are ignored
 * - Comment differences are ignored
 * - Field and definition order differences are ignored
 * - Equivalent extend-type forms hash identically
 * - The structure and content are preserved
 *
 * @param {string} sdl - GraphQL SDL to hash
 * @param {Object} deps - Dependencies
 * @param {import('../ports/crypto.mjs').CryptoPort} deps.crypto - Crypto port
 */
export function hashSchema(sdl, deps = {}) {
  const crypto = deps.crypto ?? defaultCrypto;
  return schemaHashWithCrypto(sdl, crypto);
}
