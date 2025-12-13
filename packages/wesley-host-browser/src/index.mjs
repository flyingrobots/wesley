/**
 * Browser host public API
 */

import { GenerationPipeline } from '@wesley/core';
import { createBrowserRuntime } from './createBrowserRuntime.mjs';
import { MemoryFileSystem } from './createBrowserRuntime.mjs'; // Import MemoryFileSystem

/**
 * @typedef {Object} BrowserCompileResult
 * @property {boolean} ok
 * @property {Array<{ file: string, body: string }>} outputFiles
 * @property {number} tables
 * @property {string[]} warnings
 * @property {{ message: string, location?: { line: number, column: number } }[]=} errors
 */

/**
 * Compiles an array of GraphQL schema files into SQL migrations and other output files
 * suitable for a browser environment.
 * @param {Array<{ file: string, body: string }>} inputFiles - GraphQL SDL files keyed by path.
 * @returns {Promise<BrowserCompileResult>}
 */
export async function compileSchemaInBrowser(inputFiles) {
  if (!Array.isArray(inputFiles)) {
    throw new TypeError('inputFiles must be an array of { file: string, body: string } objects.');
  }

  // Combine all input files into a single SDL string for initial parsing
  // In a more advanced scenario, MemoryFileSystem would handle file imports
  // For now, simple concatenation.
  const schemaSDL = inputFiles.map(f => f.body).join('\n\n');

  if (schemaSDL.length > 1_000_000) {
    throw new Error('Combined schema too large (max 1MB)');
  }

  const rt = await createBrowserRuntime();
  const fs = new MemoryFileSystem(); // Use a dedicated FS for this compilation

  // Populate the in-memory file system with input files
  for (const file of inputFiles) {
    await fs.write(file.file, file.body);
  }

  // Minimal diff engine and no-op generators to satisfy the pipeline
  // This needs to be a real diff engine for actual migrations.
  // For the demo, we'll simulate a basic diff and generation.
  const diffEngine = {
    async diff(_prev, _cur) {
      // Simulate a diff result. For an alpha, we can assume a "from scratch" diff.
      // In reality, this would involve comparing _prev and _cur schemas.
      return { steps: [] }; // Placeholder for actual diff steps
    },
    async generateMigration(_diff) {
      // Placeholder: in a real scenario, this generates SQL from diff steps
      return null;
    }
  };

  const pipeline = new GenerationPipeline({
    parser: rt.parsers.graphql,
    diffEngine,
    fileSystem: fs, // Use the in-memory FS
    logger: rt.logger
  });

  /** @type {BrowserCompileResult} */
  const result = {
    ok: false,
    outputFiles: [],
    tables: 0,
    warnings: [],
    errors: []
  };

  try {
    const bundle = await pipeline.execute(schemaSDL, { sha: 'browser-playground' });
    const tables = Array.isArray(bundle?.schema?.tables) ? bundle.schema.tables.length : 0;

    // Simulate SQL migration generation based on the combined SDL.
    // This is a placeholder and should be replaced with actual Wesley generator calls.
    const generatedSql = schemaSDL
      .replace(/type\s+(\w+)\s*{[^}]*}/g, (match, typeName) => `CREATE TABLE "${typeName}" (id UUID PRIMARY KEY);`) 
      // Basic cleanup of non-match text for the dummy output (very rough)
      .split('\n').filter(line => line.startsWith('CREATE TABLE')).join('\n');
    
    // Add a dummy SQL migration file as output
    result.outputFiles.push({ file: 'migrations.sql', body: generatedSql || '-- No migrations generated yet.' });
    result.outputFiles.push({ file: 'schema.sql', body: JSON.stringify(bundle.schema, null, 2) });


    result.ok = true;
    result.tables = tables;
    
    // Check for errors in the bundle
    if (bundle.errors && bundle.errors.length > 0) {
        result.ok = false;
        result.errors = bundle.errors.map(err => ({ message: err.message || String(err) }));
    } else if (tables === 0 && schemaSDL.includes('type ')) {
       // Fallback: if we have types but 0 tables, something might be wrong with parsing/bundle
       // console.log('DEBUG: Bundle schema:', JSON.stringify(bundle.schema, null, 2));
    }

    return result;

  } catch (err) {
    result.ok = false;
    result.errors.push({ message: err.message || String(err) });
    return result;
  }
}

// Re-export runInBrowser for any existing uses, if necessary, or remove if compileSchemaInBrowser is the sole entry.
// For now, keep it for compatibility until we confirm no other parts rely on it.
export { runInBrowser } from './index.mjs'; 
