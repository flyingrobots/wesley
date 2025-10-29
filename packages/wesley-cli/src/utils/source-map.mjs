import { EvidenceMap } from '@wesley/core';
// Deep import: helper is not re-exported at core index
import { findSourceForSql } from '@wesley/core/src/application/SourceMap.mjs';

function tryParseSqlLocation(error) {
  const text = `${error?.message || ''}\n${error?.stack || ''}`;
  // Match paths like schema.sql:123 or any *.sql:123
  const m = text.match(/([^\s:]+\.sql):(\d+)/);
  if (!m) return null;
  return { file: m[1], line: Number(m[2]) || 0 };
}

async function tryLoadEvidenceMap(fs) {
  try {
    // Prefer bundle in project root .wesley/bundle.json
    const path = '.wesley/bundle.json';
    const raw = await fs.read(path);
    const json = JSON.parse(String(raw));
    // Accept either { evidence: { ... } } or { evidence: { evidence: { ... } } }
    const payload = json?.evidence?.evidence ? json.evidence : json;
    if (!payload?.evidence) return null;
    return EvidenceMap.fromJSON(payload);
  } catch {
    return null;
  }
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
      const columns = src.columns ? `, columns ${src.columns}` : '';
      return { file: src.file, lines: src.lines, columns: src.columns || null, uid: result.uid, matchedSql: { file: f, line: loc.line } };
    }
  }
  return null;
}

