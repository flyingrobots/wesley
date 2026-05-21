#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { GraphQLAdapter } from '../packages/wesley-runtime-node/src/GraphQLAdapter.mjs';
import { registryHash, canonicalizeJSON } from '../packages/wesley-core/src/domain/registryHash.mjs';

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
      const ir = await adapter.parseSDL(sdl);

      // Rust and JS parity hashing excludes the metadata envelope.
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
