import {
  GENERATED_REALM_PATH,
  GENERATED_SNAPSHOT_PATH,
  generatedArtifactPathCandidates
} from '@wesley/core';

export const SNAPSHOT_PROJECTION_PATH = GENERATED_SNAPSHOT_PATH;
export const REALM_PROJECTION_PATH = GENERATED_REALM_PATH;

export function buildSnapshotProjection(ir = {}) {
  return {
    irVersion: '1.0.0',
    tables: Array.isArray(ir?.tables) ? ir.tables : []
  };
}

export function buildRealmProjection({
  transmutation,
  runId,
  provider,
  verdict,
  durationMs,
  steps,
  error,
  timestamp
}) {
  return {
    transmutation,
    runId,
    provider,
    verdict,
    duration_ms: durationMs,
    ...(steps == null ? {} : { steps }),
    ...(error == null ? {} : { error }),
    timestamp
  };
}

export async function writeSnapshotProjection(fs, ir, path = SNAPSHOT_PROJECTION_PATH) {
  await writeProjectionFile(fs, path, buildSnapshotProjection(ir));
}

export async function writeRealmProjection(fs, projection, path = REALM_PROJECTION_PATH) {
  await writeProjectionFile(fs, path, projection);
}

export async function readSnapshotProjection(fs, path = SNAPSHOT_PROJECTION_PATH) {
  return readProjectionFile(fs, path);
}

export async function readRealmProjection(fs, path = REALM_PROJECTION_PATH) {
  return readProjectionFile(fs, path);
}

async function writeProjectionFile(fs, path, projection) {
  if (!fs?.write) return;
  await fs.write(path, JSON.stringify(projection, null, 2));
}

async function readProjectionFile(fs, path) {
  if (!fs?.read) return null;
  let lastError = null;
  for (const candidate of generatedArtifactPathCandidates(path)) {
    try {
      return JSON.parse(await fs.read(candidate));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
