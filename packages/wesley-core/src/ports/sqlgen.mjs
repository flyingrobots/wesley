// wesley-core/src/ports/sqlgen.js
export class SqlGeneratorPort {
  /**
   * Generate SQL DDL from Wesley IR
   * @param {object} ir - Wesley schema IR
   * @param {object} opts - Generation options
   * @returns {Promise<{sql: string, evidence?: any[]}>}
   */
  async generate(ir, opts) { 
    throw new Error('SqlGeneratorPort.generate() must be implemented'); 
  }
}