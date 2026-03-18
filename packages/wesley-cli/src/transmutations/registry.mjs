import { WesleyError } from '@wesley/core';
import { LEGACY_SUPABASE_TRANSMUTATION } from './legacy-supabase.mjs';

const SUPPORTED_TRANSMUTATIONS = Object.freeze([
  LEGACY_SUPABASE_TRANSMUTATION
]);

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
