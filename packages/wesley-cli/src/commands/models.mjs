import { GeneratorCommand } from '../framework/GeneratorCommand.mjs';
import { ModelGenerator } from '@wesley/generator-js';

export class ModelsCommand extends GeneratorCommand {
  constructor(ctx) {
    super(ctx, 'models', 'Generate TypeScript/JavaScript model classes with Zod validation');
  }

  configureCommander(cmd) {
    return super.configureCommander(cmd)
      .option('--target <type>', 'Output target: "ts" or "js"', 'ts')
      .option('--out-dir <dir>', 'Output directory', 'src/models');
  }

  async executeCore(context) {
    const { schemaContent, options, logger } = context;

    const ir = this.ctx.parsers.graphql.parse(schemaContent);

    const generator = new ModelGenerator({
      target: options.target,
      outputDir: options.outDir
    });

    const result = await generator.generate(ir, { outDir: options.outDir });

    if (!options.quiet && !options.json) {
      logger.info('Generated model classes:');
      result.files.forEach((file) => logger.info(`  ${file}`));
      logger.info(`Target: ${result.target} (${result.outputDir})`);
    }
    return result;
  }
}

export default ModelsCommand;
