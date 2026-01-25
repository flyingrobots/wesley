/**
 * TTD AST Types
 *
 * Defines the Abstract Syntax Tree types for TTD protocol schemas.
 */

import { createHash } from 'node:crypto';

/**
 * AST node kinds
 */
export const TtdAstKind = {
  CHANNEL: 'CHANNEL',
  OP: 'OP',
  RULE: 'RULE',
  INVARIANT: 'INVARIANT',
  EMISSION: 'EMISSION',
  FOOTPRINT: 'FOOTPRINT',
  REGISTRY_ENTRY: 'REGISTRY_ENTRY',
  CODEC: 'CODEC',
  STATE_FIELD: 'STATE_FIELD',
  CONSTRAINT: 'CONSTRAINT',
};

/**
 * Compute op_id from namespace and name using SHA-256 hash
 */
function computeOpId(namespace, name) {
  const buf = createHash('sha256').update(`${namespace}:${name}`).digest();
  return buf.readUInt32LE(0);
}

/**
 * Create a Channel AST node
 */
export function createChannel({
  name,
  version = 1,
  eventTypes = [],
  ordered = true,
  persistent = false,
}) {
  return {
    kind: TtdAstKind.CHANNEL,
    name,
    version,
    eventTypes,
    ordered,
    persistent,
  };
}

/**
 * Create an Op AST node
 */
export function createOp({
  name,
  args = [],
  resultType,
  namespace = 'Mutation',
  idempotent = false,
  readonly = false,
  timeout,
  op_id,
}) {
  return {
    kind: TtdAstKind.OP,
    name,
    args,
    resultType,
    idempotent,
    readonly,
    timeout,
    op_id: op_id ?? computeOpId(namespace, name),
    rules: [],
  };
}

/**
 * Create a Rule AST node
 */
export function createRule({
  name,
  from,
  to,
  guard,
  opName,
}) {
  return {
    kind: TtdAstKind.RULE,
    name,
    from,
    to,
    guard,
    opName,
  };
}

/**
 * Create an Invariant AST node
 */
export function createInvariant({
  name,
  expr,
  severity = 'error',
}) {
  return {
    kind: TtdAstKind.INVARIANT,
    name,
    expr,
    severity,
  };
}

/**
 * Create an Emission AST node
 */
export function createEmission({
  channel,
  event,
  opName,
  condition,
  withinMs,
}) {
  return {
    kind: TtdAstKind.EMISSION,
    channel,
    event,
    opName,
    condition,
    withinMs,
  };
}

/**
 * Create a Footprint AST node
 */
export function createFootprint({
  opName,
  reads = [],
  writes = [],
  creates = [],
  deletes = [],
}) {
  return {
    kind: TtdAstKind.FOOTPRINT,
    opName,
    reads,
    writes,
    creates,
    deletes,
  };
}

/**
 * Create a RegistryEntry AST node
 */
export function createRegistryEntry({
  typeName,
  id,
  deprecated = false,
  deprecatedBy,
}) {
  return {
    kind: TtdAstKind.REGISTRY_ENTRY,
    typeName,
    id,
    deprecated,
    deprecatedBy,
  };
}

/**
 * Create a CodecSpec AST node
 */
export function createCodecSpec({
  typeName,
  format,
  canonical,
}) {
  return {
    kind: TtdAstKind.CODEC,
    typeName,
    format,
    canonical: canonical ?? (format === 'cbor'),
  };
}
