/**
 * TTD Schema Extractor
 *
 * Extracts TTD AST from GraphQL SDL by walking the schema
 * and collecting channels, ops, rules, invariants, etc.
 */

import { parse, Kind } from 'graphql';
import { systemClock } from '../ports/clock.mjs';
import { defaultCrypto } from '../ports/crypto.mjs';
import { hashSchema } from './hasher.mjs';
import {
  createChannel,
  createOp,
  createRule,
  createInvariant,
  createEmission,
  createFootprint,
  createRegistryEntry,
  createCodecSpec
} from './ast.mjs';
import {
  extractTtdDirectives,
  _parseChannelDirective,
  _parseOpDirective,
  _parseRuleDirective,
  _parseInvariantDirective,
  _parseEmissionDirective,
  _parseFootprintDirective,
  _parseCodecDirective,
  _parseRegistryDirective,
  _parseConstraintDirective,
  _parseStateFieldDirective,
  _parseVersionDirective
} from './directives.mjs';

/**
 * Compute op_id from namespace and name
 * @param {string} namespace - Operation namespace
 * @param {string} name - Operation name
 * @param {import('../ports/crypto.mjs').CryptoPort} crypto - Crypto port
 */
function _computeOpId(namespace, name, crypto) {
  const bytes = crypto.sha256Bytes(`${namespace}:${name}`);
  // Read first 4 bytes as little-endian uint32 (>>> 0 converts to unsigned)
  return (bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24)) >>> 0;
}

/**
 * Unwrap GraphQL type to get base type name and modifiers
 */
function unwrapType(typeNode) {
  let required = false;
  let list = false;
  let node = typeNode;

  if (node.kind === Kind.NON_NULL_TYPE) {
    required = true;
    node = node.type;
  }

  if (node.kind === Kind.LIST_TYPE) {
    list = true;
    node = node.type;
    if (node.kind === Kind.NON_NULL_TYPE) {
      node = node.type;
    }
  }

  const typeName = node.name?.value ?? 'Unknown';
  return { typeName, required, list };
}

/**
 * Extract TTD schema from GraphQL SDL
 * @param {string} sdl - GraphQL SDL with TTD directives
 * @param {Object} deps - Dependencies for DI
 * @param {import('../ports/clock.mjs').ClockPort} deps.clock - Clock port for timestamps
 * @param {import('../ports/crypto.mjs').CryptoPort} deps.crypto - Crypto port for hashing
 */
export function extractTtdSchema(sdl, deps = {}) {
  const clock = deps.clock ?? systemClock;
  const crypto = deps.crypto ?? defaultCrypto;
  const doc = parse(sdl);

  const schema = {
    channels: [],
    ops: [],
    rules: [],
    invariants: [],
    emissions: [],
    footprints: [],
    registry: [],
    codecs: [],
    types: [],
    enums: [],
    metadata: {
      extractedAt: clock.now(),
      ttdVersion: '1.0.0'
    }
  };

  // Maps for lookups
  const opsByName = new Map();
  const channelEventTypes = new Map();

  // First pass: collect all type definitions
  for (const def of doc.definitions) {
    if (def.kind === Kind.ENUM_TYPE_DEFINITION) {
      schema.enums.push({
        name: def.name.value,
        values: def.values?.map(v => v.name.value) ?? []
      });
    }

    if (def.kind === Kind.OBJECT_TYPE_DEFINITION) {
      const typeName = def.name.value;
      const directives = extractTtdDirectives(def.directives);

      // Check for channel
      if (directives.channel) {
        const channelName = directives.channel.name || typeName;
        const eventTypes = def.fields?.map(f => {
          const { typeName: eventType } = unwrapType(f.type);
          return eventType;
        }) ?? [];

        const channel = createChannel({
          name: channelName,
          version: directives.channel.version,
          ordered: directives.channel.ordered,
          persistent: directives.channel.persistent,
          eventTypes
        });

        schema.channels.push(channel);
        channelEventTypes.set(channelName, new Set(eventTypes));
      }

      // Check for invariants on type
      for (const inv of directives.invariants) {
        schema.invariants.push(createInvariant({
          name: inv.name,
          expr: inv.expr,
          severity: inv.severity
        }));
      }

      // Process regular types (not Mutation/Query)
      if (typeName !== 'Mutation' && typeName !== 'Query' && !directives.channel) {
        const typeInfo = {
          name: typeName,
          version: directives.version ? {
            major: directives.version.major,
            minor: directives.version.minor,
            patch: directives.version.patch
          } : undefined,
          fields: []
        };

        for (const field of def.fields ?? []) {
          const { typeName: fieldType, required, list } = unwrapType(field.type);
          const fieldDirectives = extractTtdDirectives(field.directives);

          // Validate field-level registry if present
          if (fieldDirectives.registry) {
            if (typeof fieldDirectives.registry.id !== 'number') {
              throw new Error(`Field "${field.name.value}" on type "${typeName}" has @wes_registry without a valid numeric id`);
            }
          }

          typeInfo.fields.push({
            name: field.name.value,
            type: fieldType,
            required,
            list,
            stateField: fieldDirectives.stateField,
            constraint: fieldDirectives.constraint,
            registry: fieldDirectives.registry
          });
        }

        schema.types.push(typeInfo);

        // Check for codec
        if (directives.codec) {
          schema.codecs.push(createCodecSpec({
            typeName,
            format: directives.codec.format,
            canonical: directives.codec.canonical
          }));
        }

        // Check for registry entry
        if (directives.registry) {
          schema.registry.push(createRegistryEntry({
            typeName,
            id: directives.registry.id,
            deprecated: directives.registry.deprecated,
            deprecatedBy: directives.registry.deprecatedBy
          }));
        }
      }
    }
  }

  // Second pass: extract operations from Mutation and Query
  for (const def of doc.definitions) {
    if (def.kind !== Kind.OBJECT_TYPE_DEFINITION) continue;

    const typeName = def.name.value;
    if (typeName !== 'Mutation' && typeName !== 'Query') continue;

    const namespace = typeName;
    const isQuery = typeName === 'Query';

    for (const field of def.fields ?? []) {
      const fieldName = field.name.value;
      const directives = extractTtdDirectives(field.directives);
      const { typeName: resultType } = unwrapType(field.type);

      // Parse arguments
      const args = (field.arguments ?? []).map(a => {
        const { typeName: argType, required, list } = unwrapType(a.type);
        return {
          name: a.name.value,
          type: argType,
          required,
          list
        };
      });

      // Create operation
      const opInfo = directives.op ?? {};
      const op = createOp({
        name: opInfo.name ?? fieldName,
        args,
        resultType,
        namespace,
        idempotent: opInfo.idempotent ?? false,
        readonly: isQuery || (opInfo.readonly ?? false),
        timeout: opInfo.timeout
      }, { crypto });

      // Attach rules to op
      for (const ruleInfo of directives.rules) {
        if (!ruleInfo.from || !ruleInfo.to) {
          throw new Error(`Rule "${ruleInfo.name}" has from/to as required arguments but they are missing`);
        }
        const rule = createRule({
          name: ruleInfo.name,
          from: ruleInfo.from,
          to: ruleInfo.to,
          guard: ruleInfo.guard,
          opName: op.name
        });
        schema.rules.push(rule);
        op.rules.push(rule);
      }

      // Extract emissions
      for (const emInfo of directives.emissions) {
        const emission = createEmission({
          channel: emInfo.channel,
          event: emInfo.event,
          opName: op.name,
          condition: emInfo.condition
        });
        schema.emissions.push(emission);
      }

      // Extract emitsTo - merge with existing emissions from same channel
      if (directives.emitsTo) {
        const channel = directives.emitsTo.channel;
        const withinMs = directives.emitsTo.within;

        // Find existing emissions for this op/channel and add withinMs
        const existingEmissions = schema.emissions.filter(
          e => e.opName === op.name && e.channel === channel
        );

        if (existingEmissions.length > 0) {
          // Merge withinMs into existing emissions
          for (const existing of existingEmissions) {
            existing.withinMs = withinMs;
          }
        } else {
          // Create new emission with event from @wes_produces
          const events = directives.produces?.events ?? [];
          for (const event of events) {
            const emission = createEmission({
              channel,
              event,
              opName: op.name,
              withinMs
            });
            schema.emissions.push(emission);
          }
        }
      }

      // Extract footprint
      if (directives.footprint) {
        const fp = createFootprint({
          opName: op.name,
          reads: directives.footprint.reads,
          writes: directives.footprint.writes,
          creates: directives.footprint.creates,
          deletes: directives.footprint.deletes
        });
        schema.footprints.push(fp);
      }

      // Only add op if it has any TTD directives
      const hasTtdDirectives = directives.op ||
                               directives.rules.length > 0 ||
                               directives.emissions.length > 0 ||
                               directives.emitsTo ||
                               directives.footprint ||
                               directives.produces;

      if (hasTtdDirectives) {
        schema.ops.push(op);
        opsByName.set(op.name, op);
      }
    }
  }

  // Sort ops by op_id for deterministic output
  schema.ops.sort((a, b) => a.op_id - b.op_id);

  // Compute schema hash from SDL
  schema.schemaHash = hashSchema(sdl, { crypto });

  return schema;
}
