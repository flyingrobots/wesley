/**
 * TTD Canonical Hasher
 *
 * Provides deterministic hashing for TTD schemas using canonical
 * JSON serialization and SHA-256 hashing.
 */

import { parse, print } from 'graphql';
import { defaultCrypto } from '../ports/crypto.mjs';

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
    fields: [...(typeDef.fields || [])].sort((a, b) => a.name.localeCompare(b.name)),
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
    resultType: op.resultType,
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
    persistent: channel.persistent,
  };

  const canonical = canonicalizeObject(normalized);
  return hashString(JSON.stringify(canonical), deps);
}

/**
 * Hash a GraphQL SDL schema
 *
 * The hash is computed from the normalized AST, which means:
 * - Whitespace differences are ignored
 * - Comment differences are ignored
 * - The structure and content are preserved
 *
 * @param {string} sdl - GraphQL SDL to hash
 * @param {Object} deps - Dependencies
 * @param {import('../ports/crypto.mjs').CryptoPort} deps.crypto - Crypto port
 */
export function hashSchema(sdl, deps = {}) {
  // Parse and re-print to normalize whitespace and remove comments
  const doc = parse(sdl);

  // Sort definitions by kind and name for deterministic ordering
  const sortedDefs = [...doc.definitions].sort((a, b) => {
    const kindOrder = { EnumTypeDefinition: 0, ObjectTypeDefinition: 1 };
    const kindA = kindOrder[a.kind] ?? 2;
    const kindB = kindOrder[b.kind] ?? 2;

    if (kindA !== kindB) return kindA - kindB;

    const nameA = a.name?.value ?? '';
    const nameB = b.name?.value ?? '';
    return nameA.localeCompare(nameB);
  });

  // Print normalized SDL
  const normalizedSdl = print({
    kind: 'Document',
    definitions: sortedDefs,
  });

  return hashString(normalizedSdl, deps);
}
