import { GeneratorCommand } from './GeneratorCommand.mjs';

/**
 * FileOutputGeneratorCommand - Base class for generators that output to files
 *
 * Extends GeneratorCommand with --out-file option for commands that
 * generate single files such as legacy zod or typescript projections.
 */
export class FileOutputGeneratorCommand extends GeneratorCommand {
  constructor(ctx, name, description) {
    super(ctx, name, description);
  }

  configureCommander(cmd) {
    // Get generator options first
    const generatorCmd = super.configureCommander(cmd);

    // Add file output option
    return generatorCmd.option(
      '--out-file <file>',
      'Output file (prints to stdout if not specified)'
    );
  }

  async resolveOutFile({ options }) {
    return typeof options.outFile === 'string' && options.outFile.trim().length > 0
      ? options.outFile.trim()
      : null;
  }
}

export default FileOutputGeneratorCommand;
