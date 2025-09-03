#!/usr/bin/env node
/**
 * Wesley CLI Executable - Node.js host entry point
 * Dependency injects Node.js adapters into the platform-agnostic CLI library
 */

import { Command } from 'commander';
import { AutomaticallyRegisteredProgram } from '@wesley/cli';

// Import all commands to trigger auto-registration
import '@wesley/cli/commands';

// Create the main CLI program
const program = new Command()
  .name('wesley')
  .description('Wesley - GraphQL → Everything\n"Make it so, schema."')
  .version('0.1.0');

// Auto-register all commands from the registry
AutomaticallyRegisteredProgram.registerAll(program);

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
