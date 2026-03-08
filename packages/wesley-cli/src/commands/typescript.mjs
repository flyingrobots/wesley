import { TypeScriptGenerator } from '@wesley/generator-js';
import { FileOutputGeneratorCommand } from '../framework/FileOutputGeneratorCommand.mjs';
import { irToSchema } from '../framework/irToSchema.mjs';

export class TypeScriptCommand extends FileOutputGeneratorCommand {
  constructor(ctx) {
    super(ctx, 'typescript', 'Generate TypeScript interfaces from GraphQL');
  }

  configureCommander(cmd) {
    return super.configureCommander(cmd).alias('ts');
  }

  async executeCore(context) {
    const { schemaContent, options } = context;

    const ir = this.ctx.parsers.graphql.parse(schemaContent);
    const schema = irToSchema(ir);

    const generator = new TypeScriptGenerator(null);
    const tsCode = generator.generate(schema);

    const outFile = options.outFile;
    const written = await this.writeOutput({ code: tsCode, outFile, options });
    if (!options.quiet && outFile) {
      console.log(`Generated TypeScript interfaces: ${written}`);
    }
    return { outFile: written };
  }
}

export default TypeScriptCommand;
