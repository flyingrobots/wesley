#!/usr/bin/env node
import { writeFileSync, readdirSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { spawnSync } from 'node:child_process';

const FIXTURE_DIR = process.env.WESLEY_IR_FIXTURE_DIR || 'test/fixtures/ir-parity';
const CARGO = process.env.CARGO || 'cargo';
const WESLEY_CLI_ARGS = ['run', '--quiet', '-p', 'wesley-cli', '--'];
const WESLEY_CLI_BIN = process.env.WESLEY_CLI_BIN || null;

function runWesley(args) {
  const command = WESLEY_CLI_BIN || CARGO;
  const commandArgs = WESLEY_CLI_BIN ? args : [...WESLEY_CLI_ARGS, ...args];
  const result = spawnSync(command, commandArgs, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const details = (result.stderr || result.stdout || '').trim();
    throw new Error(details || `${command} ${commandArgs.join(' ')} failed`);
  }

  return result.stdout;
}

async function generate() {
  const files = readdirSync(FIXTURE_DIR)
    .filter((f) => extname(f) === '.graphql')
    .sort((a, b) => a.localeCompare(b));
  let hasError = false;

  for (const file of files) {
    const sdlPath = join(FIXTURE_DIR, file);
    const base = basename(file, '.graphql');

    console.log(`Processing ${file}...`);

    try {
      const irJson = runWesley(['schema', 'lower', '--schema', sdlPath, '--json']);
      const hash = runWesley(['schema', 'hash', '--schema', sdlPath]).trim();

      writeFileSync(join(FIXTURE_DIR, `${base}.l1.json`), irJson);
      writeFileSync(join(FIXTURE_DIR, `${base}.l1.hash`), `${hash}\n`);

      console.log(`  Hash: ${hash}`);
    } catch (error) {
      hasError = true;
      console.error(`  Error processing ${file}: ${error.message}`);
    }
  }

  if (hasError) {
    process.exitCode = 1;
  }
}

generate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
