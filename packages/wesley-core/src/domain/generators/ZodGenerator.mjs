/**
 * Zod Schema Generator - Core domain implementation
 * Generates Zod validation schemas from the Wesley schema model.
 */

// Avoid Node-specific imports to keep core pure

export class ZodGenerator {
  constructor(evidenceMap) {
    this.evidenceMap = evidenceMap;
  }

  generate(schema) {
    const schemas = [];
    const imports = new Set(['z']);

    for (const table of schema.getTables()) {
      const schemaName = `${table.name}Schema`;
      const fields = [];

      for (const field of table.getFields()) {
        if (field.isVirtual()) continue;
        const zodField = this.generateFieldSchema(field);
        fields.push(`  ${field.name}: ${zodField}`);
      }

      schemas.push(`export const ${schemaName} = z.object({
${fields.join(',\n')}
});`);
      schemas.push(`export type ${table.name} = z.infer<typeof ${schemaName}>;`);

      const createSchema = this.generateCreateSchema(table);
      const updateSchema = this.generateUpdateSchema(table);

      if (createSchema) {
        schemas.push(createSchema);
        schemas.push(`export type ${table.name}Create = z.infer<typeof ${table.name}CreateSchema>;`);
      }

      if (updateSchema) {
        schemas.push(updateSchema);
        schemas.push(`export type ${table.name}Update = z.infer<typeof ${table.name}UpdateSchema>;`);
      }

      if (this.evidenceMap) {
        const tableUid = table.directives?.['@uid'] || `tbl:${table.name}`;
        this.evidenceMap.record(tableUid, 'zod', {
          file: 'generated/zod.ts',
          lines: `${schemas.length - 3}-${schemas.length}`
        });
      }
    }

    const importStatement = `import { ${Array.from(imports).join(', ')} } from 'zod';`;
    const helpers = this.generateHelpers();

    return `${importStatement}

${helpers}

${schemas.join('\n\n')}`;
  }

  generateHelpers() {
    return `// Helper functions
export const parseWithSchema = <T>(schema: z.ZodSchema<T>, data: unknown): T => {
  return schema.parse(data);
};

export const safeParseWithSchema = <T>(schema: z.ZodSchema<T>, data: unknown): z.SafeParseReturnType<unknown, T> => {
  return schema.safeParse(data);
};

export const validateCreate = <T>(schema: z.ZodSchema<T>, data: unknown): T => {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error('Validation failed: ' + result.error.message);
  }
  return result.data;
};

export const validateUpdate = <T>(schema: z.ZodSchema<T>, data: unknown): T => {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error('Validation failed: ' + result.error.message);
  }
  return result.data;
};`;
  }

  generateFieldSchema(field) {
    let schema = this.getBaseZodType(field);

    if (field.list) {
      if (field.itemNonNull) {
        schema = `z.array(${schema})`;
      } else {
        schema = `z.array(${schema}.nullable())`;
      }
    }

    schema = this.applyDirectiveValidators(schema, field);

    if (!field.nonNull) {
      schema = `${schema}.optional()`;
    }

    if (field.directives?.['@default']) {
      const defaultValue = field.directives['@default'].value;
      if (defaultValue && !defaultValue.includes('()')) {
        schema = `${schema}.default(${JSON.stringify(defaultValue)})`;
      }
    }

    return schema;
  }

  getBaseZodType(field) {
    const typeMap = {
      ID: 'z.string().uuid()',
      String: 'z.string()',
      Int: 'z.number().int()',
      Float: 'z.number()',
      Boolean: 'z.boolean()',
      DateTime: 'z.string().datetime()',
      Date: 'z.string().date()',
      Time: 'z.string().time()',
      Decimal: 'z.number()',
      UUID: 'z.string().uuid()',
      JSON: 'z.record(z.any())',
      Inet: 'z.string().ip()',
      CIDR: 'z.string()',
      MacAddr: "z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/)",
      BigInt: 'z.bigint()',
      // Use Uint8Array for isomorphic binary representation
      Bytes: 'z.instanceof(Uint8Array)'
    };

    if (this.isEnumType(field.type)) {
      return `z.enum(['${field.type}'])`;
    }

    return typeMap[field.type] || 'z.unknown()';
  }

  isEnumType(type) {
    if (!type) return false;
    const scalarTypes = new Set(['ID', 'String', 'Int', 'Float', 'Boolean', 'DateTime', 'Date', 'Time', 'Decimal', 'UUID', 'JSON', 'Inet', 'CIDR', 'MacAddr', 'BigInt', 'Bytes']);
    if (scalarTypes.has(type)) return false;
    return type[0] === type[0].toUpperCase();
  }

  applyDirectiveValidators(schema, field) {
    const directives = field.directives || {};

    if (directives['@email']) {
      schema = schema.replace('z.string()', 'z.string().email()');
    }

    if (directives['@min']) {
      const min = directives['@min'].value;
      if (field.type === 'String') {
        schema += `.min(${min})`;
      }
    }

    if (directives['@max']) {
      const max = directives['@max'].value;
      if (field.type === 'String') {
        schema += `.max(${max})`;
      }
    }

    if (directives['@regex']) {
      const pattern = directives['@regex'].pattern;
      if (pattern) {
        schema += `.regex(new RegExp(${JSON.stringify(pattern)}))`;
      }
    }

    if (directives['@critical']) {
      schema += `.brand<'critical'>()`;
    }

    return schema;
  }

  generateCreateSchema(table) {
    const fields = table.getFields().filter(f => !f.isVirtual());
    if (fields.length === 0) return null;

    const shape = fields.map(field => {
      const base = this.generateFieldSchema(field);
      const required = field.nonNull && !field.isPrimaryKey();
      return `  ${field.name}: ${required ? base : `${base}.optional()`}`;
    });

    return `export const ${table.name}CreateSchema = z.object({
${shape.join(',\n')}
});`;
  }

  generateUpdateSchema(table) {
    const fields = table.getFields().filter(f => !f.isVirtual());
    if (fields.length === 0) return null;

    const shape = fields.map(field => `  ${field.name}: ${this.generateFieldSchema(field)}.optional()`);

    return `export const ${table.name}UpdateSchema = z.object({
${shape.join(',\n')}
}).partial();`;
  }
}
