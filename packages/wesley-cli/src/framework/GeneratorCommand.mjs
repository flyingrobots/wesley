import { WesleyCommand } from './WesleyCommand.mjs';

/**
 * GeneratorCommand - Base class for schema-based generator commands
 * 
 * Provides common options for commands that:
 * - Take a GraphQL schema as input
 * - Generate code/files as output
 * - Support common CLI flags (verbose, quiet, json, etc.)
 */
export class GeneratorCommand extends WesleyCommand {
  constructor(name, description) {
    super(name, description);
    this.requiresSchema = true;
  }

  configureCommander(cmd) {
    // Let parent configure first
    const baseCmd = super.configureCommander(cmd);
    
    // Add common generator options
    return baseCmd
      .requiredOption('--schema <path>', 'Path to GraphQL schema file (use "-" for stdin)')
      .option('-v, --verbose', 'Verbose output (level=info)')
      .option('-d, --debug', 'Debug output (level=debug)')
      .option('-q, --quiet', 'Silence logs (level=silent)')
      .option('--json', 'Emit newline-delimited JSON logs')
      .option('--log-level <level>', 'One of: error|warn|info|debug|trace')
      .option('--show-plan', 'Display execution plan before running');
  }
}

export default GeneratorCommand;