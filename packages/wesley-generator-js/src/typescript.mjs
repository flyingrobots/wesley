/**
 * TypeScript Generator
 * Generates TypeScript interfaces and types from Wesley schema
 */

export class TypeScriptGenerator {
  constructor(evidenceMap) {
    this.evidenceMap = evidenceMap;
  }
  
  /**
   * Generate TypeScript interfaces from Wesley schema
   */
  generate(schema) {
    const interfaces = [];
    const types = [];
    const enums = [];
    
    // Generate interface for each table
    for (const table of schema.getTables()) {
      const interfaceDef = this.generateInterface(table);
      interfaces.push(interfaceDef);
      
      // Generate create/update types
      const createType = this.generateCreateType(table);
      const updateType = this.generateUpdateType(table);
      
      if (createType) types.push(createType);
      if (updateType) types.push(updateType);
      
      // Record evidence
      if (this.evidenceMap) {
        const tableUid = table.directives?.['@uid'] || `tbl:${table.name}`;
        this.evidenceMap.record(tableUid, 'typescript', {
          file: 'generated/types.ts',
          lines: `${interfaces.length}-${interfaces.length}`
        });
      }
    }
    
    // Combine all generated code
    const sections = [];
    
    if (enums.length > 0) {
      sections.push('// Enums');
      sections.push(...enums);
      sections.push('');
    }
    
    if (interfaces.length > 0) {
      sections.push('// Table Interfaces');
      sections.push(...interfaces);
      sections.push('');
    }
    
    if (types.length > 0) {
      sections.push('// Create/Update Types');
      sections.push(...types);
    }
    
    return sections.join('\n');
  }
  
  /**
   * Generate TypeScript interface for a table
   */
  generateInterface(table) {
    const fields = [];
    
    for (const field of table.getFields()) {
      if (field.isVirtual()) {
        // Handle virtual relations
        const relationField = this.generateRelationField(field);
        if (relationField) fields.push(relationField);
        continue;
      }
      
      const fieldDef = this.generateField(field);
      fields.push(fieldDef);
    }
    
    const interfaceBody = fields.map(f => `  ${f}`).join('\n');
    
    return `export interface ${table.name} {
${interfaceBody}
}`;
  }
  
  /**
   * Generate TypeScript field definition
   */
  generateField(field) {
    let typeStr = this.getTypeScriptType(field);
    
    // Handle arrays
    if (field.list) {
      if (field.itemNonNull) {
        // Array with non-null items: T[]
        typeStr = `${typeStr}[]`;
      } else {
        // Array that can contain nulls: (T | null)[]
        typeStr = `(${typeStr} | null)[]`;
      }
    }
    
    // Handle field nullability
    const isOptional = !field.nonNull;
    const fieldName = isOptional ? `${field.name}?` : field.name;
    
    if (!field.nonNull && !field.list) {
      typeStr = `${typeStr} | null`;
    }
    
    return `${fieldName}: ${typeStr};`;
  }
  
  /**
   * Generate virtual relation field
   */
  generateRelationField(field) {
    const hasMany = field.directives['@hasMany'];
    const hasOne = field.directives['@hasOne'];
    
    if (hasMany) {
      const targetType = hasMany.target || field.type;
      return `${field.name}?: ${targetType}[];`;
    }
    
    if (hasOne) {
      const targetType = hasOne.target || field.type;
      const isOptional = !field.nonNull;
      const fieldName = isOptional ? `${field.name}?` : field.name;
      return `${fieldName}: ${targetType}${isOptional ? ' | null' : ''};`;
    }
    
    return null;
  }
  
  /**
   * Get TypeScript type for a GraphQL type
   */
  getTypeScriptType(field) {
    // Handle custom scalar types and enums
    if (this.isCustomType(field.type)) {
      return field.type;
    }
    
    const typeMap = {
      'ID': 'string',
      'String': 'string', 
      'Int': 'number',
      'Float': 'number',
      'Boolean': 'boolean',
      'DateTime': 'string', // ISO string representation
      'Date': 'string',
      'Time': 'string', 
      'Decimal': 'number',
      'UUID': 'string',
      'JSON': 'Record<string, any>',
      'Inet': 'string',
      'CIDR': 'string',
      'MacAddr': 'string'
    };
    
    return typeMap[field.type] || 'unknown';
  }
  
  /**
   * Check if type is a custom type (not a built-in scalar)
   */
  isCustomType(type) {
    const builtInTypes = [
      'ID', 'String', 'Int', 'Float', 'Boolean', 
      'DateTime', 'Date', 'Time', 'Decimal', 'UUID', 
      'JSON', 'Inet', 'CIDR', 'MacAddr'
    ];
    return !builtInTypes.includes(type);
  }
  
  /**
   * Generate create type (omits auto-generated fields)
   */
  generateCreateType(table) {
    const fields = [];
    
    for (const field of table.getFields()) {
      if (field.isVirtual()) continue;
      
      // Skip auto-generated fields
      if (field.isPrimaryKey() && field.directives?.['@default']) continue;
      if (field.name === 'createdAt' || field.name === 'updatedAt') continue;
      
      const fieldDef = this.generateField(field);
      fields.push(fieldDef);
    }
    
    if (fields.length === 0) return null;
    
    const interfaceBody = fields.map(f => `  ${f}`).join('\n');
    
    return `export interface ${table.name}Create {
${interfaceBody}
}`;
  }
  
  /**
   * Generate update type (all fields optional except relations)
   */
  generateUpdateType(table) {
    const fields = [];
    
    for (const field of table.getFields()) {
      if (field.isVirtual()) continue;
      
      // Skip immutable fields
      if (field.isPrimaryKey()) continue;
      if (field.name === 'createdAt') continue;
      
      // Make field optional for updates
      let typeStr = this.getTypeScriptType(field);
      
      // Handle arrays
      if (field.list) {
        if (field.itemNonNull) {
          typeStr = `${typeStr}[]`;
        } else {
          typeStr = `(${typeStr} | null)[]`;
        }
      }
      
      // All update fields are optional and nullable
      const fieldName = `${field.name}?`;
      typeStr = field.list ? `${typeStr} | null` : `${typeStr} | null`;
      
      fields.push(`${fieldName}: ${typeStr};`);
    }
    
    if (fields.length === 0) return null;
    
    const interfaceBody = fields.map(f => `  ${f}`).join('\n');
    
    return `export interface ${table.name}Update {
${interfaceBody}
}`;
  }
  
  /**
   * Generate enum types
   */
  generateEnum(name, values) {
    const enumValues = values.map(value => `  ${value} = ${JSON.stringify(value)}`).join(',\n');
    
    return `export enum ${name} {
${enumValues}
}`;
  }
  
  /**
   * Generate utility types
   */
  generateUtilityTypes() {
    return `// Utility types
export type DatabaseTable = ${this.getTableUnion()};

export type TableInsert<T extends DatabaseTable> = T extends keyof Database['public']['Tables'] 
  ? Database['public']['Tables'][T]['Insert']
  : never;

export type TableUpdate<T extends DatabaseTable> = T extends keyof Database['public']['Tables']
  ? Database['public']['Tables'][T]['Update'] 
  : never;

export type TableRow<T extends DatabaseTable> = T extends keyof Database['public']['Tables']
  ? Database['public']['Tables'][T]['Row']
  : never;`;
  }
  
  /**
   * Get union of all table names
   */
  getTableUnion() {
    // This would need access to the schema to generate the union
    return 'string'; // Placeholder
  }
}
