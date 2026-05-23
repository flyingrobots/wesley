import { EvidenceMap, GENERATED_BUNDLE_PATH, generatedArtifactPathCandidates } from '@wesley/core';
// Deep import: helper is not re-exported at core index
import { findSourceForSql } from '@wesley/core/src/application/SourceMap.mjs';

function tryParseSqlLocation(error) {
  const text = `${error?.message || ''}\n${error?.stack || ''}`;
  const sqlMarker = '.sql:';
  const markerIndex = text.indexOf(sqlMarker);
  if (markerIndex < 0) return null;

  let fileStart = markerIndex;
  while (fileStart > 0) {
    const ch = text[fileStart - 1];
    if (ch === '\n' || ch === '\r' || ch === '\t' || ch === ' ' || ch === ':') break;
    fileStart -= 1;
  }

  const lineStart = markerIndex + sqlMarker.length;
  let lineEnd = lineStart;
  while (lineEnd < text.length) {
    const ch = text[lineEnd];
    if (ch < '0' || ch > '9') break;
    lineEnd += 1;
  }

  if (lineEnd === lineStart) return null;
  const file = text.slice(fileStart, markerIndex + 4);
  const line = Number(text.slice(lineStart, lineEnd)) || 0;
  return { file, line };
}

async function tryLoadEvidenceMap(fs) {
  for (const candidate of generatedArtifactPathCandidates(GENERATED_BUNDLE_PATH)) {
    try {
      const raw = await fs.read(candidate);
      const json = JSON.parse(String(raw));
      const payload = json?.evidence?.evidence ? json.evidence : json;
      if (!payload?.evidence) return null;
      return EvidenceMap.fromJSON(payload);
    } catch {
      continue;
    }
  }
  return null;
}

export async function annotateErrorWithSDL(error, { fs } = {}) {
  const loc = tryParseSqlLocation(error);
  if (!loc || !fs) return null;
  const ev = await tryLoadEvidenceMap(fs);
  if (!ev) return null;
  // If evidence recorded with a specific path (e.g., out/schema.sql), try both exact and suffix match
  const tryFiles = [loc.file];
  if (!loc.file.endsWith('schema.sql')) {
    tryFiles.push('out/schema.sql', 'schema.sql');
  }
  for (const f of tryFiles) {
    const result = findSourceForSql(ev, { file: f, line: loc.line });
    if (result && result.source) {
      const src = result.source;
      const _columns = src.columns ? `, columns ${src.columns}` : '';
      return {
        file: src.file,
        lines: src.lines,
        columns: src.columns || null,
        uid: result.uid,
        matchedSql: { file: f, line: loc.line }
      };
    }
  }
  return null;
}
