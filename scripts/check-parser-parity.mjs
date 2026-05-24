#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { TimeoutError } from '@git-stunts/alfred';
import { GraphQLAdapter } from '../packages/wesley-runtime-node/src/index.mjs';
import { runProcess } from './resilient-process.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');
const CARGO = process.env.CARGO || 'cargo';
const WESLEY_CLI_ARGS = ['run', '--quiet', '-p', 'wesley-cli', '--'];
const WESLEY_CLI_BIN = process.env.WESLEY_CLI_BIN || null;
const PARSER_TIMEOUT_MS = readPositiveIntegerEnv('WESLEY_PARSER_PARITY_TIMEOUT_MS', 120_000);
const PARSER_MAX_BUFFER_BYTES = readPositiveIntegerEnv(
  'WESLEY_PARSER_PARITY_MAX_BUFFER_BYTES',
  64 * 1024 * 1024
);
const GIT_TIMEOUT_MS = readPositiveIntegerEnv('WESLEY_GIT_TIMEOUT_MS', 5_000);
const GIT_MAX_BUFFER_BYTES = readPositiveIntegerEnv('WESLEY_GIT_MAX_BUFFER_BYTES', 1024 * 1024);

const EXPECTED_BOTH_ACCEPT = 'both-accept';
const EXPECTED_BOTH_REJECT = 'both-reject';

export const PARSER_PARITY_REPORT_VERSION = 'parser-parity-spike.v0';
export const DEFAULT_PARSER_PARITY_CASES = Object.freeze([
  parserCase('test/fixtures/ir-parity/small-schema.graphql', EXPECTED_BOTH_ACCEPT),
  parserCase('test/fixtures/ir-parity/schema-extensions-schema.graphql', EXPECTED_BOTH_ACCEPT),
  parserCase('test/fixtures/ir-parity/nested-list-schema.graphql', EXPECTED_BOTH_ACCEPT),
  parserCase('test/fixtures/ir-parity-invalid/parser-syntax-error.graphql', EXPECTED_BOTH_REJECT),
  parserCase(
    'test/fixtures/ir-parity-invalid/duplicate-directive-alias.graphql',
    EXPECTED_BOTH_REJECT,
    'Both lowerers reject duplicate canonical core directives after alias normalization.'
  )
]);

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  if (options.listFixtures) {
    for (const entry of DEFAULT_PARSER_PARITY_CASES) {
      console.log(formatParserCase(entry));
    }
    return;
  }

  const report = await runParserParity(options.cases);

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
  let expect = EXPECTED_BOTH_ACCEPT;

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
      if (!fixture) throw new Error('--fixture requires a path');
      fixturePaths.push(fixture);
      index += 1;
    } else if (arg === '--expect') {
      expect = assertKnownExpectation(args[index + 1], '--expect');
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return {
    cases:
      fixturePaths.length > 0
        ? fixturePaths.map((fixture) => parserCase(fixture, expect))
        : [...DEFAULT_PARSER_PARITY_CASES],
    json,
    listFixtures,
    help
  };
}

function parserCase(fixture, expected, note = null) {
  assertKnownExpectation(expected, 'parser case expectation');
  return Object.freeze({
    fixture,
    expected,
    ...(note ? { note } : {})
  });
}

function formatParserCase(entry) {
  return [entry.fixture, entry.expected, entry.note ?? ''].join('\t').trimEnd();
}

function assertKnownExpectation(value, label) {
  const expectations = [EXPECTED_BOTH_ACCEPT, EXPECTED_BOTH_REJECT];
  if (!expectations.includes(value)) {
    throw new Error(`${label} must be one of: ${expectations.join(', ')}`);
  }
  return value;
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

async function runParserParity(cases) {
  const results = [];
  for (const entry of cases) {
    results.push(await compareParserCase(entry));
  }
  const failed = results.filter((result) => result.status !== 'pass').length;

  return {
    tool: PARSER_PARITY_REPORT_VERSION,
    gitHead: await gitHead(),
    lowerers: {
      legacy: 'GraphQLAdapter.parseSDL',
      rust: WESLEY_CLI_BIN || `${CARGO} ${WESLEY_CLI_ARGS.join(' ')}`
    },
    projectionGapDecision: {
      status: 'nested-list-type-family-covered',
      defaultProjectionAdded: 'js-sdl-type-family-vs-rust-l1-type-family.v0',
      fixture: 'test/fixtures/ir-parity/nested-list-schema.graphql'
    },
    summary: {
      total: results.length,
      passed: results.length - failed,
      failed
    },
    fixtures: results
  };
}

async function compareParserCase(entry) {
  const fixturePath = resolve(ROOT_DIR, entry.fixture);
  const displayPath = relative(ROOT_DIR, fixturePath);

  try {
    if (!existsSync(fixturePath)) {
      throw new Error(`Fixture does not exist: ${displayPath}`);
    }

    const sdl = readFileSync(fixturePath, 'utf8');
    const legacy = lowerLegacy(sdl);
    const rust = await lowerRust(fixturePath);
    const observed = classifyObserved(legacy, rust);

    return {
      fixture: displayPath,
      expected: entry.expected,
      observed,
      status: observed === entry.expected ? 'pass' : 'fail',
      legacy,
      rust,
      ...(entry.note ? { note: entry.note } : {})
    };
  } catch (error) {
    return {
      fixture: displayPath,
      expected: entry.expected,
      observed: 'harness-error',
      status: 'error',
      error: error?.message || String(error)
    };
  }
}

function lowerLegacy(sdl) {
  try {
    const ir = new GraphQLAdapter().parseSDL(sdl);
    return {
      status: 'accept',
      typeCount: Array.isArray(ir?.tables) ? ir.tables.length : null
    };
  } catch (error) {
    return {
      status: 'reject',
      error: error?.message || String(error)
    };
  }
}

async function lowerRust(fixturePath) {
  try {
    const stdout = await runWesley(['schema', 'lower', '--schema', fixturePath, '--json']);
    const ir = JSON.parse(stdout);
    return {
      status: 'accept',
      typeCount: Array.isArray(ir?.types) ? ir.types.length : null
    };
  } catch (error) {
    return {
      status: 'reject',
      error: error?.message || String(error)
    };
  }
}

function classifyObserved(legacy, rust) {
  if (legacy.status === 'accept' && rust.status === 'accept') return EXPECTED_BOTH_ACCEPT;
  if (legacy.status === 'reject' && rust.status === 'reject') return EXPECTED_BOTH_REJECT;
  if (legacy.status === 'accept' && rust.status === 'reject') return 'rust-rejects-only';
  return 'legacy-rejects-only';
}

async function runWesley(args) {
  const command = WESLEY_CLI_BIN || CARGO;
  const commandArgs = WESLEY_CLI_BIN ? args : [...WESLEY_CLI_ARGS, ...args];

  let result;
  try {
    result = await runProcess(command, commandArgs, {
      cwd: ROOT_DIR,
      timeoutMs: PARSER_TIMEOUT_MS,
      maxBufferBytes: PARSER_MAX_BUFFER_BYTES
    });
  } catch (error) {
    if (error instanceof TimeoutError) {
      throw new Error(
        `${command} ${commandArgs.join(' ')} timed out after ${PARSER_TIMEOUT_MS}ms`,
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
  try {
    const result = await runProcess('git', ['rev-parse', '--short=12', 'HEAD'], {
      cwd: ROOT_DIR,
      timeoutMs: GIT_TIMEOUT_MS,
      maxBufferBytes: GIT_MAX_BUFFER_BYTES
    });
    return result.status === 0 ? result.stdout.trim() || null : null;
  } catch {
    return null;
  }
}

function printTextReport(report) {
  if (report.summary.failed === 0) {
    console.log(
      `Parser parity spike passed for ${report.summary.passed}/${report.summary.total} fixtures.`
    );
    console.log(
      `Projection gap decision: ${report.projectionGapDecision.status} via ${report.projectionGapDecision.fixture}.`
    );
    return;
  }

  console.error(
    `Parser parity spike failed for ${report.summary.failed}/${report.summary.total} fixtures.`
  );
  for (const result of report.fixtures) {
    if (result.status === 'pass') continue;
    console.error(`- ${result.fixture}`);
    console.error(`  expected: ${result.expected}`);
    console.error(`  observed: ${result.observed}`);
    if (result.error) console.error(`  error: ${result.error}`);
    if (result.legacy?.error) console.error(`  legacy: ${result.legacy.error}`);
    if (result.rust?.error) console.error(`  rust: ${result.rust.error}`);
  }
}

function printHelp() {
  console.log(`Usage: pnpm parity:parser [--json] [--list-fixtures] [--fixture <path> ...] [--expect <status>]

Compares legacy JS parsing/lowering acceptance against Rust schema lowering for
the v0.0.6 parser parity spike.

Default fixtures:
${DEFAULT_PARSER_PARITY_CASES.map((entry) => `  - ${formatParserCase(entry)}`).join('\n')}`);
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
