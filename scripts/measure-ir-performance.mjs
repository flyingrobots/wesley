#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { canonicalizeJSON } from '../packages/wesley-core/src/domain/registryHash.mjs';
import { sha256Hex } from './ir-parity-projection.mjs';

export const PERFORMANCE_REPORT_VERSION = 'rust-ir-performance-baseline.v0';
export const DEFAULT_PERFORMANCE_FIXTURES = Object.freeze([
  'test/fixtures/ir-parity/small-schema.graphql',
  'test/fixtures/ir-parity/medium-schema.graphql',
  'test/fixtures/ir-parity/large-schema.graphql',
  'test/fixtures/ir-parity/directive-heavy-schema.graphql',
  'test/fixtures/ir-parity/legacy-alias-schema.graphql',
  'test/fixtures/ir-parity/schema-extensions-schema.graphql'
]);

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');
const CARGO = process.env.CARGO || 'cargo';
const WESLEY_CLI_ARGS = ['run', '--quiet', '-p', 'wesley-cli', '--'];
const WESLEY_CLI_BIN = process.env.WESLEY_CLI_BIN || null;
const DEFAULT_ITERATIONS = 3;
const DEFAULT_WARMUPS = 1;

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  if (options.listFixtures) {
    for (const fixture of DEFAULT_PERFORMANCE_FIXTURES) {
      console.log(fixture);
    }
    return;
  }

  const report = measurePerformance(options);
  const output = options.markdown ? renderMarkdown(report) : JSON.stringify(report, null, 2);

  if (options.outputPath) {
    const outputPath = resolve(ROOT_DIR, options.outputPath);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${output}\n`);
  }

  console.log(output);

  if (report.summary.failed > 0) {
    process.exitCode = 1;
  }
}

function parseArgs(args) {
  const fixtures = [];
  let iterations = DEFAULT_ITERATIONS;
  let warmups = DEFAULT_WARMUPS;
  let listFixtures = false;
  let help = false;
  let json = false;
  let markdown = false;
  let outputPath = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--') {
      continue;
    } else if (arg === '--fixture') {
      const fixture = args[index + 1];
      if (!fixture) throw new Error('--fixture requires a path');
      fixtures.push(fixture);
      index += 1;
    } else if (arg === '--iterations') {
      iterations = parsePositiveInteger(args[index + 1], '--iterations');
      index += 1;
    } else if (arg === '--warmups') {
      warmups = parseNonNegativeInteger(args[index + 1], '--warmups');
      index += 1;
    } else if (arg === '--list-fixtures') {
      listFixtures = true;
    } else if (arg === '--json') {
      json = true;
    } else if (arg === '--markdown') {
      markdown = true;
    } else if (arg === '--output') {
      outputPath = args[index + 1];
      if (!outputPath) throw new Error('--output requires a path');
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (json && markdown) {
    throw new Error('Choose only one output format: --json or --markdown');
  }

  return {
    fixtures: fixtures.length > 0 ? fixtures : [...DEFAULT_PERFORMANCE_FIXTURES],
    iterations,
    warmups,
    listFixtures,
    help,
    markdown,
    outputPath
  };
}

function parsePositiveInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${flag} requires a positive integer`);
  }
  return parsed;
}

function parseNonNegativeInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${flag} requires a non-negative integer`);
  }
  return parsed;
}

function measurePerformance(options) {
  const fixtures = options.fixtures.map((fixture) =>
    measureFixture(resolve(ROOT_DIR, fixture), options)
  );
  const failed = fixtures.filter((fixture) => fixture.status !== 'pass').length;

  return {
    tool: PERFORMANCE_REPORT_VERSION,
    gitHead: gitHead(),
    lowerer: WESLEY_CLI_BIN || `${CARGO} ${WESLEY_CLI_ARGS.join(' ')}`,
    iterations: options.iterations,
    warmups: options.warmups,
    memory: {
      status: 'not-captured',
      reason:
        'v0 records Rust CLI wall-clock lowering time only; peak RSS and binding overhead require a separate harness.'
    },
    summary: {
      total: fixtures.length,
      passed: fixtures.length - failed,
      failed
    },
    fixtures
  };
}

function measureFixture(fixturePath, options) {
  const displayPath = relative(ROOT_DIR, fixturePath);

  try {
    if (!existsSync(fixturePath)) {
      throw new Error(`Fixture does not exist: ${displayPath}`);
    }

    for (let index = 0; index < options.warmups; index += 1) {
      runLower(fixturePath);
    }

    const durationsMs = [];
    let lastOutput = '';
    for (let index = 0; index < options.iterations; index += 1) {
      const measured = measureLower(fixturePath);
      durationsMs.push(measured.durationMs);
      lastOutput = measured.stdout;
    }

    const parsed = JSON.parse(lastOutput);
    const semanticIr = { ...parsed };
    delete semanticIr.metadata;

    return {
      fixture: displayPath,
      status: 'pass',
      schemaBytes: statSync(fixturePath).size,
      outputBytes: Buffer.byteLength(lastOutput),
      rustL1Hash: sha256Hex(canonicalizeJSON(semanticIr)),
      typeCount: Array.isArray(parsed.types) ? parsed.types.length : null,
      durationMs: summarizeDurations(durationsMs)
    };
  } catch (error) {
    return {
      fixture: displayPath,
      status: 'error',
      error: error?.message || String(error)
    };
  }
}

function measureLower(fixturePath) {
  const started = process.hrtime.bigint();
  const stdout = runLower(fixturePath);
  const ended = process.hrtime.bigint();
  return {
    stdout,
    durationMs: roundMs(Number(ended - started) / 1_000_000)
  };
}

function runLower(fixturePath) {
  const command = WESLEY_CLI_BIN || CARGO;
  const args = WESLEY_CLI_BIN
    ? ['schema', 'lower', '--schema', fixturePath, '--json']
    : [...WESLEY_CLI_ARGS, 'schema', 'lower', '--schema', fixturePath, '--json'];
  const result = spawnSync(command, args, {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const details = (result.stderr || result.stdout || '').trim();
    throw new Error(details || `${command} ${args.join(' ')} failed`);
  }

  return result.stdout;
}

function summarizeDurations(durations) {
  const sorted = [...durations].sort((left, right) => left - right);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  return {
    samples: durations,
    min: sorted[0],
    median: sorted[Math.floor(sorted.length / 2)],
    mean: roundMs(total / sorted.length),
    max: sorted[sorted.length - 1]
  };
}

function roundMs(value) {
  return Math.round(value * 1000) / 1000;
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

function renderMarkdown(report) {
  const lines = [
    '# Rust IR Performance Baseline',
    '',
    `- Tool: \`${report.tool}\``,
    `- Git head: \`${report.gitHead ?? 'unknown'}\``,
    `- Lowerer: \`${report.lowerer}\``,
    `- Warmups: \`${report.warmups}\``,
    `- Iterations: \`${report.iterations}\``,
    `- Memory: \`${report.memory.status}\``,
    '',
    '| Fixture | Status | Types | Schema Bytes | Output Bytes | Median ms | Mean ms | Rust L1 Hash |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |'
  ];

  for (const fixture of report.fixtures) {
    if (fixture.status !== 'pass') {
      lines.push(
        `| \`${fixture.fixture}\` | ${fixture.status}: ${escapeMarkdownCell(fixture.error)} |  |  |  |  |  |  |`
      );
      continue;
    }

    lines.push(
      `| \`${fixture.fixture}\` | ${fixture.status} | ${fixture.typeCount ?? ''} | ` +
        `${fixture.schemaBytes} | ${fixture.outputBytes} | ${fixture.durationMs.median} | ` +
        `${fixture.durationMs.mean} | \`${fixture.rustL1Hash}\` |`
    );
  }

  return lines.join('\n');
}

function escapeMarkdownCell(value) {
  return String(value ?? '')
    .replaceAll('|', '\\|')
    .replaceAll('\n', ' ');
}

function printHelp() {
  console.log(`Usage: pnpm perf:ir [--json|--markdown] [--list-fixtures] [--fixture <path> ...] [--iterations <n>] [--warmups <n>] [--output <path>]

Measures Rust CLI schema-lower wall-clock duration over the explicit IR fixture
corpus. The v0 report is evidence, not a pass/fail performance threshold.

Default fixtures:
${DEFAULT_PERFORMANCE_FIXTURES.map((fixture) => `  - ${fixture}`).join('\n')}`);
}

try {
  main();
} catch (error) {
  console.error(error?.message || String(error));
  process.exitCode = 1;
}
