#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { TimeoutError } from '@git-stunts/alfred';
import { GraphQLAdapter } from '../packages/wesley-runtime-node/src/index.mjs';
import { canonicalizeJSON } from '../packages/wesley-core/src/domain/registryHash.mjs';
import {
  DEFAULT_PARITY_FIXTURES,
  TABLE_PROJECTION_NAME,
  PROJECTION_NORMALIZER_VERSION,
  canonicalProjectionBytes,
  formatParityFixture,
  firstMismatch,
  normalizeParityFixture,
  projectLegacyProjection,
  projectRustProjection,
  projectionHash,
  sha256Hex
} from './ir-parity-projection.mjs';
import { runProcess } from './resilient-process.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');
const CARGO = process.env.CARGO || 'cargo';
const WESLEY_CLI_ARGS = ['run', '--quiet', '-p', 'wesley-cli', '--'];
const WESLEY_CLI_BIN = process.env.WESLEY_CLI_BIN || null;
const PARITY_TIMEOUT_MS = readPositiveIntegerEnv('WESLEY_PARITY_TIMEOUT_MS', 120_000);
const PARITY_MAX_BUFFER_BYTES = readPositiveIntegerEnv(
  'WESLEY_PARITY_MAX_BUFFER_BYTES',
  64 * 1024 * 1024
);
const GIT_TIMEOUT_MS = readPositiveIntegerEnv('WESLEY_GIT_TIMEOUT_MS', 5_000);
const GIT_MAX_BUFFER_BYTES = readPositiveIntegerEnv('WESLEY_GIT_MAX_BUFFER_BYTES', 1024 * 1024);

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  if (options.listFixtures) {
    for (const fixture of DEFAULT_PARITY_FIXTURES) {
      console.log(formatParityFixture(fixture));
    }
    return;
  }

  const report = await runParity(options.fixtures);

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
  const fixturePaths = [];
  let json = false;
  let listFixtures = false;
  let help = false;
  let projection = TABLE_PROJECTION_NAME;
  let projectionSpecified = false;

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
      fixturePaths.push(fixture);
      index += 1;
    } else if (arg === '--projection') {
      projection = args[index + 1];
      if (!projection) {
        throw new Error('--projection requires a projection name');
      }
      projectionSpecified = true;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  let fixtures = [...DEFAULT_PARITY_FIXTURES];
  if (fixturePaths.length > 0) {
    fixtures = fixturePaths.map((fixture) => normalizeParityFixture({ fixture, projection }));
  } else if (projectionSpecified) {
    fixtures = DEFAULT_PARITY_FIXTURES.map((entry) =>
      normalizeParityFixture({ ...entry, projection })
    );
  }

  return {
    fixtures,
    json,
    listFixtures,
    help
  };
}

function parsePositiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label} requires a positive integer`);
  }
  return parsed;
}

function readPositiveIntegerEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return parsePositiveInteger(raw, name);
}

async function runParity(fixtures) {
  const results = [];
  for (const entry of fixtures) {
    results.push(await compareFixture(normalizeParityFixture(entry)));
  }
  const failed = results.filter((result) => result.status !== 'pass').length;
  const projections = [...new Set(results.map((result) => result.projection))];

  return {
    projection: projections.length === 1 ? projections[0] : 'multiple',
    projections,
    normalizerVersion: PROJECTION_NORMALIZER_VERSION,
    gitHead: await gitHead(),
    lowerers: {
      legacy: 'projection-owned JS lowerer',
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

async function compareFixture(fixture) {
  const fixturePath = resolve(ROOT_DIR, fixture.fixture);
  const displayPath = relative(ROOT_DIR, fixturePath);
  const { projection } = fixture;

  try {
    if (!existsSync(fixturePath)) {
      throw new Error(`Fixture does not exist: ${displayPath}`);
    }

    const legacyProjection = lowerLegacyProjection(fixturePath, projection);
    const rustIr = await lowerRustL1(fixturePath);
    const rustProjection = projectRustProjection(projection, rustIr);
    const legacyBytes = canonicalProjectionBytes(legacyProjection);
    const rustBytes = canonicalProjectionBytes(rustProjection);
    const mismatch =
      legacyBytes === rustBytes ? null : firstMismatch(legacyProjection, rustProjection);
    const rustL1Hash = rustSemanticHash(rustIr);
    const rustCommandHash = (await runWesley(['schema', 'hash', '--schema', fixturePath])).trim();
    const rustTrackedHash = readTrackedHash(fixturePath);
    const rustCommandHashMatches = rustCommandHash === rustL1Hash;
    const rustTrackedHashMatches = rustTrackedHash === null ? null : rustTrackedHash === rustL1Hash;
    const failureReasons = [];

    if (mismatch) failureReasons.push('projection-mismatch');
    if (!rustCommandHashMatches) failureReasons.push('rust-command-hash-mismatch');
    if (rustTrackedHashMatches === false) failureReasons.push('tracked-rust-hash-mismatch');

    return {
      fixture: displayPath,
      projection,
      status: failureReasons.length > 0 ? 'fail' : 'pass',
      failureReasons,
      legacyBytes,
      rustBytes,
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
      projection,
      status: 'error',
      error: error?.message || String(error)
    };
  }
}

function lowerLegacyProjection(fixturePath, projection) {
  const sdl = readFileSync(fixturePath, 'utf8');
  const legacyIr = projection === TABLE_PROJECTION_NAME ? new GraphQLAdapter().parseSDL(sdl) : null;
  return projectLegacyProjection(projection, { sdl, legacyIr });
}

async function lowerRustL1(fixturePath) {
  const output = await runWesley(['schema', 'lower', '--schema', fixturePath, '--json']);
  return JSON.parse(output);
}

function rustSemanticHash(ir) {
  const semanticIr = { ...ir };
  delete semanticIr.metadata;
  return sha256Hex(canonicalizeJSON(semanticIr));
}

async function runWesley(args) {
  const command = WESLEY_CLI_BIN || CARGO;
  const commandArgs = WESLEY_CLI_BIN ? args : [...WESLEY_CLI_ARGS, ...args];

  let result;
  try {
    result = await runProcess(command, commandArgs, {
      cwd: ROOT_DIR,
      timeoutMs: PARITY_TIMEOUT_MS,
      maxBufferBytes: PARITY_MAX_BUFFER_BYTES
    });
  } catch (error) {
    if (error instanceof TimeoutError) {
      throw new Error(
        `${command} ${commandArgs.join(' ')} timed out after ${PARITY_TIMEOUT_MS}ms`,
        {
          cause: error
        }
      );
    }
    throw error;
  }

  if (result.status !== 0) {
    const details = (result.stderr || result.stdout || '').trim();
    throw new Error(details || `${command} ${commandArgs.join(' ')} failed`);
  }

  return result.stdout;
}

async function gitHead() {
  let result;
  try {
    result = await runProcess('git', ['rev-parse', '--short=12', 'HEAD'], {
      cwd: ROOT_DIR,
      timeoutMs: GIT_TIMEOUT_MS,
      maxBufferBytes: GIT_MAX_BUFFER_BYTES
    });
  } catch {
    return null;
  }

  if (result.status !== 0) return null;
  return result.stdout.trim() || null;
}

function readTrackedHash(fixturePath) {
  if (!fixturePath.endsWith('.graphql')) return null;
  const hashPath = fixturePath.replace(/\.graphql$/, '.l1.hash');
  if (!existsSync(hashPath)) return null;
  return readFileSync(hashPath, 'utf8').trim();
}

function printTextReport(report) {
  if (report.summary.failed === 0) {
    console.log(
      `IR parity passed for ${report.summary.passed}/${report.summary.total} fixture projections ` +
        `using ${projectionSummary(report)}.`
    );
    return;
  }

  console.error(
    `IR parity failed for ${report.summary.failed}/${report.summary.total} fixture projections ` +
      `using ${projectionSummary(report)}.`
  );

  for (const result of report.fixtures) {
    if (result.status === 'pass') continue;
    console.error(`- ${result.fixture}`);
    console.error(`  projection: ${result.projection}`);
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

function projectionSummary(report) {
  if (report.projections.length === 1) return report.projections[0];
  return `${report.projections.length} projections`;
}

function formatPreview(value) {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function printHelp() {
  console.log(`Usage: pnpm parity:ir [--json] [--list-fixtures] [--fixture <path> ...] [--projection <name>]

Compares explicit legacy/Rust IR parity projections. By default it runs the
explicit v0 sentinel corpus with each fixture's owning projection:

${DEFAULT_PARITY_FIXTURES.map((fixture) => `  - ${formatParityFixture(fixture)}`).join('\n')}`);
}

function isCliEntrypoint() {
  if (!process.argv[1]) return false;
  return pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
}

if (isCliEntrypoint()) {
  try {
    await main();
  } catch (error) {
    console.error(error?.message || String(error));
    process.exitCode = 1;
  }
}
