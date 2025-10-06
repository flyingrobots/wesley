/**
 * GraphQL Schema Builder - Core domain logic
 * Builds Wesley schema from parsed GraphQL AST
 * This is pure business logic - no library dependencies
 */

import { Schema, Table, Field } from './Schema.mjs';

export class GraphQLSchemaBuilder {
  constructor(evidenceMap) {
    this.evidenceMap = evidenceMap;
  }
  
  /**
   * Build Wesley schema from GraphQL AST
   * @param {Object} ast - Parsed GraphQL AST (from graphql-js or similar)
   * @returns {Schema} Wesley domain schema
   */
  buildFromAST(ast) {
    const tables = {};
    const mutations = [];
    const queries = [];
    
    // Process each definition in the AST
    for (const def of ast.definitions || []) {
      if (def.kind === 'ObjectTypeDefinition') {
        if (this.hasDirective(def, 'table')) {
          tables[def.name.value] = this.buildTable(def);
        } else if (def.name.value === 'Mutation') {
          mutations.push(...this.buildOperations(def));
        } else if (def.name.value === 'Query' && this.hasCustomQueries(def)) {
          queries.push(...this.buildOperations(def));
        }
      }
    }
    
    const schema = new Schema(tables);
    schema.mutations = mutations;
    schema.queries = queries;
    
    return schema;
  }
  
  /**
   * Build a Table from an ObjectTypeDefinition
   */
  buildTable(node) {
    const fields = {};
    const tableName = node.name.value;
    const tableDirectives = this.extractDirectives(node);
    const tableUid = tableDirectives?.['@uid'] || `table_${tableName.toLowerCase()}`;
    
    // Check for duplicate type names
    if (fields[tableName]) {
      if (this.evidenceMap) {
        this.evidenceMap.recordError(tableUid, {
          message: `Duplicate type name: ${tableName}`,
          type: 'duplicate_type',
          context: { tableName }
        });
      }
    }
    
    for (const fieldNode of node.fields || []) {
      const typeInfo = this.unwrapType(fieldNode.type);
      const fieldName = fieldNode.name.value;
      const fieldUid = `${tableUid}_${fieldName}`;
      
      // Validate directive arguments
      const directives = this.extractDirectives(fieldNode);
      this.validateDirectives(directives, fieldUid, fieldName);
      
      fields[fieldName] = new Field({
        name: fieldName,
        type: typeInfo.base,
        nonNull: typeInfo.nonNull,
        list: typeInfo.list,
        itemNonNull: typeInfo.itemNonNull,
        directives
      });
    }
    
    if (tableDirectives['@rls']) {
      tableDirectives['@rls'] = this.parseRLSConfig(tableDirectives['@rls']);
    }

    return new Table({
      name: tableName,
      directives: tableDirectives,
      fields
    });
  }
  
  /**
   * Validate directive arguments and record errors
   */
  validateDirectives(directives, uid, fieldName) {
    if (!this.evidenceMap) return;
    
    // Validate @foreignKey ref format
    if (directives['@foreignKey']) {
      const ref = directives['@foreignKey'].ref;
      if (!ref || !ref.includes('.')) {
        this.evidenceMap.recordError(uid, {
          message: `Invalid @foreignKey ref format for ${fieldName}. Expected 'Table.field'`,
          type: 'invalid_directive_arg',
          context: { directive: '@foreignKey', ref }
        });
      }
    }
    
    // Validate @index arguments
    if (directives['@index']) {
      const indexDef = directives['@index'];
      if (indexDef.where && typeof indexDef.where !== 'string') {
        this.evidenceMap.recordError(uid, {
          message: `Invalid @index where clause for ${fieldName}. Expected string`,
          type: 'invalid_directive_arg',
          context: { directive: '@index', where: indexDef.where }
        });
      }
    }
    
    // Validate @default value
    if (directives['@default']) {
      const defaultValue = directives['@default'].value;
      if (defaultValue === undefined || defaultValue === null) {
        this.evidenceMap.recordWarning(uid, {
          message: `@default directive on ${fieldName} has no value`,
          type: 'missing_directive_arg',
          context: { directive: '@default' }
        });
      }
    }
    
    // Validate @rls configuration
    if (directives['@rls']) {
      const rls = directives['@rls'];
      const validOperations = ['select', 'insert', 'update', 'delete'];
      
      for (const op of validOperations) {
        if (rls[op] && typeof rls[op] !== 'string') {
          this.evidenceMap.recordError(uid, {
            message: `Invalid @rls ${op} expression. Expected string`,
            type: 'invalid_directive_arg',
            context: { directive: '@rls', operation: op }
          });
        }
      }
    }
  }
  
  /**
   * Build operations (mutations/queries) from type definition
   */
  buildOperations(node) {
    const operations = [];
    
    for (const field of node.fields || []) {
      const returnType = this.unwrapType(field.type);
      const args = this.extractArguments(field.arguments);
      
      operations.push({
        name: field.name.value,
        args,
        returnType,
        directives: this.extractDirectives(field)
      });
    }
    
    return operations;
  }
  
  /**
   * Extract arguments from a field
   */
  extractArguments(args) {
    if (!args) return [];
    
    return args.map(arg => {
      const typeInfo = this.unwrapType(arg.type);
      return {
        name: arg.name.value,
        type: typeInfo.base,
        nonNull: typeInfo.nonNull,
        list: typeInfo.list,
        defaultValue: arg.defaultValue ? this.extractValue(arg.defaultValue) : null
      };
    });
  }
  
  /**
   * Check if a node has a specific directive
   */
  hasDirective(node, name) {
    return node.directives?.some(d => d.name.value === name) || false;
  }
  
  /**
   * Check if Query type has custom RPC queries
   */
  hasCustomQueries(node) {
    return node.fields?.some(f => this.hasDirective(f, 'rpc')) || false;
  }
  
  /**
   * Extract all directives from a node
   */
  extractDirectives(node) {
    const directives = {};
    
    for (const dir of node.directives || []) {
      const args = {};
      
      for (const arg of dir.arguments || []) {
        args[arg.name.value] = this.extractValue(arg.value);
      }
      
      // Normalize directive name with aliases
      const normalizedName = this.normalizeDirectiveName(dir.name.value);
      directives[normalizedName] = args;
    }
    
    return directives;
  }
  
  /**
   * Normalize directive names to canonical form
   * This allows using aliases like @pk for @primaryKey
   */
  normalizeDirectiveName(name) {
    const aliases = {
      // Primary key aliases
      'pk': '@primaryKey',
      'primaryKey': '@primaryKey',
      
      // Unique aliases
      'uid': '@unique',
      'unique': '@unique',
      
      // Foreign key aliases
      'fk': '@foreignKey',
      'foreignKey': '@foreignKey',
      
      // Index aliases
      'idx': '@index',
      'index': '@index',
      
      // Relation aliases
      'hasOne': '@hasOne',
      'hasMany': '@hasMany',
      'belongsTo': '@belongsTo',
      
      // RLS aliases
      'rls': '@rls',
      'rowLevelSecurity': '@rls',
      
      // Other common aliases
      'table': '@table',
      'default': '@default',
      'owner': '@owner',
      'tenant': '@tenant',
      'grant': '@grant',
      'sensitive': '@sensitive',
      'pii': '@pii',
      
      // Keep original if no alias found
      [name]: `@${name}`
    };
    
    // Remove @ if present in the input
    const cleanName = name.startsWith('@') ? name.substring(1) : name;
    return aliases[cleanName] || `@${cleanName}`;
  }
  
  /**
   * Extract value from AST value node
   */
  extractValue(valueNode) {
    switch (valueNode.kind) {
      case 'StringValue':
        return valueNode.value;
      case 'IntValue':
        return parseInt(valueNode.value, 10);
      case 'FloatValue':
        return parseFloat(valueNode.value);
      case 'BooleanValue':
        return valueNode.value;
      case 'EnumValue':
        return valueNode.value;
      case 'NullValue':
        return null;
      case 'ListValue':
        return valueNode.values.map(v => this.extractValue(v));
      case 'ObjectValue':
        const obj = {};
        for (const field of valueNode.fields) {
          obj[field.name.value] = this.extractValue(field.value);
        }
        return obj;
      default:
        // Alpha Blocker #2: Remove silent coercion in value extraction
        throw new Error(`Unknown value node kind: ${valueNode.kind}. Value node: ${JSON.stringify(valueNode)}`);
    }
  }
  
  /**
   * Unwrap GraphQL type to get base type and modifiers
   */
  unwrapType(typeNode) {
    let base = '';
    let nonNull = false;
    let list = false;
    let itemNonNull = false;
    let current = typeNode;
    
    // Unwrap outer NonNull wrapper (field nullability)
    if (current.kind === 'NonNullType') {
      nonNull = true;
      current = current.type;
    }
    
    // Check for List type
    if (current.kind === 'ListType') {
      list = true;
      current = current.type;
      
      // Check if list items are NonNull
      if (current.kind === 'NonNullType') {
        itemNonNull = true;
        current = current.type;
      }
    }
    
    // Get the base type name
    if (current.kind === 'NamedType') {
      base = current.name.value;
    } else {
      // Alpha Blocker #2: Remove silent type coercion
      throw new Error(`Unknown GraphQL type kind: ${current.kind}. Type node: ${JSON.stringify(current)}`);
    }
    
    return { base, nonNull, list, itemNonNull };
  }
  
  /**
   * Parse RLS configuration from directive arguments
   */
  parseRLSConfig(args) {
    const config = {
      enabled: args.enabled ?? args.enable ?? true,
      select: args.select || 'true',
      insert: args.insert || 'true',
      update: args.update || 'true',
      delete: args.delete || 'false',
      roles: args.roles || ['authenticated']
    };
    
    // Preserve preset configuration (string or object with name/options)
    if (args.preset !== undefined) {
      config.preset = args.preset;
    }
    
    // Parse role-specific settings if provided
    if (args.selectRoles) config.selectRoles = args.selectRoles;
    if (args.insertRoles) config.insertRoles = args.insertRoles;
    if (args.updateRoles) config.updateRoles = args.updateRoles;
    if (args.deleteRoles) config.deleteRoles = args.deleteRoles;
    
    return config;
  }
}
