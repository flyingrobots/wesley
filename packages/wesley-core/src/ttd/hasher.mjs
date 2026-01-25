/**
 * TTD Canonical Hasher
 *
 * Provides deterministic hashing for TTD schemas using canonical
 * JSON serialization and SHA-256 hashing.
 */

import { createHash } from 'node:crypto';
import { parse, print } from 'graphql';

/**
 * Compute SHA-256 hash of a string
 */
export function hashString(str) {
  return createHash('sha256').update(str).digest('hex');
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
 */
export function hashType(typeDef) {
  // Sort fields by name for consistent hashing
  const normalized = {
    name: typeDef.name,
    fields: [...(typeDef.fields || [])].sort((a, b) => a.name.localeCompare(b.name)),
  };

  const canonical = canonicalizeObject(normalized);
  return hashString(JSON.stringify(canonical));
}

/**
 * Hash an operation definition
 */
export function hashOp(op) {
  // Sort args by name for consistent hashing
  const normalized = {
    name: op.name,
    args: [...(op.args || [])].sort((a, b) => a.name.localeCompare(b.name)),
    resultType: op.resultType,
  };

  const canonical = canonicalizeObject(normalized);
  return hashString(JSON.stringify(canonical));
}

/**
 * Hash a channel definition
 */
export function hashChannel(channel) {
  // Sort event types for consistent hashing
  const normalized = {
    name: channel.name,
    version: channel.version,
    eventTypes: [...(channel.eventTypes || [])].sort(),
    ordered: channel.ordered,
    persistent: channel.persistent,
  };

  const canonical = canonicalizeObject(normalized);
  return hashString(JSON.stringify(canonical));
}

/**
 * Hash a GraphQL SDL schema
 *
 * The hash is computed from the normalized AST, which means:
 * - Whitespace differences are ignored
 * - Comment differences are ignored
 * - The structure and content are preserved
 */
export function hashSchema(sdl) {
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

  return hashString(normalizedSdl);
}
