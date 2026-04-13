import { WesleyError } from '@wesley/core';
import {
  LEGACY_SUPABASE_TRANSMUTATION,
  LegacySupabaseGeneratorPlugin,
  legacySupabaseScoringOptions
} from './legacy-supabase.mjs';
import {
  NULL_GENERATOR_TRANSMUTATION,
  NullGeneratorPlugin
} from './null-generator.mjs';

const TRANSMUTATION_REGISTRY = Object.freeze({
  [LEGACY_SUPABASE_TRANSMUTATION]: {
    name: LEGACY_SUPABASE_TRANSMUTATION,
    requiredGenerators: ['sql'],
    supportsTasksRunner: true,
    createExecution({ ctx, context, ir }) {
      return {
        name: LEGACY_SUPABASE_TRANSMUTATION,
        plugins: [
          new LegacySupabaseGeneratorPlugin({
            generators: ctx.generators,
            enableRls: context.options.supabase
          })
        ],
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
            name: LEGACY_SUPABASE_TRANSMUTATION,
            supabase: Boolean(context.options.supabase)
          }
        },
        scoring: legacySupabaseScoringOptions()
      };
    }
  },
  [NULL_GENERATOR_TRANSMUTATION]: {
    name: NULL_GENERATOR_TRANSMUTATION,
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

export function listTransmutations() {
  return [...SUPPORTED_TRANSMUTATIONS];
}

export function resolveTransmutationName(requested) {
  const normalized = String(requested || LEGACY_SUPABASE_TRANSMUTATION).trim() || LEGACY_SUPABASE_TRANSMUTATION;
  if (!SUPPORTED_TRANSMUTATIONS.includes(normalized)) {
    throw new WesleyError(
      'UNKNOWN_TRANSMUTATION',
      `Unknown transmutation "${normalized}". Supported transmutations: ${SUPPORTED_TRANSMUTATIONS.join(', ')}`
    );
  }
  return normalized;
}

export function resolveTransmutationRegistration(requested) {
  return TRANSMUTATION_REGISTRY[resolveTransmutationName(requested)];
}

export function assertTransmutationPrerequisites(requested, ctx) {
  const registration = resolveTransmutationRegistration(requested);
  const missing = (registration.requiredGenerators || []).filter((kind) => !ctx?.generators?.[kind]);

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
