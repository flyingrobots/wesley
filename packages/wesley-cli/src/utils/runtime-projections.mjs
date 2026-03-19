export const SNAPSHOT_PROJECTION_PATH = '.wesley/snapshot.json';
export const REALM_PROJECTION_PATH = '.wesley/realm.json';

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

async function writeProjectionFile(fs, path, projection) {
  if (!fs?.write) return;
  await fs.write(path, JSON.stringify(projection, null, 2));
}
