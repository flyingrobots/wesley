/**
 * Zod Schema Generator
 * Generates Zod validation schemas from Wesley schema
 */

export class ZodGenerator {
  constructor(evidenceMap) {
    this.evidenceMap = evidenceMap;
  }
  
  /**
   * Generate Zod schemas from Wesley schema
   */
  generate(schema) {
    const schemas = [];
    const imports = new Set(['z']);
    
    // Generate schema for each table
    for (const table of schema.getTables()) {
      const schemaName = `${table.name}Schema`;
      const fields = [];
      
      for (const field of table.getFields()) {
        if (field.isVirtual()) continue;
        
        const zodField = this.generateFieldSchema(field);
        fields.push(`  ${field.name}: ${zodField}`);
      }
      
      // Generate the schema
      schemas.push(`export const ${schemaName} = z.object({
${fields.join(',\n')}
});`);
      
      // Generate the TypeScript type
      schemas.push(`export type ${table.name} = z.infer<typeof ${schemaName}>;`);
      
      // Generate create/update schemas
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
      
      // Record evidence
      if (this.evidenceMap) {
        const tableUid = table.directives?.['@uid'] || `table_${table.name.toLowerCase()}`;
        this.evidenceMap.record(tableUid, 'zod', {
          file: 'generated/zod.ts',
          lines: `${schemas.length - 3}-${schemas.length}`
        });
      }
    }
    
    // Build final output
    const importStatement = `import { ${Array.from(imports).join(', ')} } from 'zod';`;
    
    return `${importStatement}

${schemas.join('\n\n')}`;
  }
  
  /**
   * Generate Zod schema for a field
   */
  generateFieldSchema(field) {
    let schema = this.getBaseZodType(field);
    
    // Handle arrays with itemNonNull
    if (field.list) {
      if (field.itemNonNull) {
        // Array with non-null items
        schema = `z.array(${schema})`;
      } else {
        // Array that can contain nulls
        schema = `z.array(${schema}.nullable())`;
      }
    }
    
    // Apply validators from directives
    schema = this.applyDirectiveValidators(schema, field);
    
    // Handle field nullability (different from array item nullability)
    if (!field.nonNull) {
      schema = `${schema}.optional()`;
    }
    
    // Add default value if specified
    if (field.directives?.['@default']) {
      const defaultValue = field.directives['@default'].value;
      if (defaultValue && !defaultValue.includes('()')) {
        // Only add static defaults, not function calls
        schema = `${schema}.default(${JSON.stringify(defaultValue)})`;
      }
    }
    
    return schema;
  }
  
  /**
   * Get base Zod type for a field
   */
  getBaseZodType(field) {
    const typeMap = {
      'ID': 'z.string().uuid()',
      'String': 'z.string()',
      'Int': 'z.number().int()',
      'Float': 'z.number()',
      'Boolean': 'z.boolean()',
      'DateTime': 'z.string().datetime()',
      'Date': 'z.string().date()',
      'Time': 'z.string().time()',
      'Decimal': 'z.number()',
      'UUID': 'z.string().uuid()',
      'JSON': 'z.record(z.any())',
      'Inet': 'z.string().ip()'
    };
    
    return typeMap[field.type] || 'z.unknown()';
  }
  
  /**
   * Apply directive-based validators
   */
  applyDirectiveValidators(schema, field) {
    const directives = field.directives || {};
    
    // Email validation
    if (directives['@email']) {
      schema = schema.replace('z.string()', 'z.string().email()');
    }
    
    // Length constraints
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
    
    // Pattern validation
    if (directives['@pattern']) {
      const pattern = directives['@pattern'].value;
      schema += `.regex(/${pattern}/)`;
    }
    
    // URL validation
    if (directives['@url']) {
      schema = schema.replace('z.string()', 'z.string().url()');
    }
    
    // Custom refinements for sensitive fields
    if (directives['@sensitive'] && field.name.toLowerCase().includes('password')) {
      // Password strength requirements
      schema += `.refine(val => val.length >= 8, { message: "Password must be at least 8 characters" })`;
      schema += `.refine(val => /[A-Z]/.test(val), { message: "Password must contain uppercase letter" })`;
      schema += `.refine(val => /[0-9]/.test(val), { message: "Password must contain number" })`;
    }
    
    return schema;
  }
  
  /**
   * Generate create schema (omits auto-generated fields)
   */
  generateCreateSchema(table) {
    const fields = [];
    
    for (const field of table.getFields()) {
      if (field.isVirtual()) continue;
      
      // Skip auto-generated fields
      if (field.isPrimaryKey() && field.directives?.['@default']) continue;
      if (field.name === 'createdAt' || field.name === 'updatedAt') continue;
      
      const zodField = this.generateFieldSchema(field);
      fields.push(`  ${field.name}: ${zodField}`);
    }
    
    if (fields.length === 0) return null;
    
    return `export const ${table.name}CreateSchema = z.object({
${fields.join(',\n')}
});`;
  }
  
  /**
   * Generate update schema (all fields optional)
   */
  generateUpdateSchema(table) {
    const fields = [];
    
    for (const field of table.getFields()) {
      if (field.isVirtual()) continue;
      
      // Skip immutable fields
      if (field.isPrimaryKey()) continue;
      if (field.name === 'createdAt') continue;
      
      let zodField = this.generateFieldSchema(field);
      // Make all fields optional for updates
      if (!zodField.includes('.optional()')) {
        zodField = `${zodField}.optional()`;
      }
      
      fields.push(`  ${field.name}: ${zodField}`);
    }
    
    if (fields.length === 0) return null;
    
    return `export const ${table.name}UpdateSchema = z.object({
${fields.join(',\n')}
});`;
  }
  
  /**
   * Generate RPC parameter validation schemas
   */
  generateRPCSchemas(operations) {
    const schemas = [];
    
    for (const op of operations || []) {
      const inputFields = [];
      
      for (const arg of op.args || []) {
        const zodType = this.getZodTypeForArg(arg);
        const field = arg.nonNull ? zodType : `${zodType}.optional()`;
        inputFields.push(`  ${arg.name}: ${field}`);
      }
      
      if (inputFields.length > 0) {
        schemas.push(`export const ${op.name}InputSchema = z.object({
${inputFields.join(',\n')}
});`);
      }
    }
    
    return schemas.join('\n\n');
  }
  
  /**
   * Get Zod type for RPC argument
   */
  getZodTypeForArg(arg) {
    const typeMap = {
      'ID': 'z.string().uuid()',
      'String': 'z.string()',
      'Int': 'z.number().int()',
      'Float': 'z.number()',
      'Boolean': 'z.boolean()',
      'JSON': 'z.record(z.any())'
    };
    
    let type = typeMap[arg.type] || 'z.unknown()';
    
    if (arg.list) {
      type = `z.array(${type})`;
    }
    
    return type;
  }
}