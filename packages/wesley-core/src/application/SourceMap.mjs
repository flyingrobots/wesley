/**
 * SourceMap utilities — map generated artifact locations back to SDL.
 *
 * EvidenceMap records entries like:
 *   record(uid, 'sql',    { file: 'out/schema.sql', lines: '12-12' })
 *   record(uid, 'source', { file: 'schema.graphql', lines: '3-5', columns: '1-20' })
 *
 * Given a SQL error at (file,line), we find the owning uid and then
 * return the corresponding source location if present.
 */

function parseRange(r) {
  if (!r) return [0, 0];
  const m = String(r).split('-').map((n) => Number(n));
  return [m[0] || 0, m[1] || m[0] || 0];
}

export function findSourceForSql(evidenceMap, { file, line }) {
  if (!evidenceMap || !file || !line) return null;
  const candidates = [];
  for (const [uid, evid] of evidenceMap.map.entries()) {
    const sqlSpans = (evid.sql || []).filter((e) => e.file === file);
    for (const s of sqlSpans) {
      const [a, b] = parseRange(s.lines);
      if (line >= a && line <= b) {
        candidates.push({ uid, evid });
      }
    }
  }
  if (candidates.length === 0) return null;
  // Prefer exact one; otherwise first match
  const { uid, evid } = candidates[0];
  const source = (evid.source || [])[0];
  if (!source) return { uid, source: null };
  return { uid, source };
}

