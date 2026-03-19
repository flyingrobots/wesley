/**
 * WesleyCommand - Hybrid Architecture
 * Combines Commander parsing with hexagonal dependency injection
 * Best of both worlds: Rich CLI features + Pure architecture
 */

import { exitCodeFor } from '@wesley/core/domain/ExitCodes';

const LOG_LEVELS = { trace: 5, debug: 10, info: 30, warn: 40, error: 50, fatal: 60, silent: 100 };

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
    if (options.quiet) {
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
    const { fs } = this.ctx;
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

    let schemaPath;
    let content;
    try {
      schemaPath = options.schema || 'schema.graphql';
      content = await fs.read(schemaPath);
    } catch (error) {
      if (error.code === 'ENOENT' || error.message?.includes('ENOENT')) {
        const err = new Error(`Schema file not found: ${schemaPath}`);
        err.code = 'ENOENT';
        throw err;
      }
      throw error;
    }

    // Detect multi-file composition directives (regex avoids matching inside strings/comments)
    const needsComposition = /(^|[^a-zA-Z0-9_])@wes_(import|package)\b/m.test(content);
    if (needsComposition) {
      const { resolve } = await import('@wesley/core/domain/SchemaResolver');
      const { resolve: pathResolve, dirname } = await import('node:path');
      const { realpathSync } = await import('node:fs');

      let realSchemaPath;
      try {
        realSchemaPath = realpathSync(schemaPath);
      } catch (err) {
        this.ctx?.logger?.debug?.({ err, schemaPath }, 'realpathSync failed, using pathResolve');
        realSchemaPath = pathResolve(schemaPath);
      }
      const rootDir = options.schemaRoot
        ? pathResolve(options.schemaRoot)
        : dirname(realSchemaPath);

      const units = await resolve(realSchemaPath, (p) => fs.read(p), rootDir, { resolvePath: pathResolve });
      const mergedSdl = units.map(u => u.sdl).join('\n\n');
      return { schemaPath, schemaContent: mergedSdl, units };
    }

    return { schemaPath, schemaContent: content };
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
    const requestedFormat = (options.logFormat || (options.json ? 'json' : 'text'))?.toLowerCase?.() || 'text';
    if (!['text', 'json'].includes(requestedFormat)) {
      const err = new Error(`Unsupported log format: ${options.logFormat}`);
      err.code = 'INVALID_LOG_FORMAT';
      throw err;
    }
    options.logFormat = requestedFormat;
    if (requestedFormat === 'json') {
      options.json = true;
      // Known DI violation tracked in BACKLOG: mutating process.env is needed
      // for compatibility with pino's log format detection during initialization.
      process.env.WESLEY_LOG_FORMAT = 'json';
    }

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

      // Handle JSON output mode
      if (options.json && result) {
        this.ctx.stdout.write(JSON.stringify({
          success: true,
          result,
          timestamp: new Date().toISOString()
        }, null, 2) + '\n');
      }

      return result;

    } catch (error) {
      // Handle errors properly
      const exitCode = this.exitCodeFor(error);

      // Best-effort SDL source annotation if evidence bundle is available
      let sdlNote = null;
      try {
        const { annotateErrorWithSDL } = await import('../utils/source-map.mjs');
        const ann = await annotateErrorWithSDL(error, { fs: this.ctx.fs });
        if (ann && ann.file && ann.lines) {
          sdlNote = `${ann.file}:${ann.lines}`;
        }
      } catch { /* empty */ }

      if (options.json) {
        const fallbackRunId = typeof options.runId === 'string' && options.runId.trim()
          ? options.runId.trim()
          : null;
        const fallbackTransmutation = typeof options.transmutation === 'string' && options.transmutation.trim()
          ? options.transmutation.trim()
          : null;
        const errorPayload = {
          success: false,
          code: error.code || 'ERROR',
          error: sdlNote ? `${error.message} (SDL: ${sdlNote})` : error.message,
          runId: error.runId || fallbackRunId,
          transmutation: error.transmutation || fallbackTransmutation,
          events: Array.isArray(error.events) ? error.events : [],
          stack: (options.debug || options.verbose) ? error.stack : undefined,
          timestamp: new Date().toISOString()
        };
        this.ctx.stderr.write(JSON.stringify(errorPayload, null, 2) + '\n');
      } else if (!options.quiet) {
        const msg = this.formatError(error, options);
        const annotated = sdlNote ? `${msg}\n   SDL: ${sdlNote}` : msg;
        this.ctx.stderr.write(annotated + '\n');

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
  async executeCore(_context) {
    throw new Error('executeCore must be implemented by subclasses');
  }

  // Error formatting
  formatError(error, options) {
    const code = error.code ? `[${error.code}] ` : '';
    const message = `❌ ${code}${error.message}`;

    if (options.debug || options.verbose) {
      return message + '\n' + error.stack;
    }
    return message;
  }

  // Exit code mapping — delegates to the core registry (single source of truth)
  exitCodeFor(error) {
    return exitCodeFor(error?.code);
  }

  // Helpful hints for common errors
  missingSchemaHint() {
    return `wesley ${this.name} --schema path/to/schema.graphql`;
  }

  emptySchemaHint() {
    return `echo "type Query { hello: String }" | wesley ${this.name} --schema -`;
  }
}
