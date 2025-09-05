/**
 * Wesley CLI Program
 * Uses Commander with auto-registration
 * Commands register themselves when imported
 */

import { Command } from 'commander';
import { WesleyCommand } from './framework/WesleyCommand.mjs';

// Import commands to trigger auto-registration
import { GeneratePipelineCommand } from './commands/generate.mjs';
import { TransformPipelineCommand } from './commands/transform.mjs';
import { PlanCommand } from './commands/plan.mjs';
import { RehearseCommand } from './commands/rehearse.mjs';

export async function program(argv, ctx) {
  // Create commands with context (auto-registers them)
  new GeneratePipelineCommand(ctx);
  new TransformPipelineCommand(ctx);
  new PlanCommand(ctx);
  new RehearseCommand(ctx);
  
  // TODO: Add other commands when they're updated
  // new ModelsCommand(ctx);
  // new TypeScriptCommand(ctx);
  // new ZodCommand(ctx);
  
  // Create main program
  const program = new Command()
    .name('wesley')
    .version('0.1.0')
    .description('Wesley - GraphQL → Everything\n"Make it so, schema."')
    .option('-v, --verbose', 'Verbose output')
    .option('--debug', 'Debug mode with stack traces')
    .option('-q, --quiet', 'Suppress all output')
    .option('--json', 'Output JSON');
  
  // Register all commands from the registry
  WesleyCommand.registerAll(program);
  
  // Parse and execute
  try {
    await program.parseAsync(argv, { from: 'node' });
    return 0;
  } catch (error) {
    // Allow commands to throw ExitError to control exit code
    if (error && error.name === 'ExitError') {
      return error.exitCode ?? 1;
    }
    // Commander-level errors or unexpected issues
    if (!program.opts().quiet) {
      console.error(error?.stack || error?.message || String(error));
    }
    return 1;
  }
}
