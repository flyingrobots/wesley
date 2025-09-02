/**
 * SQL Backend - Flip-able backend for SQL generation
 * Can use either our custom toSQL() methods or pg-parser deparse
 */

export class SQLBackend {
  constructor(strategy = 'custom') {
    this.strategy = strategy; // 'custom' or 'pg-parser'
    this.pgParserAdapter = null;
  }
  
  /**
   * Set the pg-parser adapter (injected from host-node)
   */
  setPgParserAdapter(adapter) {
    this.pgParserAdapter = adapter;
  }
  
  /**
   * Convert AST to SQL based on strategy
   */
  toSQL(ast) {
    if (this.strategy === 'pg-parser') {
      if (!this.pgParserAdapter) {
        throw new Error('pg-parser adapter not set. Inject from host-node.');
      }
      
      // Convert our AST to pg-parser format if needed
      const pgAst = this.convertToPgParserFormat(ast);
      return this.pgParserAdapter.deparse(pgAst);
    }
    
    // Default: use our custom toSQL() methods
    if (typeof ast.toSQL === 'function') {
      return ast.toSQL();
    }
    
    throw new Error(`Object does not have toSQL() method: ${ast.constructor.name}`);
  }
  
  /**
   * Convert our AST nodes to pg-parser format
   * This is a bridge between our domain AST and pg-parser's format
   */
  convertToPgParserFormat(ast) {
    // This would need implementation based on pg-parser's expected format
    // For now, we'll use our custom toSQL() methods
    // This is where we'd map our CreateTableStatement to pg-parser's format
    
    // Example structure (would need full implementation):
    if (ast.constructor.name === 'CreateTableStatement') {
      return {
        type: 'CreateStmt',
        relation: {
          relname: ast.tableName,
          schemaname: ast.schema || 'public'
        },
        tableElts: ast.columns.map(col => ({
          type: 'ColumnDef',
          colname: col.name,
          typeName: {
            names: [{ String: { str: col.type } }]
          },
          constraints: col.constraints || []
        }))
      };
    }
    
    // For other node types, fall back to custom toSQL
    return ast;
  }
  
  /**
   * Set generation strategy
   */
  setStrategy(strategy) {
    if (!['custom', 'pg-parser'].includes(strategy)) {
      throw new Error(`Invalid SQL backend strategy: ${strategy}`);
    }
    this.strategy = strategy;
    return this;
  }
  
  /**
   * Get current strategy
   */
  getStrategy() {
    return this.strategy;
  }
}

// Singleton instance for global configuration
export const sqlBackend = new SQLBackend();