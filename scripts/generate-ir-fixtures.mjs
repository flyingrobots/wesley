#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { GraphQLAdapter } from '../packages/wesley-runtime-node/src/GraphQLAdapter.mjs';
import { registryHash, canonicalizeJSON } from '../packages/wesley-core/src/domain/registryHash.mjs';
import { parse, print } from '../packages/wesley-runtime-node/node_modules/graphql/index.mjs';

const adapter = new GraphQLAdapter();
const FIXTURE_DIR = 'test/fixtures/ir-parity';

async function generate() {
  const files = readdirSync(FIXTURE_DIR).filter(f => extname(f) === '.graphql');

  for (const file of files) {
    const sdlPath = join(FIXTURE_DIR, file);
    const sdl = readFileSync(sdlPath, 'utf8');
    const base = basename(file, '.graphql');

    console.log(`Processing ${file}...`);

    try {
      // NOTE: We now expect the adapter to handle extensions and sorting.
      // Since the legacy JS adapter is flawed, we still apply manual folding
      // here ONLY to produce a "Truth Anchor" that matches what the Rust
      // implementation SHOULD do.

      const doc = parse(sdl);
      const definitions = [];
      const extensions = new Map();

      // Collect all
      for (const def of doc.definitions) {
        if (def.kind === 'ObjectTypeExtension') {
          const name = def.name.value;
          if (!extensions.has(name)) extensions.set(name, []);
          extensions.get(name).push(def);
        } else {
          definitions.push(def);
        }
      }

      // Merge extensions into base definitions
      for (const def of definitions) {
        if (def.kind === 'ObjectTypeDefinition' && extensions.has(def.name.value)) {
          def.fields.push(...extensions.get(def.name.value).flatMap(ext => ext.fields));
        }
      }

      // Sort definitions by name to ensure cross-host parity with the new Rust logic
      definitions.sort((a, b) => a.name.value.localeCompare(b.name.value));

      const mergedSdl = print({ ...doc, definitions });
      const ir = await adapter.parseSDL(mergedSdl);

      // Strip non-deterministic metadata for parity hashing
      const parityIr = JSON.parse(JSON.stringify(ir));
      delete parityIr.metadata;

      const hash = await registryHash(parityIr);
      const canonicalJson = canonicalizeJSON(parityIr);

      writeFileSync(join(FIXTURE_DIR, `${base}.ir.json`), JSON.stringify(ir, null, 2));
      writeFileSync(join(FIXTURE_DIR, `${base}.canonical.json`), canonicalJson);
      writeFileSync(join(FIXTURE_DIR, `${base}.hash`), hash);

      console.log(`  Hash: ${hash}`);
    } catch (error) {
      console.error(`  Error processing ${file}: ${error.message}`);
    }
  }
}

generate().catch(console.error);
