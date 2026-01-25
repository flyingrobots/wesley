/**
 * TTD Manifest Generator
 *
 * Generates manifest files for TTD schemas including:
 * - schema.json: Full TTD schema representation
 * - contracts.json: Emission contracts and invariants
 * - manifest.json: Registry and lookup tables
 */

import { hashSchema, hashType, hashOp, hashChannel, canonicalizeObject } from './hasher.mjs';
import { systemClock } from '../ports/clock.mjs';
import { defaultCrypto } from '../ports/crypto.mjs';

/**
 * Generate schema.json
 * @param {object} schema - The TTD schema
 * @param {object} deps - Dependencies (for DI)
 * @param {import('../ports/clock.mjs').ClockPort} deps.clock - Clock port for timestamps
 */
export function generateSchemaJson(schema, deps = {}) {
  const clock = deps.clock ?? systemClock;
  const schemaJson = {
    version: '1.0.0',
    hash: schema.schemaHash,
    generatedAt: clock.now(),
    generatedBy: '@wesley/generator-ttd',
    channels: schema.channels.map(c => canonicalizeObject(c)),
    ops: schema.ops.map(o => canonicalizeObject({
      name: o.name,
      op_id: o.op_id,
      args: o.args,
      resultType: o.resultType,
      idempotent: o.idempotent,
      readonly: o.readonly,
      rules: o.rules?.map(r => r.name) ?? [],
    })),
    rules: schema.rules.map(r => canonicalizeObject(r)),
    invariants: schema.invariants.map(i => canonicalizeObject(i)),
    types: schema.types.map(t => canonicalizeObject(t)),
    enums: schema.enums.map(e => canonicalizeObject(e)),
  };

  return canonicalizeObject(schemaJson);
}

/**
 * Generate contracts.json
 */
export function generateContractsJson(schema) {
  // Group rules by state type to form state machines
  const stateMachines = [];
  const stateTypeMap = new Map();
  const seenRulesPerType = new Map();

  // Find enum types that are used in rules
  for (const rule of schema.rules) {
    // Infer state type from rule states
    const allStates = [...rule.from, rule.to];
    for (const state of allStates) {
      for (const enumDef of schema.enums) {
        if (enumDef.values.includes(state)) {
          if (!stateTypeMap.has(enumDef.name)) {
            stateTypeMap.set(enumDef.name, []);
            seenRulesPerType.set(enumDef.name, new Set());
          }
          // Prevent duplicate rules per state type
          const seen = seenRulesPerType.get(enumDef.name);
          if (!seen.has(rule)) {
            seen.add(rule);
            stateTypeMap.get(enumDef.name).push(rule);
          }
          break;
        }
      }
    }
  }

  for (const [stateType, rules] of stateTypeMap) {
    stateMachines.push({
      stateType,
      transitions: rules.map(r => ({
        name: r.name,
        from: r.from,
        to: r.to,
        guard: r.guard,
        opName: r.opName,
      })),
    });
  }

  const contracts = {
    emissions: schema.emissions.map(e => canonicalizeObject({
      channel: e.channel,
      event: e.event,
      opName: e.opName,
      condition: e.condition,
      withinMs: e.withinMs,
    })),
    invariants: schema.invariants.map(i => canonicalizeObject({
      name: i.name,
      expr: i.expr,
      severity: i.severity,
    })),
    footprints: schema.footprints.map(f => canonicalizeObject({
      opName: f.opName,
      reads: f.reads,
      writes: f.writes,
      creates: f.creates,
      deletes: f.deletes,
    })),
    stateMachines: stateMachines.map(sm => canonicalizeObject(sm)),
  };

  return canonicalizeObject(contracts);
}

/**
 * Generate manifest.json
 * @param {object} schema - The TTD schema
 * @param {object} deps - Dependencies (for DI)
 * @param {import('../ports/crypto.mjs').CryptoPort} deps.crypto - Crypto port for hashing
 */
export function generateManifest(schema, deps = {}) {
  const crypto = deps.crypto ?? defaultCrypto;
  const hashDeps = { crypto };

  // Sort ops by op_id
  const sortedOps = [...schema.ops].sort((a, b) => a.op_id - b.op_id);

  // Sort registry by id
  const sortedRegistry = [...schema.registry].sort((a, b) => a.id - b.id);

  const manifest = {
    schemaHash: schema.schemaHash,
    registry: {
      version: 1,
      entries: sortedRegistry.map(entry => ({
        id: entry.id,
        typeName: entry.typeName,
        deprecated: entry.deprecated,
        deprecatedBy: entry.deprecatedBy,
        typeHash: hashType(schema.types.find(t => t.name === entry.typeName) || { name: entry.typeName, fields: [] }, hashDeps),
      })),
    },
    ops: sortedOps.map(op => ({
      name: op.name,
      op_id: op.op_id,
      args: op.args,
      resultType: op.resultType,
      signatureHash: hashOp(op, hashDeps),
    })),
    channels: [...schema.channels].sort((a, b) => a.name.localeCompare(b.name)).map(c => ({
      name: c.name,
      version: c.version,
      ordered: c.ordered,
      persistent: c.persistent,
      eventTypes: c.eventTypes,
      channelHash: hashChannel(c, hashDeps),
    })),
    codecs: schema.codecs.map(c => canonicalizeObject({
      typeName: c.typeName,
      format: c.format,
      canonical: c.canonical,
    })),
  };

  return canonicalizeObject(manifest);
}
