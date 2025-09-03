import { GraphQLAdapter } from '@wesley/host-node';
import { ModelGenerator } from '@wesley/core';
import { WesleyCommand } from '../framework/WesleyCommand.mjs';

export class ModelsCommand extends WesleyCommand {
  constructor() {
    super('models', 'Generate model classes with Zod validation');
    this.requiresSchema = true;
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

