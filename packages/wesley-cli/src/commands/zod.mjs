import { ZodGenerator } from '@wesley/generator-js';
import { FileOutputGeneratorCommand } from '../framework/FileOutputGeneratorCommand.mjs';
import { irToSchema } from '../framework/irToSchema.mjs';

export class ZodCommand extends FileOutputGeneratorCommand {
  constructor(ctx) {
    super(ctx, 'zod', 'Generate standalone Zod validation schemas from GraphQL');
  }

  async executeCore(context) {
    const { schemaContent, options } = context;

    const ir = this.ctx.parsers.graphql.parse(schemaContent);
    const schema = irToSchema(ir);

    const generator = new ZodGenerator(null);
    const zodCode = generator.generate(schema);

    const outFile = options.outFile;
    const written = await this.writeOutput({ code: zodCode, outFile, options });
    if (!options.quiet && !options.json && outFile) {
      context.logger.info(`Generated Zod schemas: ${written}`);
    }
    return { outFile: written };
  }
}

export default ZodCommand;
