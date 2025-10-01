/**
 * Centralized Identifier Helper
 * Handles GraphQL → SQL name mapping with configurable strategies
 */

export class Identifier {
  constructor(strategy = 'preserve') {
    this.strategy = strategy; // 'preserve', 'snake_case', 'lower', 'upper'
  }
  
  /**
   * Table name mapping: snake_case + naive pluralization (append 's' if absent)
   */
  toTableSQLName(graphqlName) {
    const base = this.toSQL(graphqlName);
    if (base.endsWith('s')) return base;
    return `${base}s`;
  }

  /**
   * Convert GraphQL name to SQL identifier
   */
  toSQL(graphqlName) {
    switch (this.strategy) {
      case 'snake_case':
        return this.toSnakeCase(graphqlName);
      case 'lower':
        return graphqlName.toLowerCase();
      case 'upper':
        return graphqlName.toUpperCase();
      case 'preserve':
      default:
        return graphqlName;
    }
  }
  
  /**
   * Convert SQL identifier back to GraphQL name
   */
  fromSQL(sqlName) {
    switch (this.strategy) {
      case 'snake_case':
        return this.fromSnakeCase(sqlName);
      case 'lower':
        // Assuming original had PascalCase
        return this.toPascalCase(sqlName);
      case 'upper':
        return this.toPascalCase(sqlName.toLowerCase());
      case 'preserve':
      default:
        return sqlName;
    }
  }
  
  /**
   * Quote identifier for SQL if needed
   */
  quote(identifier) {
    // PostgreSQL requires quotes for mixed case or reserved words
    const needsQuoting = 
      identifier !== identifier.toLowerCase() ||
      this.isReservedWord(identifier) ||
      /[^a-z0-9_]/.test(identifier);
    
    return needsQuoting ? `"${identifier}"` : identifier;
  }
  
  /**
   * Convert to snake_case
   */
  toSnakeCase(str) {
    return str
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');
  }
  
  /**
   * Convert from snake_case to PascalCase
   */
  fromSnakeCase(str) {
    return str
      .split('_')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }
  
  /**
   * Convert to PascalCase
   */
  toPascalCase(str) {
    return str
      .replace(/(?:^|_)([a-z])/g, (_, char) => char.toUpperCase());
  }
  
  /**
   * Check if word is PostgreSQL reserved
   */
  isReservedWord(word) {
    const reserved = [
      'user', 'order', 'group', 'table', 'column', 'select',
      'insert', 'update', 'delete', 'where', 'from', 'join',
      'limit', 'offset', 'union', 'all', 'distinct', 'having',
      'between', 'like', 'in', 'exists', 'case', 'when', 'then',
      'else', 'end', 'and', 'or', 'not', 'null', 'true', 'false'
    ];
    
    return reserved.includes(word.toLowerCase());
  }
  
  /**
   * Generate index name
   */
  indexName(tableName, columnName, type = 'idx') {
    const table = this.toSQL(tableName);
    const column = this.toSQL(columnName);
    return `${type}_${table}_${column}`;
  }
  
  /**
   * Generate constraint name
   */
  constraintName(tableName, columnName, type = 'fk') {
    const table = this.toSQL(tableName);
    const column = this.toSQL(columnName);
    return `${table}_${column}_${type}`;
  }
  
  /**
   * Generate policy name with UID
   */
  policyName(tableName, operation, uid) {
    const table = this.toSQL(tableName);
    const op = operation.toLowerCase();
    return `policy_${table}_${op}_${uid}`;
  }
  
  /**
   * Set naming strategy
   */
  setStrategy(strategy) {
    if (!['preserve', 'snake_case', 'lower', 'upper'].includes(strategy)) {
      throw new Error(`Invalid naming strategy: ${strategy}`);
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
export const identifier = new Identifier();
