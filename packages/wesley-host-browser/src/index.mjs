/**
 * Browser host public API
 */

import { GenerationPipeline } from '@wesley/core';
import { createBrowserRuntime } from './createBrowserRuntime.mjs';

/**
 * Minimal browser entry that runs a tiny pipeline and returns a success token.
 * @param {string} schemaSDL
 * @returns {Promise<{ ok: boolean, token: string, tables: number }>} 
 */
export async function runInBrowser(schemaSDL) {
  if (typeof schemaSDL !== 'string') {
    throw new TypeError('schemaSDL must be a string');
  }
  if (schemaSDL.length > 1_000_000) {
    throw new Error('Schema too large (max 1MB)');
  }
  const rt = await createBrowserRuntime();

  // Minimal diff engine and no-op generators to satisfy the pipeline
  const diffEngine = {
    async diff(_prev, _cur) { return { steps: [] }; },
    async generateMigration(_diff) { return null; }
  };

  const pipeline = new GenerationPipeline({
    parser: rt.parsers.graphql,
    diffEngine,
    fileSystem: undefined, // no disk access in browser
    logger: rt.logger
  });

  try {
    const bundle = await pipeline.execute(schemaSDL, { sha: 'browser-smoke' });
    const tables = Array.isArray(bundle?.schema?.tables) ? bundle.schema.tables.length : 0;
    // Use WebCrypto via runtime to prove we’re really in a browser-y environment
    const digest = await rt.crypto.sha256Hex(JSON.stringify(bundle.schema));
    const token = `BROWSER_SMOKE_OK:${tables}:${digest.slice(0, 12)}`;
    return { ok: true, token, tables };
  } catch (err) {
    return { ok: false, token: 'BROWSER_SMOKE_FAILED', tables: 0, error: String(err?.message || err) };
  }
}
