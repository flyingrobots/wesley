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

import { resolve } from 'node:path';
import { Command } from 'commander';
import { formatError, exitCodeFor } from './src/framework/utils.mjs';
import PlanBuilder from './src/framework/PlanBuilder.mjs';

const program = new Command();

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
// generate moved to command architecture

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

// validate-bundle to be routed via plan

// generator functions moved to command classes

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
  .option('--show-plan', 'Display execution plan before running')
  .action(async (options) => {
    // Handle --stdin flag by setting schema to '-'
    if (options.stdin && options.schema && options.schema !== '-') {
      // If both --stdin and --schema provided, prefer stdin
      options.schema = '-';
    } else if (options.stdin) {
      options.schema = '-';
    }
    const plan = new PlanBuilder('generate', options).build();
    if (!options.quiet && options.showPlan && !options.json) {
      console.log(plan.visualize());
    }
    return plan.run();
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
  .option('--show-plan', 'Display execution plan before running')
  .action(async (options) => {
    const plan = new PlanBuilder('validate-bundle', options).build();
    if (!options.quiet && options.showPlan && !options.json) {
      console.log(plan.visualize());
    }
    return plan.run();
  });

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
  .option('--show-plan', 'Display execution plan before running')
  .action(async (options) => {
    const plan = new PlanBuilder('models', options).build();
    if (!options.quiet && options.showPlan && !options.json) {
      console.log(plan.visualize());
    }
    return plan.run();
  });

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
  .option('--show-plan', 'Display execution plan before running')
  .action(async (options) => {
    const plan = new PlanBuilder('zod', options).build();
    if (!options.quiet && options.showPlan && !options.json) {
      console.log(plan.visualize());
    }
    return plan.run();
  });

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
  .option('--show-plan', 'Display execution plan before running')
  .action(async (options) => {
    const plan = new PlanBuilder('typescript', options).build();
    if (!options.quiet && options.showPlan && !options.json) {
      console.log(plan.visualize());
    }
    return plan.run();
  });

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
  const logger = globalThis.__WESLEY_LOGGER;
  const options = globalThis.__WESLEY_OPTIONS;
  if (logger && options) {
    logger.error({ err: error }, 'unhandled:rejection');
    outputError(error, logger, options);
  } else {
    process.stderr.write(formatError(error) + '\n');
  }
  process.exit(exitCodeFor(error));
});

process.on('uncaughtException', (error) => {
  const logger = globalThis.__WESLEY_LOGGER;
  const options = globalThis.__WESLEY_OPTIONS;
  if (logger && options) {
    logger.error({ err: error }, 'uncaught:exception');
    outputError(error, logger, options);
  } else {
    process.stderr.write(formatError(error) + '\n');
  }
  process.exit(exitCodeFor(error));
});

// Set up flush on exit handlers
process.on('beforeExit', () => globalThis.__WESLEY_LOGGER?.flush?.());
process.on('SIGINT', async () => { 
  await globalThis.__WESLEY_LOGGER?.flush?.(); 
  process.exit(130); 
});
process.on('SIGTERM', async () => { 
  await globalThis.__WESLEY_LOGGER?.flush?.(); 
  process.exit(143); 
});

// Parse CLI arguments
program.parse();
