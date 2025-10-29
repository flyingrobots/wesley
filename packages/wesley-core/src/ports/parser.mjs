// wesley-core/src/ports/parser.js
export class ParserPort {
  /**
   * Parse GraphQL SDL to Wesley IR
   * @param {string} sdl
   * @returns {Promise<{getTables(): Array, toJSON(): object}>}
   */
  async parse(sdl) { 
    throw new Error('ParserPort.parse() must be implemented'); 
  }
}