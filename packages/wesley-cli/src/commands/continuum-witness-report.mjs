import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WesleyError } from '@wesley/core';
import {
  createCheck,
  inspectEchoSurface,
  inspectTtdSurface,
  summarizeChecks
} from './continuum-witness-support.mjs';
import { inspectReceiptFamilySurface } from './continuum-receipt-family-witness.mjs';

export const CURRENT_MINIMUM_SCOPE = 'current-minimum-shared-surface';
export const RECEIPT_FAMILY_SCOPE = 'receipt-family';

const WITNESS_KIND = 'wesley.continuum.conformance.v1';
const RECEIPT_FAMILY_FIXTURE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../test/fixtures/continuum/receipt-family'
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
        'one explicit delivery-observation-versus-receipt separation case'
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
        'explicit receipt-versus-witness and delivery-versus-receipt separation cases'
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

  throw new WesleyError(
    'CONTINUUM_WITNESS_INVALID_SCOPE',
    `Unsupported witness scope "${options.scope}". Expected "${CURRENT_MINIMUM_SCOPE}" or "${RECEIPT_FAMILY_SCOPE}".`,
    {
      requestedScope: options.scope,
      supportedScopes: [CURRENT_MINIMUM_SCOPE, RECEIPT_FAMILY_SCOPE]
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
  outputPath,
  proves,
  doesNotProve,
  receiptFamilyFixtureDir
}) {
  const checks = [];
  const ttdSurface = await inspectTtdSurface({ fs, crypto, schemaPath: ttdSchemaPath, outDir: ttdDir, checks });
  const echoSurface = await inspectEchoSurface({ fs, schemaPath: echoSchemaPath, outDir: echoDir, checks });
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

  const summary = summarizeChecks(checks);

  return {
    kind: WITNESS_KIND,
    scope,
    status: summary.failed === 0 ? 'pass' : 'fail',
    outputPath,
    proves,
    doesNotProve,
    surfaces: receiptFamily == null
      ? { ttd: ttdSurface, echo: echoSurface }
      : { ttd: ttdSurface, echo: echoSurface, receiptFamily },
    summary,
    checks
  };
}

export { createCheck } from './continuum-witness-support.mjs';
