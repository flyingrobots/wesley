/**
 * Base Wesley Command
 * Pure - NO Node.js imports, NO generator imports
 * Everything comes through ctx dependency injection
 */

export class WesleyCommand {
  /** @param {{ logger:any, fs:any, env:any, stdin:any, parsers:any, generators:any, planner:any, runner:any, writer:any, clock:any }} ctx */
  constructor(ctx) {
    this.ctx = ctx;
    this.name = 'unknown';
  }

  // Common logger
  makeLogger(options = {}, bindings = {}) {
    const logger = this.ctx.logger;
    if (logger && logger.child) {
      return logger.child({ cmd: this.name, ...bindings });
    }
    return logger || console;
  }

  // Read schema from file or stdin if requested  
  async readSchemaFromOptions(options) {
    const { fs, stdin } = this.ctx;
    const fromStdin = options.schema === '-' || options.stdin === true;
    
    if (fromStdin) {
      return await new Promise((resolve, reject) => {
        let buf = '';
        stdin.setEncoding('utf8');
        stdin.on('data', chunk => buf += chunk);
        stdin.on('end', () => {
          if (!buf.trim()) {
            const e = new Error('Schema input from stdin is empty');
            e.code = 'EEMPTYSCHEMA';
            reject(e);
          } else {
            resolve(buf);
          }
        });
        stdin.on('error', reject);
      });
    }
    
    return await fs.read(options.schema);
  }

  // Subclasses must implement run
  async run(argv) {
    throw new Error('run must be implemented by subclasses');
  }
}

export default WesleyCommand;