import { WesleyError } from '@wesley/core';
import { NULL_GENERATOR_TRANSMUTATION, NullGeneratorPlugin } from './null-generator.mjs';

const TRANSMUTATION_REGISTRY = Object.freeze({
  [NULL_GENERATOR_TRANSMUTATION]: {
    name: NULL_GENERATOR_TRANSMUTATION,
    description: 'Minimal registration-only witness transmutation',
    default: true,
    requiredGenerators: [],
    supportsTasksRunner: false,
    createExecution({ ctx, context, ir }) {
      return {
        name: NULL_GENERATOR_TRANSMUTATION,
        plugins: [new NullGeneratorPlugin()],
        schema: {
          sdl: context.schemaContent,
          ir
        },
        config: {
          paths: {
            ...(ctx.config?.paths || {}),
            outputDir: context.options.outDir
          },
          transmutation: {
            name: NULL_GENERATOR_TRANSMUTATION
          }
        }
      };
    }
  }
});

const SUPPORTED_TRANSMUTATIONS = Object.freeze(Object.keys(TRANSMUTATION_REGISTRY));
const DEFAULT_TRANSMUTATION =
  Object.values(TRANSMUTATION_REGISTRY).find((registration) => registration.default)?.name ||
  NULL_GENERATOR_TRANSMUTATION;

export function listTransmutations() {
  return [...SUPPORTED_TRANSMUTATIONS];
}

export function describeTransmutations() {
  return SUPPORTED_TRANSMUTATIONS.map((name) => {
    const registration = TRANSMUTATION_REGISTRY[name];
    return {
      name,
      description: registration.description || '',
      default: registration.default === true
    };
  });
}

export function getDefaultTransmutationName() {
  return DEFAULT_TRANSMUTATION;
}

export function formatTransmutationChoices() {
  return describeTransmutations()
    .map((registration) =>
      registration.default ? `${registration.name} (default)` : registration.name
    )
    .join(', ');
}

export function resolveTransmutationName(requested) {
  const normalized = String(requested || DEFAULT_TRANSMUTATION).trim() || DEFAULT_TRANSMUTATION;
  if (!SUPPORTED_TRANSMUTATIONS.includes(normalized)) {
    throw new WesleyError(
      'UNKNOWN_TRANSMUTATION',
      `Unknown transmutation "${normalized}". Supported transmutations: ${formatTransmutationChoices()}`
    );
  }
  return normalized;
}

export function resolveTransmutationRegistration(requested) {
  return TRANSMUTATION_REGISTRY[resolveTransmutationName(requested)];
}

export function assertTransmutationPrerequisites(requested, ctx) {
  const registration = resolveTransmutationRegistration(requested);
  const missing = (registration.requiredGenerators || []).filter(
    (kind) => !ctx?.generators?.[kind]
  );

  if (missing.length > 0) {
    throw new WesleyError(
      'GENERATION_FAILED',
      `Transmutation "${registration.name}" requires generator(s): ${missing.join(', ')}`
    );
  }

  return registration;
}

export function createTransmutationExecution(requested, params) {
  const registration = resolveTransmutationRegistration(requested);
  return registration.createExecution(params);
}

export function flattenTransmutationArtifacts(runResult) {
  const artifacts = [];
  for (const result of runResult?.results || []) {
    if (result.status !== 'ok' || !result.artifacts) continue;
    for (const [name, content] of Object.entries(result.artifacts)) {
      artifacts.push({ name, content });
    }
  }
  return artifacts;
}
