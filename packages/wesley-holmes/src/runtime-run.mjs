import path from 'node:path';
import { readRuntimeRunRecord, resolveRuntimeRunStream } from '@wesley/core';
import { GitWarpEventStore, resolveLedgerRootDir } from '@wesley/runtime-node';

export async function loadRuntimeRunRecord({ repoRoot, runId, transmutation = null }) {
  const requestedRunId = typeof runId === 'string' ? runId.trim() : '';
  const requestedTransmutation = typeof transmutation === 'string' && transmutation.trim()
    ? transmutation.trim()
    : null;

  if (!requestedRunId) {
    return null;
  }

  const workspaceRoot = path.resolve(repoRoot || process.cwd());
  const ledgerDir = await resolveLedgerRootDir({ repoRoot: workspaceRoot });
  const eventStore = new GitWarpEventStore({ rootDir: ledgerDir });

  let record;
  try {
    const { streamId } = resolveRuntimeRunStream(eventStore, {
      runId: requestedRunId,
      transmutation: requestedTransmutation
    });
    record = readRuntimeRunRecord(eventStore, streamId, {
      runId: requestedRunId,
      transmutation: requestedTransmutation,
      includeEvents: false
    });
  } catch (error) {
    throw normalizeRuntimeLookupError(error);
  }

  return {
    requested: {
      runId: requestedRunId,
      transmutation: requestedTransmutation
    },
    run: record.run,
    snapshot: record.snapshot
      ? {
        used: true,
        lastSequence: record.snapshot.lastSequence ?? null,
        updatedAt: record.snapshot.updatedAt ?? null,
        eventCount: record.snapshot.eventCount ?? null
      }
      : null,
    replay: {
      terminal: Boolean(record.replay?.terminal),
      valid: Boolean(record.replay?.integrity?.valid),
      issueCount: Array.isArray(record.replay?.integrity?.issues) ? record.replay.integrity.issues.length : 0
    },
    ledgerDir
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
  return error instanceof Error ? error : new Error(String(error));
}
