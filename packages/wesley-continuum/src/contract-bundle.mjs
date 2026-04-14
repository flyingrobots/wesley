import { WesleyError } from '@wesley/core';
import {
  RECEIPT_FAMILY_SCOPE,
  SETTLEMENT_FAMILY_SCOPE,
  getContinuumScopeDefinition
} from './scopes.mjs';

export const CONTINUUM_CONTRACT_PROFILE = 'continuum';
export const CONTINUUM_CONTRACT_FAMILY_ORDER = [
  RECEIPT_FAMILY_SCOPE,
  SETTLEMENT_FAMILY_SCOPE
];
export const CONTINUUM_CONTRACT_CONSUMER_ORDER = [
  'warp-ttd',
  'echo'
];

const CONTINUUM_CONTRACT_BUNDLE_DEFINITIONS = deepFreeze({
  [RECEIPT_FAMILY_SCOPE]: {
    targets: ['warp-ttd', 'echo'],
    consumerKinds: ['warp-ttd', 'echo']
  },
  [SETTLEMENT_FAMILY_SCOPE]: {
    targets: ['warp-ttd', 'echo'],
    consumerKinds: ['warp-ttd', 'echo']
  }
});

const CONTINUUM_CONTRACT_CONSUMERS = deepFreeze({
  'warp-ttd': {
    description: 'Sync the checked-in manifest and TypeScript protocol roots in warp-ttd.',
    allowedExtraFilesByRoot: {},
    projections: [
      {
        kind: 'directory',
        fromRoot: 'targets/warp-ttd/manifest',
        toRoot: 'manifest'
      },
      {
        kind: 'directory',
        fromRoot: 'targets/warp-ttd/typescript',
        toRoot: 'typescript'
      }
    ]
  },
  echo: {
    description: 'Sync the checked-in generated TTD TypeScript package in Echo.',
    allowedExtraFilesByRoot: {
      'packages/ttd-protocol-ts': [
        '.gitkeep',
        'package.json',
        'primitives.ts'
      ]
    },
    projections: [
      {
        kind: 'file',
        from: 'targets/warp-ttd/typescript/index.ts',
        to: 'packages/ttd-protocol-ts/index.ts'
      },
      {
        kind: 'file',
        from: 'targets/warp-ttd/typescript/registry.ts',
        to: 'packages/ttd-protocol-ts/registry.ts'
      },
      {
        kind: 'file',
        from: 'targets/warp-ttd/typescript/types.ts',
        to: 'packages/ttd-protocol-ts/types.ts'
      },
      {
        kind: 'file',
        from: 'targets/warp-ttd/typescript/zod.ts',
        to: 'packages/ttd-protocol-ts/zod.ts'
      }
    ]
  }
});

export function getContinuumContractBundleDefinition(family) {
  const resolvedFamily = normalizeRequiredText(family, 'Continuum contract family');
  const definition = CONTINUUM_CONTRACT_BUNDLE_DEFINITIONS[resolvedFamily];
  if (definition == null) {
    throw new WesleyError(
      'CONTINUUM_CONTRACT_FAMILY_INVALID',
      `Unsupported Continuum contract family "${resolvedFamily}". Expected "${CONTINUUM_CONTRACT_FAMILY_ORDER.join('" or "')}".`,
      {
        requestedFamily: resolvedFamily,
        supportedFamilies: CONTINUUM_CONTRACT_FAMILY_ORDER
      }
    );
  }

  const scopeDefinition = getContinuumScopeDefinition(resolvedFamily);
  return cloneJson({
    profile: CONTINUUM_CONTRACT_PROFILE,
    family: resolvedFamily,
    scope: scopeDefinition.scope,
    defaultSchemaPath: scopeDefinition.defaultTtdSchemaPath,
    targets: [...definition.targets],
    consumerKinds: [...definition.consumerKinds],
    proves: [...scopeDefinition.proves],
    doesNotProve: [...scopeDefinition.doesNotProve]
  });
}

export function listContinuumContractBundleDefinitions() {
  return CONTINUUM_CONTRACT_FAMILY_ORDER.map((family) => getContinuumContractBundleDefinition(family));
}

export function getContinuumContractConsumerDefinition(consumer) {
  const resolvedConsumer = normalizeRequiredText(consumer, 'Continuum contract consumer');
  const definition = CONTINUUM_CONTRACT_CONSUMERS[resolvedConsumer];
  if (definition == null) {
    throw new WesleyError(
      'CONTINUUM_CONTRACT_CONSUMER_INVALID',
      `Unsupported Continuum contract consumer "${resolvedConsumer}". Expected "${CONTINUUM_CONTRACT_CONSUMER_ORDER.join('" or "')}".`,
      {
        requestedConsumer: resolvedConsumer,
        supportedConsumers: CONTINUUM_CONTRACT_CONSUMER_ORDER
      }
    );
  }

  return cloneJson({
    consumer: resolvedConsumer,
    ...definition
  });
}

export function listContinuumContractConsumerDefinitions() {
  return CONTINUUM_CONTRACT_CONSUMER_ORDER.map((consumer) => getContinuumContractConsumerDefinition(consumer));
}

export function defaultContinuumContractBundleOutDir({ family, release }) {
  const resolvedFamily = getContinuumContractBundleDefinition(family).family;
  const resolvedRelease = normalizeRequiredText(release, 'Continuum contract release');
  return joinContinuumPath('.wesley-cache/contracts', CONTINUUM_CONTRACT_PROFILE, resolvedFamily, resolvedRelease);
}

export function resolveContinuumContractBundleProfile({
  family,
  release,
  schemaPath,
  bundleOut,
  authorityRepository = null,
  authorityRef = null,
  authorityCommit = null,
  authorityPath = null
}) {
  const definition = getContinuumContractBundleDefinition(family);
  const resolvedRelease = normalizeRequiredText(release, 'Continuum contract release');
  const resolvedSchemaPath = normalizeOptionalPath(schemaPath) ?? definition.defaultSchemaPath;
  const resolvedBundleRoot = normalizeOptionalPath(bundleOut) ?? defaultContinuumContractBundleOutDir({
    family: definition.family,
    release: resolvedRelease
  });

  return {
    profile: CONTINUUM_CONTRACT_PROFILE,
    family: definition.family,
    scope: definition.scope,
    release: resolvedRelease,
    schemaPath: resolvedSchemaPath,
    bundleRoot: resolvedBundleRoot,
    targetsRoot: joinContinuumPath(resolvedBundleRoot, 'targets'),
    realizationPath: joinContinuumPath(resolvedBundleRoot, 'realization', 'manifest.json'),
    witnessPath: joinContinuumPath(resolvedBundleRoot, 'witness', 'conformance.json'),
    sourceAuthorityPath: joinContinuumPath(resolvedBundleRoot, 'source', 'authority.json'),
    sourceSnapshotPath: joinContinuumPath(resolvedBundleRoot, 'source', 'admitted.graphql'),
    bundleManifestPath: joinContinuumPath(resolvedBundleRoot, 'bundle.json'),
    targets: [...definition.targets],
    proves: [...definition.proves],
    doesNotProve: [...definition.doesNotProve],
    consumers: definition.consumerKinds.map((consumer) => getContinuumContractConsumerDefinition(consumer)),
    authority: {
      repository: normalizeOptionalText(authorityRepository),
      ref: normalizeOptionalText(authorityRef),
      commit: normalizeOptionalText(authorityCommit),
      path: normalizeOptionalPath(authorityPath) ?? resolvedSchemaPath
    }
  };
}

function joinContinuumPath(...parts) {
  return parts
    .filter((part) => part != null)
    .map((part) => String(part).trim())
    .filter(Boolean)
    .join('/')
    .replace(/\/+/g, '/');
}

function normalizeOptionalPath(value) {
  const text = normalizeOptionalText(value);
  return text == null ? null : text.replace(/\\/g, '/');
}

function normalizeRequiredText(value, label) {
  const text = normalizeOptionalText(value);
  if (text == null) {
    throw new WesleyError(
      'CONTINUUM_CONTRACT_ARGUMENT_INVALID',
      `${label} is required.`
    );
  }
  return text;
}

function normalizeOptionalText(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const text = value.trim();
  return text.length === 0 ? null : text;
}

function deepFreeze(value) {
  if (value == null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  for (const nested of Object.values(value)) {
    deepFreeze(nested);
  }
  return Object.freeze(value);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}
