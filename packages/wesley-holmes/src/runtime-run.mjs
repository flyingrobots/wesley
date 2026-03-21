import path from 'node:path';
import { runNodeCommand, resolveWesleyExecutable } from './wesley-exec.mjs';

export async function loadRuntimeRunRecord({ repoRoot, runId, transmutation = null }) {
  const requestedRunId = typeof runId === 'string' ? runId.trim() : '';
  const requestedTransmutation = typeof transmutation === 'string' && transmutation.trim()
    ? transmutation.trim()
    : null;

  if (!requestedRunId) {
    return null;
  }

  const wesleyExec = resolveWesleyExecutable(repoRoot);
  if (!wesleyExec) {
    throw new Error(`Unable to locate the Wesley runtime for run lookup under ${repoRoot}.`);
  }

  const args = [
    wesleyExec.entry,
    'runs',
    'replay',
    '--run-id',
    requestedRunId,
    '--json',
    '--quiet'
  ];
  if (requestedTransmutation) {
    args.push('--transmutation', requestedTransmutation);
  }

  let payload;
  try {
    const result = runNodeCommand(args, repoRoot, wesleyExec.env);
    payload = JSON.parse(result.stdout);
  } catch (error) {
    throw normalizeRuntimeLookupError(error);
  }

  return {
    requested: {
      runId: requestedRunId,
      transmutation: requestedTransmutation
    },
    run: payload.run,
    snapshot: payload.snapshot
      ? {
        used: true,
        lastSequence: payload.snapshot.lastSequence ?? null,
        updatedAt: payload.snapshot.updatedAt ?? null,
        eventCount: payload.snapshot.eventCount ?? null
      }
      : null,
    replay: {
      terminal: Boolean(payload.replay?.terminal),
      valid: Boolean(payload.replay?.integrity?.valid),
      issueCount: Array.isArray(payload.replay?.integrity?.issues) ? payload.replay.integrity.issues.length : 0
    },
    ledgerDir: path.join(repoRoot, '.wesley', 'ledger')
  };
}

export function attachRuntimeRun(data, runtimeRecord) {
  if (!runtimeRecord) {
    return;
  }

  data.runtime = runtimeRecord;
  data.metadata = typeof data.metadata === 'object' && data.metadata !== null ? data.metadata : {};
  data.metadata.runId = runtimeRecord.run?.runId || runtimeRecord.requested?.runId || null;
  data.metadata.transmutation = runtimeRecord.run?.transmutation || runtimeRecord.requested?.transmutation || null;

  data.warnings = Array.isArray(data.warnings) ? data.warnings : [];
  data.patterns = Array.isArray(data.patterns) ? data.patterns : [];

  if (runtimeRecord.run?.status && runtimeRecord.run.status !== 'completed') {
    data.warnings.push(
      `Runtime run ${runtimeRecord.run.runId} is ${runtimeRecord.run.status}; Moriarty is reading partial or failed execution context.`
    );
    data.patterns.push({
      type: 'RUNTIME_RUN_STATE',
      description: `Associated runtime run is ${runtimeRecord.run.status}.`
    });
  }

  if (runtimeRecord.run?.failure?.code) {
    data.patterns.push({
      type: 'RUNTIME_RUN_FAILURE',
      description: `${runtimeRecord.run.failure.code}${runtimeRecord.run.failure.message ? `: ${runtimeRecord.run.failure.message}` : ''}`
    });
  }
}

function normalizeRuntimeLookupError(error) {
  const message = typeof error?.message === 'string' ? error.message : '';
  for (const candidate of extractJsonObjects(message)) {
    if (typeof candidate?.message === 'string' && candidate.message.trim()) {
      return new Error(candidate.message.trim());
    }
    if (typeof candidate?.error === 'string' && candidate.error.trim()) {
      return new Error(candidate.error.trim());
    }
  }
  return error instanceof Error ? error : new Error(String(error));
}

function extractJsonObjects(message) {
  const results = [];
  const candidates = [message];
  const start = message.indexOf('{');
  const end = message.lastIndexOf('}');
  if (start >= 0 && end > start) {
    candidates.push(message.slice(start, end + 1));
  }
  for (const candidate of candidates) {
    try {
      results.push(JSON.parse(candidate));
    } catch (_error) {
      // Ignore non-JSON fragments while searching for structured CLI errors.
    }
  }
  return results;
}
