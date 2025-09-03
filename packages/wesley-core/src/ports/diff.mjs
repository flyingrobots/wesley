// wesley-core/src/ports/diff.js
export class DiffEnginePort {
  /**
   * Diff schemas and generate migration
   * @param {string|null} prevSql - Previous SQL schema
   * @param {string} currentSql - Current SQL schema
   * @returns {Promise<{migrationSql: string|null, manifest: object|null}>}
   */
  async diff(prevSql, currentSql) { 
    throw new Error('DiffEnginePort.diff() must be implemented'); 
  }
}