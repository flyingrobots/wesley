/**
 * High level compile service the CLI (and API) depend on.
 */
/**
 * @typedef {{ sdl: string, flags?: { supabase?: boolean, emitBundle?: boolean } }} CompileInput
 * @typedef {{ sha: string, outDir: string }} CompileContext
 * @typedef {{
 *   artifacts: {
 *     sql?: string,
 *     tests?: string,
 *     migration?: { sql: string, manifest: any },
 *     typescript?: string
 *   },
 *   evidence?: any[],
 *   scores?: { scores?: { scs:number, mri:number, tci:number }, readiness?: { verdict:string } },
 *   meta: { generatedAt: string, sha: string }
 * }} CompileResult
 * @typedef {('PIPELINE_EXEC_FAILED'|'PARSE_FAILED'|'GENERATION_FAILED'|'DIFF_FAILED')} CompilerErrorCode
 */

/**
 * Structured compiler error for consistent CLI handling.
 */
export class CompilerError extends Error {
  /**
   * @param {CompilerErrorCode} code
   * @param {string} message
   * @param {any} [cause]
   */
  constructor(code, message, cause){
    super(message);
    this.name = 'CompilerError';
    /** @type {CompilerErrorCode} */ this.code = code;
    if (cause) this.cause = cause;
  }
}
export class CompilerPort {
  /**
   * @param {CompileInput} input
   * @param {CompileContext} ctx
   * @returns {Promise<CompileResult>}
   */
  async compile(input, ctx) { 
    throw new Error('CompilerPort.compile() must be implemented'); 
  }

  /** Optional additional ops the CLI may expose */
  async validateBundle(path) { 
    throw new Error('CompilerPort.validateBundle() must be implemented'); 
  }
  
  async runTests(opts) { 
    throw new Error('CompilerPort.runTests() must be implemented'); 
  } // wire pgTAP later
}
