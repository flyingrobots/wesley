// wesley-core/src/application/ArtifactWriter.mjs

import { detectConflicts } from '../ports/ArtifactWriter.mjs';

/**
 * @typedef {Object} FsDeps
 * @property {(path: string, data: string|Uint8Array) => Promise<void>} writeFile
 * @property {(path: string, options?: {recursive?: boolean}) => Promise<void>} mkdir
 * @property {(oldPath: string, newPath: string) => Promise<void>} rename
 * @property {(path: string) => Promise<{isFile(): boolean}|null>} stat
 * @property {(path: string, options?: {recursive?: boolean}) => Promise<void>} [rm]
 */

/**
 * @typedef {Object} ArtifactWriterDeps
 * @property {FsDeps} fs - Injected filesystem operations
 * @property {import('../ports/Logger.mjs').LoggerPort} [logger]
 */

/**
 * @typedef {import('../ports/ArtifactWriter.mjs').WriteOptions} WriteOptions
 * @typedef {import('../ports/ArtifactWriter.mjs').WriteResult} WriteResult
 */

const noopLogger = {
  info() {},
  warn() {},
  error() {},
  debug() {},
  child() { return noopLogger; },
  setLevel() {},
  async flush() {},
};

/**
 * ArtifactWriter - Writes plugin artifacts to disk with conflict detection
 * and atomic commit semantics.
 *
 * Writes to a temp directory first, then renames files into place.
 * If any write fails, the temp directory is cleaned up.
 *
 * Dependencies are injected (no node:fs import) to keep core dependency-free.
 */
export class ArtifactWriter {
  /**
   * @param {ArtifactWriterDeps} deps
   */
  constructor({ fs, logger }) {
    if (!fs) throw new TypeError('ArtifactWriter requires an fs dependency');
    if (typeof fs.writeFile !== 'function') throw new TypeError('fs.writeFile must be a function');
    if (typeof fs.mkdir !== 'function') throw new TypeError('fs.mkdir must be a function');
    if (typeof fs.rename !== 'function') throw new TypeError('fs.rename must be a function');
    this._fs = fs;
    this._logger = logger || noopLogger;
  }

  /**
   * Write artifacts from a RunResult to the output directory.
   *
   * Strategy:
   * 1. Detect conflicts (same path from multiple plugins)
   * 2. In dry-run mode, return the report without writing
   * 3. Write all artifacts to a temp staging directory
   * 4. Rename (move) each file from staging into the final location
   * 5. On failure, clean up the staging directory
   *
   * @param {import('../application/PluginRunner.mjs').RunResult} runResult
   * @param {string} outputDir
   * @param {WriteOptions} [options]
   * @returns {Promise<WriteResult>}
   */
  async writeArtifacts(runResult, outputDir, options = {}) {
    if (!runResult || !Array.isArray(runResult.results)) {
      throw new TypeError('writeArtifacts: runResult must have a results array');
    }
    if (typeof outputDir !== 'string' || outputDir.length === 0) {
      throw new TypeError('writeArtifacts: outputDir must be a non-empty string');
    }

    const { overwrite = true, dryRun = false } = options;

    // Step 1: Detect conflicts
    const conflicts = detectConflicts(runResult);
    const conflictPaths = conflicts.map(c => c.path);

    for (const conflict of conflicts) {
      this._logger.warn(
        { path: conflict.path, plugins: conflict.plugins },
        `Artifact path "${conflict.path}" produced by multiple plugins: ${conflict.plugins.join(', ')}`
      );
    }

    // Step 2: Collect all artifacts into a flat map (last-wins for conflicts)
    /** @type {Map<string, {data: string|Uint8Array, plugin: string}>} */
    const artifactMap = new Map();
    for (const result of runResult.results) {
      if (result.status !== 'ok' || !result.artifacts) continue;
      for (const [path, data] of Object.entries(result.artifacts)) {
        artifactMap.set(path, { data, plugin: result.name });
      }
    }

    // Step 3: Check overwrite constraints (if overwrite=false, check existing files)
    /** @type {string[]} */
    const written = [];
    /** @type {string[]} */
    const skipped = [];

    if (dryRun) {
      for (const path of artifactMap.keys()) {
        skipped.push(path);
      }
      return { written, skipped, conflicts: conflictPaths };
    }

    // Step 4: Atomic write — stage in temp dir, then rename into place
    const tmpDir = _tmpDirPath(outputDir, runResult.runId);

    try {
      await this._fs.mkdir(tmpDir, { recursive: true });

      // Write all artifacts to temp directory
      for (const [relPath, { data }] of artifactMap) {
        const tmpPath = _joinPath(tmpDir, relPath);
        const tmpParent = _parentDir(tmpPath);
        await this._fs.mkdir(tmpParent, { recursive: true });

        if (data instanceof Uint8Array) {
          await this._fs.writeFile(tmpPath, data);
        } else {
          await this._fs.writeFile(tmpPath, String(data));
        }
      }

      // Move staged files to final location
      await this._fs.mkdir(outputDir, { recursive: true });

      for (const [relPath, { data }] of artifactMap) {
        const finalPath = _joinPath(outputDir, relPath);
        const tmpPath = _joinPath(tmpDir, relPath);

        // Check overwrite constraint
        if (!overwrite) {
          const exists = await _fileExists(this._fs, finalPath);
          if (exists) {
            skipped.push(relPath);
            this._logger.warn(
              { path: relPath },
              `Skipping "${relPath}" — file exists and overwrite=false`
            );
            continue;
          }
        }

        const finalParent = _parentDir(finalPath);
        await this._fs.mkdir(finalParent, { recursive: true });
        await this._fs.rename(tmpPath, finalPath);
        written.push(relPath);
      }

      // Clean up temp dir (best-effort)
      await _rmDir(this._fs, tmpDir);

    } catch (err) {
      // Clean up temp dir on failure
      await _rmDir(this._fs, tmpDir);
      throw err;
    }

    return { written, skipped, conflicts: conflictPaths };
  }
}

/**
 * Build temp directory path for atomic writes.
 * @param {string} outputDir
 * @param {string} runId
 * @returns {string}
 */
function _tmpDirPath(outputDir, runId) {
  return _joinPath(outputDir, `.wesley-tmp-${runId}`);
}

/**
 * Simple path join — avoids importing node:path to keep core dependency-free.
 * Handles leading/trailing slashes.
 * @param {string} base
 * @param {string} rel
 * @returns {string}
 */
function _joinPath(base, rel) {
  const b = base.endsWith('/') ? base.slice(0, -1) : base;
  const r = rel.startsWith('/') ? rel.slice(1) : rel;
  return `${b}/${r}`;
}

/**
 * Extract parent directory from a path.
 * @param {string} path
 * @returns {string}
 */
function _parentDir(path) {
  const idx = path.lastIndexOf('/');
  return idx > 0 ? path.slice(0, idx) : path;
}

/**
 * Check if a file exists using stat.
 * @param {FsDeps} fs
 * @param {string} path
 * @returns {Promise<boolean>}
 */
async function _fileExists(fs, path) {
  if (typeof fs.stat !== 'function') return false;
  try {
    const s = await fs.stat(path);
    return s != null;
  } catch {
    return false;
  }
}

/**
 * Remove a directory recursively (best-effort, never throws).
 * @param {FsDeps} fs
 * @param {string} dir
 */
async function _rmDir(fs, dir) {
  if (typeof fs.rm === 'function') {
    try {
      await fs.rm(dir, { recursive: true });
    } catch {
      // best-effort cleanup
    }
  }
}
