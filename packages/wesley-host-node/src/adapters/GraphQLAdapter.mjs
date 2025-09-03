/**
 * GraphQL Adapter - THIN wrapper for graphql-js library
 * This is the ONLY place where we depend on the graphql npm package
 */

import { parse, Kind, buildSchema, validate } from 'graphql';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Wesley directive validation errors
class WesleyParseError extends Error {
  constructor(message, directive = null, field = null) {
    super(message);
    this.name = 'PARSE_FAILED';
    this.directive = directive;
    this.field = field;
  }
}

/**
 * GraphQLSchemaParser - Converts GraphQL SDL with Wesley directives to Wesley IR
 */
class GraphQLSchemaParser {
  constructor() {
    // Load Wesley directive schema for validation
    this.directiveSchema = this.loadDirectiveSchema();
    
    // Canonical directive set
    this.canonicalDirectives = new Set([
      'wes_table', 'wes_pk', 'wes_fk', 'wes_unique', 
      'wes_index', 'wes_tenant', 'wes_default'
    ]);
    
    // Legacy aliases (with deprecation warnings)
    this.legacyAliases = new Map([
      // Long aliases
      ['wesley_table', 'wes_table'], ['wesley_pk', 'wes_pk'], ['wesley_fk', 'wes_fk'],
      ['wesley_unique', 'wes_unique'], ['wesley_index', 'wes_index'], 
      ['wesley_tenant', 'wes_tenant'], ['wesley_default', 'wes_default'],
      // Short aliases  
      ['table', 'wes_table'], ['pk', 'wes_pk'], ['fk', 'wes_fk'],
      ['unique', 'wes_unique'], ['index', 'wes_index'], 
      ['tenant', 'wes_tenant'], ['default', 'wes_default']
    ]);
  }
  
  /**
   * Load and parse the Wesley directive schema
   */
  loadDirectiveSchema() {
    try {
      // Find the schema file relative to this module
      // This assumes the schema is in the project root/schemas directory
      const schemaPath = join(process.cwd(), 'schemas', 'directives.graphql');
      const directiveSchemaSDL = readFileSync(schemaPath, 'utf8');
      return buildSchema(directiveSchemaSDL);
    } catch (error) {
      console.warn('Could not load Wesley directive schema for validation:', error.message);
      return null;
    }
  }
  
  /**
   * Parse GraphQL SDL to Wesley IR
   */
  parse(sdl) {
    try {
      const ast = parse(sdl);
      
      // Validate directive usage if we have the directive schema
      if (this.directiveSchema) {
        this.validateDirectiveUsage(ast);
      }
      
      return this.buildIRFromAST(ast);
    } catch (error) {
      if (error.name === 'PARSE_FAILED') {
        throw error;
      }
      throw new WesleyParseError(`GraphQL syntax error: ${error.message}`);
    }
  }
  
  /**
   * Validate directive usage against the directive schema
   */
  validateDirectiveUsage(ast) {
    try {
      // Create a temporary schema with the user's types and Wesley directives
      const userTypeDefs = ast.definitions
        .filter(def => def.kind === Kind.OBJECT_TYPE_DEFINITION)
        .map(def => `type ${def.name.value}`)
        .join('\n');
      
      const directiveSDL = readFileSync(join(process.cwd(), 'schemas', 'directives.graphql'), 'utf8');
      const fullSchemaSDL = `${directiveSDL}\n\n${userTypeDefs}`;
      
      // Parse the combined schema to validate directive usage
      const fullSchema = buildSchema(fullSchemaSDL);
      const validationErrors = validate(fullSchema, ast);
      
      if (validationErrors.length > 0) {
        const errorMessages = validationErrors.map(err => err.message).join(', ');
        throw new WesleyParseError(`Directive validation failed: ${errorMessages}`);
      }
    } catch (error) {
      // Non-fatal: directive validation is best-effort
      console.warn('Directive validation skipped:', error.message);
    }
  }
  
  /**
   * Build Wesley IR from GraphQL AST
   */
  buildIRFromAST(ast) {
    const tables = [];
    const tableNames = new Set();
    
    // First pass: collect all table types
    for (const definition of ast.definitions) {
      if (definition.kind === Kind.OBJECT_TYPE_DEFINITION) {
        const tableDirective = this.findDirective(definition.directives, 'wes_table');
        if (tableDirective) {
          const tableName = this.getDirectiveArgument(tableDirective, 'name') || definition.name.value;
          
          if (tableNames.has(tableName)) {
            throw new WesleyParseError(`Duplicate table name: ${tableName}`);
          }
          tableNames.add(tableName);
          
          const table = this.buildTable(definition, tableName);
          tables.push(table);
        }
      }
    }
    
    // Second pass: validate foreign key references
    this.validateForeignKeys(tables);
    
    return { tables };
  }
  
  /**
   * Build table from GraphQL object type definition
   */
  buildTable(typeDef, tableName) {
    if (!typeDef.fields || typeDef.fields.length === 0) {
      throw new WesleyParseError(`Table ${tableName} must have at least one field`);
    }
    
    const columns = [];
    const foreignKeys = [];
    const indexes = [];
    let primaryKey = null;
    let tenantBy = null;
    
    // Process tenant directive first
    const tenantDirective = this.findDirective(typeDef.directives, 'wes_tenant');
    if (tenantDirective) {
      tenantBy = this.getDirectiveArgument(tenantDirective, 'by');
      if (!tenantBy) {
        throw new WesleyParseError(`@wes_tenant directive requires 'by' argument`, 'wes_tenant');
      }
    }
    
    // Process fields
    for (const field of typeDef.fields) {
      const column = this.buildColumn(field, tableName);
      columns.push(column);
      
      // Check for primary key
      if (this.findDirective(field.directives, 'wes_pk')) {
        if (primaryKey) {
          throw new WesleyParseError(`Table ${tableName} can have at most one primary key`);
        }
        if (!this.isNonNullType(field.type)) {
          throw new WesleyParseError(`Primary key field ${field.name.value} must be NonNull (end with !)`, 'wes_pk', field.name.value);
        }
        primaryKey = field.name.value;
      }
      
      // Check for foreign key
      const fkDirective = this.findDirective(field.directives, 'wes_fk');
      if (fkDirective) {
        const ref = this.getDirectiveArgument(fkDirective, 'ref');
        if (!ref) {
          throw new WesleyParseError(`@wes_fk directive requires 'ref' argument`, 'wes_fk', field.name.value);
        }
        
        const [refTable, refColumn] = ref.split('.');
        if (!refTable || !refColumn) {
          throw new WesleyParseError(`Foreign key ref must be in format 'Table.column', got: ${ref}`, 'wes_fk', field.name.value);
        }
        
        foreignKeys.push({
          column: field.name.value,
          refTable,
          refColumn
        });
      }
      
      // Check for index
      const indexDirective = this.findDirective(field.directives, 'wes_index');
      if (indexDirective) {
        const indexName = this.getDirectiveArgument(indexDirective, 'name');
        const using = this.getDirectiveArgument(indexDirective, 'using');
        indexes.push({
          columns: [field.name.value],
          name: indexName,
          using
        });
      }
    }
    
    // Validate tenant field exists
    if (tenantBy) {
      const tenantField = columns.find(col => col.name === tenantBy);
      if (!tenantField) {
        throw new WesleyParseError(`@wes_tenant(by: "${tenantBy}") field must exist on table ${tableName}`, 'wes_tenant');
      }
    }
    
    return {
      name: tableName,
      columns,
      primaryKey,
      foreignKeys,
      indexes,
      tenantBy,
      directives: this.extractDirectives(typeDef.directives)
    };
  }
  
  /**
   * Build column from GraphQL field definition
   */
  buildColumn(field, tableName) {
    const name = field.name.value;
    const nullable = !this.isNonNullType(field.type);
    const type = this.mapGraphQLTypeToPostgreSQL(field.type);
    
    const column = {
      name,
      type,
      nullable,
      directives: this.extractDirectives(field.directives)
    };
    
    // Process directives
    const defaultDirective = this.findDirective(field.directives, 'wes_default');
    if (defaultDirective) {
      const value = this.getDirectiveArgument(defaultDirective, 'value');
      if (!value) {
        throw new WesleyParseError(`@wes_default directive requires 'value' argument`, 'wes_default', name);
      }
      column.default = value;
    }
    
    const uniqueDirective = this.findDirective(field.directives, 'wes_unique');
    if (uniqueDirective) {
      column.unique = true;
    }
    
    return column;
  }
  
  /**
   * Map GraphQL types to PostgreSQL types
   */
  mapGraphQLTypeToPostgreSQL(type) {
    const baseType = this.getBaseType(type);
    const isArray = this.isListType(type);
    
    let pgType;
    switch (baseType) {
      case 'ID': pgType = 'uuid'; break;
      case 'String': pgType = 'text'; break;
      case 'Int': pgType = 'integer'; break;
      case 'Float': pgType = 'double precision'; break;
      case 'Boolean': pgType = 'boolean'; break;
      case 'DateTime': pgType = 'timestamptz'; break;
      default: pgType = 'text'; // fallback
    }
    
    return isArray ? `${pgType}[]` : pgType;
  }
  
  /**
   * Validate foreign key references
   */
  validateForeignKeys(tables) {
    const tableMap = new Map(tables.map(t => [t.name, t]));
    
    for (const table of tables) {
      for (const fk of table.foreignKeys) {
        const refTable = tableMap.get(fk.refTable);
        if (!refTable) {
          throw new WesleyParseError(`Foreign key ${table.name}.${fk.column} references non-existent table: ${fk.refTable}`);
        }
        
        const refColumn = refTable.columns.find(col => col.name === fk.refColumn);
        if (!refColumn) {
          throw new WesleyParseError(`Foreign key ${table.name}.${fk.column} references non-existent column: ${fk.refTable}.${fk.refColumn}`);
        }
        
        // Type compatibility check (basic)
        const sourceColumn = table.columns.find(col => col.name === fk.column);
        if (sourceColumn && this.getBasePostgreSQLType(sourceColumn.type) !== this.getBasePostgreSQLType(refColumn.type)) {
          console.warn(`Warning: Foreign key ${table.name}.${fk.column} type '${sourceColumn.type}' may be incompatible with ${fk.refTable}.${fk.refColumn} type '${refColumn.type}'`);
        }
      }
    }
  }
  
  /**
   * Find directive by canonical name, handling aliases
   */
  findDirective(directives, canonicalName) {
    if (!directives) return null;
    
    for (const directive of directives) {
      const directiveName = directive.name.value;
      
      // Check canonical name
      if (directiveName === canonicalName) {
        return directive;
      }
      
      // Check aliases
      const canonical = this.legacyAliases.get(directiveName);
      if (canonical === canonicalName) {
        // Issue deprecation warning
        console.warn(`Deprecated directive @${directiveName} used. Use @${canonicalName} instead.`);
        return directive;
      }
    }
    
    return null;
  }
  
  /**
   * Get directive argument value
   */
  getDirectiveArgument(directive, argName) {
    if (!directive.arguments) return null;
    
    const arg = directive.arguments.find(a => a.name.value === argName);
    if (!arg) return null;
    
    if (arg.value.kind === Kind.STRING) {
      return arg.value.value;
    }
    
    return null;
  }
  
  /**
   * Extract all directive information
   */
  extractDirectives(directives) {
    if (!directives) return {};
    
    const result = {};
    for (const directive of directives) {
      const name = directive.name.value;
      const args = {};
      
      if (directive.arguments) {
        for (const arg of directive.arguments) {
          if (arg.value.kind === Kind.STRING) {
            args[arg.name.value] = arg.value.value;
          }
        }
      }
      
      result[name] = args;
    }
    
    return result;
  }
  
  /**
   * Check if GraphQL type is NonNull
   */
  isNonNullType(type) {
    return type.kind === Kind.NON_NULL_TYPE;
  }
  
  /**
   * Check if GraphQL type is List
   */
  isListType(type) {
    if (type.kind === Kind.NON_NULL_TYPE) {
      return type.type.kind === Kind.LIST_TYPE;
    }
    return type.kind === Kind.LIST_TYPE;
  }
  
  /**
   * Get base type name from GraphQL type
   */
  getBaseType(type) {
    if (type.kind === Kind.NON_NULL_TYPE) {
      return this.getBaseType(type.type);
    }
    if (type.kind === Kind.LIST_TYPE) {
      return this.getBaseType(type.type);
    }
    return type.name.value;
  }
  
  /**
   * Get base PostgreSQL type (strip array suffix)
   */
  getBasePostgreSQLType(pgType) {
    return pgType.replace('[]', '');
  }
}

export class GraphQLAdapter {
  constructor() {
    this.parser = new GraphQLSchemaParser();
  }
  
  /**
   * Parse GraphQL SDL and return Wesley IR
   */
  parseSDL(sdl) {
    return this.parser.parse(sdl);
  }
  
  /**
   * Validate GraphQL SDL syntax
   */
  validateSDL(sdl) {
    try {
      parse(sdl);
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        error: error.message,
        location: error.locations?.[0]
      };
    }
  }
}