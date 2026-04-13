import { GeneratorPlugin } from '@wesley/core';

export const LEGACY_SUPABASE_TRANSMUTATION = 'legacy-supabase';

export class LegacySupabaseGeneratorPlugin extends GeneratorPlugin {
  constructor({ generators, enableRls = false } = {}) {
    super();
    this._generators = generators || {};
    this._enableRls = Boolean(enableRls);
  }

  get apiVersion() {
    return '1';
  }

  get name() {
    return LEGACY_SUPABASE_TRANSMUTATION;
  }

  async plan(schema, context) {
    const ir = schema?.ir;
    if (!ir || !Array.isArray(ir.tables)) {
      throw new Error('LegacySupabaseGeneratorPlugin requires schema.ir');
    }

    const artifacts = [
      { path: 'schema.sql', reason: 'DDL emitted by the legacy supabase pipeline' }
    ];

    if (this._enableRls && typeof this._generators.sql?.emitRLS === 'function') {
      artifacts.push({ path: 'rls.sql', reason: 'RLS policies emitted by the legacy supabase pipeline' });
    }

    if (typeof this._generators.tests?.emitPgTap === 'function') {
      artifacts.push({ path: 'tests.sql', reason: 'pgTAP emitted by the legacy supabase pipeline' });
    }

    return {
      artifacts,
      metadata: {
        ir,
        enableRls: this._enableRls,
        outDir: context?.emission?.outDir || 'out'
      }
    };
  }

  async generate(plan) {
    const ir = plan?.metadata?.ir;
    if (!ir || !Array.isArray(ir.tables)) {
      throw new Error('LegacySupabaseGeneratorPlugin plan metadata is missing ir');
    }

    const files = {};
    const evidence = {};
    const emitOptions = {
      outDir: plan.metadata.outDir || 'out'
    };
    await mergeEmitted(files, evidence, this._generators.sql?.emitDDL?.(ir, emitOptions));

    if (plan.metadata.enableRls && typeof this._generators.sql?.emitRLS === 'function') {
      await mergeEmitted(files, evidence, this._generators.sql.emitRLS(ir, emitOptions));
    }

    if (typeof this._generators.tests?.emitPgTap === 'function') {
      await mergeEmitted(files, evidence, this._generators.tests.emitPgTap(ir, emitOptions));
    }

    return { files, evidence };
  }
}

async function mergeEmitted(targetFiles, targetEvidence, emittedPromise) {
  const emitted = await emittedPromise;
  for (const file of emitted?.files || []) {
    if (!file?.name) continue;
    targetFiles[file.name] = file.content ?? '';
  }

  for (const [uid, entry] of Object.entries(emitted?.evidence || {})) {
    const merged = targetEvidence[uid] || {};
    if (entry?.artifacts && typeof entry.artifacts === 'object') {
      merged.artifacts = {
        ...(merged.artifacts || {}),
        ...entry.artifacts
      };
    }
    if (Array.isArray(entry?.errors) && entry.errors.length > 0) {
      merged.errors = [...(merged.errors || []), ...entry.errors];
    }
    if (Array.isArray(entry?.warnings) && entry.warnings.length > 0) {
      merged.warnings = [...(merged.warnings || []), ...entry.warnings];
    }
    if (Object.keys(merged).length > 0) {
      targetEvidence[uid] = merged;
    }
  }
}

export function flattenTransmutationArtifacts(runResult) {
  const artifacts = [];
  for (const result of runResult?.results || []) {
    if (result.status !== 'ok' || !result.artifacts) continue;
    for (const [name, content] of Object.entries(result.artifacts)) {
      artifacts.push({ name, content });
    }
  }
  return artifacts;
}
