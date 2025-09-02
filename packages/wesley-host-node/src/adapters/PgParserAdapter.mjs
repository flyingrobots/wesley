/**
 * pg-parser Adapter - Node.js specific PostgreSQL parsing
 * This is appropriate for host-node since it wraps a Node library
 */

import { parse, deparse } from '@supabase/pg-parser';

export class PgParserAdapter {
  /**
   * Parse SQL to AST
   */
  parse(sql) {
    try {
      return parse(sql);
    } catch (error) {
      throw new Error(`Failed to parse SQL: ${error.message}`);
    }
  }
  
  /**
   * Convert AST back to SQL
   */
  deparse(ast) {
    try {
      return deparse(ast);
    } catch (error) {
      throw new Error(`Failed to deparse AST: ${error.message}`);
    }
  }
  
  /**
   * Validate SQL syntax
   */
  validate(sql) {
    try {
      parse(sql);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}