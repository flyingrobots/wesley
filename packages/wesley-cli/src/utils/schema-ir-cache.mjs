import { computeSdlHash } from '@wesley/core';

export const SCHEMA_IR_CACHE_KIND = 'wesley.schema-ir-cache.v1';
export const SCHEMA_IR_CACHE_DIR = '.wesley-cache/ir';

export async function resolveSchemaIr({
  ctx,
  schemaContent,
  schemaPath = null,
  units = null,
  logger = null
}) {
  if (!ctx?.parsers?.graphql) {
    throw new TypeError('resolveSchemaIr requires a GraphQL parser on ctx.parsers.graphql');
  }

  const cacheKey = await computeSdlHash(schemaContent);
  const composed = Array.isArray(units) && units.length > 0;
  const memoryKey = `${SCHEMA_IR_CACHE_KIND}:${composed ? 'composed' : 'raw'}:${cacheKey}`;
  const memoryCache = getMemoryCache(ctx);
  if (memoryCache.has(memoryKey)) {
    return {
      ir: memoryCache.get(memoryKey),
      cacheKey,
      cachePath: await resolveSchemaIrCachePath(ctx?.fs, cacheKey),
      cacheStatus: 'memory'
    };
  }

  const cachePath = await resolveSchemaIrCachePath(ctx?.fs, cacheKey);
  const cached = await readSchemaIrCache({
    fs: ctx?.fs,
    cachePath,
    cacheKey,
    logger
  });
  if (cached) {
    memoryCache.set(memoryKey, cached);
    return {
      ir: cached,
      cacheKey,
      cachePath,
      cacheStatus: 'disk'
    };
  }

  const ir = composed
    ? ctx.parsers.graphql.parseComposed(units)
    : ctx.parsers.graphql.parse(schemaContent, schemaPath ? { filename: schemaPath } : undefined);

  memoryCache.set(memoryKey, ir);
  await writeSchemaIrCache({
    fs: ctx?.fs,
    cachePath,
    cacheKey,
    schemaPath,
    composed,
    units,
    ir,
    logger
  });

  return {
    ir,
    cacheKey,
    cachePath,
    cacheStatus: 'fresh'
  };
}

export async function resolveSchemaIrCachePath(fs, cacheKey) {
  if (!fs || typeof fs.join !== 'function' || !isNonEmptyString(cacheKey)) {
    return null;
  }
  return fs.join(SCHEMA_IR_CACHE_DIR, `${cacheKey}.json`);
}

function getMemoryCache(ctx) {
  if (!(ctx._schemaIrCache instanceof Map)) {
    ctx._schemaIrCache = new Map();
  }
  return ctx._schemaIrCache;
}

async function readSchemaIrCache({ fs, cachePath, cacheKey, logger }) {
  if (!canUsePersistentCache(fs, cachePath)) {
    return null;
  }

  try {
    if (!(await fs.exists(cachePath))) {
      return null;
    }

    const payload = JSON.parse(await fs.read(cachePath));
    const payloadKey = payload?.cacheKey ?? payload?.sourceHash ?? null;
    if (payload?.kind !== SCHEMA_IR_CACHE_KIND || payloadKey !== cacheKey || !isIr(payload?.ir)) {
      return null;
    }

    return payload.ir;
  } catch (error) {
    logger?.debug?.(
      {
        cachePath,
        error: error?.message || String(error)
      },
      'Ignoring unreadable schema IR cache entry'
    );
    return null;
  }
}

async function writeSchemaIrCache({
  fs,
  cachePath,
  cacheKey,
  schemaPath,
  composed,
  units,
  ir,
  logger
}) {
  if (!canUsePersistentCache(fs, cachePath) || !isIr(ir)) {
    return;
  }

  try {
    const payload = {
      kind: SCHEMA_IR_CACHE_KIND,
      cacheKey,
      schemaPath: isNonEmptyString(schemaPath) ? schemaPath : null,
      composed,
      unitCount: Array.isArray(units) ? units.length : 0,
      cachedAt: new Date().toISOString(),
      ir
    };
    await fs.write(cachePath, JSON.stringify(payload, null, 2) + '\n');
  } catch (error) {
    logger?.debug?.(
      {
        cachePath,
        error: error?.message || String(error)
      },
      'Could not persist schema IR cache entry'
    );
  }
}

function canUsePersistentCache(fs, cachePath) {
  return Boolean(
    fs &&
    typeof fs.read === 'function' &&
    typeof fs.write === 'function' &&
    typeof fs.exists === 'function' &&
    isNonEmptyString(cachePath)
  );
}

function isIr(value) {
  return Boolean(value && typeof value === 'object' && Array.isArray(value.tables));
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}
