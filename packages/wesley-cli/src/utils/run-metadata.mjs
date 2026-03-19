import { createRunId } from '@wesley/core';
import { LEGACY_SUPABASE_TRANSMUTATION } from '../transmutations/legacy-supabase.mjs';
import { resolveTransmutationName } from '../transmutations/registry.mjs';

export function resolveRunMetadata(options = {}, defaults = {}) {
  return {
    transmutation: resolveTransmutationName(
      options.transmutation || defaults.transmutation || LEGACY_SUPABASE_TRANSMUTATION
    ),
    runId: normalizeRunId(options.runId) || normalizeRunId(defaults.runId) || createRunId()
  };
}

function normalizeRunId(runId) {
  if (typeof runId !== 'string') return null;
  const trimmed = runId.trim();
  return trimmed || null;
}
