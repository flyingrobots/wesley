import {
  buildPlanFromJson,
  emitFunction,
  emitView,
  collectParams,
  quoteIdent,
  sanitizeIdentBase,
  translateOperation,
  TranslateEnv,
  sanitizeOpName as coreSanitizeOpName,
  derivePrefixedOpName,
  assertOpNameFitsLimit
} from '@wesley/core/domain/qir';
import { WesleyError, OpsError } from '@wesley/core';
import { assertValid } from '../framework/schemaValidator.mjs';

const CONCURRENCY_LIMIT = 8;
const POSTGRESQL_IDENTIFIER_LIMIT = 63;
const sanitizeOpIdentifier = coreSanitizeOpName;
const derivePrefixedIdentifier = derivePrefixedOpName;

let parseGraphQL;

export async function compileOpsIfRequested({ ctx, context }) {
  const { options, logger } = context;
  let opsDir = options.ops || null;
  let manifestPath = options.opsManifest || null;
  try {
    const fs = ctx.fs;
    if (!manifestPath && !opsDir) {
      for (const c of ['ops/ops.manifest.json', 'ops.manifest.json', 'ops-manifest.json']) {
        if (await fs.exists(c)) {
          manifestPath = c;
          break;
        }
      }
    }
    if (!opsDir && !manifestPath) {
      if (await fs.exists('ops')) opsDir = 'ops';
    }
    if (!opsDir && !manifestPath) return;

    let ir = context.ir;
    try {
      if (!ir && context.schemaContent) {
        ir = ctx.parsers.graphql.parse(context.schemaContent);
      }
    } catch (parseErr) {
      logger.warn({ error: parseErr?.message }, 'Could not parse schema for PK map; ops will use heuristic tie-breakers');
    }

    const pkMap = new Map();
    if (ir && Array.isArray(ir.tables)) {
      for (const t of ir.tables) {
        const pkField = t?.fields?.find(f => f.directives?.pk);
        if (t?.name && pkField) pkMap.set(String(t.name), String(pkField.name));
      }
    }
    const pkResolver = (plan) => {
      let r = plan?.root;
      while (r && r.kind === 'Filter') r = r.input;
      while (r && r.kind === 'Join') r = r.left;
      if (r && r.kind === 'Table' && r.alias && r.table) {
        const pk = pkMap.get(String(r.table));
        if (pk) return { kind: 'ColumnRef', table: r.alias, column: pk };
      }
      return null;
    };

    let files = [];
    if (manifestPath) {
      const manifest = JSON.parse(await fs.read(manifestPath));
      try {
        await assertValid(ctx, 'ops-manifest.schema.json', manifest, 'Ops manifest');
      } catch (e) {
        if (!(e instanceof WesleyError)) {
          const wrapped = new OpsError('OPS_MANIFEST_INVALID', e.message, { errors: e.meta?.errors ?? e.errors, file: manifestPath }, e);
          logger.error(wrapped.meta, wrapped.message);
          throw wrapped;
        }
        logger.error({ code: e.code, errors: e.meta?.errors, file: manifestPath }, e.message);
        throw e;
      }
      const repoRoot = (ctx.env || {}).WESLEY_REPO_ROOT || ctx.cwd?.() || process.cwd();
      const resolvedIncludes = await Promise.all((manifest.include || []).map(p => fs.join(repoRoot, p)));
      const resolvedExcludes = await Promise.all((manifest.exclude || []).map(p => fs.join(repoRoot, p)));
      files = await resolveManifestEntries(fs, resolvedIncludes, resolvedExcludes, logger);
      if (files.length === 0 && !manifest.allowEmpty) {
        const err = new OpsError('OPS_EMPTY_SET', 'Ops manifest produced no files and allowEmpty=false', { file: manifestPath });
        logger.error(err.meta, err.message);
        throw err;
      }
    } else {
      files = await findOpFiles(fs, opsDir, logger);
    }
    if (files.length === 0) return;

    const outDir = options.outDir || 'out';
    const targetSchema = options.opsSchema || 'wes_ops';
    const allowErrors = Boolean(options.opsAllowErrors);
    const opsTarget = String(options.opsTarget || 'postgres').toLowerCase();
    if (opsTarget !== 'postgres' && opsTarget !== 'supabase') {
      throw new OpsError('OPS_INVALID_TARGET', `Invalid --ops-target value "${options.opsTarget}"; must be "postgres" or "supabase"`);
    }

    const compiledOps = [];
    const collisions = new Map();
    const compileErrors = [];
    const skippedErrors = [];
    let fileIndex = 0;
    const workerCount = Math.min(CONCURRENCY_LIMIT, files.length);
    const workers = Array.from({ length: workerCount }, async () => {
      for (;;) {
        const idx = fileIndex++;
        if (idx >= files.length) break;
        const path = files[idx];
        try {
          const compiled = await compileOpFile(fs, path, collisions, logger, { ir, target: opsTarget });
          compiledOps.push({ order: idx, ...compiled });
        } catch (e) {
          if (e?.code === 'OPS_IDENTIFIER_TOO_LONG') {
            logger.error({ file: path, sanitized: e?.meta?.sanitized, bytes: e?.meta?.bytes }, e.message);
            throw e;
          }
          if (allowErrors) {
            skippedErrors.push({ file: path, message: e?.message || String(e), code: e?.code });
            logger.warn({ file: path, code: e?.code }, 'Skipping op due to compile error (allowed)');
          } else {
            compileErrors.push({ file: path, message: e?.message || String(e), code: e?.code });
            logger.warn({ file: path, code: e?.code }, 'Failed to compile op: ' + (e?.message || e));
          }
        }
      }
    });
    await Promise.all(workers);

    if (compileErrors.length > 0) {
      const err = new OpsError('OPS_COMPILE_FAILED', `Failed to compile ${compileErrors.length} operation(s); see log for details`, { failures: compileErrors });
      logger.error(err.meta, err.message);
      throw err;
    }
    if (skippedErrors.length > 0) {
      logger.warn({ count: skippedErrors.length, failures: skippedErrors }, 'Continuing despite compilation errors due to --ops-allow-errors');
    }

    if (compiledOps.length) {
      compiledOps.sort((a, b) => a.order - b.order);
      const orderedOps = compiledOps.map(({ order: _order, ...rest }) => rest);
      const security = String(options.opsSecurity || 'invoker').toLowerCase();
      if (security !== 'invoker' && security !== 'definer') {
        throw new OpsError('OPS_INVALID_SECURITY', `Invalid --ops-security value "${options.opsSecurity}"; must be "invoker" or "definer"`);
      }
      const setSearchPath = options.opsSearchPath
        ? String(options.opsSearchPath).split(',').map(s => s.trim()).filter(Boolean)
        : null;
      const explainMode = (options.opsExplain || '').toLowerCase();
      const outFiles = emitOpArtifacts(orderedOps, targetSchema, logger, pkResolver, {
        security,
        setSearchPath,
        allowErrors: !!options.opsAllowErrors,
        explainMode
      });
      await ctx.writer.writeFiles(outFiles, outDir);
      const opsOutputDir = await fs.join(outDir, 'ops');
      logger.info({ count: outFiles.length, dir: opsOutputDir }, 'Compiled operations (experimental)');

      try {
        const registryPath = await ctx.fs.join(opsOutputDir, 'registry.json');
        if (await ctx.fs.exists(registryPath)) {
          const reg = JSON.parse(String(await ctx.fs.read(registryPath)));
          await assertValid(ctx, 'ops-registry.schema.json', reg, 'Ops registry');
          logger.info({ file: registryPath }, 'Ops registry validated');
        }
      } catch (ve) {
        logger.warn({ error: ve?.message }, 'Ops registry validation failed');
        if (!options.opsAllowErrors) throw ve;
      }
    }
  } catch (e) {
    logger.error({ code: e?.code, error: e?.message }, 'Experimental --ops failed');
    throw e;
  }
}

async function getGraphQLParser() {
  if (!parseGraphQL) {
    const gql = await import('graphql');
    parseGraphQL = gql.parse;
  }
  return parseGraphQL;
}

async function findOpFiles(fs, opsDir, logger) {
  const exists = await fs.exists(opsDir);
  if (!exists) {
    logger.info({ opsDir }, 'Experimental --ops: directory not found; skipping');
    return [];
  }
  const acc = [];
  const walk = async (dir) => {
    const entries = await fs.readDir?.(dir);
    if (!Array.isArray(entries)) return;
    for (const e of entries) {
      if (e.isDirectory) {
        await walk(e.path);
      } else if (e.isFile && (e.name?.endsWith?.('.op.json') || e.name?.endsWith?.('.graphql'))) {
        acc.push(e.path || await fs.join(dir, e.name));
      }
    }
  };
  await walk(opsDir);
  acc.sort();
  if (acc.length === 0) {
    logger.info({ opsDir }, 'Experimental --ops: no *.op.json or *.graphql files found; skipping');
  }
  return acc;
}

async function resolveManifestEntries(fs, includes = [], excludes = [], logger) {
  const acc = new Set();
  const addDir = async (dir) => {
    const entries = await fs.readDir?.(dir);
    if (!Array.isArray(entries)) return;
    for (const e of entries) {
      if (e.isDirectory) await addDir(e.path);
      else if (e.isFile && (e.name?.endsWith?.('.op.json') || e.name?.endsWith?.('.graphql'))) acc.add(e.path);
    }
  };
  for (const entry of includes) {
    if (!entry) continue;
    const isDir = fs.readDir ? await fs.readDir(entry).then(() => true).catch(() => false) : false;
    if (isDir) await addDir(entry);
    else if (await fs.exists(entry)) acc.add(entry);
  }
  const normalize = (v) => String(v || '').replace(/\\/g, '/').replace(/\/+$/g, '');
  const excluded = (p) => {
    const np = normalize(p);
    return excludes.some((ex) => {
      const ne = normalize(ex);
      return np === ne || np.startsWith(`${ne}/`);
    });
  };
  const list = Array.from(acc).filter(p => !excluded(p)).sort();
  if (list.length === 0) logger.info({ includes, excludes }, 'ops manifest resolved no files');
  return list;
}

async function compileOpFile(fs, path, collisions, logger, { ir, target = 'postgres' } = {}) {
  const raw = await fs.read(path);
  let plan;
  let baseName;

  if (path.endsWith('.graphql')) {
    if (!ir) {
      throw new OpsError('OPS_NO_IR', 'Cannot compile .graphql ops without a parsed schema IR. Ensure --schema is provided.', { file: path });
    }
    const gql = String(raw);
    const env = new TranslateEnv(ir);
    const parseGQL = await getGraphQLParser();
    const doc = parseGQL(gql);
    const opDefs = doc.definitions.filter(d => d.kind === 'OperationDefinition');
    if (opDefs.length === 0) throw new OpsError('OPS_NO_OPERATION', 'No operation definition found in .graphql file', { file: path });
    if (opDefs.length > 1) throw new OpsError('OPS_MULTIPLE_OPERATIONS', `Expected exactly one operation definition but found ${opDefs.length}; split into separate files`, { file: path, count: opDefs.length });

    const opDef = opDefs[0];
    const opName = opDef.name?.value || 'unnamed';
    const rootFields = (opDef.selectionSet?.selections || []).filter(s => s.kind === 'Field');
    if (rootFields.length === 0) throw new OpsError('OPS_NO_ROOT_FIELD', 'No root field found in operation', { file: path });
    if (rootFields.length > 1) throw new OpsError('OPS_MULTIPLE_ROOT_FIELDS', `Expected exactly one root field but found ${rootFields.length}; split into separate operations`, { file: path, count: rootFields.length });

    const rootFieldName = rootFields[0].name.value;
    const rootType = resolveRootType(ir, rootFieldName);
    if (!rootType) {
      throw new OpsError('OPS_UNKNOWN_ROOT', `Cannot resolve root field '${rootFieldName}' to a known table type`, { file: path, field: rootFieldName });
    }

    plan = translateOperation(gql, env, { rootTypeName: rootType, target });
    baseName = sanitizeOpIdentifier(opName);
  } else {
    const op = JSON.parse(String(raw));
    plan = buildPlanFromJson(op);
    baseName = sanitizeOpIdentifier(op.name);
  }

  assertOpNameFitsLimit(baseName, POSTGRESQL_IDENTIFIER_LIMIT, path);
  const seen = collisions.get(baseName) || [];
  seen.push(path);
  collisions.set(baseName, seen);
  if (seen.length > 1) {
    const err = new OpsError('OPS_COLLISION', `Identifier collision detected: "${baseName}" used in ${seen.join(', ')}`, {
      identifier: baseName,
      paths: [...seen]
    });
    logger.error(err.meta, err.message);
    throw err;
  }

  const paramCount = (collectParams(plan)?.ordered?.length) || 0;
  return { baseName, plan, isParamless: paramCount === 0, path };
}

function emitOpArtifacts(compiledOps, targetSchema, logger, pkResolver, { security = 'invoker', setSearchPath = null, allowErrors = false, explainMode = '' } = {}) {
  const outFiles = [];
  const total = compiledOps.length;
  let ordinal = 0;
  const normalizedSchema = sanitizeIdentBase(targetSchema, 'wes_ops');
  const effectiveSearchPath = normalizeOpsSearchPath(setSearchPath, normalizedSchema);
  const deployChunks = ['BEGIN;', `CREATE SCHEMA IF NOT EXISTS ${quoteIdent(normalizedSchema)};`];
  const registry = { version: '1.0.0', schema: normalizedSchema, ops: [] };

  for (const entry of compiledOps) {
    ordinal += 1;
    const { baseName, plan, isParamless, path } = entry;
    let emitted = false;
    try {
      const fnSql = emitFunction(baseName, plan, {
        schema: targetSchema,
        identPolicy: 'strict',
        pkResolver,
        security,
        setSearchPath: effectiveSearchPath
      });
      if (isParamless) {
        const viewSql = emitView(baseName, plan, {
          schema: targetSchema,
          identPolicy: 'strict',
          pkResolver,
          setSearchPath: effectiveSearchPath
        });
        outFiles.push({ name: `ops/${baseName}.view.sql`, content: `${viewSql}\n` });
        deployChunks.push(viewSql);
      }
      outFiles.push({ name: `ops/${baseName}.fn.sql`, content: `${fnSql}\n` });
      deployChunks.push(fnSql);
      emitted = true;
    } catch (e) {
      if (!allowErrors) throw e;
      logger.warn({ op: baseName, file: path, error: e?.message }, 'Skipping op during emission due to error');
    }

    if (emitted) {
      logger.info({ ordinal, total, sanitized: baseName, file: path, schema: targetSchema, code: 'OPS_DISCOVERY' }, 'ops: compiled operation');
    }

    try {
      const params = (collectParams(plan)?.ordered || []).map(p => ({ name: String(p.name), type: p.typeHint || 'text' }));
      const projItems = Array.isArray(plan?.projection?.items)
        ? plan.projection.items.map(i => String(i?.alias || '')).filter(Boolean)
        : [];
      const opId = derivePrefixedIdentifier(baseName);
      const entryJson = {
        name: baseName,
        sql: {
          schema: normalizedSchema,
          function: opId,
          view: isParamless ? opId : null
        },
        params,
        projection: {
          star: projItems.length === 0,
          items: projItems
        },
        files: {
          function: `${baseName}.fn.sql`,
          view: isParamless ? `${baseName}.view.sql` : null
        },
        sourceFile: path
      };
      if (emitted) registry.ops.push(entryJson);
    } catch (e) {
      logger.warn({ file: path, error: e?.message }, 'Failed to record registry entry');
    }

    if (emitted && String(explainMode).toLowerCase() === 'mock') {
      const explain = {
        Plan: { 'Node Type': 'Result', Plans: [] },
        Mock: true,
        Version: 1
      };
      outFiles.push({ name: `ops/explain/${baseName}.explain.json`, content: JSON.stringify(explain, null, 2) + '\n' });
    }
  }

  deployChunks.push('COMMIT;');
  outFiles.push({ name: 'ops/ops_deploy.sql', content: deployChunks.join('\n\n') + '\n' });
  try {
    const registryStr = JSON.stringify({
      version: registry.version,
      schema: registry.schema,
      ops: registry.ops.sort((a, b) => a.name.localeCompare(b.name))
    }, null, 2) + '\n';
    outFiles.push({ name: 'ops/registry.json', content: registryStr });
  } catch (e) {
    logger.warn({ error: e?.message }, 'Failed to emit ops registry');
  }
  return outFiles;
}

function normalizeOpsSearchPath(setSearchPath, normalizedSchema) {
  if (Array.isArray(setSearchPath) && setSearchPath.length > 0) {
    return setSearchPath;
  }
  return [normalizedSchema, 'public'];
}

function resolveRootType(ir, rootFieldName) {
  if (!ir || !Array.isArray(ir.tables)) return null;
  const fieldLower = rootFieldName.toLowerCase();
  const singularCandidates = singularize(fieldLower);
  for (const table of ir.tables) {
    const tableLower = table.name.toLowerCase();
    if (tableLower === fieldLower) return table.name;
    if (singularCandidates.includes(tableLower)) return table.name;
    const tablePlurals = pluralize(tableLower);
    if (tablePlurals.includes(fieldLower)) return table.name;
  }
  return null;
}

function singularize(plural) {
  const candidates = [];
  if (plural.endsWith('ies')) candidates.push(plural.slice(0, -3) + 'y');
  else if (plural.endsWith('ses')) candidates.push(plural.slice(0, -2));
  else if (plural.endsWith('es')) candidates.push(plural.slice(0, -2));
  else if (plural.endsWith('s') && !plural.endsWith('ss')) candidates.push(plural.slice(0, -1));
  return candidates;
}

function pluralize(singular) {
  const candidates = [];
  if (singular.endsWith('y') && !/[aeiou]y$/.test(singular)) {
    candidates.push(singular.slice(0, -1) + 'ies');
  } else if (singular.endsWith('s') || singular.endsWith('x') || singular.endsWith('z') || singular.endsWith('ch') || singular.endsWith('sh')) {
    candidates.push(singular + 'es');
  } else {
    candidates.push(singular + 's');
  }
  return candidates;
}
