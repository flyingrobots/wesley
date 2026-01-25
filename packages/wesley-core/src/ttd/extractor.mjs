/**
 * TTD Schema Extractor
 *
 * Extracts TTD AST from GraphQL SDL by walking the schema
 * and collecting channels, ops, rules, invariants, etc.
 */

import { parse, Kind } from 'graphql';
import { createHash } from 'node:crypto';
import {
  createChannel,
  createOp,
  createRule,
  createInvariant,
  createEmission,
  createFootprint,
  createRegistryEntry,
  createCodecSpec,
} from './ast.mjs';
import {
  extractTtdDirectives,
  parseChannelDirective,
  parseOpDirective,
  parseRuleDirective,
  parseInvariantDirective,
  parseEmissionDirective,
  parseFootprintDirective,
  parseCodecDirective,
  parseRegistryDirective,
  parseConstraintDirective,
  parseStateFieldDirective,
  parseVersionDirective,
} from './directives.mjs';

/**
 * Compute op_id from namespace and name
 */
function computeOpId(namespace, name) {
  const buf = createHash('sha256').update(`${namespace}:${name}`).digest();
  return buf.readUInt32LE(0);
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
 */
export function extractTtdSchema(sdl) {
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
      extractedAt: new Date().toISOString(),
      ttdVersion: '1.0.0',
    },
  };

  // Maps for lookups
  const opsByName = new Map();
  const channelEventTypes = new Map();

  // First pass: collect all type definitions
  for (const def of doc.definitions) {
    if (def.kind === Kind.ENUM_TYPE_DEFINITION) {
      schema.enums.push({
        name: def.name.value,
        values: def.values?.map(v => v.name.value) ?? [],
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
          eventTypes,
        });

        schema.channels.push(channel);
        channelEventTypes.set(channelName, new Set(eventTypes));
      }

      // Check for invariants on type
      for (const inv of directives.invariants) {
        schema.invariants.push(createInvariant({
          name: inv.name,
          expr: inv.expr,
          severity: inv.severity,
        }));
      }

      // Process regular types (not Mutation/Query)
      if (typeName !== 'Mutation' && typeName !== 'Query' && !directives.channel) {
        const typeInfo = {
          name: typeName,
          version: directives.version ? {
            major: directives.version.major,
            minor: directives.version.minor,
            patch: directives.version.patch,
          } : undefined,
          fields: [],
        };

        for (const field of def.fields ?? []) {
          const { typeName: fieldType, required, list } = unwrapType(field.type);
          const fieldDirectives = extractTtdDirectives(field.directives);

          typeInfo.fields.push({
            name: field.name.value,
            type: fieldType,
            required,
            list,
            stateField: fieldDirectives.stateField,
            constraint: fieldDirectives.constraint,
          });
        }

        schema.types.push(typeInfo);

        // Check for codec
        if (directives.codec) {
          schema.codecs.push(createCodecSpec({
            typeName,
            format: directives.codec.format,
            canonical: directives.codec.canonical,
          }));
        }

        // Check for registry entry
        if (directives.registry) {
          schema.registry.push(createRegistryEntry({
            typeName,
            id: directives.registry.id,
            deprecated: directives.registry.deprecated,
            deprecatedBy: directives.registry.deprecatedBy,
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
          list,
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
        timeout: opInfo.timeout,
      });

      // Attach rules to op
      for (const ruleInfo of directives.rules) {
        if (!ruleInfo.from || !ruleInfo.to) {
          throw new Error(`Rule "${ruleInfo.name}" is missing required "from" or "to" argument`);
        }
        const rule = createRule({
          name: ruleInfo.name,
          from: ruleInfo.from,
          to: ruleInfo.to,
          guard: ruleInfo.guard,
          opName: op.name,
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
          condition: emInfo.condition,
        });
        schema.emissions.push(emission);
      }

      // Extract emitsTo (simplified emission)
      if (directives.emitsTo) {
        const emission = createEmission({
          channel: directives.emitsTo.channel,
          event: undefined, // Will be inferred from produces
          opName: op.name,
          withinMs: directives.emitsTo.within,
        });
        schema.emissions.push(emission);
      }

      // Extract footprint
      if (directives.footprint) {
        const fp = createFootprint({
          opName: op.name,
          reads: directives.footprint.reads,
          writes: directives.footprint.writes,
          creates: directives.footprint.creates,
          deletes: directives.footprint.deletes,
        });
        schema.footprints.push(fp);
      }

      schema.ops.push(op);
      opsByName.set(op.name, op);
    }
  }

  // Sort ops by op_id for deterministic output
  schema.ops.sort((a, b) => a.op_id - b.op_id);

  return schema;
}
