// wesley-core/src/ports/writer.js
export class WriterPort {
  /**
   * Write compilation results to storage
   * @param {object} result - Compilation result
   * @returns {Promise<{files: string[]}>}
   */
  async writeBundle(result) { 
    throw new Error('WriterPort.writeBundle() must be implemented'); 
  }
}