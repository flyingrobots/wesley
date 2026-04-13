import { createRunId } from '@wesley/core';
import { getDefaultTransmutationName, resolveTransmutationName } from '../transmutations/registry.mjs';

export function resolveRunMetadata(options = {}, defaults = {}) {
  return {
    transmutation: resolveTransmutationName(
      options.transmutation || defaults.transmutation || getDefaultTransmutationName()
    ),
    runId: normalizeRunId(options.runId) || normalizeRunId(defaults.runId) || createRunId()
  };
}

function normalizeRunId(runId) {
  if (typeof runId !== 'string') return null;
  const trimmed = runId.trim();
  return trimmed || null;
}
