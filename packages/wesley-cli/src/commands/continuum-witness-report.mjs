import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WesleyError } from '@wesley/core';
import {
  inspectEchoSurface,
  inspectTtdSurface,
  summarizeChecks
} from './continuum-witness-support.mjs';
import { inspectContinuumPublicationBoundary } from './continuum-publication-boundary.mjs';
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
  realizationRoot,
  outputPath,
  proves,
  doesNotProve,
  receiptFamilyFixtureDir
}) {
  const checks = [];
  const repoRoot = await resolveRepoRoot(fs);
  const ttdSurface = await inspectTtdSurface({ fs, crypto, schemaPath: ttdSchemaPath, outDir: ttdDir, checks });
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
      receiptFamilyFixtureDir
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

  const summary = summarizeChecks(checks);

  return {
    kind: WITNESS_KIND,
    scope,
    status: summary.failed === 0 ? 'pass' : 'fail',
    outputPath,
    proves,
    doesNotProve,
    surfaces: receiptFamily == null
      ? { ttd: ttdSurface, echo: echoSurface, publicationBoundary }
      : { ttd: ttdSurface, echo: echoSurface, receiptFamily, publicationBoundary },
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
  receiptFamilyFixtureDir
}) {
  if (scope === CURRENT_MINIMUM_SCOPE) {
    return [
      {
        id: 'ttd-protocol',
        authoredHomes: [ttdSchemaPath],
        generatedRoots: [ttdDir].concat(realizationRoot == null ? [] : [realizationRoot]),
        compatRoots: [],
        generatedArtifacts: [
          'manifest/schema.json',
          'manifest/contracts.json',
          'manifest/manifest.json',
          'manifest/ttd-ir.json',
          'typescript/types.ts',
          'typescript/zod.ts',
          'typescript/registry.ts',
          'typescript/index.ts'
        ]
      },
      {
        id: 'echo-core-types',
        authoredHomes: [echoSchemaPath],
        generatedRoots: [echoDir].concat(realizationRoot == null ? [] : [realizationRoot]),
        compatRoots: [],
        generatedArtifacts: [
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
        ]
      }
    ];
  }

  return [
    {
      id: 'receipt-family',
      authoredHomes: [ttdSchemaPath],
      generatedRoots: [ttdDir, echoDir].concat(realizationRoot == null ? [] : [realizationRoot]),
      compatRoots: [receiptFamilyFixtureDir],
      generatedArtifacts: [
        'manifest/schema.json',
        'manifest/contracts.json',
        'manifest/manifest.json',
        'manifest/ttd-ir.json',
        'typescript/types.ts',
        'typescript/zod.ts',
        'typescript/registry.ts',
        'typescript/index.ts',
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
      ]
    }
  ];
}

async function resolveRepoRoot(fs) {
  if (fs.resolve) {
    return fs.resolve('.');
  }
  return process.cwd();
}
