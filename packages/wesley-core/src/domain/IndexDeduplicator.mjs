/**
 * Index Deduplication Strategy
 * Prevents creation of redundant indexes
 */

export class IndexDeduplicator {
  constructor() {
    this.indexes = new Map(); // tableName -> Set of index signatures
    this.primaryKeys = new Map(); // tableName -> column(s)
    this.uniqueConstraints = new Map(); // tableName -> Set of columns
  }
  
  /**
   * Register a primary key constraint
   */
  registerPrimaryKey(tableName, columns) {
    const cols = Array.isArray(columns) ? columns : [columns];
    this.primaryKeys.set(tableName, cols);
  }
  
  /**
   * Register a unique constraint
   */
  registerUniqueConstraint(tableName, columns) {
    const cols = Array.isArray(columns) ? columns : [columns];
    if (!this.uniqueConstraints.has(tableName)) {
      this.uniqueConstraints.set(tableName, new Set());
    }
    this.uniqueConstraints.get(tableName).add(cols.join(','));
  }
  
  /**
   * Check if an index is redundant
   */
  isRedundant(tableName, columns, options = {}) {
    const cols = Array.isArray(columns) ? columns : [columns];
    
    // Check if covered by primary key
    const pk = this.primaryKeys.get(tableName);
    if (pk && this.isPrefix(cols, pk) && !options.where) {
      return {
        redundant: true,
        reason: `Index on ${cols.join(',')} is covered by primary key on ${pk.join(',')}`
      };
    }
    
    // Check if covered by unique constraint
    const uniques = this.uniqueConstraints.get(tableName);
    if (uniques) {
      for (const uniqueCols of uniques) {
        const uniqueArr = uniqueCols.split(',');
        if (this.isPrefix(cols, uniqueArr) && !options.where) {
          return {
            redundant: true,
            reason: `Index on ${cols.join(',')} is covered by unique constraint on ${uniqueCols}`
          };
        }
      }
    }
    
    // Check if duplicate index already exists
    const signature = this.getIndexSignature(tableName, cols, options);
    if (this.indexes.has(tableName) && this.indexes.get(tableName).has(signature)) {
      return {
        redundant: true,
        reason: `Duplicate index on ${cols.join(',')} already exists`
      };
    }
    
    return { redundant: false };
  }
  
  /**
   * Register an index
   */
  registerIndex(tableName, columns, options = {}) {
    const cols = Array.isArray(columns) ? columns : [columns];
    const signature = this.getIndexSignature(tableName, cols, options);
    
    if (!this.indexes.has(tableName)) {
      this.indexes.set(tableName, new Set());
    }
    this.indexes.get(tableName).add(signature);
  }
  
  /**
   * Get unique signature for an index
   */
  getIndexSignature(tableName, columns, options = {}) {
    const parts = [
      tableName,
      columns.join(','),
      options.unique ? 'UNIQUE' : '',
      options.where || ''
    ];
    return parts.filter(Boolean).join('::');
  }
  
  /**
   * Check if arr1 is a prefix of arr2
   */
  isPrefix(arr1, arr2) {
    if (arr1.length > arr2.length) return false;
    for (let i = 0; i < arr1.length; i++) {
      if (arr1[i] !== arr2[i]) return false;
    }
    return true;
  }
  
  /**
   * Deduplicate a list of index statements
   */
  deduplicateIndexes(schema) {
    const statements = [];
    const deduper = new IndexDeduplicator();
    
    // First pass: register all PKs and unique constraints
    for (const table of schema.getTables()) {
      for (const field of table.getFields()) {
        if (field.isPrimaryKey()) {
          deduper.registerPrimaryKey(table.name, field.name);
        }
        if (field.isUnique()) {
          deduper.registerUniqueConstraint(table.name, field.name);
        }
      }
    }
    
    // Second pass: generate non-redundant indexes
    for (const table of schema.getTables()) {
      for (const field of table.getFields()) {
        if (field.directives?.['@index']) {
          const indexDef = field.directives['@index'];
          const columns = [field.name];
          const options = {
            unique: indexDef.unique || false,
            where: indexDef.where || null
          };
          
          const check = deduper.isRedundant(table.name, columns, options);
          if (!check.redundant) {
            // Generate index statement
            const indexName = `idx_${table.name}_${field.name}`;
            let stmt = `CREATE INDEX`;
            if (options.unique) stmt += ' UNIQUE';
            stmt += ` IF NOT EXISTS "${indexName}"`;
            stmt += ` ON "${table.name}" ("${field.name}")`;
            if (options.where) {
              stmt += ` WHERE ${options.where}`;
            }
            stmt += ';';
            
            statements.push({
              statement: stmt,
              reason: `Index for ${table.name}.${field.name}`
            });
            
            deduper.registerIndex(table.name, columns, options);
          } else {
            // Record skipped index for evidence
            statements.push({
              statement: `-- Skipped: ${check.reason}`,
              skipped: true,
              reason: check.reason
            });
          }
        }
      }
    }
    
    return statements;
  }
}

// Export singleton for global usage
export const indexDeduplicator = new IndexDeduplicator();