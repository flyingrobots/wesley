import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WesleyError } from '@wesley/core';
import {
  CONTINUUM_JUDGMENT_PROFILE,
  RECEIPT_FAMILY_SCOPE,
  SETTLEMENT_FAMILY_SCOPE,
  buildContinuumPublicationBoundaryPlan,
  resolveContinuumWitnessProfile
} from '@wesley/continuum';
import {
  DEFAULT_ECHO_REQUIRED_FILES,
  DEFAULT_TTD_REQUIRED_FILES,
  inspectEchoSurface,
  inspectTtdSurface,
  summarizeChecks
} from './continuum-witness-support.mjs';
import { inspectContinuumPublicationBoundary } from './continuum-publication-boundary.mjs';
import { inspectReceiptFamilySurface } from './continuum-receipt-family-witness.mjs';
import { inspectSettlementFamilySurface } from './continuum-settlement-family-witness.mjs';
import { inspectRealizationManifest } from './realization-integrity.mjs';

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
  try {
    return resolveContinuumWitnessProfile({
      scope: options.scope,
      schemaPath: options.schemaPath,
      outDir: options.outDir,
      ttdSchemaPath: options.ttdSchemaPath ?? options.ttdSchema,
      ttdDir: options.ttdDir,
      echoSchemaPath: options.echoSchemaPath ?? options.echoSchema,
      echoDir: options.echoDir,
      reportPath: options.outputPath ?? options.out,
      receiptFamilyFixtureDir: options.receiptFamilyFixtureDir ?? RECEIPT_FAMILY_FIXTURE_DIR,
      settlementFamilyFixtureDir: options.settlementFamilyFixtureDir ?? SETTLEMENT_FAMILY_FIXTURE_DIR
    });
  } catch (error) {
    if (error instanceof WesleyError && error.code === 'CONTINUUM_SCOPE_INVALID') {
      throw new WesleyError(
        'CONTINUUM_WITNESS_INVALID_SCOPE',
        error.message.replace('Continuum scope', 'witness scope'),
        error.meta
      );
    }
    throw error;
  }
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
  const realizationInspection = await inspectRealizationManifest({
    fs,
    crypto,
    schemaPath: ttdSchemaPath,
    realizationRoot,
    ttdDir,
    echoDir
  });
  const realizationManifest = realizationInspection?.manifest ?? null;
  if (realizationInspection != null) {
    checks.push(...realizationInspection.checks);
  }
  const ttdRequiredFiles = resolveLegRequiredFiles({
    leg: realizationManifest?.generatedLegs?.warpTtd,
    currentLegOutDir: ttdDir,
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
    ...buildContinuumPublicationBoundaryPlan({
      scope,
      ttdSchemaPath,
      ttdDir,
      echoSchemaPath,
      echoDir,
      realizationRoot,
      realizationManifest,
      defaultTtdGeneratedArtifacts: DEFAULT_TTD_REQUIRED_FILES,
      defaultEchoGeneratedArtifacts: DEFAULT_ECHO_REQUIRED_FILES,
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
    judgmentProfile: CONTINUUM_JUDGMENT_PROFILE,
    proves,
    doesNotProve,
    surfaces: {
      ttd: ttdSurface,
      echo: echoSurface,
      ...(realizationInspection == null ? {} : { realization: realizationInspection }),
      ...(receiptFamily == null ? {} : { receiptFamily }),
      ...(settlementFamily == null ? {} : { settlementFamily }),
      publicationBoundary
    },
    summary,
    checks
  };
}

export { createCheck } from './continuum-witness-support.mjs';
export {
  CURRENT_MINIMUM_SCOPE,
  RECEIPT_FAMILY_SCOPE,
  SETTLEMENT_FAMILY_SCOPE
} from '@wesley/continuum';

async function resolveRepoRoot(fs) {
  if (fs.resolve) {
    return fs.resolve('.');
  }
  return process.cwd();
}

function resolveLegRequiredFiles({ leg, currentLegOutDir, fallback }) {
  const files = resolveLegGeneratedArtifacts({ leg, currentLegOutDir, fallback: [] });
  return files.length === 0 ? fallback : files;
}

function resolveLegGeneratedArtifacts({ leg, currentLegOutDir, fallback }) {
  const files = leg?.files
    ?.map((file) => normalizeLegArtifactPath({
      filePath: file?.path,
      manifestLegOutDir: leg?.outDir,
      currentLegOutDir
    }))
    .filter(Boolean);
  if (!Array.isArray(files) || files.length === 0) {
    return fallback;
  }
  return [...new Set(files)].sort((left, right) => left.localeCompare(right));
}

function normalizeLegArtifactPath({
  filePath,
  manifestLegOutDir,
  currentLegOutDir
}) {
  if (typeof filePath !== 'string' || filePath.trim().length === 0) {
    return null;
  }

  const artifactPath = normalizeSeparators(filePath.trim());
  const resolvedManifestLegOutDir = manifestLegOutDir == null
    ? null
    : normalizeSeparators(path.resolve(manifestLegOutDir));
  const resolvedCurrentLegOutDir = normalizeSeparators(path.resolve(currentLegOutDir));
  const resolvedArtifactPath = normalizeSeparators(path.resolve(artifactPath));
  if (
    resolvedManifestLegOutDir != null &&
    (
      resolvedArtifactPath === resolvedManifestLegOutDir ||
      resolvedArtifactPath.startsWith(`${resolvedManifestLegOutDir}/`)
    )
  ) {
    return normalizeSeparators(path.relative(resolvedManifestLegOutDir, resolvedArtifactPath));
  }

  if (
    resolvedArtifactPath === resolvedCurrentLegOutDir ||
    resolvedArtifactPath.startsWith(`${resolvedCurrentLegOutDir}/`)
  ) {
    return normalizeSeparators(path.relative(resolvedCurrentLegOutDir, resolvedArtifactPath));
  }

  return artifactPath.replace(/^\.\//, '');
}

function normalizeSeparators(value) {
  return value.replace(/\\/g, '/');
}
