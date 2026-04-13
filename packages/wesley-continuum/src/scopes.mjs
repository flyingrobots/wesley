import path from 'node:path';
import { WesleyError } from '@wesley/core';

export const CURRENT_MINIMUM_SCOPE = 'current-minimum-shared-surface';
export const RECEIPT_FAMILY_SCOPE = 'receipt-family';
export const SETTLEMENT_FAMILY_SCOPE = 'settlement-family';
export const CONTINUUM_SCOPE_ORDER = [
  CURRENT_MINIMUM_SCOPE,
  RECEIPT_FAMILY_SCOPE,
  SETTLEMENT_FAMILY_SCOPE
];

const CONTINUUM_SCOPE_DEFINITIONS = deepFreeze({
  [CURRENT_MINIMUM_SCOPE]: {
    defaultOutDir: '.wesley-cache/continuum/local-inspect',
    defaultTtdSchemaPath: 'schemas/ttd-protocol.graphql',
    defaultEchoSchemaPath: 'schemas/echo-core-types.graphql',
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
      'the receipt-family proving lane',
      'the settlement-family proving lane'
    ]
  },
  [RECEIPT_FAMILY_SCOPE]: {
    defaultOutDir: '.wesley-cache/continuum/receipt-family',
    defaultTtdSchemaPath: 'schemas/continuum-receipt-family.graphql',
    defaultEchoSchemaPath: 'schemas/continuum-receipt-family.graphql',
    proves: [
      'schema-to-artifact consistency for the authored receipt-family TTD and Echo legs',
      'fixture-level conformance for emitted family nouns, footprints, invariants, and selected round-trip operation vectors',
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
    ]
  },
  [SETTLEMENT_FAMILY_SCOPE]: {
    defaultOutDir: '.wesley-cache/continuum/settlement-family',
    defaultTtdSchemaPath: 'schemas/continuum-settlement-family.graphql',
    defaultEchoSchemaPath: 'schemas/continuum-settlement-family.graphql',
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
    ]
  }
});

export function getContinuumScopeDefinition(scope) {
  const resolvedScope = scope ?? CURRENT_MINIMUM_SCOPE;
  const definition = CONTINUUM_SCOPE_DEFINITIONS[resolvedScope];
  if (definition != null) {
    return cloneJson({
      scope: resolvedScope,
      ...definition
    });
  }

  throw new WesleyError(
    'CONTINUUM_SCOPE_INVALID',
    `Unsupported Continuum scope "${resolvedScope}". Expected "${CURRENT_MINIMUM_SCOPE}", "${RECEIPT_FAMILY_SCOPE}", or "${SETTLEMENT_FAMILY_SCOPE}".`,
    {
      requestedScope: resolvedScope,
      supportedScopes: CONTINUUM_SCOPE_ORDER
    }
  );
}

export function listContinuumScopeDefinitions() {
  return CONTINUUM_SCOPE_ORDER.map((scope) => getContinuumScopeDefinition(scope));
}

export function defaultContinuumOutDir(scope) {
  return getContinuumScopeDefinition(scope).defaultOutDir;
}

export function resolveContinuumWitnessProfile({
  scope,
  schemaPath,
  outDir,
  ttdSchemaPath,
  ttdDir,
  echoSchemaPath,
  echoDir,
  reportPath,
  receiptFamilyFixtureDir = null,
  settlementFamilyFixtureDir = null
}) {
  const definition = getContinuumScopeDefinition(scope);
  const sharedSchemaPath = normalizeOptionalPath(schemaPath);
  const resolvedOutDir = normalizeOptionalPath(outDir) ?? definition.defaultOutDir;
  const resolvedTtdSchemaPath = normalizeOptionalPath(ttdSchemaPath) ?? sharedSchemaPath ?? definition.defaultTtdSchemaPath;
  const resolvedEchoSchemaPath = normalizeOptionalPath(echoSchemaPath) ?? sharedSchemaPath ?? definition.defaultEchoSchemaPath;

  return {
    scope: definition.scope,
    outDir: resolvedOutDir,
    ttdSchemaPath: resolvedTtdSchemaPath,
    ttdDir: normalizeOptionalPath(ttdDir) ?? joinContinuumPath(resolvedOutDir, 'warp-ttd'),
    echoSchemaPath: resolvedEchoSchemaPath,
    echoDir: normalizeOptionalPath(echoDir) ?? joinContinuumPath(resolvedOutDir, 'echo'),
    outputPath: normalizeOptionalPath(reportPath) ?? joinContinuumPath(resolvedOutDir, 'witness', 'conformance.json'),
    realizationRoot: joinContinuumPath(resolvedOutDir, 'realization'),
    proves: [...definition.proves],
    doesNotProve: [...definition.doesNotProve],
    receiptFamilyFixtureDir: definition.scope === RECEIPT_FAMILY_SCOPE ? normalizeOptionalPath(receiptFamilyFixtureDir) ?? null : null,
    settlementFamilyFixtureDir: definition.scope === SETTLEMENT_FAMILY_SCOPE ? normalizeOptionalPath(settlementFamilyFixtureDir) ?? null : null
  };
}

export function resolveContinuumDriftWatchProfile({
  scope,
  schemaPath,
  outDir,
  ttdSchemaPath,
  ttdDir,
  echoSchemaPath,
  echoDir,
  reportPath,
  receiptFamilyFixtureDir = null,
  settlementFamilyFixtureDir = null,
  mirrorRoots = []
}) {
  const witnessProfile = resolveContinuumWitnessProfile({
    scope,
    schemaPath,
    outDir,
    ttdSchemaPath,
    ttdDir,
    echoSchemaPath,
    echoDir,
    reportPath: normalizeOptionalPath(reportPath) ?? joinContinuumPath(
      normalizeOptionalPath(outDir) ?? defaultContinuumOutDir(scope),
      'witness',
      'drift-watch.json'
    ),
    receiptFamilyFixtureDir,
    settlementFamilyFixtureDir
  });

  return {
    ...witnessProfile,
    outputPath: witnessProfile.outputPath,
    mirrorRoots: [...new Set((Array.isArray(mirrorRoots) ? mirrorRoots : [mirrorRoots])
      .map((item) => normalizeOptionalPath(item))
      .filter(Boolean))]
  };
}

export function buildContinuumPublicationBoundaryPlan({
  scope,
  ttdSchemaPath,
  ttdDir,
  echoSchemaPath,
  echoDir,
  realizationRoot,
  realizationManifest = null,
  ttdGeneratedArtifacts = [],
  echoGeneratedArtifacts = [],
  defaultTtdGeneratedArtifacts = [],
  defaultEchoGeneratedArtifacts = [],
  receiptFamilyFixtureDir = null,
  settlementFamilyFixtureDir = null
}) {
  const resolvedScope = getContinuumScopeDefinition(scope).scope;
  const resolvedTtdGeneratedArtifacts = resolveLegGeneratedArtifacts({
    leg: realizationManifest?.generatedLegs?.warpTtd,
    currentLegOutDir: ttdDir,
    fallback: ttdGeneratedArtifacts.length > 0 ? ttdGeneratedArtifacts : defaultTtdGeneratedArtifacts
  });
  const resolvedEchoGeneratedArtifacts = resolveLegGeneratedArtifacts({
    leg: realizationManifest?.generatedLegs?.echo,
    currentLegOutDir: echoDir,
    fallback: echoGeneratedArtifacts.length > 0 ? echoGeneratedArtifacts : defaultEchoGeneratedArtifacts
  });
  const realizationArtifactPaths = realizationRoot == null
    ? []
    : buildGeneratedArtifactPaths(realizationRoot, ['manifest.json']);

  if (resolvedScope === CURRENT_MINIMUM_SCOPE) {
    return {
      rules: [
        {
          id: 'ttd-protocol',
          authoredHomes: [ttdSchemaPath],
          generatedRoots: [ttdDir].concat(realizationRoot == null ? [] : [realizationRoot]),
          compatRoots: [],
          generatedArtifactPaths: buildGeneratedArtifactPaths(ttdDir, resolvedTtdGeneratedArtifacts)
        },
        {
          id: 'echo-core-types',
          authoredHomes: [echoSchemaPath],
          generatedRoots: [echoDir].concat(realizationRoot == null ? [] : [realizationRoot]),
          compatRoots: [],
          generatedArtifactPaths: buildGeneratedArtifactPaths(echoDir, resolvedEchoGeneratedArtifacts)
        }
      ],
      reservedRoots: buildPublicationBoundaryReservedRoots(resolvedScope)
    };
  }

  if (resolvedScope === SETTLEMENT_FAMILY_SCOPE) {
    return {
      rules: [
        {
          id: 'settlement-family',
          authoredHomes: [ttdSchemaPath],
          generatedRoots: [ttdDir, echoDir].concat(realizationRoot == null ? [] : [realizationRoot]),
          compatRoots: [settlementFamilyFixtureDir, 'schemas/continuum-settlement-family.graphql'].filter(Boolean),
          generatedArtifactPaths: [
            ...buildGeneratedArtifactPaths(ttdDir, resolvedTtdGeneratedArtifacts),
            ...buildGeneratedArtifactPaths(echoDir, resolvedEchoGeneratedArtifacts),
            ...realizationArtifactPaths
          ]
        }
      ],
      reservedRoots: buildPublicationBoundaryReservedRoots(resolvedScope)
    };
  }

  return {
    rules: [
      {
        id: 'receipt-family',
        authoredHomes: [ttdSchemaPath],
        generatedRoots: [ttdDir, echoDir].concat(realizationRoot == null ? [] : [realizationRoot]),
        compatRoots: [receiptFamilyFixtureDir, 'schemas/continuum-receipt-family.graphql'].filter(Boolean),
        generatedArtifactPaths: [
          ...buildGeneratedArtifactPaths(ttdDir, resolvedTtdGeneratedArtifacts),
          ...buildGeneratedArtifactPaths(echoDir, resolvedEchoGeneratedArtifacts),
          ...realizationArtifactPaths
        ]
      }
    ],
    reservedRoots: buildPublicationBoundaryReservedRoots(resolvedScope)
  };
}

function buildPublicationBoundaryReservedRoots(scope) {
  if (scope === CURRENT_MINIMUM_SCOPE) {
    return [
      'test',
      'packages/wesley-cli/test',
      'packages/wesley-core/test',
      'packages/wesley-generator-echo/test',
      'packages/wesley-generator-ttd/test',
      'test/fixtures/continuum/receipt-family',
      'test/fixtures/continuum/settlement-family',
      'schemas/continuum-receipt-family.graphql',
      'schemas/continuum-settlement-family.graphql',
      'schemas/directives.graphql'
    ];
  }

  return [
    'schemas/ttd-protocol.graphql',
    'schemas/echo-core-types.graphql',
    'schemas/continuum-receipt-family.graphql',
    'schemas/continuum-settlement-family.graphql',
    'schemas/directives.graphql'
  ];
}

function buildGeneratedArtifactPaths(rootDir, files) {
  const rootSegment = normalizeSeparators(path.basename(rootDir));
  return [...new Set(
    files
      .map((file) => normalizeGeneratedArtifactPath(file))
      .filter(Boolean)
      .map((file) => rootSegment.length === 0 ? file : `${rootSegment}/${file}`)
  )].sort((left, right) => left.localeCompare(right));
}

function normalizeGeneratedArtifactPath(filePath) {
  if (typeof filePath !== 'string' || filePath.trim().length === 0) {
    return null;
  }

  return normalizeSeparators(filePath.trim()).replace(/^\.?\//, '');
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

function joinContinuumPath(...segments) {
  return normalizeSeparators(path.join(...segments));
}

function normalizeSeparators(value) {
  return value.replace(/\\/g, '/');
}

function normalizeOptionalPath(value) {
  if (value == null) {
    return undefined;
  }
  const text = String(value).trim();
  return text.length === 0 ? undefined : normalizeSeparators(text);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (value == null || typeof value !== 'object') {
    return value;
  }
  Object.freeze(value);
  for (const nested of Object.values(value)) {
    deepFreeze(nested);
  }
  return value;
}
