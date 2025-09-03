#!/usr/bin/env node
/**
 * Wesley CLI - Command-line interface
 * Orchestrates core logic with platform adapters
 */

/*
 * COMPLETED ChatGPT recommendations:
 * ✅ Added --help/-h, --version/-V, --quiet/-q, --verbose/-v flags
 * ✅ Added JSON output support via --json flag  
 * ✅ Added guards for missing/partial artifacts and scores
 * ✅ Added better error handling with helpful messages
 * 
 * DEFERRED for future releases:
 * 🔄 Config file support (wesley.config.{js,ts,json}) - needs config system
 * 🔄 STDIN schema input - needs stdin detection and piping  
 * 🔄 Watch mode --watch - needs chokidar integration
 * 🔄 Atomic writes - needs file system safety layer
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Command } from 'commander';

// Helper function to read stdin synchronously
function readStdinUtf8() {
  return readFileSync(0, 'utf8'); // fd 0 = stdin, blocks until EOF
}
import { InProcessCompiler, SystemClock, ModelGenerator, ZodGenerator, TypeScriptGenerator } from '@wesley/core';
import {
  GraphQLSchemaParser,
  GraphQLAdapter,
  PostgreSQLGenerator,
  PgTAPTestGenerator,
  MigrationDiffEngine,
  NodeFileSystem,
  createPinoLogger,
  WesleyFileWriter
} from '@wesley/host-node';

const program = new Command();

function formatError(err, options = {}) {
  const code = err?.code || 'ERROR';
  const msg = err?.message || String(err);
  const showStack =
    options.debug ||
    options.verbose ||
    process.env.DEBUG === '1' ||
    process.env.WESLEY_DEBUG === '1' ||
    process.argv.includes('--debug');
  let out = `\n💥 ${code}: ${msg}`;
  if (showStack && err?.stack) out += `\n${err.stack}`;
  return out;
}

function exitCodeFor(err) {
  switch (err?.code) {
    case 'PARSE_FAILED': return 3;           // invalid SDL / directives
    case 'GENERATION_FAILED': return 4;      // codegen failures
    case 'DIFF_FAILED': return 5;            // migration diff problems
    case 'PIPELINE_EXEC_FAILED': return 6;   // generic pipeline failure
    default: return 1;                       // unknown / unexpected
  }
}

// Helper functions for logging
function resolveLevel(opts) {
  if (opts.quiet) return 'silent';
  if (opts.logLevel) return opts.logLevel;
  if (opts.verbose) return 'debug';
  return process.env.WESLEY_LOG_LEVEL || 'info';
}

function makeCompiler(options) {
  const logger = createPinoLogger({ 
    name: 'Wesley', 
    level: resolveLevel(options),
    pretty: !options.json, 
    json: !!options.json,
    bindings: { cmd: 'generate' }
  });
  
  const compiler = new InProcessCompiler({
    parser: new GraphQLSchemaParser(),
    sqlGenerator: new PostgreSQLGenerator(),
    testGenerator: new PgTAPTestGenerator(),
    diffEngine: new MigrationDiffEngine(),
    fileSystem: new NodeFileSystem(),
    logger,
    clock: new SystemClock()
  });
  
  return { logger, compiler };
}

// Configure the CLI
program
  .name('wesley')
  .description('Wesley - GraphQL → Everything\n"Make it so, schema."')
  .version('0.1.0');

/**
 * generate – main orchestration from schema input to artifacts.
 * Responsibilities: read schema, build adapters, run pipeline, write outputs, print summary.
 * 
 * DEFERRED TODOs (require additional architecture):
 *  - Support reading schema from STDIN when `--schema -` (needs stdin detection)
 *  - Allow glob/imports for modular schemas (needs schema module system)
 *  - Add `--watch` mode to re‑run on change (needs chokidar + incremental compilation)
 */
async function generate(options) {
  const rawSchemaArg = options.schema;
  const fromStdin = rawSchemaArg === '-' || options.stdin === true;
  
  let schemaPath = fromStdin ? '<stdin>' : resolve(rawSchemaArg || 'schema.graphql');
  let schemaContent;
  
  try {
    if (fromStdin) {
      schemaContent = readStdinUtf8();
      if (!schemaContent || schemaContent.trim().length === 0) {
        const error = new Error('Schema input from stdin is empty.');
        error.code = 'EEMPTYSCHEMA';
        throw error;
      }
    } else {
      schemaContent = readFileSync(schemaPath, 'utf8');
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      if (options.json) {
        console.error(JSON.stringify({
          success: false,
          code: 'ENOENT',
          error: `Schema file not found: ${schemaPath}`,
          suggestion: 'Try: wesley generate --schema path/to/schema.graphql',
          timestamp: new Date().toISOString()
        }, null, 2));
      } else if (!options.quiet) {
        console.error(`💥 Error: Schema file not found: ${schemaPath}`);
        console.error('   Try: wesley generate --schema path/to/schema.graphql');
      }
      process.exit(2);
    }
    if (error.code === 'EEMPTYSCHEMA') {
      if (options.json) {
        console.error(JSON.stringify({
          success: false,
          code: 'EEMPTYSCHEMA',
          error: 'Schema input from stdin is empty',
          suggestion: 'Try: echo "type Query { hello: String }" | wesley generate --schema -',
          timestamp: new Date().toISOString()
        }, null, 2));
      } else if (!options.quiet) {
        console.error(`💥 Error: Schema input from stdin is empty`);
        console.error('   Try: echo "type Query { hello: String }" | wesley generate --schema -');
      }
      process.exit(2);
    }
    throw error;
  }
  
  // Get SHA and setup
  const writer = new WesleyFileWriter(options);
  const sha = writer.getCurrentSHA();
  
  // Create compiler with all dependencies
  const { logger, compiler } = makeCompiler(options);
  
  // Store globally for exit handlers  
  globalLogger = logger;
  globalOptions = options;
  
  let result;
  try {
    result = await compiler.compile(
      { sdl: schemaContent, flags: { supabase: !!options.supabase, emitBundle: !!options['emit-bundle'] } },
      { sha, outDir: options.outDir || 'out' }
    );
  } catch (error) {
    const code = error?.code || 'ERROR';
    const exit = exitCodeFor(error);
    if (options.json) {
      console.error(JSON.stringify({
        success: false,
        code,
        error: error.message,
        stack: (options.debug || options.verbose) ? error.stack : undefined,
        timestamp: new Date().toISOString()
      }, null, 2));
    } else if (!options.quiet) {
      console.error(formatError(error, options));
    }
    process.exit(exit);
  }
  
  try {
    await writer.writeBundle(result);
  } catch (error) {
    console.error('💥 Error writing files:', error.message);
    process.exit(1);
  }
  
  // Output results based on format preference
  if (options.json) {
    // JSON output for programmatic consumption
    const output = {
      success: true,
      artifacts: result.artifacts || {},
      scores: result.scores || null,
      meta: result.meta || {},
      timestamp: new Date().toISOString()
    };
    console.log(JSON.stringify(output, null, 2));
  } else if (!options.quiet) {
    // Human-readable output (default)
    console.log('');
    console.log('✨ Generated:');
    if (result.artifacts && result.artifacts.sql) console.log('  ✓ PostgreSQL DDL       → out/schema.sql');
    if (result.artifacts && result.artifacts.typescript) console.log('  ✓ TypeScript Types     → out/types.ts');
    if (result.artifacts && result.artifacts.tests) console.log('  ✓ pgTAP Tests          → tests/generated.sql');
    if (result.artifacts && result.artifacts.migration) console.log('  ✓ Migration            → db/migrations/');
    console.log('');
    
    if (result.scores && result.scores.scores) {
      console.log('📊 Scores:');
      const { scs, mri, tci } = result.scores.scores;
      if (typeof scs === 'number') console.log(`  SCS: ${(scs * 100).toFixed(1)}%`);
      if (typeof mri === 'number') console.log(`  MRI: ${(mri * 100).toFixed(1)}%`);
      if (typeof tci === 'number') console.log(`  TCI: ${(tci * 100).toFixed(1)}%`);
      console.log('');
      if (result.scores.readiness && result.scores.readiness.verdict) {
        console.log(`🎯 Verdict: ${result.scores.readiness.verdict}`);
      }
    } else {
      console.log('📊 Scores: (not available)');
    }
    console.log('');
  }
}

async function test(options) {
  // DEFERRED: Test runner implementation requires:
  //  - pg_prove integration for pgTAP test execution
  //  - Database connection management (DATABASE_URL)
  //  - Test result parsing and reporting
  //  - Error handling for connection failures
  console.log('🧪 Running pgTAP tests...');
  console.log('⚠️  Test runner not yet implemented');
  console.log('    Tests are generated in: tests/generated.sql');
  console.log('    Run manually: pg_prove tests/generated.sql');
}

async function validateBundle(options) {
  // NOTE: Dynamic import keeps cold‑start lower for common commands.
  try {
    const { ValidateBundleCommand } = await import('./src/commands/validate-bundle.mjs');
    const command = new ValidateBundleCommand();
    await command.execute(options);
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.error('💥 Error: ValidateBundleCommand not implemented yet');
      console.error('    This feature is coming in a future release.');
      process.exit(1);
    }
    throw error;
  }
}

async function generateModels(options) {
  const fromStdin = options.schema === '-';
  const schemaPath = fromStdin ? '<stdin>' : resolve(options.schema);
  
  let schemaContent;
  try {
    if (fromStdin) {
      schemaContent = readStdinUtf8();
      if (!schemaContent?.trim()) {
        throw Object.assign(new Error('Schema input from stdin is empty'), { code: 'EEMPTYSCHEMA' });
      }
    } else {
      schemaContent = readFileSync(schemaPath, 'utf8');
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`💥 Error: Schema file not found: ${schemaPath}`);
      console.error('   Try: wesley models --schema path/to/schema.graphql');
      process.exit(2);
    }
    if (error.code === 'EEMPTYSCHEMA') {
      console.error('💥 Error: Schema input from stdin is empty');
      process.exit(2);
    }
    throw error;
  }

  const { logger } = makeCompiler(options);
  globalLogger = logger;
  globalOptions = options;

  try {
    // Parse GraphQL schema directly to Wesley IR
    // Use GraphQLAdapter to obtain IR with columns/types as expected by ModelGenerator
    const adapter = new GraphQLAdapter();
    const ir = adapter.parseSDL(schemaContent);
    
    // Generate models using ts-morph
    const generator = new ModelGenerator({
      target: options.target,
      outputDir: options.outDir
    });
    
    const result = await generator.generate(ir, { outDir: options.outDir });
    
    if (!options.quiet) {
      console.log('✨ Generated model classes:');
      result.files.forEach(file => {
        console.log(`  ✓ ${file}`);
      });
      console.log(`\n📁 Target: ${result.target} (${result.outputDir})`);
    }
  } catch (error) {
    console.error('💥 Error generating models:', error.message);
    if (options.debug || options.verbose) {
      console.error(error.stack);
    }
    process.exit(exitCodeFor(error));
  }
}

async function generateZod(options) {
  const fromStdin = options.schema === '-';
  const schemaPath = fromStdin ? '<stdin>' : resolve(options.schema);
  
  let schemaContent;
  try {
    if (fromStdin) {
      schemaContent = readStdinUtf8();
      if (!schemaContent?.trim()) {
        throw Object.assign(new Error('Schema input from stdin is empty'), { code: 'EEMPTYSCHEMA' });
      }
    } else {
      schemaContent = readFileSync(schemaPath, 'utf8');
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`💥 Error: Schema file not found: ${schemaPath}`);
      console.error('   Try: wesley zod --schema path/to/schema.graphql');
      process.exit(2);
    }
    if (error.code === 'EEMPTYSCHEMA') {
      console.error('💥 Error: Schema input from stdin is empty');
      process.exit(2);
    }
    throw error;
  }

  const { logger } = makeCompiler(options);
  globalLogger = logger;
  globalOptions = options;

  try {
    // Parse GraphQL schema to Wesley Schema objects
    const parser = new GraphQLSchemaParser();
    const schema = await parser.parse(schemaContent);
    
    // Generate Zod schemas
    const generator = new ZodGenerator(null);
    const zodCode = generator.generate(schema);
    
    // Write to file or stdout
    if (options.outFile) {
      const outPath = resolve(options.outFile);
      const fs = new NodeFileSystem();
      await fs.write(outPath, zodCode);
      
      if (!options.quiet) {
        console.log(`✨ Generated Zod schemas: ${outPath}`);
      }
    } else {
      console.log(zodCode);
    }
  } catch (error) {
    console.error('💥 Error generating Zod schemas:', error.message);
    if (options.debug || options.verbose) {
      console.error(error.stack);
    }
    process.exit(exitCodeFor(error));
  }
}

async function generateTypeScript(options) {
  const fromStdin = options.schema === '-';
  const schemaPath = fromStdin ? '<stdin>' : resolve(options.schema);
  
  let schemaContent;
  try {
    if (fromStdin) {
      schemaContent = readStdinUtf8();
      if (!schemaContent?.trim()) {
        throw Object.assign(new Error('Schema input from stdin is empty'), { code: 'EEMPTYSCHEMA' });
      }
    } else {
      schemaContent = readFileSync(schemaPath, 'utf8');
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`💥 Error: Schema file not found: ${schemaPath}`);
      console.error('   Try: wesley typescript --schema path/to/schema.graphql');
      process.exit(2);
    }
    if (error.code === 'EEMPTYSCHEMA') {
      console.error('💥 Error: Schema input from stdin is empty');
      process.exit(2);
    }
    throw error;
  }

  const { logger } = makeCompiler(options);
  globalLogger = logger;
  globalOptions = options;

  try {
    // Parse GraphQL schema to Wesley Schema objects  
    const parser = new GraphQLSchemaParser();
    const schema = await parser.parse(schemaContent);
    
    // Generate TypeScript interfaces
    const generator = new TypeScriptGenerator(null);
    const tsCode = generator.generate(schema);
    
    // Write to file or stdout
    if (options.outFile) {
      const outPath = resolve(options.outFile);
      const fs = new NodeFileSystem();
      await fs.write(outPath, tsCode);
      
      if (!options.quiet) {
        console.log(`✨ Generated TypeScript interfaces: ${outPath}`);
      }
    } else {
      console.log(tsCode);
    }
  } catch (error) {
    console.error('💥 Error generating TypeScript interfaces:', error.message);
    if (options.debug || options.verbose) {
      console.error(error.stack);
    }
    process.exit(exitCodeFor(error));
  }
}

// Generate command
program
  .command('generate')
  .description('Generate SQL, tests, and more from GraphQL schema')
  .option('-s, --schema <path>', 'GraphQL schema file. Use "-" for stdin', 'schema.graphql')
  .option('--stdin', 'Read schema from stdin (alias for --schema -)')
  .option('--emit-bundle', 'Emit .wesley/ evidence bundle')
  .option('--supabase', 'Enable Supabase features (RLS tests)')
  .option('-v, --verbose', 'More logs (level=debug)')
  .option('--debug', 'Debug output with stack traces')
  .option('-q, --quiet', 'Silence logs (level=silent)')
  .option('--json', 'Emit newline-delimited JSON logs')
  .option('--log-level <level>', 'One of: error|warn|info|debug|trace')
  .action((options) => {
    // Handle --stdin flag by setting schema to '-'
    if (options.stdin && options.schema && options.schema !== '-') {
      // If both --stdin and --schema provided, prefer stdin
      options.schema = '-';
    } else if (options.stdin) {
      options.schema = '-';
    }
    return generate(options);
  });

// Test command
program
  .command('test')
  .description('Run generated pgTAP tests')
  .option('--database-url <url>', 'Database connection URL (or use DATABASE_URL env)')
  .option('-v, --verbose', 'Verbose test output')
  .action(test);

// Validate bundle command
program
  .command('validate-bundle')
  .description('Validate .wesley/ bundle')
  .option('--bundle <path>', 'Bundle path', '.wesley')
  .option('--schemas <path>', 'Schemas path', './schemas')
  .action(validateBundle);

// Models command
program
  .command('models')
  .description('Generate TypeScript/JavaScript model classes with Zod validation')
  .requiredOption('--schema <path>', 'Path to GraphQL schema file (use "-" for stdin)')
  .option('--target <type>', 'Output target: "ts" or "js"', 'ts')
  .option('--out-dir <dir>', 'Output directory', 'src/models')
  .option('-v, --verbose', 'Verbose output (level=info)')
  .option('-d, --debug', 'Debug output (level=debug)')
  .option('-q, --quiet', 'Silence logs (level=silent)')
  .option('--json', 'Emit newline-delimited JSON logs')
  .option('--log-level <level>', 'One of: error|warn|info|debug|trace')
  .action(generateModels);

// Zod command
program
  .command('zod')
  .description('Generate standalone Zod validation schemas from GraphQL schema')
  .requiredOption('--schema <path>', 'Path to GraphQL schema file (use "-" for stdin)')
  .option('--out-file <file>', 'Output file (prints to stdout if not specified)')
  .option('-v, --verbose', 'Verbose output (level=info)')
  .option('-d, --debug', 'Debug output (level=debug)')
  .option('-q, --quiet', 'Silence logs (level=silent)')
  .option('--json', 'Emit newline-delimited JSON logs')
  .option('--log-level <level>', 'One of: error|warn|info|debug|trace')
  .action(generateZod);

// TypeScript command
program
  .command('typescript')
  .alias('ts')
  .description('Generate TypeScript interfaces and types from GraphQL schema')
  .requiredOption('--schema <path>', 'Path to GraphQL schema file (use "-" for stdin)')
  .option('--out-file <file>', 'Output file (prints to stdout if not specified)')
  .option('-v, --verbose', 'Verbose output (level=info)')
  .option('-d, --debug', 'Debug output (level=debug)')
  .option('-q, --quiet', 'Silence logs (level=silent)')
  .option('--json', 'Emit newline-delimited JSON logs')
  .option('--log-level <level>', 'One of: error|warn|info|debug|trace')
  .action(generateTypeScript);

// Global logger for exit handlers
let globalLogger = null;
let globalOptions = null;

function outputError(error, logger, options) {
  if (options?.json) {
    process.stderr.write(JSON.stringify({
      success: false,
      code: 'UNHANDLED_ERROR',
      error: error.message,
      stack: options.debug || options.verbose ? error.stack : undefined,
      timestamp: new Date().toISOString()
    }, null, 2) + '\n');
  } else if (!options?.quiet) {
    process.stderr.write(formatError(error, options) + '\n');
  }
}

process.on('unhandledRejection', (error) => {
  if (globalLogger && globalOptions) {
    globalLogger.error({ err: error }, 'unhandled:rejection');
    outputError(error, globalLogger, globalOptions);
  } else {
    process.stderr.write(formatError(error) + '\n');
  }
  process.exit(exitCodeFor(error));
});

process.on('uncaughtException', (error) => {
  if (globalLogger && globalOptions) {
    globalLogger.error({ err: error }, 'uncaught:exception');
    outputError(error, globalLogger, globalOptions);
  } else {
    process.stderr.write(formatError(error) + '\n');
  }
  process.exit(exitCodeFor(error));
});

// Set up flush on exit handlers
process.on('beforeExit', () => globalLogger?.flush?.());
process.on('SIGINT', async () => { 
  await globalLogger?.flush?.(); 
  process.exit(130); 
});
process.on('SIGTERM', async () => { 
  await globalLogger?.flush?.(); 
  process.exit(143); 
});

// Parse CLI arguments
program.parse();
