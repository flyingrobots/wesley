/**
 * GraphQL Adapter - THIN wrapper for graphql-js library
 * This is the ONLY place where we depend on the graphql npm package
 */

import { parse } from 'graphql';
import { GraphQLSchemaBuilder } from '@wesley/core';

export class GraphQLAdapter {
  constructor() {
    this.builder = new GraphQLSchemaBuilder();
  }
  
  /**
   * Parse GraphQL SDL and return Wesley Schema
   * This is the ONLY method that uses the graphql library
   */
  parseSDL(sdl) {
    try {
      // Use graphql-js to parse SDL to AST
      const ast = parse(sdl);
      
      // Use core logic to build Wesley schema from AST
      return this.builder.buildFromAST(ast);
    } catch (error) {
      throw new Error(`Failed to parse GraphQL schema: ${error.message}`);
    }
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