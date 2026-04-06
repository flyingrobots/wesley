import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import { WesleyError, computeSdlHash, schemaHash } from '@wesley/core';
import { hashSchema as hashTtdSchema } from '@wesley/core/ttd';
import path from 'node:path';
import { canonicalizeSchemaPath, joinPath } from './path-utils.mjs';

const WITNESS_KIND = 'wesley.continuum.conformance.v1';
const CURRENT_SCOPE = 'current-minimum-shared-surface';
const TTD_REQUIRED_FILES = [
  'manifest/schema.json',
  'manifest/contracts.json',
  'manifest/manifest.json',
  'manifest/ttd-ir.json',
  'typescript/types.ts',
  'typescript/zod.ts',
  'typescript/registry.ts',
  'typescript/index.ts'
];
const ECHO_REQUIRED_FILES = [
  'ir.json',
  'ops.generated.ts',
  'schemas.generated.ts',
  'client.generated.ts',
  'raw_le_codec.generated.ts',
  'raw_le_codec.generated.rs',
  'wasm_abi_codec.generated.ts',
  'wasm_abi_codec.generated.rs',
  'mock/deliveries.jsonl',
  'mock/summary.json'
];
const RECEIPT_ONLY_FIELDS = [
  'receiptId',
  'writerId',
  'inputTick',
  'outputTick',
  'admittedRewriteCount',
  'rejectedRewriteCount',
  'counterfactualCount',
  'digest'
];
const DELIVERY_OBSERVATION_REQUIRED_FIELDS = [
  ['observationId', isNonEmptyString],
  ['emissionId', isNonEmptyString],
  ['headId', isNonEmptyString],
  ['frameIndex', Number.isInteger],
  ['sinkId', isNonEmptyString],
  ['outcome', isNonEmptyString],
  ['reason', isNonEmptyString],
  ['executionMode', isNonEmptyString],
  ['summary', isNonEmptyString]
];

export class WitnessContinuumCommand extends WesleyCommand {
  constructor(ctx) {
    super(
      ctx,
      'witness-continuum',
      'Verify current Continuum minimum-surface coherence and write a conformance witness'
    );
  }

  configureCommander(cmd) {
    return cmd
      .option('--ttd-schema <path>', 'TTD schema path', 'schemas/ttd-protocol.graphql')
      .option('--ttd-dir <dir>', 'TTD output directory', '.wesley-cache/continuum/local-inspect/ttd')
      .option('--echo-schema <path>', 'Echo schema path', 'schemas/echo-core-types.graphql')
      .option('--echo-dir <dir>', 'Echo output directory', '.wesley-cache/continuum/local-inspect/echo')
      .option(
        '-o, --out <path>',
        'Conformance witness output path',
        '.wesley-cache/continuum/local-inspect/witness/conformance.json'
      )
      .option('--dry-run', 'Compute the witness without writing the conformance file');
  }

  async executeCore({ options, logger }) {
    const report = await buildContinuumWitnessReport({
      fs: this.ctx.fs,
      crypto: this.ctx.crypto,
      ttdSchemaPath: options.ttdSchema,
      ttdDir: options.ttdDir,
      echoSchemaPath: options.echoSchema,
      echoDir: options.echoDir,
      outputPath: options.out
    });

    if (!options.dryRun) {
      await this.ctx.fs.write(options.out, JSON.stringify(report, null, 2) + '\n');
    }

    if (report.status === 'fail') {
      const guidance = options.dryRun
        ? ' No report file was written because --dry-run was set.'
        : ` See ${options.out}.`;
      throw new WesleyError(
        'CONTINUUM_WITNESS_FAILED',
        `Continuum witness failed ${report.summary.failed} check(s).${guidance}`
      );
    }

    if (!options.quiet && !options.json) {
      logger?.info?.(`Continuum witness passed (${report.summary.passed}/${report.summary.totalChecks} checks)`);
      if (options.dryRun) {
        logger?.info?.('Witness report not written because --dry-run was set.');
      } else {
        logger?.info?.(`Witness report: ${options.out}`);
      }
    }

    return report;
  }
}

export async function buildContinuumWitnessReport({
  fs,
  crypto,
  ttdSchemaPath,
  ttdDir,
  echoSchemaPath,
  echoDir,
  outputPath
}) {
  const checks = [];
  const ttdSurface = await inspectTtdSurface({ fs, crypto, schemaPath: ttdSchemaPath, outDir: ttdDir, checks });
  const echoSurface = await inspectEchoSurface({ fs, schemaPath: echoSchemaPath, outDir: echoDir, checks });

  const summary = summarizeChecks(checks);

  return {
    kind: WITNESS_KIND,
    scope: CURRENT_SCOPE,
    status: summary.failed === 0 ? 'pass' : 'fail',
    outputPath,
    proves: [
      'schema-to-artifact consistency for the current TTD and Echo minimum surfaces',
      'manifest and source traceability for emitted local inspect outputs',
      'fixture-level conformance for the mocked deliveries inspect surface',
      'one explicit delivery-observation-versus-receipt separation case'
    ],
    doesNotProve: [
      'runtime policy correctness',
      'storage semantics',
      'debugger semantics',
      'full Continuum completeness',
      'the not-yet-authored receipt-family proving lane'
    ],
    surfaces: {
      ttd: ttdSurface,
      echo: echoSurface
    },
    summary,
    checks
  };
}

async function inspectTtdSurface({ fs, crypto, schemaPath, outDir, checks }) {
  const schemaContent = await fs.read(schemaPath);
  const expectedHash = await hashTtdSchema(schemaContent, { crypto });
  const requiredPaths = TTD_REQUIRED_FILES.map((file) => joinPath(outDir, file));
  const missingFiles = await collectMissingFiles(fs, requiredPaths);
  const missingRelative = missingFiles.map((missingPath) => relativePath(outDir, missingPath));

  checks.push(createCheck(
    'ttd.required-files',
    missingFiles.length === 0,
    missingFiles.length === 0
      ? `Found all ${TTD_REQUIRED_FILES.length} required TTD artifacts.`
      : `Missing TTD artifacts: ${missingRelative.join(', ')}`,
    {
      outDir,
      requiredFiles: TTD_REQUIRED_FILES,
      missingFiles: missingRelative
    }
  ));

  if (missingFiles.length > 0) {
    return {
      schemaPath,
      schemaHash: expectedHash,
      outDir,
      missingFiles: missingRelative
    };
  }

  const schemaJson = await readJson(fs, joinPath(outDir, 'manifest/schema.json'));
  const manifestJson = await readJson(fs, joinPath(outDir, 'manifest/manifest.json'));
  const contractsJson = await readJson(fs, joinPath(outDir, 'manifest/contracts.json'));

  const hashMatches = schemaJson.hash === expectedHash;
  checks.push(createCheck(
    'ttd.schema-traceability',
    hashMatches,
    hashMatches
      ? 'TTD schema hash matches the authored schema input.'
      : `TTD schema hash mismatch: expected ${expectedHash}, got ${schemaJson.hash}`,
    {
      expectedHash,
      actualHash: schemaJson.hash,
      schemaPath
    }
  ));

  const manifestConsistent = Array.isArray(manifestJson.channels) &&
    Array.isArray(schemaJson.channels) &&
    Array.isArray(manifestJson.ops) &&
    Array.isArray(schemaJson.ops) &&
    Array.isArray(contractsJson.emissions) &&
    manifestJson.channels.length === schemaJson.channels.length &&
    manifestJson.ops.length === schemaJson.ops.length;
  checks.push(createCheck(
    'ttd.manifest-consistency',
    manifestConsistent,
    manifestConsistent
      ? 'TTD manifest and schema outputs agree on channel and operation counts.'
      : 'TTD manifest outputs diverge on channel or operation counts.',
    {
      channels: {
        manifest: manifestJson.channels?.length ?? null,
        schema: schemaJson.channels?.length ?? null
      },
      ops: {
        manifest: manifestJson.ops?.length ?? null,
        schema: schemaJson.ops?.length ?? null
      },
      emissionCount: contractsJson.emissions?.length ?? null
    }
  ));

  return {
    schemaPath,
    schemaHash: expectedHash,
    outDir,
    channels: schemaJson.channels?.length ?? 0,
    ops: schemaJson.ops?.length ?? 0,
    emissions: contractsJson.emissions?.length ?? 0
  };
}

async function inspectEchoSurface({ fs, schemaPath, outDir, checks }) {
  const schemaContent = await fs.read(schemaPath);
  const expectedHash = await schemaHash(schemaContent);
  const expectedIrHash = await computeSdlHash(schemaContent);
  const requiredPaths = ECHO_REQUIRED_FILES.map((file) => joinPath(outDir, file));
  const missingFiles = await collectMissingFiles(fs, requiredPaths);
  const missingRelative = missingFiles.map((missingPath) => relativePath(outDir, missingPath));

  checks.push(createCheck(
    'echo.required-files',
    missingFiles.length === 0,
    missingFiles.length === 0
      ? `Found all ${ECHO_REQUIRED_FILES.length} required Echo artifacts and mock outputs.`
      : `Missing Echo artifacts: ${missingRelative.join(', ')}`,
    {
      outDir,
      requiredFiles: ECHO_REQUIRED_FILES,
      missingFiles: missingRelative
    }
  ));

  if (missingFiles.length > 0) {
    return {
      schemaPath,
      schemaHash: expectedHash,
      outDir,
      missingFiles: missingRelative
    };
  }

  const irJson = await readJson(fs, joinPath(outDir, 'ir.json'));
  const summaryJson = await readJson(fs, joinPath(outDir, 'mock/summary.json'));
  const deliveryLines = await fs.read(joinPath(outDir, 'mock/deliveries.jsonl'));
  const deliveryRows = parseJsonl(deliveryLines);
  const deliveredOutcomes = countDeliveryOutcomes(deliveryRows);
  const malformedRows = findMalformedDeliveryObservationRows(deliveryRows);
  const irHash = irJson.schema_hash ?? irJson.schema_sha256 ?? null;

  const expectedCanonicalSchemaPath = canonicalizeSchemaPath(schemaPath);
  const actualCanonicalSchemaPath = summaryJson.canonicalSchemaPath ??
    canonicalizeSchemaPath(summaryJson.schemaPath);
  const traceable = summaryJson.kind === 'wesley.echo-bundle.inspect.v1' &&
    summaryJson.schemaHash === expectedHash &&
    isNonEmptyString(summaryJson.schemaPath) &&
    (expectedCanonicalSchemaPath == null
      ? actualCanonicalSchemaPath == null
      : actualCanonicalSchemaPath != null &&
        actualCanonicalSchemaPath === expectedCanonicalSchemaPath);
  checks.push(createCheck(
    'echo.summary-traceability',
    traceable,
    traceable
      ? 'Echo inspect summary matches the authored schema hash and records traceable schema origin.'
      : 'Echo inspect summary does not match the authored schema input.',
    {
      expectedHash,
      actualHash: summaryJson.schemaHash,
      expectedSchemaPath: schemaPath,
      actualSchemaPath: summaryJson.schemaPath,
      expectedCanonicalSchemaPath,
      actualCanonicalSchemaPath
    }
  ));

  const irTraceable = typeof irHash === 'string' && irHash === expectedIrHash;
  checks.push(createCheck(
    'echo.ir-traceability',
    irTraceable,
    irTraceable
      ? 'Echo IR SDL hash matches the authored schema input.'
      : 'Echo IR SDL hash does not match the authored schema input.',
    {
      expectedHash: expectedIrHash,
      actualHash: irHash
    }
  ));

  const files = Array.isArray(summaryJson.echo?.files) ? summaryJson.echo.files : [];
  const summaryMatchesIr = summaryJson.echo?.artifactCount === files.length &&
    summaryJson.echo?.ir?.typeCount === (irJson.types?.length ?? 0) &&
    summaryJson.echo?.ir?.opCount === (irJson.ops?.length ?? 0);
  checks.push(createCheck(
    'echo.summary-consistency',
    summaryMatchesIr,
    summaryMatchesIr
      ? 'Echo summary matches the emitted IR and artifact list.'
      : 'Echo summary diverges from the emitted IR or artifact list.',
    {
      artifactCount: {
        summary: summaryJson.echo?.artifactCount ?? null,
        files: files.length
      },
      ir: {
        summaryTypeCount: summaryJson.echo?.ir?.typeCount ?? null,
        actualTypeCount: irJson.types?.length ?? null,
        summaryOpCount: summaryJson.echo?.ir?.opCount ?? null,
        actualOpCount: irJson.ops?.length ?? null
      }
    }
  ));

  const rowsConform = malformedRows.length === 0;
  checks.push(createCheck(
    'echo.mock-deliveries-shape',
    rowsConform,
    rowsConform
      ? 'Mocked deliveries rows satisfy the DeliveryObservationSummary shape contract.'
      : 'Mocked deliveries rows are missing required DeliveryObservationSummary fields.',
    {
      requiredFields: DELIVERY_OBSERVATION_REQUIRED_FIELDS.map(([field]) => field),
      malformedRows
    }
  ));

  const mockMatches = summaryJson.mock?.command === 'deliveries' &&
    summaryJson.mock?.observationCount === deliveryRows.length &&
    sameOutcomeCounts(summaryJson.mock?.outcomes ?? {}, deliveredOutcomes) &&
    deliveryRows.every((row) => row.envelope === 'DeliveryObservationSummary');
  checks.push(createCheck(
    'echo.mock-deliveries-summary',
    mockMatches,
    mockMatches
      ? 'Mocked deliveries summary matches the JSONL witness rows.'
      : 'Mocked deliveries summary diverges from the JSONL witness rows.',
    {
      summaryObservationCount: summaryJson.mock?.observationCount ?? null,
      actualObservationCount: deliveryRows.length,
      summaryOutcomes: summaryJson.mock?.outcomes ?? {},
      actualOutcomes: deliveredOutcomes
    }
  ));

  const separationHolds = summaryJson.mock?.command === 'deliveries' &&
    deliveryRows.every((row) => {
      const data = row.data ?? {};
      return !RECEIPT_ONLY_FIELDS.some((field) => Object.hasOwn(data, field));
    });
  checks.push(createCheck(
    'continuum.delivery-vs-receipt-separation',
    separationHolds,
    separationHolds
      ? 'Mocked witness rows stay on DeliveryObservationSummary and do not absorb receipt-only fields.'
      : 'Mocked witness rows blur delivery observations with receipt-only fields.',
    {
      command: summaryJson.mock?.command ?? null,
      forbiddenFields: RECEIPT_ONLY_FIELDS
    }
  ));

  return {
    schemaPath,
    schemaHash: expectedHash,
    outDir,
    typeCount: irJson.types?.length ?? 0,
    opCount: irJson.ops?.length ?? 0,
    observationCount: deliveryRows.length,
    outcomes: deliveredOutcomes
  };
}

async function collectMissingFiles(fs, paths) {
  const missing = [];
  for (const path of paths) {
    if (!(await fs.exists(path))) {
      missing.push(path);
    }
  }
  return missing;
}

async function readJson(fs, path) {
  return JSON.parse(await fs.read(path));
}

function parseJsonl(content) {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const preview = line.length > 120 ? `${line.slice(0, 117)}...` : line;
      throw new WesleyError(
        'CONTINUUM_WITNESS_INVALID_JSONL',
        `JSONL parse error at line ${index + 1}: ${message}. Line: ${preview}`,
        { lineNumber: index + 1, preview },
        error instanceof Error ? error : undefined
      );
    }
  });
}

function countDeliveryOutcomes(rows) {
  return rows.reduce((counts, row) => {
    const outcome = row?.data?.outcome ?? 'unknown';
    counts[outcome] = (counts[outcome] ?? 0) + 1;
    return counts;
  }, {});
}

function sameOutcomeCounts(expected, actual) {
  const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  for (const key of keys) {
    if ((expected[key] ?? 0) !== (actual[key] ?? 0)) {
      return false;
    }
  }
  return true;
}

function summarizeChecks(checks) {
  const passed = checks.filter((check) => check.status === 'pass').length;
  const failed = checks.filter((check) => check.status === 'fail').length;
  return {
    totalChecks: checks.length,
    passed,
    failed
  };
}

function createCheck(id, pass, message, details) {
  return {
    id,
    status: pass ? 'pass' : 'fail',
    message,
    details
  };
}

function relativePath(outDir, targetPath) {
  return path.posix.relative(joinPath(outDir), targetPath);
}

function findMalformedDeliveryObservationRows(rows) {
  return rows.flatMap((row, index) => {
    const problems = validateDeliveryObservationRow(row);
    return problems.length === 0 ? [] : [{
      index,
      problems
    }];
  });
}

function validateDeliveryObservationRow(row) {
  const problems = [];

  if (row.envelope !== 'DeliveryObservationSummary') {
    problems.push('envelope');
  }

  const data = row?.data;
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    problems.push('data');
    return problems;
  }

  for (const [field, predicate] of DELIVERY_OBSERVATION_REQUIRED_FIELDS) {
    if (!predicate(data[field])) {
      problems.push(`data.${field}`);
    }
  }

  return problems;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}
