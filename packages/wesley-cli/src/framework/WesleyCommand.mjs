import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createPinoLogger, NodeFileSystem } from '@wesley/host-node';
import { readStdinUtf8, resolveLevel, formatError, exitCodeFor } from './utils.mjs';

export class WesleyCommand {
  constructor(name, description) {
    this.name = name;
    this.description = description;
    this.requiresSchema = false;
  }

  // Optionally overridden in subclasses to add command-specific options
  configureCommander(cmd) { return cmd; }

  // Common logger
  makeLogger(options = {}, bindings = {}) {
    return createPinoLogger({
      name: 'Wesley',
      level: resolveLevel(options),
      pretty: !options.json,
      json: !!options.json,
      bindings: { cmd: this.name, ...bindings }
    });
  }

  // Read schema from file or stdin if requested
  readSchemaFromOptions(options) {
    const fromStdin = options.schema === '-' || options.stdin === true;
    const schemaPath = fromStdin ? '<stdin>' : resolve(options.schema);
    let schemaContent;
    try {
      if (fromStdin) {
        schemaContent = readStdinUtf8();
        if (!schemaContent || !schemaContent.trim()) {
          const e = new Error('Schema input from stdin is empty');
          e.code = 'EEMPTYSCHEMA';
          throw e;
        }
      } else {
        schemaContent = readFileSync(schemaPath, 'utf8');
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        const err = new Error(`Schema file not found: ${schemaPath}`);
        err.code = 'ENOENT';
        throw err;
      }
      throw error;
    }
    return { schemaPath, schemaContent };
  }

  // Write output to file or stdout
  async writeOutput({ code, outFile, options }) {
    if (outFile) {
      const outPath = resolve(outFile);
      const fs = new NodeFileSystem();
      await fs.write(outPath, code);
      if (!options.quiet) {
        // Consumer prints its own friendly line if needed
        // Intentionally minimal here for reusability.
      }
      return outPath;
    } else {
      process.stdout.write(code + (code?.endsWith('\n') ? '' : '\n'));
      return '<stdout>';
    }
  }

  // Subclasses must implement executeCore
  // eslint-disable-next-line no-unused-vars
  async executeCore(context) {
    throw new Error('executeCore must be implemented by subclasses');
  }

  async execute(options = {}) {
    try {
      const logger = this.makeLogger(options);
      const context = { options, logger };
      // expose for process-level handlers
      globalThis.__WESLEY_LOGGER = logger;
      globalThis.__WESLEY_OPTIONS = options;
      if (this.requiresSchema) {
        Object.assign(context, this.readSchemaFromOptions(options));
      }
      const result = await this.executeCore(context);
      return result;
    } catch (error) {
      const exit = exitCodeFor(error);
      if (options?.json) {
        process.stderr.write(JSON.stringify({
          success: false,
          code: error?.code || 'ERROR',
          error: error.message,
          stack: (options.debug || options.verbose) ? error.stack : undefined,
          timestamp: new Date().toISOString()
        }, null, 2) + '\n');
      } else if (!options?.quiet) {
        process.stderr.write(formatError(error, options) + '\n');
        if (error.code === 'ENOENT') {
          const hint = this._missingSchemaHint();
          if (hint) process.stderr.write(`   Try: ${hint}\n`);
        }
        if (error.code === 'EEMPTYSCHEMA') {
          const hint = this._emptySchemaHint();
          if (hint) process.stderr.write(`   Try: ${hint}\n`);
        }
      }
      process.exit(exit);
    }
  }

  _missingSchemaHint() {
    switch (this.name) {
      case 'generate': return 'wesley generate --schema path/to/schema.graphql';
      case 'models': return 'wesley models --schema path/to/schema.graphql';
      case 'zod': return 'wesley zod --schema path/to/schema.graphql';
      case 'typescript': return 'wesley typescript --schema path/to/schema.graphql';
      default: return null;
    }
  }

  _emptySchemaHint() {
    switch (this.name) {
      case 'generate': return 'echo "type Query { hello: String }" | wesley generate --schema -';
      case 'models': return 'echo "type Query { hello: String }" | wesley models --schema -';
      case 'zod': return 'echo "type Query { hello: String }" | wesley zod --schema -';
      case 'typescript': return 'echo "type Query { hello: String }" | wesley typescript --schema -';
      default: return null;
    }
  }
}

export default WesleyCommand;
