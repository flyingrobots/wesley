/**
 * Pure CLI Main Function
 * Platform-agnostic CLI logic that accepts injected adapters
 */

import { Command } from 'commander';
import { exitCodeFor } from '@wesley/core';
import { AutomaticallyRegisteredProgram } from './framework/AutomaticallyRegisteredProgram.mjs';
import { formatError } from './framework/utils.mjs';

// Import all commands to trigger auto-registration
import './commands.mjs';

function bindFunction(target, key, label) {
  const fn = target?.[key];
  if (typeof fn !== 'function') {
    throw new TypeError(`Invalid ${label}: expected function at ${key}`);
  }
  return fn.bind(target);
}

export async function main(argv, adapters) {
  const { logger, _fileSystem, process } = adapters;
  const processOn = bindFunction(process, 'on', 'process adapter');
  const processExit = bindFunction(process, 'exit', 'process adapter');
  const stderrWrite = bindFunction(process?.stderr, 'write', 'process.stderr');
  const flushLogger = typeof logger?.flush === 'function' ? logger.flush.bind(logger) : null;

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
      stderrWrite(JSON.stringify({
        success: false,
        code: 'UNHANDLED_ERROR',
        error: error.message,
        stack: options.debug || options.verbose ? error.stack : undefined,
        timestamp: new Date().toISOString()
      }, null, 2) + '\n');
    } else if (!options?.quiet) {
      stderrWrite(formatError(error, options) + '\n');
    }
  }

  processOn('unhandledRejection', (error) => {
    const options = globalThis.__WESLEY_OPTIONS;
    if (logger && options) {
      logger.error({ err: error }, 'unhandled:rejection');
      outputError(error, logger, options);
    } else {
      stderrWrite(formatError(error) + '\n');
    }
    processExit(exitCodeFor(error));
  });

  processOn('uncaughtException', (error) => {
    const options = globalThis.__WESLEY_OPTIONS;
    if (logger && options) {
      logger.error({ err: error }, 'uncaught:exception');
      outputError(error, logger, options);
    } else {
      stderrWrite(formatError(error) + '\n');
    }
    processExit(exitCodeFor(error));
  });

  // Set up flush on exit handlers
  processOn('beforeExit', () => flushLogger?.());
  processOn('SIGINT', async () => {
    await flushLogger?.();
    processExit(130);
  });
  processOn('SIGTERM', async () => {
    await flushLogger?.();
    processExit(143);
  });

  // Parse CLI arguments
  program.parse(argv);
}
