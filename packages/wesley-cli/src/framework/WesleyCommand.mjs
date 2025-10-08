/**
 * WesleyCommand - Hybrid Architecture
 * Combines Commander parsing with hexagonal dependency injection
 * Best of both worlds: Rich CLI features + Pure architecture
 */

export class WesleyCommand {
  /** @param {{ logger:any, fs:any, env:any, stdin:any, stdout:any, stderr:any, parsers:any, generators:any, planner:any, runner:any, writer:any, clock:any }} ctx */
  constructor(ctx, name, description) {
    this.ctx = ctx;
    this.name = name;
    this.description = description;
    this.requiresSchema = false;
    
    // Auto-register on construction (if registry exists)
    if (WesleyCommand.registry) {
      WesleyCommand.registry.set(name, this);
    }
  }

  // Static registry for auto-registration
  static registry = new Map();
  
  // Register all commands with a Commander program
  static registerAll(program) {
    for (const [name, cmd] of this.registry) {
      const subcommand = program.command(name).description(cmd.description);
      cmd.configureCommander(subcommand);
      subcommand.action((options, command) => {
        // Merge global options from parent program
        const globalOpts = program.opts();
        const mergedOptions = { ...globalOpts, ...options };
        return cmd.execute(mergedOptions, command);
      });
    }
  }

  // Subclasses override to add command-specific options
  configureCommander(cmd) { 
    return cmd; 
  }

  // Create logger with proper context
  makeLogger(options = {}, bindings = {}) {
    const logger = this.ctx.logger;
    const level = this.resolveLogLevel(options);
    
    // If quiet mode, return no-op logger
    if (options.quiet || options.json) {
      return {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        fatal: () => {}
      };
    }
    
    // If logger supports child/level setting
    if (logger && logger.child) {
      return logger.child({ 
        cmd: this.name, 
        ...bindings,
        level 
      });
    }
    
    // Fallback to console with level filtering
    return {
      debug: level <= 10 ? console.log : () => {},
      info: level <= 30 ? console.log : () => {},
      warn: level <= 40 ? console.warn : () => {},
      error: level <= 50 ? console.error : () => {},
      fatal: console.error
    };
  }

  // Resolve log level from options
  resolveLogLevel(options) {
    if (options.quiet) return LOG_LEVELS.silent;
    if (options.debug || options.verbose) return LOG_LEVELS.debug;
    if (options.logLevel) {
      return LOG_LEVELS[options.logLevel] ?? LOG_LEVELS.info;
    }
    return LOG_LEVELS.info;
  }

  // Read schema from file or stdin (ASYNC - keeping the improvement)
  async readSchemaFromOptions(options) {
    const { fs, stdin } = this.ctx;
    const fromStdin = options.schema === '-' || options.stdin === true;
    
    if (fromStdin) {
      const content = await this.readFromStdin();
      if (!content || !content.trim()) {
        const e = new Error('Schema input from stdin is empty');
        e.code = 'EEMPTYSCHEMA';
        throw e;
      }
      return { schemaPath: '<stdin>', schemaContent: content };
    }
    
    try {
      const schemaPath = options.schema || 'schema.graphql';
      const content = await fs.read(schemaPath);
      return { schemaPath, schemaContent: content };
    } catch (error) {
      if (error.code === 'ENOENT' || error.message?.includes('ENOENT')) {
        const err = new Error(`Schema file not found: ${options.schema}`);
        err.code = 'ENOENT';
        throw err;
      }
      throw error;
    }
  }

  // Async stdin reading (keeping this improvement)
  async readFromStdin() {
    const { stdin } = this.ctx;
    return new Promise((resolve, reject) => {
      let buf = '';
      stdin.setEncoding('utf8');
      stdin.on('data', chunk => buf += chunk);
      stdin.on('end', () => resolve(buf));
      stdin.on('error', reject);
    });
  }

  // Write output to file or stdout
  async writeOutput({ code, outFile, options }) {
    const { fs, stdout } = this.ctx;
    
    if (outFile) {
      await fs.write(outFile, code);
      if (!options.quiet) {
        // Let command decide what to log
      }
      return outFile;
    } else {
      stdout.write(code + (code?.endsWith('\n') ? '' : '\n'));
      return '<stdout>';
    }
  }

  // Main execute flow with error handling
  async execute(options = {}, command) {
    const logger = this.makeLogger(options);
    
    try {
      const context = { 
        options, 
        logger,
        fs: this.ctx.fs,
        command 
      };
      
      // Read schema if required
      if (this.requiresSchema) {
        const schemaData = await this.readSchemaFromOptions(options);
        Object.assign(context, schemaData);
      }
      
      // Execute the command logic
      const result = await this.executeCore(context);
      // In JSON mode, subcommands are responsible for structured output.
      // We intentionally avoid duplicating output here to keep stdout machine-parseable.
      return result;
      
    } catch (error) {
      // Handle errors properly
      const exitCode = this.exitCodeFor(error);

      if (options.json) {
        this.ctx.stderr.write(JSON.stringify({
          success: false,
          code: error.code || 'ERROR',
          error: error.message,
          stack: (options.debug || options.verbose) ? error.stack : undefined,
          timestamp: new Date().toISOString()
        }, null, 2) + '\n');
      } else if (!options.quiet) {
        this.ctx.stderr.write(this.formatError(error, options) + '\n');
        
        // Add helpful hints
        if (error.code === 'ENOENT') {
          const hint = this.missingSchemaHint();
          if (hint) this.ctx.stderr.write(`   Try: ${hint}\n`);
        }
        if (error.code === 'EEMPTYSCHEMA') {
          const hint = this.emptySchemaHint();
          if (hint) this.ctx.stderr.write(`   Try: ${hint}\n`);
        }
      }
      // Defer exit to program entry via ExitError
      const { ExitError } = await import('./errors.mjs');
      throw new ExitError(exitCode, error);
    }
  }

  // Subclasses must implement
  async executeCore(context) {
    throw new Error('executeCore must be implemented by subclasses');
  }

  // Error formatting
  formatError(error, options) {
    const codeOrName = error.code || error.name;
    const code = codeOrName ? `[${codeOrName}] ` : '';
    const message = `❌ ${code}${error.message}`;
    
    if (options.debug || options.verbose) {
      return message + '\n' + error.stack;
    }
    return message;
  }

  // Exit code mapping
  exitCodeFor(error) {
    const codeMap = {
      'ENOENT': 2,
      'EEMPTYSCHEMA': 2,
      'PARSE_FAILED': 3,
      'GENERATION_FAILED': 4,
      'VALIDATION_FAILED': 5
    };
    const key = error.code || error.name;
    return codeMap[key] || 1;
  }

  // Helpful hints for common errors
  missingSchemaHint() {
    return `wesley ${this.name} --schema path/to/schema.graphql`;
  }

  emptySchemaHint() {
    return `echo "type Query { hello: String }" | wesley ${this.name} --schema -`;
  }
}

export default WesleyCommand;
const LOG_LEVELS = { trace: 5, debug: 10, info: 30, warn: 40, error: 50, fatal: 60, silent: 100 };
