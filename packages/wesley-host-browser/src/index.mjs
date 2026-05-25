/**
 * Browser host public API
 */

import { createBrowserRuntime } from './createBrowserRuntime.mjs';

/**
 * @typedef {Object} BrowserCompileResult
 * @property {boolean} ok
 * @property {Array<{ file: string, body: string }>} outputFiles
 * @property {number} tables
 * @property {string[]} warnings
 * @property {{ message: string, location?: { line: number, column: number } }[]=} errors
 */

/**
 * Compiles an array of GraphQL schema files into generic schema output files
 * suitable for a browser environment.
 * @param {Array<{ file: string, body: string }>} inputFiles - GraphQL SDL files keyed by path.
 * @returns {Promise<BrowserCompileResult>}
 */
export async function compileSchemaInBrowser(inputFiles) {
  if (!Array.isArray(inputFiles)) {
    throw new TypeError('inputFiles must be an array of { file: string, body: string } objects.');
  }

  for (const file of inputFiles) {
    if (!file || typeof file.file !== 'string' || typeof file.body !== 'string') {
      throw new TypeError('inputFiles must contain { file: string, body: string } objects.');
    }
  }

  const schemaSDL = inputFiles.map((file) => file.body).join('\n\n');
  if (schemaSDL.length > 1_000_000) {
    throw new Error('Combined schema too large (max 1MB)');
  }

  const rt = await createBrowserRuntime();
  /** @type {BrowserCompileResult} */
  const result = {
    ok: false,
    outputFiles: [],
    tables: 0,
    warnings: [],
    errors: []
  };

  try {
    const sanitized = rt.validators.sanitizeGraphQL(schemaSDL);
    const ir = await rt.parsers.graphql.parse(sanitized);
    const tables = Array.isArray(ir?.tables) ? ir.tables.length : 0;

    result.outputFiles.push({ file: 'schema.json', body: JSON.stringify(ir, null, 2) });

    result.ok = true;
    result.tables = tables;

    return result;
  } catch (err) {
    result.ok = false;
    result.errors.push({ message: err.message || String(err) });
    return result;
  }
}

export async function runInBrowser(schema) {
  const result = await compileSchemaInBrowser([{ file: 'schema.graphql', body: schema }]);
  if (!result.ok) {
    return {
      ok: false,
      token: null,
      tables: 0,
      errors: result.errors
    };
  }

  const rt = await createBrowserRuntime();
  const ir = JSON.parse(result.outputFiles[0].body);
  const token = `BROWSER_SMOKE_OK:${result.tables}:${(await rt.crypto.sha256Hex(ir)).slice(0, 12)}`;
  return {
    ok: true,
    token,
    tables: result.tables
  };
}
