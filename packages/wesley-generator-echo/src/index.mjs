import { createHash } from 'node:crypto';
import { parse, Kind } from 'graphql';

/**
 * Generator for Echo (Rust/WASM) artifacts.
 * Input: GraphQL SDL (string) or prebuilt Wesley IR.
 * Output: Wesley IR JSON enriched with mutation IDs + Intent enum for Echo.
 */
export async function generateEcho({ sdl, ir, mutationIdNamespace = 'Mutation' } = {}) {
  const baseIr = ir ?? parseGraphQLToEchoIR(sdl);

  const mutationIds = buildMutationIds(baseIr, mutationIdNamespace);
  const intentEnum = buildIntentEnum(Object.keys(mutationIds));

  const fullIr = {
    ...baseIr,
    mutation_ids: mutationIds,
    types: [...(baseIr.types ?? []), intentEnum]
  };

  return {
    files: [
      {
        path: 'ir.json',
        content: JSON.stringify(fullIr, null, 2)
      }
    ]
  };
}

function buildMutationIds(ir, namespace) {
  const mutations = (ir.types || []).find((t) => t.name === 'Mutation');
  const fields = mutations?.fields || [];
  const ids = {};
  for (const field of fields) {
    ids[field.name] = hash32(`${namespace}:${field.name}`);
  }
  return ids;
}

function buildIntentEnum(mutationNames) {
  return {
    name: 'Intent',
    kind: 'ENUM',
    values: mutationNames
  };
}

function hash32(text) {
  // SHA-256 then take first 4 bytes little-endian
  const buf = createHash('sha256').update(text).digest();
  return buf.readUInt32LE(0);
}

function parseGraphQLToEchoIR(sdl) {
  const doc = parse(sdl);
  const types = [];

  for (const def of doc.definitions) {
    if (def.kind === Kind.ENUM_TYPE_DEFINITION) {
      types.push({
        name: def.name.value,
        kind: 'ENUM',
        values: def.values?.map((v) => v.name.value) ?? [],
      });
    }

    if (def.kind === Kind.OBJECT_TYPE_DEFINITION) {
      types.push({
        name: def.name.value,
        kind: 'OBJECT',
        fields: (def.fields ?? []).map((f) => {
          const { typeName, required, list } = unwrapType(f.type);
          return {
            name: f.name.value,
            type: typeName,
            required,
            list,
          };
        }),
      });
    }
  }

  return { types };
}

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
      node = node.type; // element non-null; outer required already tracked
    }
  }

  const typeName = node.name?.value ?? (node.type?.name?.value ?? 'Unknown');
  return { typeName, required, list };
}
