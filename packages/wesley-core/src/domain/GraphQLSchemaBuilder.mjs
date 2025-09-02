/**
 * GraphQL Schema Builder - Core domain logic
 * Builds Wesley schema from parsed GraphQL AST
 * This is pure business logic - no library dependencies
 */

import { Schema, Table, Field } from './Schema.mjs';

export class GraphQLSchemaBuilder {
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
    
    for (const fieldNode of node.fields || []) {
      const typeInfo = this.unwrapType(fieldNode.type);
      
      fields[fieldNode.name.value] = new Field({
        name: fieldNode.name.value,
        type: typeInfo.base,
        nonNull: typeInfo.nonNull,
        list: typeInfo.list,
        itemNonNull: typeInfo.itemNonNull,
        directives: this.extractDirectives(fieldNode)
      });
    }
    
    return new Table({
      name: node.name.value,
      directives: this.extractDirectives(node),
      fields
    });
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
      
      directives[`@${dir.name.value}`] = args;
    }
    
    return directives;
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
}