import { GeneratorPlugin } from '@wesley/core';

export const NULL_GENERATOR_TRANSMUTATION = 'null-generator';

export class NullGeneratorPlugin extends GeneratorPlugin {
  get apiVersion() {
    return '1';
  }

  get name() {
    return NULL_GENERATOR_TRANSMUTATION;
  }

  async plan(schema, context) {
    const ir = schema?.ir;
    if (!ir || !Array.isArray(ir.tables)) {
      throw new Error('NullGeneratorPlugin requires schema.ir');
    }

    return {
      artifacts: [
        { path: 'null/summary.json', reason: 'Minimal registration-only witness artifact' }
      ],
      metadata: {
        outDir: context?.emission?.outDir || 'out',
        tableCount: ir.tables.length,
        fieldCount: ir.tables.reduce(
          (total, table) => total + (Array.isArray(table?.fields) ? table.fields.length : 0),
          0
        )
      }
    };
  }

  async generate(plan, context) {
    return {
      'null/summary.json':
        JSON.stringify(
          {
            transmutation: NULL_GENERATOR_TRANSMUTATION,
            plugin: this.name,
            outputDir: context?.emission?.outDir || plan?.metadata?.outDir || 'out',
            tables: plan?.metadata?.tableCount || 0,
            fields: plan?.metadata?.fieldCount || 0
          },
          null,
          2
        ) + '\n'
    };
  }
}
