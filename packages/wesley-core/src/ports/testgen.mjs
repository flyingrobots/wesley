// wesley-core/src/ports/testgen.js
export class TestGeneratorPort {
  /**
   * Generate tests from Wesley IR
   * @param {object} ir - Wesley schema IR
   * @param {object} opts - Generation options
   * @returns {Promise<{testsSql: string, evidence?: any[]}>}
   */
  async generate(ir, opts) { 
    throw new Error('TestGeneratorPort.generate() must be implemented'); 
  }
}