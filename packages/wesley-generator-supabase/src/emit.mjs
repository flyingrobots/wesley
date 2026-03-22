/**
 * Supabase Generator Emit Functions
 * Side-effect free exports for lazy loading
 */

import {
  DirectiveProcessor,
  EvidenceMap,
  PgTAPTestGenerator,
  PostgreSQLGenerator,
  irToSchema
} from '@wesley/core';

const DEFAULT_OUT_DIR = 'out';

/**
 * Emit PostgreSQL DDL from Wesley IR and return precise per-element evidence.
 * @param {object} ir - Wesley IR with structured fields and directives
 * @param {{ outDir?: string }} [options]
 */
export async function emitDDL(ir, options = {}) {
  const schema = irToSchema(ir);
  const evidenceMap = new EvidenceMap();
  const generator = new PostgreSQLGenerator(evidenceMap);
  const sql = await generator.generate(schema, { enableRLS: false });

  return {
    label: 'ddl',
    files: [{ name: 'schema.sql', content: String(sql) }],
    evidence: toPluginEvidence(evidenceMap, {
      outDir: options.outDir,
      defaultFile: 'schema.sql'
    })
  };
}

/**
 * Emit RLS policies while preserving legacy tenant-enable behavior.
 * @param {object} ir - Wesley IR with structured fields and directives
 * @param {{ outDir?: string }} [options]
 */
export async function emitRLS(ir, options = {}) {
  const schema = irToSchema(ir);
  const evidenceMap = new EvidenceMap();
  const generator = new PostgreSQLGenerator(evidenceMap);
  const lines = [];

  for (const table of schema.getTables()) {
    const legacyDirectives = ir.tables?.find((entry) => entry.name === table.name)?.directives || {};
    const hasTenant = Boolean(legacyDirectives?.tenant?.field);
    const hasRls = Boolean(table.directives?.['@rls']);
    if (!hasTenant && !hasRls) continue;

    const tableUid = DirectiveProcessor.getUid(table.directives) || `tbl:${table.name}`;
    const startLine = lines.length + 1;

    if (hasRls) {
      const chunk = table.directives?.['@rls']?.preset
        ? generator.generatePresetRLS(table, table.directives['@rls'].preset)
        : generator.generateRLSPolicies(table);
      lines.push(...String(chunk).trim().split('\n'));
    } else {
      lines.push(`-- Enable RLS for ${table.name}`);
      lines.push(`ALTER TABLE "${table.name}" ENABLE ROW LEVEL SECURITY;`);
      lines.push(`ALTER TABLE "${table.name}" FORCE ROW LEVEL SECURITY;`);
    }

    const endLine = lines.length;
    evidenceMap.record(`${tableUid}.rls`, 'sql', {
      file: generatedFilePath(options.outDir, 'rls.sql'),
      lines: `${startLine}-${endLine}`,
      sha: evidenceMap.sha
    });
    lines.push('');
  }

  const content = lines.length > 0
    ? `${lines.join('\n').replace(/\n+$/, '')}\n`
    : '-- No RLS annotations found\n';

  return {
    label: 'rls',
    files: [{ name: 'rls.sql', content }],
    evidence: toPluginEvidence(evidenceMap, {
      outDir: options.outDir,
      defaultFile: 'rls.sql'
    })
  };
}

/**
 * Emit migrations (placeholder, plan will emit phased files)
 */
export function emitMigrations(_ir) {
  return {
    label: 'migrations',
    files: [
      { name: '001_initial.sql', content: '-- Initial migration (placeholder)' }
    ]
  };
}

/**
 * Emit pgTAP tests with per-element evidence.
 * @param {object} ir - Wesley IR with structured fields and directives
 * @param {{ outDir?: string }} [options]
 */
export async function emitPgTap(ir, options = {}) {
  const schema = irToSchema(ir);
  const evidenceMap = new EvidenceMap();
  const generator = new PgTAPTestGenerator(evidenceMap, {
    enableDepthTesting: false
  });
  const content = generator.generate(schema);

  return {
    label: 'pgtap',
    files: [{ name: 'tests.sql', content }],
    evidence: toPluginEvidence(evidenceMap, {
      outDir: options.outDir,
      defaultFile: 'tests.sql'
    })
  };
}

function toPluginEvidence(evidenceMap, { outDir, defaultFile }) {
  const json = evidenceMap.toJSON();
  const evidence = {};

  for (const uid of new Set([
    ...Object.keys(json.evidence || {}),
    ...Object.keys(json.errors || {}),
    ...Object.keys(json.warnings || {})
  ])) {
    const entry = {};
    const artifacts = {};

    for (const [kind, locations] of Object.entries(json.evidence?.[uid] || {})) {
      const location = Array.isArray(locations) ? locations.at(-1) : null;
      if (!location?.file) continue;
      artifacts[kind] = {
        ...location,
        file: normalizeGeneratedFile(location.file, outDir, defaultFile)
      };
    }

    if (Object.keys(artifacts).length > 0) {
      entry.artifacts = artifacts;
    }
    if (Array.isArray(json.errors?.[uid]) && json.errors[uid].length > 0) {
      entry.errors = json.errors[uid];
    }
    if (Array.isArray(json.warnings?.[uid]) && json.warnings[uid].length > 0) {
      entry.warnings = json.warnings[uid];
    }
    if (Object.keys(entry).length > 0) {
      evidence[uid] = entry;
    }
  }

  return evidence;
}

function normalizeGeneratedFile(file, outDir, defaultFile) {
  const normalizedFile = normalizePath(file);
  if (normalizedFile === `out/${defaultFile}` || normalizedFile === defaultFile) {
    return generatedFilePath(outDir, defaultFile);
  }
  return normalizedFile;
}

function generatedFilePath(outDir, name) {
  const normalizedDir = normalizePath(outDir || DEFAULT_OUT_DIR).replace(/\/+$/, '');
  return normalizedDir.length > 0 ? `${normalizedDir}/${name}` : name;
}

function normalizePath(value) {
  return String(value || '').replaceAll('\\', '/');
}
