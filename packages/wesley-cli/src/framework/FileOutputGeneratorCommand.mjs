import { GeneratorCommand } from './GeneratorCommand.mjs';

/**
 * FileOutputGeneratorCommand - Base class for generators that output to files
 * 
 * Extends GeneratorCommand with --out-file option for commands that
 * generate single files (like zod, typescript) vs directories (like models)
 */
export class FileOutputGeneratorCommand extends GeneratorCommand {
  constructor(name, description) {
    super(name, description);
  }

  configureCommander(cmd) {
    // Get generator options first
    const generatorCmd = super.configureCommander(cmd);
    
    // Add file output option
    return generatorCmd
      .option('--out-file <file>', 'Output file (prints to stdout if not specified)');
  }
}

export default FileOutputGeneratorCommand;