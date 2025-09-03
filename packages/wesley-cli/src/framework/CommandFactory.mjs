import { AutomaticallyRegisteredProgram } from './AutomaticallyRegisteredProgram.mjs';

export class CommandFactory {
  static create(name) {
    // Find the command by name or alias
    const program = AutomaticallyRegisteredProgram.findProgram(name);

    if (!program) {
      throw Object.assign(new Error(`Unknown command: ${name}`), { code: 'EUNKNOWNCMD' });
    }

    // Return a new instance of the same class
    return new program.constructor();
  }
}

export default CommandFactory;

