#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { GraphQLAdapter } from '../packages/wesley-runtime-node/src/index.mjs';
import { canonicalizeJSON } from '../packages/wesley-core/src/domain/registryHash.mjs';
import {
  DEFAULT_PARITY_FIXTURES,
  PROJECTION_NAME,
  PROJECTION_NORMALIZER_VERSION,
  canonicalProjectionBytes,
  firstMismatch,
  projectLegacyTableIR,
  projectRustL1IR,
  projectionHash,
  sha256Hex
} from './ir-parity-projection.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');
const CARGO = process.env.CARGO || 'cargo';
const WESLEY_CLI_ARGS = ['run', '--quiet', '-p', 'wesley-cli', '--'];
const WESLEY_CLI_BIN = process.env.WESLEY_CLI_BIN || null;

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  if (options.listFixtures) {
    for (const fixture of DEFAULT_PARITY_FIXTURES) {
      console.log(fixture);
    }
    return;
  }

  const report = runParity(options.fixtures);

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printTextReport(report);
  }

  if (report.summary.failed > 0) {
    process.exitCode = 1;
  }
}

function parseArgs(args) {
  const fixtures = [];
  let json = false;
  let listFixtures = false;
  let help = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--') {
      continue;
    } else if (arg === '--json') {
      json = true;
    } else if (arg === '--list-fixtures') {
      listFixtures = true;
    } else if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg === '--fixture') {
      const fixture = args[index + 1];
      if (!fixture) {
        throw new Error('--fixture requires a path');
      }
      fixtures.push(fixture);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return {
    fixtures: fixtures.length > 0 ? fixtures : [...DEFAULT_PARITY_FIXTURES],
    json,
    listFixtures,
    help
  };
}

function runParity(fixtures) {
  const results = fixtures.map(compareFixture);
  const failed = results.filter(result => result.status !== 'pass').length;

  return {
    projection: PROJECTION_NAME,
    normalizerVersion: PROJECTION_NORMALIZER_VERSION,
    gitHead: gitHead(),
    lowerers: {
      legacy: '@wesley/runtime-node GraphQLAdapter.parseSDL',
      rust: WESLEY_CLI_BIN || `${CARGO} ${WESLEY_CLI_ARGS.join(' ')}`
    },
    summary: {
      total: results.length,
      passed: results.length - failed,
      failed
    },
    fixtures: results
  };
}

function compareFixture(fixture) {
  const fixturePath = resolve(ROOT_DIR, fixture);
  const displayPath = relative(ROOT_DIR, fixturePath);

  try {
    if (!existsSync(fixturePath)) {
      throw new Error(`Fixture does not exist: ${displayPath}`);
    }

    const legacyProjection = lowerLegacyProjection(fixturePath);
    const rustIr = lowerRustL1(fixturePath);
    const rustProjection = projectRustL1IR(rustIr);
    const legacyBytes = canonicalProjectionBytes(legacyProjection);
    const rustBytes = canonicalProjectionBytes(rustProjection);
    const mismatch = legacyBytes === rustBytes
      ? null
      : firstMismatch(legacyProjection, rustProjection);
    const rustL1Hash = sha256Hex(canonicalizeJSON(rustIr));
    const rustCommandHash = runWesley(['schema', 'hash', '--schema', fixturePath]).trim();
    const rustTrackedHash = readTrackedHash(fixturePath);
    const rustCommandHashMatches = rustCommandHash === rustL1Hash;
    const rustTrackedHashMatches = rustTrackedHash === null ? null : rustTrackedHash === rustL1Hash;
    const failureReasons = [];

    if (mismatch) failureReasons.push('projection-mismatch');
    if (!rustCommandHashMatches) failureReasons.push('rust-command-hash-mismatch');
    if (rustTrackedHashMatches === false) failureReasons.push('tracked-rust-hash-mismatch');

    return {
      fixture: displayPath,
      status: failureReasons.length > 0 ? 'fail' : 'pass',
      failureReasons,
      legacyHash: projectionHash(legacyProjection),
      rustHash: projectionHash(rustProjection),
      rustL1Hash,
      rustCommandHash,
      rustCommandHashMatches,
      rustTrackedHash,
      rustTrackedHashMatches,
      ...(mismatch ? { firstMismatch: mismatch } : {})
    };
  } catch (error) {
    return {
      fixture: displayPath,
      status: 'error',
      error: error?.message || String(error)
    };
  }
}

function lowerLegacyProjection(fixturePath) {
  const sdl = readFileSync(fixturePath, 'utf8');
  const ir = new GraphQLAdapter().parseSDL(sdl);
  return projectLegacyTableIR(ir);
}

function lowerRustL1(fixturePath) {
  const output = runWesley(['schema', 'lower', '--schema', fixturePath, '--json']);
  return JSON.parse(output);
}

function runWesley(args) {
  const command = WESLEY_CLI_BIN || CARGO;
  const commandArgs = WESLEY_CLI_BIN ? args : [...WESLEY_CLI_ARGS, ...args];
  const result = spawnSync(command, commandArgs, {
    cwd: ROOT_DIR,
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

function gitHead() {
  const result = spawnSync('git', ['rev-parse', '--short=12', 'HEAD'], {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  });

  if (result.status !== 0) return null;
  return result.stdout.trim() || null;
}

function readTrackedHash(fixturePath) {
  const hashPath = fixturePath.replace(/\.graphql$/, '.l1.hash');
  if (!existsSync(hashPath)) return null;
  return readFileSync(hashPath, 'utf8').trim();
}

function printTextReport(report) {
  if (report.summary.failed === 0) {
    console.log(
      `IR parity passed for ${report.summary.passed}/${report.summary.total} fixtures ` +
      `using ${report.projection}.`
    );
    return;
  }

  console.error(
    `IR parity failed for ${report.summary.failed}/${report.summary.total} fixtures ` +
    `using ${report.projection}.`
  );

  for (const result of report.fixtures) {
    if (result.status === 'pass') continue;
    console.error(`- ${result.fixture}`);
    console.error(`  status: ${result.status}`);
    if (result.error) {
      console.error(`  error: ${result.error}`);
      continue;
    }
    console.error(`  legacy projection hash: ${result.legacyHash}`);
    console.error(`  rust projection hash: ${result.rustHash}`);
    console.error(`  failure reasons: ${result.failureReasons.join(', ')}`);
    if (result.firstMismatch) {
      console.error(`  first mismatch: ${result.firstMismatch.path}`);
      console.error(`  reason: ${result.firstMismatch.reason}`);
      console.error(`  legacy: ${formatPreview(result.firstMismatch.legacy)}`);
      console.error(`  rust: ${formatPreview(result.firstMismatch.rust)}`);
    }
    console.error(`  rust schema hash matches current L1: ${result.rustCommandHashMatches}`);
    console.error(`  tracked .l1.hash matches current Rust: ${result.rustTrackedHashMatches}`);
  }
}

function formatPreview(value) {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function printHelp() {
  console.log(`Usage: pnpm parity:ir [--json] [--list-fixtures] [--fixture <path> ...]

Compares the legacy JS table IR projection against the Rust L1 projection using
${PROJECTION_NAME}. By default it runs the explicit v0 sentinel corpus:

${DEFAULT_PARITY_FIXTURES.map(fixture => `  - ${fixture}`).join('\n')}`);
}

try {
  main();
} catch (error) {
  console.error(error?.message || String(error));
  process.exitCode = 1;
}
