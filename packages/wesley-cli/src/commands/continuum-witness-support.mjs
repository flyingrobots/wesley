import path from 'node:path';
import { WesleyError, computeSdlHash, schemaHash } from '@wesley/core';
import { hashSchema as hashTtdSchema } from '@wesley/core/ttd';
import { canonicalizeSchemaPath, joinPath } from './path-utils.mjs';

export const DEFAULT_TTD_REQUIRED_FILES = [
  'manifest/schema.json',
  'manifest/contracts.json',
  'manifest/manifest.json',
  'manifest/ttd-ir.json',
  'typescript/types.ts',
  'typescript/zod.ts',
  'typescript/registry.ts',
  'typescript/index.ts'
];
export const DEFAULT_ECHO_REQUIRED_FILES = [
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

export async function inspectTtdSurface({
  fs,
  crypto,
  schemaPath,
  outDir,
  checks,
  requiredFiles = DEFAULT_TTD_REQUIRED_FILES
}) {
  const schemaContent = await fs.read(schemaPath);
  const { hash: expectedHash, error: schemaError } = computeTtdSchemaHash(schemaContent, crypto);
  const requiredPaths = requiredFiles.map((file) => joinPath(outDir, file));
  const missingFiles = await collectMissingFiles(fs, requiredPaths);
  const missingRelative = missingFiles.map((missingPath) => relativePath(outDir, missingPath));

  checks.push(createCheck(
    'ttd.schema-input-validity',
    schemaError == null,
    schemaError == null
      ? 'TTD authored schema parses cleanly for canonical hashing.'
      : `TTD authored schema could not be canonically hashed: ${schemaError}`,
    {
      schemaPath,
      error: schemaError
    }
  ));

  checks.push(createCheck(
    'ttd.required-files',
    missingFiles.length === 0,
    missingFiles.length === 0
      ? `Found all ${requiredFiles.length} required TTD artifacts.`
      : `Missing TTD artifacts: ${missingRelative.join(', ')}`,
    {
      outDir,
      requiredFiles,
      missingFiles: missingRelative
    }
  ));

  if (missingFiles.length > 0) {
    return {
      schemaPath,
      schemaHash: expectedHash,
      schemaError,
      outDir,
      missingFiles: missingRelative
    };
  }

  const schemaJson = await readJson(fs, joinPath(outDir, 'manifest/schema.json'));
  const manifestJson = await readJson(fs, joinPath(outDir, 'manifest/manifest.json'));
  const contractsJson = await readJson(fs, joinPath(outDir, 'manifest/contracts.json'));

  const hashMatches = typeof expectedHash === 'string' && schemaJson.hash === expectedHash;
  checks.push(createCheck(
    'ttd.schema-traceability',
    hashMatches,
    hashMatches
      ? 'TTD schema hash matches the authored schema input.'
      : schemaError == null
        ? `TTD schema hash mismatch: expected ${expectedHash}, got ${schemaJson.hash}`
        : `TTD schema hash could not be verified because the authored schema is malformed: ${schemaError}`,
    {
      expectedHash,
      actualHash: schemaJson.hash,
      schemaPath,
      schemaError
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
    schemaError,
    outDir,
    channels: schemaJson.channels?.length ?? 0,
    ops: schemaJson.ops?.length ?? 0,
    emissions: contractsJson.emissions?.length ?? 0
  };
}

export async function inspectEchoSurface({ fs, schemaPath, outDir, checks }) {
  const schemaContent = await fs.read(schemaPath);
  const { hash: expectedHash, error: schemaError } = await computeEchoSchemaHash(schemaContent);
  const expectedIrHash = await computeSdlHash(schemaContent);
  const requiredPaths = DEFAULT_ECHO_REQUIRED_FILES.map((file) => joinPath(outDir, file));
  const missingFiles = await collectMissingFiles(fs, requiredPaths);
  const missingRelative = missingFiles.map((missingPath) => relativePath(outDir, missingPath));

  checks.push(createCheck(
    'echo.schema-input-validity',
    schemaError == null,
    schemaError == null
      ? 'Echo authored schema parses cleanly for canonical hashing.'
      : `Echo authored schema could not be canonically hashed: ${schemaError}`,
    {
      schemaPath,
      error: schemaError
    }
  ));

  checks.push(createCheck(
    'echo.required-files',
    missingFiles.length === 0,
    missingFiles.length === 0
      ? `Found all ${DEFAULT_ECHO_REQUIRED_FILES.length} required Echo artifacts and mock outputs.`
      : `Missing Echo artifacts: ${missingRelative.join(', ')}`,
    {
      outDir,
      requiredFiles: DEFAULT_ECHO_REQUIRED_FILES,
      missingFiles: missingRelative
    }
  ));

  if (missingFiles.length > 0) {
    return {
      schemaPath,
      schemaHash: expectedHash,
      schemaError,
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
    typeof expectedHash === 'string' &&
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
      : schemaError == null
        ? 'Echo inspect summary does not match the authored schema input.'
        : `Echo inspect summary could not be fully verified because the authored schema is malformed: ${schemaError}`,
    {
      expectedHash,
      actualHash: summaryJson.schemaHash,
      expectedSchemaPath: schemaPath,
      actualSchemaPath: summaryJson.schemaPath,
      expectedCanonicalSchemaPath,
      actualCanonicalSchemaPath,
      schemaError
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
    schemaError,
    outDir,
    typeCount: irJson.types?.length ?? 0,
    opCount: irJson.ops?.length ?? 0,
    observationCount: deliveryRows.length,
    outcomes: deliveredOutcomes
  };
}

function computeTtdSchemaHash(schemaContent, crypto) {
  try {
    return {
      hash: hashTtdSchema(schemaContent, { crypto }),
      error: null
    };
  } catch (error) {
    return {
      hash: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function computeEchoSchemaHash(schemaContent) {
  try {
    return {
      hash: await schemaHash(schemaContent),
      error: null
    };
  } catch (error) {
    return {
      hash: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function readJson(fs, path) {
  return JSON.parse(await fs.read(path));
}

export function parseJsonl(content) {
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

export function summarizeChecks(checks) {
  const passed = checks.filter((check) => check.status === 'pass').length;
  const failed = checks.filter((check) => check.status === 'fail').length;
  return {
    totalChecks: checks.length,
    passed,
    failed
  };
}

export function createCheck(id, pass, message, details) {
  return {
    id,
    status: pass ? 'pass' : 'fail',
    message,
    details
  };
}

export function canonicalStringList(values) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

export function canonicalObjectList(values) {
  return [...values].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

export function canonicalFieldMap(types) {
  const entries = Object.entries(types).map(([name, fields]) => [
    name,
    canonicalStringList(fields)
  ]);
  entries.sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(entries);
}

export function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function extractSchemaFieldMap(types) {
  return Object.fromEntries(types.map((type) => [
    type.name,
    (type.fields ?? []).map((field) => field.name)
  ]));
}

export function extractIrFieldMap(types) {
  return Object.fromEntries(
    types
      .filter((type) => type.kind === 'OBJECT')
      .map((type) => [
        type.name,
        (type.fields ?? []).map((field) => field.name)
      ])
  );
}

export function fieldsPresent(actual, expectedFields) {
  return expectedFields.every((field) => actual.has(field));
}

export function fieldsAbsent(actual, forbiddenFields) {
  return forbiddenFields.every((field) => !actual.has(field));
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
