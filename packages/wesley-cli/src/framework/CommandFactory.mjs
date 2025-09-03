import { ModelsCommand } from '../commands/models.mjs';
import { ZodCommand } from '../commands/zod.mjs';
import { TypeScriptCommand } from '../commands/typescript.mjs';
import { GeneratePipelineCommand } from '../commands/generate.mjs';
import ValidateBundleCommand from '../commands/validate-bundle.mjs';

export class CommandFactory {
  static create(name, options) {
    switch (name) {
      case 'models': return new ModelsCommand(options);
      case 'zod': return new ZodCommand(options);
      case 'typescript':
      case 'ts': return new TypeScriptCommand(options);
      case 'generate': return new GeneratePipelineCommand(options);
      case 'validate-bundle': return new ValidateBundleCommand(options);
      default:
        throw Object.assign(new Error(`Unknown command: ${name}`), { code: 'EUNKNOWNCMD' });
    }
  }
}

export default CommandFactory;

