import { GraphQLAdapter } from '@wesley/host-node';
import { ModelGenerator } from '@wesley/core';
import { GeneratorCommand } from '../framework/GeneratorCommand.mjs';

export class ModelsCommand extends GeneratorCommand {
  constructor() {
    super('models', 'Generate model classes with Zod validation');
  }

  configureCommander(cmd) {
    return super.configureCommander(cmd)
      .option('--target <type>', 'Output target: "ts" or "js"', 'ts')
      .option('--out-dir <dir>', 'Output directory', 'src/models');
  }

  async executeCore(ctx) {
    const { schemaContent, options } = ctx;

    const adapter = new GraphQLAdapter();
    const ir = adapter.parseSDL(schemaContent);

    const generator = new ModelGenerator({
      target: options.target,
      outputDir: options.outDir
    });

    const result = await generator.generate(ir, { outDir: options.outDir });

    if (!options.quiet) {
      console.log('✨ Generated model classes:');
      result.files.forEach((file) => console.log(`  ✓ ${file}`));
      console.log(`\n📁 Target: ${result.target} (${result.outputDir})`);
    }
    return result;
  }
}

export default ModelsCommand;

// Auto-register this command by creating an instance
new ModelsCommand();
