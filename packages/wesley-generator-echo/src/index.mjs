import { createHash } from 'node:crypto';
import { parse, Kind } from 'graphql';
import { emitOps } from './emitOps.mjs';
import { emitSchemas } from './emitSchemas.mjs';
import { emitClient } from './emitClient.mjs';
import { emitJoinImpls } from './emitJoinImpls.mjs';

const PKG_VERSION = '0.1.0'; // keep simple: avoid package.json import in node CLI

/**
 * Generator for Echo (Rust/WASM) artifacts.
 * Input: GraphQL SDL (string) and optional prebuilt Wesley IR.
 * Output: Echo IR JSON (`echo-ir/v2`) + a small set of host-side helper files
 *         derived from the ops catalog (IDs, args/result metadata, schemas).
 */
export async function generateEcho({ sdl, ir, mutationIdNamespace = 'Mutation', queryNamespace = 'Query' } = {}) {
  if (typeof sdl !== 'string' || sdl.trim().length === 0) {
    throw new Error('generateEcho: GraphQL SDL string is required (pass { sdl })');
  }
  if (typeof mutationIdNamespace !== 'string' || mutationIdNamespace.trim().length === 0) {
    throw new Error('generateEcho: mutationIdNamespace must be a non-empty string');
  }
  if (typeof queryNamespace !== 'string' || queryNamespace.trim().length === 0) {
    throw new Error('generateEcho: queryNamespace must be a non-empty string');
  }

  const baseIr = ir ?? parseGraphQLToEchoIR(sdl);

  const ops = buildOpsFromSDL(sdl, mutationIdNamespace, queryNamespace);
  const sdlHash = sdl ? sha256hex(sdl) : null;
  const fullIr = {
    ir_version: 'echo-ir/v2',
    codec_id: 'cbor-canon-v1',
    registry_version: 1,
    generated_by: {
      tool: '@wesley/generator-echo',
      version: PKG_VERSION
    },
    schema_sha256: sdlHash,      // v1 compat
    schema_hash: sdlHash,        // v2 canonical name
    registry_hash: null,         // placeholder — EchoPlugin overwrites with canonical value
    hash_chain: null,            // placeholder — EchoPlugin overwrites after bundle hash
    ...baseIr,
    ops,
  };

  const files = [
    { path: 'ir.json', content: JSON.stringify(fullIr, null, 2) },
    { path: 'ops.generated.ts', content: emitOps(fullIr) },
    { path: 'schemas.generated.ts', content: emitSchemas(fullIr) },
    { path: 'client.generated.ts', content: emitClient(fullIr) },
  ];

  const joinRust = emitJoinImpls(fullIr);
  if (joinRust) {
    files.push({ path: 'join.generated.rs', content: joinRust });
  }

  return { files };
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

  ops.sort((a, b) => a.name.localeCompare(b.name));
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
        type_id: def.name.value,
        layout_hash: null,
        values: def.values?.map((v) => v.name.value) ?? [],
      });
    }

    if (def.kind === Kind.OBJECT_TYPE_DEFINITION) {
      // Skip Mutation/Query here; ops catalog carries operation info.
      if (def.name.value === 'Mutation' || def.name.value === 'Query') continue;

      const fields = (def.fields ?? []).map((f) => {
        const { typeName, required, list } = unwrapType(f.type);
        return {
          name: f.name.value,
          type: typeName,
          required,
          list,
          join: extractJoinDirective(f),
        };
      });

      const hasJoin = fields.some((f) => f.join !== null);

      types.push({
        name: def.name.value,
        kind: 'OBJECT',
        type_id: def.name.value,
        layout_hash: null,
        has_join: hasJoin,
        fields,
      });
    }
  }

  return { types };
}

/**
 * Extract @wes_join / @join directive from a raw GraphQL field AST node.
 * @param {object} fieldNode - GraphQL field definition AST node
 * @returns {{ strategy: string } | null}
 */
function extractJoinDirective(fieldNode) {
  for (const dir of fieldNode.directives ?? []) {
    const name = dir.name.value;
    if (name === 'wes_join' || name === 'join') {
      const strategyArg = (dir.arguments ?? []).find((a) => a.name.value === 'strategy');
      if (strategyArg) {
        return { strategy: strategyArg.value.value };
      }
      return null;
    }
  }
  return null;
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

export { EchoPlugin } from './EchoPlugin.mjs';
