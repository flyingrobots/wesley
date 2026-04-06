import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import { WesleyError, schemaHash } from '@wesley/core';
import { canonicalizeSchemaPath, joinPath } from './path-utils.mjs';

const MOCK_WARP_COMMAND = 'deliveries';
const HEAD_ID = 'head:wesley:continuum';
const FRAME_INDEX = 0;

export class BundleEchoCommand extends WesleyCommand {
  constructor(ctx) {
    super(
      ctx,
      'bundle-echo',
      'Generate Echo bundle artifacts plus a mocked warp-ttd deliveries surface'
    );
    this.requiresSchema = true;
  }

  configureCommander(cmd) {
    return cmd
      .option('-s, --schema <path>', 'GraphQL schema file. Use "-" for stdin', 'schema.graphql')
      .option('--stdin', 'Read schema from stdin')
      .option(
        '-o, --out-dir <dir>',
        'Output directory',
        '.wesley-cache/continuum/local-inspect/echo'
      )
      .option('--dry-run', 'Show what would be generated without writing files');
  }

  async executeCore(context) {
    const { schemaContent, schemaPath, options, logger } = context;
    const generateEcho = await resolveGenerateEcho();
    const bundle = await generateEcho({ sdl: schemaContent });

    if (!bundle || !Array.isArray(bundle.files)) {
      throw new WesleyError(
        'ECHO_GENERATION_FAILED',
        'Echo generation returned an unexpected result shape.'
      );
    }

    const files = bundle.files.map((file) => ({
      path: file.path,
      content: file.content,
      size: Buffer.byteLength(file.content, 'utf8')
    }));
    const hash = await schemaHash(schemaContent);
    const ir = readIr(files);
    const mock = buildMockDeliveries({
      schemaPath,
      schemaHashHex: hash,
      files,
      ir,
      outDir: options.outDir
    });
    const summary = buildBundleSummary({
      schemaPath,
      schemaHashHex: hash,
      outDir: options.outDir,
      files,
      ir,
      profile: bundle.profile ?? null,
      mock
    });

    if (!options.dryRun) {
      for (const file of files) {
        await this.ctx.fs.write(joinPath(options.outDir, file.path), file.content);
      }
      await this.ctx.fs.write(mock.outputPath, mock.jsonl);
      await this.ctx.fs.write(mock.summaryPath, JSON.stringify(summary, null, 2) + '\n');
    }

    if (!options.quiet && !options.json) {
      const action = options.dryRun ? 'Would generate' : 'Generated';
      logger?.info?.(`${action} Echo bundle (${files.length} files) from ${schemaPath}`);
      logger?.info?.(`Mocked warp-ttd surface: ${MOCK_WARP_COMMAND} (${mock.rows.length} observations)`);
      if (options.dryRun) {
        logger?.info?.('Artifact summary not written because --dry-run was set.');
      } else {
        logger?.info?.(`Artifact summary: ${mock.summaryPath}`);
      }
    }

    return {
      schemaPath,
      canonicalSchemaPath: canonicalizeSchemaPath(schemaPath),
      schemaHash: hash,
      outDir: options.outDir,
      dryRun: Boolean(options.dryRun),
      echo: {
        artifactCount: files.length,
        files: files.map(({ path, size }) => ({ path, size })),
        ir: summarizeIr(ir),
        profile: bundle.profile ?? null
      },
      mock: {
        command: MOCK_WARP_COMMAND,
        outputPath: mock.outputPath,
        summaryPath: mock.summaryPath,
        observationCount: mock.rows.length,
        outcomes: countOutcomes(mock.rows)
      }
    };
  }
}

function buildBundleSummary({
  schemaPath,
  schemaHashHex,
  outDir,
  files,
  ir,
  profile,
  mock
}) {
  return {
    kind: 'wesley.echo-bundle.inspect.v1',
    schemaPath,
    canonicalSchemaPath: canonicalizeSchemaPath(schemaPath),
    schemaHash: schemaHashHex,
    outDir,
    mockCommand: mock.command,
    disclaimer:
      'This is a local inspect surface. The deliveries output is a mocked warp-ttd-style surface, not a claim about live runtime behavior.',
    echo: {
      artifactCount: files.length,
      files: files.map(({ path, size }) => ({ path, size })),
      ir: summarizeIr(ir),
      profile
    },
    mock: {
      command: mock.command,
      outputPath: mock.outputPath,
      observationCount: mock.rows.length,
      outcomes: countOutcomes(mock.rows)
    }
  };
}

function buildMockDeliveries({ schemaPath, schemaHashHex, files, ir, outDir }) {
  const shortHash = schemaHashHex.slice(0, 12);
  const tsFiles = files.filter((file) => file.path.endsWith('.ts'));
  const rsFiles = files.filter((file) => file.path.endsWith('.rs'));
  const opCount = Array.isArray(ir?.ops) ? ir.ops.length : 0;

  const rows = [
    createObservation({
      shortHash,
      suffix: 'ir',
      sinkId: 'sink:echo-ir',
      outcome: 'delivered',
      reason: `Mocked from Wesley bundle-echo for ${schemaPath}; ir.json was emitted successfully.`,
      summary: 'Echo IR delivered to the local inspect surface.'
    }),
    createObservation({
      shortHash,
      suffix: 'typescript',
      sinkId: 'sink:typescript-bundle',
      outcome: 'delivered',
      reason: `Mocked from Wesley bundle-echo; ${tsFiles.length} TypeScript artifacts were emitted.`,
      summary: `TypeScript contract bundle marked delivered (${tsFiles.length} files).`
    }),
    createObservation({
      shortHash,
      suffix: 'rust',
      sinkId: 'sink:rust-codec-bundle',
      outcome: rsFiles.length > 0 ? 'delivered' : 'suppressed',
      reason: rsFiles.length > 0
        ? `Mocked from Wesley bundle-echo; ${rsFiles.length} Rust artifacts were emitted.`
        : 'Mocked from Wesley bundle-echo; no Rust artifacts were emitted for this schema.',
      summary: rsFiles.length > 0
        ? `Rust codec bundle marked delivered (${rsFiles.length} files).`
        : 'Rust codec delivery suppressed because no Rust artifacts were emitted.'
    }),
    createObservation({
      shortHash,
      suffix: 'ops',
      sinkId: 'sink:ops-catalog',
      outcome: opCount > 0 ? 'delivered' : 'suppressed',
      reason: opCount > 0
        ? `Mocked from Wesley bundle-echo; the emitted Echo IR carries ${opCount} operation entries.`
        : 'Mocked from Wesley bundle-echo; the schema defines no Query or Mutation operations, so the ops catalog stays empty.',
      summary: opCount > 0
        ? `Operation catalog marked delivered with ${opCount} entries.`
        : 'Operation catalog delivery suppressed for a zero-op schema.'
    })
  ];

  const outputPath = joinPath(outDir, 'mock', `${MOCK_WARP_COMMAND}.jsonl`);
  const summaryPath = joinPath(outDir, 'mock', 'summary.json');

  return {
    command: MOCK_WARP_COMMAND,
    outputPath,
    summaryPath,
    rows,
    jsonl: rows.map((row) =>
      JSON.stringify({
        envelope: 'DeliveryObservationSummary',
        data: row
      })
    ).join('\n') + '\n'
  };
}

function createObservation({ shortHash, suffix, sinkId, outcome, reason, summary }) {
  return {
    observationId: `deliv:wesley:${shortHash}:${suffix}`,
    emissionId: `emit:wesley:bundle:${shortHash}:${suffix}`,
    headId: HEAD_ID,
    frameIndex: FRAME_INDEX,
    sinkId,
    outcome,
    reason,
    executionMode: 'debug',
    summary
  };
}

function summarizeIr(ir) {
  return {
    typeCount: Array.isArray(ir?.types) ? ir.types.length : 0,
    opCount: Array.isArray(ir?.ops) ? ir.ops.length : 0
  };
}

function countOutcomes(rows) {
  return rows.reduce((counts, row) => {
    counts[row.outcome] = (counts[row.outcome] ?? 0) + 1;
    return counts;
  }, {});
}

function readIr(files) {
  const irFile = files.find((file) => file.path === 'ir.json');
  if (!irFile) {
    throw new WesleyError('ECHO_GENERATION_FAILED', 'Echo generation did not emit ir.json.');
  }
  return JSON.parse(irFile.content);
}

async function resolveGenerateEcho() {
  try {
    const mod = await import('@wesley/generator-echo');
    return mod.generateEcho;
  } catch {
    const mod = await import('../../../wesley-generator-echo/src/index.mjs');
    return mod.generateEcho;
  }
}
