import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WesleyError } from '@wesley/core';
import { joinPath } from './path-utils.mjs';
import {
  DEFAULT_ECHO_REQUIRED_FILES,
  DEFAULT_TTD_REQUIRED_FILES,
  inspectEchoSurface,
  inspectTtdSurface,
  readJson,
  summarizeChecks
} from './continuum-witness-support.mjs';
import { inspectContinuumPublicationBoundary } from './continuum-publication-boundary.mjs';
import { inspectReceiptFamilySurface } from './continuum-receipt-family-witness.mjs';
import { inspectSettlementFamilySurface } from './continuum-settlement-family-witness.mjs';

export const CURRENT_MINIMUM_SCOPE = 'current-minimum-shared-surface';
export const RECEIPT_FAMILY_SCOPE = 'receipt-family';
export const SETTLEMENT_FAMILY_SCOPE = 'settlement-family';

const WITNESS_KIND = 'wesley.continuum.conformance.v1';
const RECEIPT_FAMILY_FIXTURE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../test/fixtures/continuum/receipt-family'
);
const SETTLEMENT_FAMILY_FIXTURE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../test/fixtures/continuum/settlement-family'
);

export function resolveContinuumWitnessOptions(options) {
  if (options.scope === CURRENT_MINIMUM_SCOPE) {
    return {
      scope: CURRENT_MINIMUM_SCOPE,
      ttdSchemaPath: options.ttdSchema ?? 'schemas/ttd-protocol.graphql',
      ttdDir: options.ttdDir ?? '.wesley-cache/continuum/local-inspect/ttd',
      echoSchemaPath: options.echoSchema ?? 'schemas/echo-core-types.graphql',
      echoDir: options.echoDir ?? '.wesley-cache/continuum/local-inspect/echo',
      outputPath: options.out ?? '.wesley-cache/continuum/local-inspect/witness/conformance.json',
      proves: [
        'schema-to-artifact consistency for the current TTD and Echo minimum surfaces',
        'manifest and source traceability for emitted local inspect outputs',
        'fixture-level conformance for the mocked deliveries inspect surface',
        'one explicit delivery-observation-versus-receipt separation case',
        'one local publication-boundary anti-shadow check for the admitted current-minimum families'
      ],
      doesNotProve: [
        'runtime policy correctness',
        'storage semantics',
        'debugger semantics',
        'full Continuum completeness',
        'the receipt-family proving lane'
      ],
      receiptFamilyFixtureDir: null
    };
  }

  if (options.scope === RECEIPT_FAMILY_SCOPE) {
    const schemaPath = options.ttdSchema ?? options.echoSchema ?? 'schemas/continuum-receipt-family.graphql';
    return {
      scope: RECEIPT_FAMILY_SCOPE,
      ttdSchemaPath: schemaPath,
      ttdDir: options.ttdDir ?? '.wesley-cache/continuum/receipt-family/ttd',
      echoSchemaPath: options.echoSchema ?? options.ttdSchema ?? 'schemas/continuum-receipt-family.graphql',
      echoDir: options.echoDir ?? '.wesley-cache/continuum/receipt-family/echo',
      outputPath: options.out ?? '.wesley-cache/continuum/receipt-family/witness/conformance.json',
      proves: [
        'schema-to-artifact consistency for the authored receipt-family TTD and Echo legs',
        'fixture-level conformance for emitted family nouns, footprints, and invariants',
        'cross-leg coherence for the shared family identity and compiled field boundaries',
        'explicit receipt-versus-witness and delivery-versus-receipt separation cases',
        'one local publication-boundary anti-shadow check for the authored receipt family'
      ],
      doesNotProve: [
        'runtime policy correctness',
        'storage semantics',
        'debugger semantics',
        'full Continuum completeness',
        'observer or substrate semantics outside the authored receipt family'
      ],
      receiptFamilyFixtureDir: options.receiptFamilyFixtureDir ?? RECEIPT_FAMILY_FIXTURE_DIR
    };
  }

  if (options.scope === SETTLEMENT_FAMILY_SCOPE) {
    const schemaPath = options.ttdSchema ?? options.echoSchema ?? 'schemas/continuum-settlement-family.graphql';
    return {
      scope: SETTLEMENT_FAMILY_SCOPE,
      ttdSchemaPath: schemaPath,
      ttdDir: options.ttdDir ?? '.wesley-cache/continuum/settlement-family/ttd',
      echoSchemaPath: options.echoSchema ?? options.ttdSchema ?? 'schemas/continuum-settlement-family.graphql',
      echoDir: options.echoDir ?? '.wesley-cache/continuum/settlement-family/echo',
      outputPath: options.out ?? '.wesley-cache/continuum/settlement-family/witness/conformance.json',
      proves: [
        'schema-to-artifact consistency for the authored settlement-family TTD and Echo legs',
        'fixture-level conformance for emitted settlement nouns, operations, invariants, and footprints',
        'cross-leg coherence for the shared settlement family identity and field boundaries',
        'explicit import-candidate-versus-conflict-artifact separation',
        'one local publication-boundary anti-shadow check for the authored settlement family'
      ],
      doesNotProve: [
        'runtime settlement correctness',
        'storage semantics',
        'debugger semantics',
        'full Continuum completeness',
        'observer or substrate semantics outside the authored settlement family'
      ],
      receiptFamilyFixtureDir: null,
      settlementFamilyFixtureDir: options.settlementFamilyFixtureDir ?? SETTLEMENT_FAMILY_FIXTURE_DIR
    };
  }

  throw new WesleyError(
    'CONTINUUM_WITNESS_INVALID_SCOPE',
    `Unsupported witness scope "${options.scope}". Expected "${CURRENT_MINIMUM_SCOPE}", "${RECEIPT_FAMILY_SCOPE}", or "${SETTLEMENT_FAMILY_SCOPE}".`,
    {
      requestedScope: options.scope,
      supportedScopes: [CURRENT_MINIMUM_SCOPE, RECEIPT_FAMILY_SCOPE, SETTLEMENT_FAMILY_SCOPE]
    }
  );
}

export async function buildContinuumWitnessReport({
  fs,
  crypto,
  scope,
  ttdSchemaPath,
  ttdDir,
  echoSchemaPath,
  echoDir,
  realizationRoot,
  outputPath,
  proves,
  doesNotProve,
  receiptFamilyFixtureDir,
  settlementFamilyFixtureDir
}) {
  const checks = [];
  const repoRoot = await resolveRepoRoot(fs);
  const realizationManifest = await loadRealizationManifest({ fs, realizationRoot });
  const ttdRequiredFiles = resolveLegRequiredFiles({
    leg: realizationManifest?.generatedLegs?.warpTtd,
    legOutDir: ttdDir,
    fallback: DEFAULT_TTD_REQUIRED_FILES
  });
  const ttdSurface = await inspectTtdSurface({
    fs,
    crypto,
    schemaPath: ttdSchemaPath,
    outDir: ttdDir,
    checks,
    requiredFiles: ttdRequiredFiles
  });
  const echoSurface = await inspectEchoSurface({ fs, schemaPath: echoSchemaPath, outDir: echoDir, checks });
  const publicationBoundary = await inspectContinuumPublicationBoundary({
    fs,
    repoRoot,
    rules: buildPublicationBoundaryRules({
      scope,
      ttdSchemaPath,
      ttdDir,
      echoSchemaPath,
      echoDir,
      realizationRoot,
      realizationManifest,
      receiptFamilyFixtureDir,
      settlementFamilyFixtureDir
    }),
    checks
  });
  const receiptFamily = scope === RECEIPT_FAMILY_SCOPE &&
    ttdSurface.missingFiles == null &&
    echoSurface.missingFiles == null
    ? await inspectReceiptFamilySurface({
      fs,
      ttdDir,
      echoDir,
      fixtureDir: receiptFamilyFixtureDir,
      ttdSurface,
      echoSurface,
      checks
    })
    : null;
  const settlementFamily = scope === SETTLEMENT_FAMILY_SCOPE &&
    ttdSurface.missingFiles == null &&
    echoSurface.missingFiles == null
    ? await inspectSettlementFamilySurface({
      fs,
      ttdDir,
      echoDir,
      fixtureDir: settlementFamilyFixtureDir,
      ttdSurface,
      echoSurface,
      checks
    })
    : null;

  const summary = summarizeChecks(checks);

  return {
    kind: WITNESS_KIND,
    scope,
    status: summary.failed === 0 ? 'pass' : 'fail',
    outputPath,
    proves,
    doesNotProve,
    surfaces: {
      ttd: ttdSurface,
      echo: echoSurface,
      ...(receiptFamily == null ? {} : { receiptFamily }),
      ...(settlementFamily == null ? {} : { settlementFamily }),
      publicationBoundary
    },
    summary,
    checks
  };
}

export { createCheck } from './continuum-witness-support.mjs';

function buildPublicationBoundaryRules({
  scope,
  ttdSchemaPath,
  ttdDir,
  echoSchemaPath,
  echoDir,
  realizationRoot,
  realizationManifest,
  receiptFamilyFixtureDir,
  settlementFamilyFixtureDir
}) {
  const ttdGeneratedArtifacts = resolveLegGeneratedArtifacts({
    leg: realizationManifest?.generatedLegs?.warpTtd,
    legOutDir: ttdDir,
    fallback: DEFAULT_TTD_REQUIRED_FILES
  });
  const echoGeneratedArtifacts = resolveLegGeneratedArtifacts({
    leg: realizationManifest?.generatedLegs?.echo,
    legOutDir: echoDir,
    fallback: DEFAULT_ECHO_REQUIRED_FILES
  });
  const generatedArtifacts = [...new Set([
    ...ttdGeneratedArtifacts,
    ...echoGeneratedArtifacts,
    'manifest.json'
  ])];

  if (scope === CURRENT_MINIMUM_SCOPE) {
    return [
      {
        id: 'ttd-protocol',
        authoredHomes: [ttdSchemaPath],
        generatedRoots: [ttdDir].concat(realizationRoot == null ? [] : [realizationRoot]),
        compatRoots: [],
        generatedArtifacts: ttdGeneratedArtifacts
      },
      {
        id: 'echo-core-types',
        authoredHomes: [echoSchemaPath],
        generatedRoots: [echoDir].concat(realizationRoot == null ? [] : [realizationRoot]),
        compatRoots: [],
        generatedArtifacts: echoGeneratedArtifacts
      }
    ];
  }

  if (scope === SETTLEMENT_FAMILY_SCOPE) {
    return [
      {
        id: 'settlement-family',
        authoredHomes: [ttdSchemaPath],
        generatedRoots: [ttdDir, echoDir].concat(realizationRoot == null ? [] : [realizationRoot]),
        compatRoots: [settlementFamilyFixtureDir],
        generatedArtifacts
      }
    ];
  }

  return [
    {
      id: 'receipt-family',
      authoredHomes: [ttdSchemaPath],
      generatedRoots: [ttdDir, echoDir].concat(realizationRoot == null ? [] : [realizationRoot]),
      compatRoots: [receiptFamilyFixtureDir],
      generatedArtifacts
    }
  ];
}

async function resolveRepoRoot(fs) {
  if (fs.resolve) {
    return fs.resolve('.');
  }
  return process.cwd();
}

async function loadRealizationManifest({ fs, realizationRoot }) {
  if (realizationRoot == null) {
    return null;
  }

  const manifestPath = joinPath(realizationRoot, 'manifest.json');
  if (!(await fs.exists(manifestPath))) {
    return null;
  }

  return readJson(fs, manifestPath);
}

function resolveLegRequiredFiles({ leg, legOutDir, fallback }) {
  const files = resolveLegGeneratedArtifacts({ leg, legOutDir, fallback: [] });
  return files.length === 0 ? fallback : files;
}

function resolveLegGeneratedArtifacts({ leg, legOutDir, fallback }) {
  const files = leg?.files
    ?.map((file) => normalizeLegArtifactPath(file?.path, legOutDir))
    .filter(Boolean);
  if (!Array.isArray(files) || files.length === 0) {
    return fallback;
  }
  return [...new Set(files)].sort((left, right) => left.localeCompare(right));
}

function normalizeLegArtifactPath(filePath, legOutDir) {
  if (typeof filePath !== 'string' || filePath.trim().length === 0) {
    return null;
  }

  const artifactPath = normalizeSeparators(filePath.trim());
  const resolvedLegOutDir = normalizeSeparators(path.resolve(legOutDir));
  const resolvedArtifactPath = normalizeSeparators(path.resolve(artifactPath));
  if (
    resolvedArtifactPath === resolvedLegOutDir ||
    resolvedArtifactPath.startsWith(`${resolvedLegOutDir}/`)
  ) {
    return normalizeSeparators(path.relative(resolvedLegOutDir, resolvedArtifactPath));
  }

  return artifactPath.replace(/^\.\//, '');
}

function normalizeSeparators(value) {
  return value.replace(/\\/g, '/');
}
