import { createHash } from 'node:crypto';
import { parse, Kind } from 'graphql';

const PKG_VERSION = '0.1.0'; // keep simple: avoid package.json import in node CLI

/**
 * Generator for Echo (Rust/WASM) artifacts.
 * Input: GraphQL SDL (string) or prebuilt Wesley IR.
 * Output: Wesley IR JSON enriched with mutation IDs + Intent enum for Echo.
 */
export async function generateEcho({ sdl, ir, mutationIdNamespace = 'Mutation', queryNamespace = 'Query' } = {}) {
  const baseIr = ir ?? parseGraphQLToEchoIR(sdl);

  const ops = buildOpsFromSDL(sdl, mutationIdNamespace, queryNamespace);
  const fullIr = {
    ir_version: 'echo-ir/v1',
    generated_by: {
      tool: '@wesley/generator-echo',
      version: PKG_VERSION
    },
    schema_sha256: sdl ? sha256hex(sdl) : undefined,
    ...baseIr,
    ops,
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

function buildOpsFromSDL(sdl, mutationNs, queryNs) {
  const doc = parse(sdl);
  const mutationDef = doc.definitions.find(
    (d) => d.kind === Kind.OBJECT_TYPE_DEFINITION && d.name.value === 'Mutation'
  );
  const queryDef = doc.definitions.find(
    (d) => d.kind === Kind.OBJECT_TYPE_DEFINITION && d.name.value === 'Query'
  );

  const ops = [];
  const extract = (def, kind, ns) => {
    if (!def) return;
    for (const f of def.fields ?? []) {
      const { typeName: resultType } = unwrapType(f.type);
      const args = (f.arguments ?? []).map((a) => {
        const { typeName, required, list } = unwrapType(a.type);
        return {
          name: a.name.value,
          type: typeName,
          required,
          list,
        };
      });
      ops.push({
        kind,
        name: f.name.value,
        op_id: hash32(`${ns}:${f.name.value}`),
        args,
        result_type: resultType,
      });
    }
  };

  extract(mutationDef, 'MUTATION', mutationNs);
  extract(queryDef, 'QUERY', queryNs);

  ops.sort((a, b) => a.op_id - b.op_id || a.name.localeCompare(b.name));
  return ops;
}

function hash32(text) {
  // SHA-256 then take first 4 bytes little-endian
  const buf = createHash('sha256').update(text).digest();
  return buf.readUInt32LE(0);
}

function sha256hex(text) {
  return createHash('sha256').update(text).digest('hex');
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
      // Skip Mutation/Query here; ops catalog carries operation info.
      if (def.name.value === 'Mutation' || def.name.value === 'Query') continue;

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
