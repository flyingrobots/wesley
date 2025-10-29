/**
 * Pure CLI Main Function
 * Platform-agnostic CLI logic that accepts injected adapters
 */

import { Command } from 'commander';
import { AutomaticallyRegisteredProgram, formatError, exitCodeFor } from './framework/AutomaticallyRegisteredProgram.mjs';

// Import all commands to trigger auto-registration
import './commands.mjs';

export async function main(argv, adapters) {
  const { logger, fileSystem, process } = adapters;
  
  // Store adapters globally for command access
  globalThis.__WESLEY_ADAPTERS = adapters;
  globalThis.__WESLEY_LOGGER = logger;

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
  process.on('beforeExit', () => logger?.flush?.());
  process.on('SIGINT', async () => { 
    await logger?.flush?.(); 
    process.exit(130); 
  });
  process.on('SIGTERM', async () => { 
    await logger?.flush?.(); 
    process.exit(143); 
  });

  // Parse CLI arguments
  program.parse(argv);
}