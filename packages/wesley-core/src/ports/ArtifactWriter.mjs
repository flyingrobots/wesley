// wesley-core/src/ports/ArtifactWriter.mjs

/**
 * @typedef {Object} WriteResult
 * @property {string[]} written - Paths that were written
 * @property {string[]} skipped - Paths skipped (e.g. dry-run)
 * @property {string[]} conflicts - Paths produced by multiple plugins
 */

/**
 * @typedef {Object} WriteOptions
 * @property {boolean} [overwrite=true] - Whether to overwrite existing files
 * @property {boolean} [dryRun=false] - If true, report what would be written without writing
 */

/**
 * @typedef {Object} Conflict
 * @property {string} path - The conflicting output path
 * @property {string[]} plugins - Plugin names that produced this path
 */

/**
 * ArtifactWriterPort - Abstract port for writing plugin artifacts to storage.
 *
 * Core defines the interface; host adapters provide the implementation.
 * The writer takes a RunResult from PluginRunner and persists artifacts.
 */
export class ArtifactWriterPort {
  /**
   * Write artifacts from a RunResult to the given output directory.
   * @param {import('../application/PluginRunner.mjs').RunResult} runResult
   * @param {string} outputDir
   * @param {WriteOptions} [options]
   * @returns {Promise<WriteResult>}
   */
  async writeArtifacts(runResult, outputDir, options) {
    throw new Error('ArtifactWriterPort.writeArtifacts() must be implemented');
  }
}

/**
 * Detect path conflicts across plugins in a RunResult.
 * Pure function — no I/O. Returns an array of conflicts where multiple
 * plugins produced artifacts with the same output path.
 *
 * @param {import('../application/PluginRunner.mjs').RunResult} runResult
 * @returns {Conflict[]}
 */
export function detectConflicts(runResult) {
  if (!runResult || !Array.isArray(runResult.results)) {
    return [];
  }

  /** @type {Map<string, string[]>} path → plugin names */
  const pathOwners = new Map();

  for (const result of runResult.results) {
    if (result.status !== 'ok' || !result.artifacts) continue;
    for (const path of Object.keys(result.artifacts)) {
      const owners = pathOwners.get(path);
      if (owners) {
        owners.push(result.name);
      } else {
        pathOwners.set(path, [result.name]);
      }
    }
  }

  /** @type {Conflict[]} */
  const conflicts = [];
  for (const [path, plugins] of pathOwners) {
    if (plugins.length > 1) {
      conflicts.push({ path, plugins });
    }
  }

  return conflicts;
}
