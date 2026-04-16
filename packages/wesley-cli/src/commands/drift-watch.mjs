import path from 'node:path';
import { Kind, parse } from 'graphql';
import { WesleyCommand } from '../framework/WesleyCommand.mjs';
import { WesleyError, computeSdlHash, schemaHash } from '@wesley/core';
import {
  CONTINUUM_JUDGMENT_PROFILE,
  RECEIPT_FAMILY_SCOPE,
  buildContinuumPublicationBoundaryPlan,
  resolveContinuumDriftWatchProfile
} from '@wesley/continuum';
import { createCheck, summarizeChecks } from './continuum-witness-support.mjs';
import { inspectRealizationManifest } from './realization-integrity.mjs';
import { inspectContinuumPublicationBoundary } from './continuum-publication-boundary.mjs';
import {
  resolveContinuumWitnessOptions
} from './continuum-witness-report.mjs';
import { joinPath } from './path-utils.mjs';

const DRIFT_WATCH_KIND = 'wesley.continuum.drift-watch.v1';
const ROOT_OPERATION_TYPE_NAMES = new Set(['Query', 'Mutation', 'Subscription']);
const MIRROR_FILE_EXTENSIONS = new Set(['.graphql', '.gql', '.json', '.ts', '.tsx', '.js', '.mjs', '.cjs', '.rs']);
const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.next',
  '.turbo',
  '.wesley-cache',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'target'
]);
const SCHEMA_HASH_CONSTANT_PATTERN = /\bSCHEMA_HASH\b\s*=\s*['"]([a-f0-9]{64})['"]/;

export class DriftWatchCommand extends WesleyCommand {
  constructor(ctx) {
    super(
      ctx,
      'drift-watch',
      'Inspect local Continuum outputs and nearby mirrors for contract drift'
    );
  }

  configureCommander(cmd) {
    return cmd
      .option('--schema <path>', 'Shared authored GraphQL schema path for all selected targets')
      .option('-o, --out-dir <dir>', 'Root output directory')
      .option('--report-out <path>', 'Drift-watch output path (defaults under <out-dir>/witness/drift-watch.json)')
      .option('--scope <scope>', 'Continuum drift-watch scope', RECEIPT_FAMILY_SCOPE)
      .option('--ttd-schema <path>', 'TTD schema path')
      .option('--ttd-dir <dir>', 'TTD output directory')
      .option('--echo-schema <path>', 'Echo schema path')
      .option('--echo-dir <dir>', 'Echo output directory')
      .option('--receipt-family-fixture-dir <dir>', 'Receipt-family fixture directory')
      .option('--settlement-family-fixture-dir <dir>', 'Settlement-family fixture directory')
      .option('--mirror-root <path>', 'Additional mirror root or surface path to inspect (repeatable)', collectOption, [])
      .option('--dry-run', 'Compute the drift watch without writing the report');
  }

  async executeCore({ options, logger }) {
    const resolved = resolveContinuumDriftWatchOptions(options);
    const report = await buildContinuumDriftWatchReport({
      fs: this.ctx.fs,
      crypto: this.ctx.crypto,
      ...resolved
    });

    if (!options.dryRun) {
      await this.ctx.fs.write(resolved.outputPath, JSON.stringify(report, null, 2) + '\n');
    }

    if (report.status === 'fail') {
      const guidance = options.dryRun
        ? ' No report file was written because --dry-run was set.'
        : ` See ${resolved.outputPath}.`;
      throw new WesleyError(
        'CONTINUUM_DRIFT_WATCH_FAILED',
        `Continuum drift watch failed ${report.summary.failed} check(s).${guidance}`
      );
    }

    if (!options.quiet && !options.json) {
      logger?.info?.(`Continuum drift watch passed (${report.summary.passed}/${report.summary.totalChecks} checks).`);
      if (options.dryRun) {
        logger?.info?.('Drift-watch report not written because --dry-run was set.');
      } else {
        logger?.info?.(`Drift-watch report: ${resolved.outputPath}`);
      }
    }

    return report;
  }
}

export function resolveContinuumDriftWatchOptions(options) {
  const profile = resolveContinuumDriftWatchProfile({
    scope: options.scope ?? RECEIPT_FAMILY_SCOPE,
    schemaPath: options.schema,
    outDir: options.outDir,
    ttdSchemaPath: options.ttdSchema,
    ttdDir: options.ttdDir,
    echoSchemaPath: options.echoSchema,
    echoDir: options.echoDir,
    reportPath: options.reportOut,
    receiptFamilyFixtureDir: options.receiptFamilyFixtureDir,
    settlementFamilyFixtureDir: options.settlementFamilyFixtureDir,
    mirrorRoots: options.mirrorRoot
  });

  return {
    ...resolveContinuumWitnessOptions(profile),
    mirrorRoots: profile.mirrorRoots
  };
}

export async function buildContinuumDriftWatchReport({
  fs,
  crypto,
  scope,
  ttdSchemaPath,
  ttdDir,
  echoSchemaPath,
  echoDir,
  realizationRoot,
  outputPath,
  receiptFamilyFixtureDir,
  settlementFamilyFixtureDir,
  mirrorRoots = []
}) {
  const checks = [];
  const repoRoot = await resolveRepoRoot(fs);
  const authoredSurfaces = await inspectAuthoredSurfaces({
    fs,
    schemaPaths: [
      { id: 'ttd', schemaPath: ttdSchemaPath },
      { id: 'echo', schemaPath: echoSchemaPath }
    ],
    checks
  });
  const authoredById = Object.fromEntries(authoredSurfaces.map((surface) => [surface.id, surface]));
  const expectedMirrorHashes = [...new Set(
    authoredSurfaces
      .map((surface) => surface.sourceHash)
      .filter((value) => typeof value === 'string' && value.length > 0)
  )];
  const familyNames = new Set(authoredSurfaces.flatMap((surface) => surface.familyNames ?? []));

  const ttdSurface = await inspectLocalTtdSurface({
    fs,
    authored: authoredById.ttd,
    outDir: ttdDir,
    checks
  });
  const echoSurface = await inspectLocalEchoSurface({
    fs,
    authored: authoredById.echo,
    outDir: echoDir,
    checks
  });

  const primaryAuthoredSchemaPath = authoredById.ttd?.schemaPath ?? authoredById.echo?.schemaPath ?? ttdSchemaPath;
  const realizationInspection = await inspectRealizationManifest({
    fs,
    crypto,
    schemaPath: primaryAuthoredSchemaPath,
    realizationRoot,
    ttdDir,
    echoDir
  });
  if (realizationInspection == null) {
    checks.push(createCheck(
      'realization.manifest-present',
      false,
      `Realization manifest not found at ${joinPath(realizationRoot, 'manifest.json')}.`,
      {
        realizationRoot,
        manifestPath: joinPath(realizationRoot, 'manifest.json')
      }
    ));
  } else {
    checks.push(...realizationInspection.checks);
  }

  const publicationBoundary = await inspectContinuumPublicationBoundary({
    fs,
    repoRoot,
    ...buildContinuumPublicationBoundaryPlan({
      scope,
      ttdSchemaPath,
      ttdDir,
      echoSchemaPath,
      echoDir,
      realizationRoot,
      realizationManifest: realizationInspection?.manifest ?? null,
      defaultTtdGeneratedArtifacts: ['manifest/schema.json', 'manifest/manifest.json'],
      defaultEchoGeneratedArtifacts: ['ir.json', 'mock/summary.json'],
      receiptFamilyFixtureDir,
      settlementFamilyFixtureDir
    }),
    checks
  });

  const mirrorReport = await inspectMirrorRoots({
    fs,
    repoRoot,
    mirrorRoots,
    expectedHashes: expectedMirrorHashes,
    familyNames,
    checks
  });

  const summary = summarizeChecks(checks);
  const failureGroups = summarizeDriftFailures(checks);

  return {
    kind: DRIFT_WATCH_KIND,
    scope,
    status: summary.failed === 0 ? 'pass' : 'fail',
    outputPath,
    judgmentProfile: CONTINUUM_JUDGMENT_PROFILE,
    proves: [
      'authored Continuum schema inputs still hash to the identities local legs claim to publish',
      'local TTD, Echo, realization, and publication-boundary surfaces stay coherent at the contract boundary',
      'explicit mirror roots expose the same contract-family identity or fail loudly'
    ],
    doesNotProve: [
      'runtime policy correctness',
      'storage semantics',
      'debugger semantics',
      'observer rights or revelation policy',
      'full cross-repo runtime compatibility beyond published contract identity'
    ],
    surfaces: {
      authored: authoredSurfaces,
      local: {
        ttd: ttdSurface,
        echo: echoSurface,
        ...(realizationInspection == null ? {} : { realization: realizationInspection }),
        publicationBoundary
      },
      mirrors: mirrorReport
    },
    summary,
    failures: failureGroups,
    checks
  };
}

function collectOption(value, previous = []) {
  return previous.concat([value]);
}

async function inspectAuthoredSurfaces({ fs, schemaPaths, checks }) {
  const surfaces = [];
  const seen = new Map();

  for (const entry of schemaPaths) {
    const schemaPath = entry?.schemaPath;
    if (typeof schemaPath !== 'string' || schemaPath.trim().length === 0) {
      continue;
    }
    const cacheKey = `${entry.id}:${schemaPath}`;
    if (seen.has(cacheKey)) {
      surfaces.push(seen.get(cacheKey));
      continue;
    }

    const surface = await inspectAuthoredSchema({
      fs,
      schemaPath,
      checkId: `authored.${entry.id}.schema-input-validity`,
      checks
    });
    seen.set(cacheKey, surface);
    surfaces.push(surface);
  }

  return surfaces;
}

async function inspectAuthoredSchema({ fs, schemaPath, checkId, checks }) {
  let schemaContent = null;
  let sourceHash = null;
  let irHash = null;
  let familyNames = [];
  let error = null;

  try {
    schemaContent = await fs.read(schemaPath);
    sourceHash = await schemaHash(schemaContent);
    irHash = await computeSdlHash(schemaContent);
    const extraction = extractContractNames(schemaContent);
    familyNames = extraction.names;
    if (extraction.error != null) {
      error = extraction.error;
    }
  } catch (caughtError) {
    error = caughtError instanceof Error ? caughtError.message : String(caughtError);
  }

  const pass = error == null;
  checks.push(createCheck(
    checkId,
    pass,
    pass
      ? `Authored schema at ${schemaPath} parses cleanly for canonical hashing.`
      : `Authored schema at ${schemaPath} could not be hashed: ${error}`,
    {
      schemaPath,
      sourceHash,
      irHash,
      error
    }
  ));

  return {
    id: checkId.slice('authored.'.length, -'.schema-input-validity'.length),
    schemaPath,
    sourceHash,
    irHash,
    familyNames,
    error,
    status: pass ? 'pass' : 'fail'
  };
}

async function inspectLocalTtdSurface({ fs, authored, outDir, checks }) {
  const schemaJsonPath = joinPath(outDir, 'manifest', 'schema.json');
  const manifestJsonPath = joinPath(outDir, 'manifest', 'manifest.json');
  const required = [schemaJsonPath, manifestJsonPath];
  const missing = await collectMissingFiles(fs, required);
  const passRequired = missing.length === 0;

  checks.push(createCheck(
    'local.ttd.required-files',
    passRequired,
    passRequired
      ? 'Found TTD schema and manifest outputs needed for drift watch.'
      : `Missing TTD drift-watch artifacts: ${missing.map((item) => describeRelative(outDir, item)).join(', ')}`,
    {
      outDir,
      requiredFiles: required.map((item) => describeRelative(outDir, item)),
      missingFiles: missing.map((item) => describeRelative(outDir, item))
    }
  ));

  if (!passRequired) {
    return {
      outDir,
      missingFiles: missing.map((item) => describeRelative(outDir, item))
    };
  }

  const schemaJson = JSON.parse(await fs.read(schemaJsonPath));
  const manifestJson = JSON.parse(await fs.read(manifestJsonPath));
  const traceable = authored?.sourceHash != null &&
    schemaJson.hash === authored.sourceHash &&
    manifestJson.schemaHash === authored.sourceHash;
  checks.push(createCheck(
    'local.ttd.schema-traceability',
    traceable,
    traceable
      ? 'TTD manifest surfaces match the authored schema hash.'
      : 'TTD manifest surfaces drift from the authored schema hash.',
    {
      schemaPath: authored?.schemaPath ?? null,
      expectedSourceHash: authored?.sourceHash ?? null,
      schemaJsonHash: schemaJson.hash ?? null,
      manifestSchemaHash: manifestJson.schemaHash ?? null
    }
  ));

  const manifestConsistent = schemaJson.hash === manifestJson.schemaHash;
  checks.push(createCheck(
    'local.ttd.manifest-consistency',
    manifestConsistent,
    manifestConsistent
      ? 'TTD schema.json and manifest.json agree on schema identity.'
      : 'TTD schema.json and manifest.json disagree on schema identity.',
    {
      schemaJsonHash: schemaJson.hash ?? null,
      manifestSchemaHash: manifestJson.schemaHash ?? null
    }
  ));

  return {
    outDir,
    schemaHash: schemaJson.hash ?? null,
    manifestSchemaHash: manifestJson.schemaHash ?? null,
    status: traceable && manifestConsistent ? 'pass' : 'fail'
  };
}

async function inspectLocalEchoSurface({ fs, authored, outDir, checks }) {
  const summaryPath = joinPath(outDir, 'mock', 'summary.json');
  const irPath = joinPath(outDir, 'ir.json');
  const required = [summaryPath, irPath];
  const missing = await collectMissingFiles(fs, required);
  const passRequired = missing.length === 0;

  checks.push(createCheck(
    'local.echo.required-files',
    passRequired,
    passRequired
      ? 'Found Echo inspect outputs needed for drift watch.'
      : `Missing Echo drift-watch artifacts: ${missing.map((item) => describeRelative(outDir, item)).join(', ')}`,
    {
      outDir,
      requiredFiles: required.map((item) => describeRelative(outDir, item)),
      missingFiles: missing.map((item) => describeRelative(outDir, item))
    }
  ));

  if (!passRequired) {
    return {
      outDir,
      missingFiles: missing.map((item) => describeRelative(outDir, item))
    };
  }

  const summaryJson = JSON.parse(await fs.read(summaryPath));
  const irJson = JSON.parse(await fs.read(irPath));
  const summaryTraceable = summaryJson.kind === 'wesley.echo-bundle.inspect.v1' &&
    authored?.sourceHash != null &&
    summaryJson.schemaHash === authored.sourceHash;
  checks.push(createCheck(
    'local.echo.summary-traceability',
    summaryTraceable,
    summaryTraceable
      ? 'Echo inspect summary matches the authored schema hash.'
      : 'Echo inspect summary drifts from the authored schema hash.',
    {
      schemaPath: authored?.schemaPath ?? null,
      expectedSourceHash: authored?.sourceHash ?? null,
      summarySchemaHash: summaryJson.schemaHash ?? null,
      kind: summaryJson.kind ?? null
    }
  ));

  const actualIrHash = irJson.schema_hash ?? irJson.schema_sha256 ?? null;
  const irTraceable = authored?.irHash != null && actualIrHash === authored.irHash;
  checks.push(createCheck(
    'local.echo.ir-traceability',
    irTraceable,
    irTraceable
      ? 'Echo IR hash matches the authored schema input.'
      : 'Echo IR hash drifts from the authored schema input.',
    {
      schemaPath: authored?.schemaPath ?? null,
      expectedIrHash: authored?.irHash ?? null,
      actualIrHash
    }
  ));

  return {
    outDir,
    summarySchemaHash: summaryJson.schemaHash ?? null,
    irHash: actualIrHash,
    status: summaryTraceable && irTraceable ? 'pass' : 'fail'
  };
}

async function inspectMirrorRoots({ fs, repoRoot, mirrorRoots, expectedHashes, familyNames, checks }) {
  const results = [];
  for (let index = 0; index < mirrorRoots.length; index += 1) {
    const root = mirrorRoots[index];
    const rootId = `mirror.${index + 1}`;
    const exists = await fs.exists(root);
    checks.push(createCheck(
      `${rootId}.root-present`,
      exists,
      exists
        ? `Mirror root ${root} exists.`
        : `Mirror root ${root} does not exist.`,
      { root }
    ));

    if (!exists) {
      results.push({
        root,
        status: 'fail',
        surfaces: [],
        unpinnedSurfaces: [],
        missing: true
      });
      continue;
    }

    const files = await collectMirrorFiles(fs, root);
    const surfaces = [];
    const unpinnedSurfaces = [];
    for (const filePath of files) {
      const content = await fs.read(filePath);
      const surface = await classifyMirrorSurface({
        filePath,
        content,
        familyNames
      });
      if (surface == null) {
        continue;
      }
      if (surface.pinned) {
        surfaces.push(surface);
      } else {
        unpinnedSurfaces.push(surface);
      }
    }

    checks.push(createCheck(
      `${rootId}.surface-discovery`,
      surfaces.length > 0 || unpinnedSurfaces.length > 0,
      surfaces.length > 0 || unpinnedSurfaces.length > 0
        ? `Mirror root ${root} exposes ${surfaces.length + unpinnedSurfaces.length} contract-relevant surface(s).`
        : `Mirror root ${root} does not expose any recognized contract-relevant surfaces.`,
      {
        root,
        pinnedSurfaceCount: surfaces.length,
        unpinnedSurfaceCount: unpinnedSurfaces.length
      }
    ));

    checks.push(createCheck(
      `${rootId}.provenance`,
      unpinnedSurfaces.length === 0,
      unpinnedSurfaces.length === 0
        ? `Mirror root ${root} keeps contract-relevant mirrors pinned to published schema identity.`
        : `Mirror root ${root} contains unpinned contract-relevant mirrors.`,
      {
        root,
        unpinnedSurfaces: unpinnedSurfaces.map((surface) => ({
          path: describePath(repoRoot, surface.path),
          kind: surface.kind
        }))
      }
    ));

    surfaces.forEach((surface, surfaceIndex) => {
      const matches = expectedHashes.includes(surface.reportedHash);
      checks.push(createCheck(
        `${rootId}.surface-${surfaceIndex + 1}.hash-coherence`,
        matches,
        matches
          ? `Mirror surface ${describePath(repoRoot, surface.path)} matches one authored schema hash.`
          : `Mirror surface ${describePath(repoRoot, surface.path)} drifts from the authored schema hash set.`,
        {
          root,
          path: describePath(repoRoot, surface.path),
          kind: surface.kind,
          reportedHash: surface.reportedHash,
          expectedHashes
        }
      ));
    });

    results.push({
      root,
      status: (
        unpinnedSurfaces.length === 0 &&
        surfaces.every((surface) => expectedHashes.includes(surface.reportedHash)) &&
        (surfaces.length > 0 || unpinnedSurfaces.length > 0)
      ) ? 'pass' : 'fail',
      surfaceCount: surfaces.length,
      unpinnedSurfaceCount: unpinnedSurfaces.length,
      surfaces: surfaces.map((surface) => ({
        path: describePath(repoRoot, surface.path),
        kind: surface.kind,
        reportedHash: surface.reportedHash,
        matchesAuthoredHash: expectedHashes.includes(surface.reportedHash)
      })),
      unpinnedSurfaces: unpinnedSurfaces.map((surface) => ({
        path: describePath(repoRoot, surface.path),
        kind: surface.kind
      }))
    });
  }

  return results;
}

async function classifyMirrorSurface({ filePath, content, familyNames }) {
  const extension = path.extname(filePath);
  if (!MIRROR_FILE_EXTENSIONS.has(extension)) {
    return null;
  }

  if (extension === '.graphql' || extension === '.gql') {
    if (!looksLikeFamilyDeclaration(extension, content, familyNames)) {
      return null;
    }
    try {
      return {
        path: filePath,
        kind: 'graphql-authored-surface',
        pinned: true,
        reportedHash: await schemaHash(content)
      };
    } catch {
      return {
        path: filePath,
        kind: 'graphql-surface-with-invalid-sdl',
        pinned: false
      };
    }
  }

  if (extension === '.json') {
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return null;
    }

    const hash = extractMirrorHashFromJson(parsed);
    const mentionsFamily = mentionsAnyFamilyName(content, familyNames);
    if (hash == null) {
      return mentionsFamily
        ? {
          path: filePath,
          kind: 'json-surface-without-hash',
          pinned: false
        }
        : null;
    }

    if (!mentionsFamily && !isRecognizedMirrorKind(parsed)) {
      return null;
    }

    return {
      path: filePath,
      kind: classifyJsonMirrorKind(parsed),
      pinned: true,
      reportedHash: hash
    };
  }

  const hashMatch = content.match(SCHEMA_HASH_CONSTANT_PATTERN);
  const declaresFamily = looksLikeFamilyDeclaration(extension, content, familyNames);
  const mentionsFamily = mentionsAnyFamilyName(content, familyNames);
  if (!declaresFamily && !mentionsFamily) {
    return null;
  }

  if (hashMatch == null) {
    return {
      path: filePath,
      kind: 'code-surface-without-hash',
      pinned: false
    };
  }

  return {
    path: filePath,
    kind: 'code-schema-hash-surface',
    pinned: true,
    reportedHash: hashMatch[1]
  };
}

async function collectMirrorFiles(fs, root) {
  const files = [];

  const walk = async (target) => {
    const entries = await fs.readDir?.(target);
    if (!Array.isArray(entries)) {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) {
          await walk(entry.path);
        }
        continue;
      }
      if (entry.isFile && MIRROR_FILE_EXTENSIONS.has(path.extname(entry.name))) {
        files.push(entry.path);
      }
    }
  };

  const stats = await fs.readDir?.(root);
  if (Array.isArray(stats)) {
    await walk(root);
    files.sort();
    return files;
  }

  if (MIRROR_FILE_EXTENSIONS.has(path.extname(root))) {
    return [root];
  }

  return [];
}

async function collectMissingFiles(fs, paths) {
  const missing = [];
  for (const targetPath of paths) {
    if (!(await fs.exists(targetPath))) {
      missing.push(targetPath);
    }
  }
  return missing;
}

function extractContractNames(schemaContent) {
  let document;
  try {
    document = parse(schemaContent, { noLocation: true });
  } catch (error) {
    return {
      names: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
  const names = [];
  for (const definition of document.definitions) {
    if (!definition.name?.value) {
      continue;
    }
    if (
      definition.kind === Kind.OBJECT_TYPE_DEFINITION ||
      definition.kind === Kind.INTERFACE_TYPE_DEFINITION ||
      definition.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION ||
      definition.kind === Kind.UNION_TYPE_DEFINITION ||
      definition.kind === Kind.ENUM_TYPE_DEFINITION ||
      definition.kind === Kind.SCALAR_TYPE_DEFINITION
    ) {
      if (!ROOT_OPERATION_TYPE_NAMES.has(definition.name.value)) {
        names.push(definition.name.value);
      }
    }
  }
  return { names, error: null };
}

function looksLikeFamilyDeclaration(extension, content, familyNames) {
  if (!(familyNames instanceof Set) || familyNames.size === 0) {
    return false;
  }
  for (const familyName of familyNames) {
    const declaration = declarationPatternForExtension(extension, familyName);
    if (declaration != null && declaration.test(content)) {
      return true;
    }
  }
  return false;
}

function declarationPatternForExtension(extension, familyName) {
  const name = escapeRegExp(familyName);
  if (extension === '.graphql' || extension === '.gql') {
    return new RegExp(`\\b(type|enum|input|interface|union|scalar)\\s+${name}\\b`, 'm');
  }
  if (extension === '.ts' || extension === '.tsx' || extension === '.js' || extension === '.mjs' || extension === '.cjs') {
    return new RegExp(`\\b(export\\s+)?(type|interface|class|enum)\\s+${name}\\b`, 'm');
  }
  if (extension === '.rs') {
    return new RegExp(`\\b(pub\\s+)?(struct|enum|type)\\s+${name}\\b`, 'm');
  }
  return null;
}

function extractMirrorHashFromJson(value) {
  if (value == null || typeof value !== 'object') {
    return null;
  }
  if (typeof value.sourceHash === 'string') {
    return value.sourceHash;
  }
  if (typeof value.schemaHash === 'string') {
    return value.schemaHash;
  }
  if (
    typeof value.hash === 'string' &&
    Array.isArray(value.channels) &&
    Array.isArray(value.ops)
  ) {
    return value.hash;
  }
  return null;
}

function classifyJsonMirrorKind(value) {
  if (value?.kind === 'wesley.realization.manifest.v1') {
    return 'realization-manifest';
  }
  if (value?.kind === 'wesley.echo-bundle.inspect.v1') {
    return 'echo-summary';
  }
  if (Array.isArray(value?.codecs) && Array.isArray(value?.ops) && value?.registry != null) {
    return 'ttd-manifest';
  }
  if (Array.isArray(value?.channels) && Array.isArray(value?.ops) && typeof value?.hash === 'string') {
    return 'ttd-schema-json';
  }
  if (typeof value?.sourceHash === 'string') {
    return 'json-source-hash';
  }
  return 'json-schema-hash';
}

function isRecognizedMirrorKind(value) {
  return value?.kind === 'wesley.realization.manifest.v1' ||
    value?.kind === 'wesley.echo-bundle.inspect.v1' ||
    (Array.isArray(value?.codecs) && Array.isArray(value?.ops) && value?.registry != null) ||
    (Array.isArray(value?.channels) && Array.isArray(value?.ops) && typeof value?.hash === 'string');
}

function mentionsAnyFamilyName(content, familyNames) {
  if (!(familyNames instanceof Set) || familyNames.size === 0) {
    return false;
  }
  return [...familyNames].some((name) => new RegExp(`\\b${escapeRegExp(name)}\\b`).test(content));
}

function summarizeDriftFailures(checks) {
  const groups = {
    authored: [],
    generatedArtifact: [],
    mirror: []
  };

  for (const check of checks) {
    if (check.status !== 'fail') {
      continue;
    }
    if (check.id.startsWith('authored.')) {
      groups.authored.push(check.id);
      continue;
    }
    if (check.id.startsWith('mirror.')) {
      groups.mirror.push(check.id);
      continue;
    }
    groups.generatedArtifact.push(check.id);
  }

  return groups;
}

async function resolveRepoRoot(fs) {
  if (typeof fs.resolve === 'function') {
    return fs.resolve('.');
  }
  return process.cwd();
}

function describeRelative(root, targetPath) {
  const relativePath = path.relative(root, targetPath);
  return relativePath.startsWith('..') ? targetPath : relativePath;
}

function describePath(repoRoot, targetPath) {
  const relativePath = path.relative(repoRoot, targetPath);
  return relativePath.startsWith('..') ? targetPath : relativePath;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
