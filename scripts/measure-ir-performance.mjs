#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { TimeoutError } from '@git-stunts/alfred';
import { GraphQLAdapter } from '../packages/wesley-runtime-node/src/index.mjs';
import { canonicalizeJSON } from '../packages/wesley-core/src/domain/registryHash.mjs';
import { sha256Hex } from './ir-parity-projection.mjs';
import { runProcess } from './resilient-process.mjs';

export { runProcess } from './resilient-process.mjs';

export const PERFORMANCE_REPORT_VERSION = 'rust-ir-performance-baseline.v0';
export const OBSERVATORY_REPORT_VERSION = 'rust-core-binding-observatory.v0';
export const DEFAULT_PERFORMANCE_FIXTURES = Object.freeze([
  'test/fixtures/ir-parity/small-schema.graphql',
  'test/fixtures/ir-parity/medium-schema.graphql',
  'test/fixtures/ir-parity/large-schema.graphql',
  'test/fixtures/ir-parity/directive-heavy-schema.graphql',
  'test/fixtures/ir-parity/legacy-alias-schema.graphql',
  'test/fixtures/ir-parity/schema-extensions-schema.graphql',
  'test/fixtures/ir-parity/nested-list-schema.graphql'
]);

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');
const CARGO = process.env.CARGO || 'cargo';
const WESLEY_CLI_ARGS = ['run', '--quiet', '-p', 'wesley-cli', '--'];
const WESLEY_CLI_BIN = process.env.WESLEY_CLI_BIN || null;
const DEFAULT_ITERATIONS = 3;
const DEFAULT_WARMUPS = 1;
const LOWER_TIMEOUT_MS = readPositiveIntegerEnv('WESLEY_PERF_TIMEOUT_MS', 120_000);
const GIT_TIMEOUT_MS = readPositiveIntegerEnv('WESLEY_GIT_TIMEOUT_MS', 5_000);
const LOWER_MAX_BUFFER_BYTES = readPositiveIntegerEnv(
  'WESLEY_PERF_MAX_BUFFER_BYTES',
  64 * 1024 * 1024
);
const GIT_MAX_BUFFER_BYTES = readPositiveIntegerEnv('WESLEY_GIT_MAX_BUFFER_BYTES', 1024 * 1024);

async function main() {
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

  const report = options.observatory
    ? await measureObservatory(options)
    : await measurePerformance(options);
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
  let includeLegacyJs = false;
  let observatory = false;

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
    } else if (arg === '--include-legacy-js') {
      includeLegacyJs = true;
    } else if (arg === '--observatory') {
      observatory = true;
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
    includeLegacyJs,
    observatory,
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

function readPositiveIntegerEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return parsePositiveInteger(raw, name);
}

async function measurePerformance(options) {
  const fixtures = [];
  for (const fixture of options.fixtures) {
    fixtures.push(await measureFixture(resolve(ROOT_DIR, fixture), options));
  }
  const failed = fixtures.filter((fixture) => fixture.status !== 'pass').length;

  return {
    tool: PERFORMANCE_REPORT_VERSION,
    gitHead: await gitHead(),
    lowerer: WESLEY_CLI_BIN || `${CARGO} ${WESLEY_CLI_ARGS.join(' ')}`,
    comparisons: {
      legacyJsLowering: options.includeLegacyJs
        ? {
            status: 'captured',
            lowerer: 'GraphQLAdapter.parseSDL',
            caveat:
              'Measured in-process JS lowerer wall-clock time only; this is not Node binding or WASM overhead.'
          }
        : {
            status: 'not-captured',
            reason: 'pass --include-legacy-js to measure legacy JS lowerer wall-clock samples'
          }
    },
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

async function measureObservatory(options) {
  const fixtures = [];
  for (const fixture of options.fixtures) {
    fixtures.push(await measureObservatoryFixture(resolve(ROOT_DIR, fixture), options));
  }
  const failed = fixtures.filter((fixture) => fixture.status !== 'pass').length;

  return {
    tool: OBSERVATORY_REPORT_VERSION,
    gitHead: await gitHead(),
    corpus: {
      fixtureCount: options.fixtures.length,
      fixtures: options.fixtures.map((fixture) => relative(ROOT_DIR, resolve(ROOT_DIR, fixture)))
    },
    iterations: options.iterations,
    warmups: options.warmups,
    adapters: {
      rustCli: {
        id: 'rust-cli',
        status: 'captured',
        host: 'native-rust-cli',
        binding: 'child-process',
        executionMode: 'rust-native',
        lowerer: WESLEY_CLI_BIN || `${CARGO} ${WESLEY_CLI_ARGS.join(' ')}`,
        bindingOverhead: {
          status: 'not-applicable',
          reason:
            'Rust CLI measurement includes process launch and lowering; it is the baseline, not a binding hop.'
        },
        memory: rustCliMemoryPolicy()
      },
      legacyJsInProcess: {
        id: 'legacy-js-in-process',
        status: 'captured',
        host: 'node',
        binding: 'in-process-js',
        executionMode: 'typescript-node',
        lowerer: 'GraphQLAdapter.parseSDL',
        caveat:
          'Measured in-process JS lowerer wall-clock and heap delta only; this is not Node-to-Rust or WASM overhead.',
        memory: {
          heapDeltaBytes: {
            status: 'captured',
            caveat:
              'heapUsed deltas are process-local samples and can be negative when the Node runtime releases memory.'
          }
        }
      },
      nodeRustBinding: {
        id: 'node-rust-binding',
        status: 'not-implemented',
        host: 'node',
        binding: 'napi-or-native-addon-pending',
        executionMode: 'rust-native',
        reason:
          'No Node-to-Rust binding package is implemented yet; this report reserves the evidence slot without choosing N-API or another mechanism.'
      },
      wasmBinding: {
        id: 'wasm-binding',
        status: 'not-implemented',
        host: 'portable-wasm-host',
        binding: 'wasm-pending',
        executionMode: 'wasm',
        reason:
          'No Rust-core WASM lowering binding is implemented yet; this report reserves the portability evidence slot.'
      }
    },
    cutoverCriteria: {
      status: 'not-evaluated',
      requires: [
        'correctness parity over named projections',
        'Rust CLI latency baseline',
        'legacy JS latency and memory baseline',
        'Node binding overhead measurement',
        'WASM binding overhead measurement',
        'peak RSS strategy',
        'normal CLI regression risk review'
      ]
    },
    summary: {
      total: fixtures.length,
      passed: fixtures.length - failed,
      failed,
      capturedAdapters: ['rust-cli', 'legacy-js-in-process'],
      notImplementedAdapters: ['node-rust-binding', 'wasm-binding']
    },
    fixtures
  };
}

async function measureFixture(fixturePath, options) {
  const displayPath = relative(ROOT_DIR, fixturePath);

  try {
    if (!existsSync(fixturePath)) {
      throw new Error(`Fixture does not exist: ${displayPath}`);
    }

    for (let index = 0; index < options.warmups; index += 1) {
      await runLower(fixturePath);
      if (options.includeLegacyJs) {
        measureLegacyJsLower(fixturePath);
      }
    }

    const durationsMs = [];
    const legacyJsDurationsMs = [];
    let lastOutput = '';
    for (let index = 0; index < options.iterations; index += 1) {
      const measured = await measureLower(fixturePath);
      durationsMs.push(measured.durationMs);
      lastOutput = measured.stdout;

      if (options.includeLegacyJs) {
        legacyJsDurationsMs.push(measureLegacyJsLower(fixturePath).durationMs);
      }
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
      durationMs: summarizeDurations(durationsMs),
      ...(options.includeLegacyJs
        ? { legacyJsDurationMs: summarizeDurations(legacyJsDurationsMs) }
        : {})
    };
  } catch (error) {
    return {
      fixture: displayPath,
      status: 'error',
      error: error?.message || String(error)
    };
  }
}

async function measureObservatoryFixture(fixturePath, options) {
  const displayPath = relative(ROOT_DIR, fixturePath);

  try {
    if (!existsSync(fixturePath)) {
      throw new Error(`Fixture does not exist: ${displayPath}`);
    }

    for (let index = 0; index < options.warmups; index += 1) {
      await runLower(fixturePath);
      measureLegacyJsLower(fixturePath);
    }

    const rustDurationsMs = [];
    const legacyJsDurationsMs = [];
    const legacyJsHeapDeltaBytes = [];
    let lastOutput = '';

    for (let index = 0; index < options.iterations; index += 1) {
      const measured = await measureLower(fixturePath);
      rustDurationsMs.push(measured.durationMs);
      lastOutput = measured.stdout;

      const legacyMeasured = measureLegacyJsLower(fixturePath);
      legacyJsDurationsMs.push(legacyMeasured.durationMs);
      legacyJsHeapDeltaBytes.push(legacyMeasured.heapDeltaBytes);
    }

    const parsed = JSON.parse(lastOutput);
    const semanticIr = { ...parsed };
    delete semanticIr.metadata;

    return {
      fixture: displayPath,
      status: 'pass',
      schemaBytes: statSync(fixturePath).size,
      rustCli: {
        status: 'pass',
        outputBytes: Buffer.byteLength(lastOutput),
        rustL1Hash: sha256Hex(canonicalizeJSON(semanticIr)),
        typeCount: Array.isArray(parsed.types) ? parsed.types.length : null,
        durationMs: summarizeDurations(rustDurationsMs),
        memory: rustCliMemoryPolicy()
      },
      legacyJsInProcess: {
        status: 'pass',
        durationMs: summarizeDurations(legacyJsDurationsMs),
        memory: {
          heapDeltaBytes: summarizeIntegerSamples(legacyJsHeapDeltaBytes),
          caveat:
            'heapUsed deltas are process-local samples and can be negative when the Node runtime releases memory.'
        }
      },
      nodeRustBinding: bindingNotImplemented('node-rust-binding'),
      wasmBinding: bindingNotImplemented('wasm-binding')
    };
  } catch (error) {
    return {
      fixture: displayPath,
      status: 'error',
      error: error?.message || String(error)
    };
  }
}

async function measureLower(fixturePath) {
  const started = process.hrtime.bigint();
  const stdout = await runLower(fixturePath);
  const ended = process.hrtime.bigint();
  return {
    stdout,
    durationMs: roundMs(Number(ended - started) / 1_000_000)
  };
}

function measureLegacyJsLower(fixturePath) {
  const sdl = readFileSync(fixturePath, 'utf8');
  const heapBefore = process.memoryUsage().heapUsed;
  const started = process.hrtime.bigint();
  new GraphQLAdapter().parseSDL(sdl);
  const ended = process.hrtime.bigint();
  const heapAfter = process.memoryUsage().heapUsed;

  return {
    durationMs: roundMs(Number(ended - started) / 1_000_000),
    heapDeltaBytes: heapAfter - heapBefore
  };
}

async function runLower(fixturePath) {
  const command = WESLEY_CLI_BIN || CARGO;
  const args = WESLEY_CLI_BIN
    ? ['schema', 'lower', '--schema', fixturePath, '--json']
    : [...WESLEY_CLI_ARGS, 'schema', 'lower', '--schema', fixturePath, '--json'];

  let result;
  try {
    result = await runProcess(command, args, {
      timeoutMs: LOWER_TIMEOUT_MS,
      maxBufferBytes: LOWER_MAX_BUFFER_BYTES
    });
  } catch (error) {
    if (error instanceof TimeoutError) {
      throw new Error(`${command} ${args.join(' ')} timed out after ${LOWER_TIMEOUT_MS}ms`, {
        cause: error
      });
    }
    throw error;
  }

  if (result.status !== 0) {
    const details = (result.stderr || result.stdout || '').trim();
    throw new Error(details || `${command} ${args.join(' ')} failed`);
  }

  return result.stdout;
}

export function summarizeDurations(durations) {
  const sorted = [...durations].sort((left, right) => left - right);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  const midpoint = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? roundMs((sorted[midpoint - 1] + sorted[midpoint]) / 2)
      : sorted[midpoint];

  return {
    samples: durations,
    min: sorted[0],
    median,
    mean: roundMs(total / sorted.length),
    max: sorted[sorted.length - 1]
  };
}

export function summarizeIntegerSamples(samples) {
  const sorted = [...samples].sort((left, right) => left - right);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  const midpoint = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? Math.round((sorted[midpoint - 1] + sorted[midpoint]) / 2)
      : sorted[midpoint];

  return {
    samples,
    min: sorted[0],
    median,
    mean: Math.round(total / sorted.length),
    max: sorted[sorted.length - 1]
  };
}

function rustCliMemoryPolicy() {
  return {
    peakRssBytes: {
      status: 'not-captured',
      reason:
        'Rust CLI peak RSS requires a platform-specific child-process memory harness; v0 records the evidence slot only.'
    }
  };
}

function bindingNotImplemented(id) {
  return {
    status: 'not-implemented',
    adapter: id,
    reason:
      'Reserved observatory evidence slot; no executable binding adapter exists in this repo yet.'
  };
}

function roundMs(value) {
  return Math.round(value * 1000) / 1000;
}

export async function gitHead(processRunner = runProcess) {
  let result;
  try {
    result = await processRunner('git', ['rev-parse', '--short=12', 'HEAD'], {
      timeoutMs: GIT_TIMEOUT_MS,
      maxBufferBytes: GIT_MAX_BUFFER_BYTES
    });
  } catch (error) {
    if (error instanceof TimeoutError) {
      console.error(
        `git rev-parse timed out after ${GIT_TIMEOUT_MS}ms; recording unknown git head`
      );
    } else {
      console.error(`git rev-parse failed: ${error.message}; recording unknown git head`);
    }
    return null;
  }

  if (result.status !== 0) return null;
  return result.stdout.trim() || null;
}

function renderMarkdown(report) {
  if (report.tool === OBSERVATORY_REPORT_VERSION) {
    return renderObservatoryMarkdown(report);
  }

  const lines = [
    '# Rust IR Performance Baseline',
    '',
    `- Tool: \`${report.tool}\``,
    `- Git head: \`${report.gitHead ?? 'unknown'}\``,
    `- Lowerer: \`${report.lowerer}\``,
    `- Legacy JS comparison: \`${report.comparisons.legacyJsLowering.status}\``,
    `- Warmups: \`${report.warmups}\``,
    `- Iterations: \`${report.iterations}\``,
    `- Memory: \`${report.memory.status}\``,
    ''
  ];

  if (report.comparisons.legacyJsLowering.status === 'captured') {
    lines.push(
      '',
      '| Fixture | Status | Types | Rust Median ms | Rust Mean ms | Legacy JS Median ms | Legacy JS Mean ms | Rust L1 Hash |',
      '| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |'
    );

    for (const fixture of report.fixtures) {
      if (fixture.status !== 'pass') {
        lines.push(
          `| \`${fixture.fixture}\` | ${fixture.status}: ${escapeMarkdownCell(fixture.error)} |  |  |  |  |  |  |`
        );
        continue;
      }

      lines.push(
        `| \`${fixture.fixture}\` | ${fixture.status} | ${fixture.typeCount ?? ''} | ` +
          `${fixture.durationMs.median} | ${fixture.durationMs.mean} | ` +
          `${fixture.legacyJsDurationMs?.median ?? ''} | ${fixture.legacyJsDurationMs?.mean ?? ''} | ` +
          `\`${fixture.rustL1Hash}\` |`
      );
    }

    return lines.join('\n');
  }

  lines.push(
    '| Fixture | Status | Types | Schema Bytes | Output Bytes | Median ms | Mean ms | Rust L1 Hash |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |'
  );

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

function renderObservatoryMarkdown(report) {
  const lines = [
    '# Rust Core Binding Observatory',
    '',
    `- Tool: \`${report.tool}\``,
    `- Git head: \`${report.gitHead ?? 'unknown'}\``,
    `- Warmups: \`${report.warmups}\``,
    `- Iterations: \`${report.iterations}\``,
    `- Cutover criteria: \`${report.cutoverCriteria.status}\``,
    '',
    '| Adapter | Status | Host | Binding | Execution Mode |',
    '| --- | --- | --- | --- | --- |'
  ];

  for (const adapter of Object.values(report.adapters)) {
    lines.push(
      `| \`${adapter.id}\` | ${adapter.status} | ${adapter.host} | ${adapter.binding} | ${adapter.executionMode} |`
    );
  }

  lines.push(
    '',
    '| Fixture | Status | Types | Rust CLI Median ms | Legacy JS Median ms | Legacy JS Heap Delta Mean bytes | Node Binding | WASM Binding |',
    '| --- | --- | ---: | ---: | ---: | ---: | --- | --- |'
  );

  for (const fixture of report.fixtures) {
    if (fixture.status !== 'pass') {
      lines.push(
        `| \`${fixture.fixture}\` | ${fixture.status}: ${escapeMarkdownCell(fixture.error)} |  |  |  |  |  |  |`
      );
      continue;
    }

    lines.push(
      `| \`${fixture.fixture}\` | ${fixture.status} | ${fixture.rustCli.typeCount ?? ''} | ` +
        `${fixture.rustCli.durationMs.median} | ${fixture.legacyJsInProcess.durationMs.median} | ` +
        `${fixture.legacyJsInProcess.memory.heapDeltaBytes.mean} | ` +
        `${fixture.nodeRustBinding.status} | ${fixture.wasmBinding.status} |`
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
  console.log(`Usage: pnpm perf:ir [--json|--markdown] [--include-legacy-js] [--observatory] [--list-fixtures] [--fixture <path> ...] [--iterations <n>] [--warmups <n>] [--output <path>]

Measures Rust CLI schema-lower wall-clock duration over the explicit IR fixture
corpus. The v0 report is evidence, not a pass/fail performance threshold.

Pass --observatory to emit the Rust core binding observatory report, which
captures Rust CLI and legacy JS measurements while reserving explicit
not-implemented evidence slots for Node-to-Rust and WASM bindings.

Default fixtures:
${DEFAULT_PERFORMANCE_FIXTURES.map((fixture) => `  - ${fixture}`).join('\n')}`);
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
