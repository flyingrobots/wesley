/**
 * Operation Registry
 * Harvests and exposes all RPC operations for tooling integration
 */

export class OperationRegistry {
  constructor() {
    this.operations = new Map();
    this.metadata = new Map();
  }
  
  /**
   * Harvest operations from schema
   */
  harvest(schema) {
    const harvested = {
      queries: [],
      mutations: [],
      tables: {},
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
    
    // Harvest explicit RPC operations
    if (schema.queries) {
      for (const query of schema.queries) {
        const operation = this.extractOperation(query, 'query');
        harvested.queries.push(operation);
        this.operations.set(`Query.${query.name}`, operation);
      }
    }
    
    if (schema.mutations) {
      for (const mutation of schema.mutations) {
        const operation = this.extractOperation(mutation, 'mutation');
        harvested.mutations.push(operation);
        this.operations.set(`Mutation.${mutation.name}`, operation);
      }
    }
    
    // Harvest implicit CRUD operations from tables
    for (const table of schema.getTables()) {
      const tableName = table.name;
      const crud = this.generateCRUDOperations(table);
      
      harvested.tables[tableName] = {
        operations: crud,
        fields: this.extractTableFields(table),
        directives: table.directives || {},
        relationships: this.extractRelationships(table)
      };
      
      // Register each CRUD operation
      for (const op of crud) {
        this.operations.set(`${tableName}.${op.name}`, op);
      }
    }
    
    // Store metadata
    this.metadata.set('harvest', harvested);
    
    return harvested;
  }
  
  /**
   * Extract operation details
   */
  extractOperation(operation, type) {
    return {
      name: operation.name,
      type,
      description: operation.description || null,
      deprecated: operation.deprecated || false,
      args: this.extractArguments(operation.args),
      returnType: this.extractReturnType(operation.returnType),
      directives: operation.directives || {},
      complexity: this.calculateComplexity(operation),
      permissions: this.extractPermissions(operation)
    };
  }
  
  /**
   * Extract argument details
   */
  extractArguments(args) {
    if (!args) return [];
    
    return args.map(arg => ({
      name: arg.name,
      type: this.formatType(arg),
      required: arg.nonNull || false,
      defaultValue: arg.defaultValue,
      description: arg.description || null,
      validation: this.extractValidation(arg)
    }));
  }
  
  /**
   * Extract return type details
   */
  extractReturnType(returnType) {
    if (!returnType) return { type: 'void' };
    
    return {
      type: this.formatType(returnType),
      nullable: !returnType.nonNull,
      list: returnType.list || false,
      itemNullable: returnType.list && !returnType.itemNonNull
    };
  }
  
  /**
   * Format type representation
   */
  formatType(typeInfo) {
    let formatted = typeInfo.type || typeInfo.base || 'Unknown';
    
    if (typeInfo.list) {
      formatted = `[${formatted}${typeInfo.itemNonNull ? '!' : ''}]`;
    }
    
    if (typeInfo.nonNull) {
      formatted += '!';
    }
    
    return formatted;
  }
  
  /**
   * Generate CRUD operations for a table
   */
  generateCRUDOperations(table) {
    const tableName = table.name;
    const operations = [];
    
    // SELECT operations
    operations.push({
      name: `findOne${tableName}`,
      type: 'query',
      category: 'read',
      args: this.getPrimaryKeyArgs(table),
      returnType: { type: tableName, nullable: true },
      generated: true,
      sql: `SELECT * FROM "${tableName}" WHERE id = $1`
    });
    
    operations.push({
      name: `findMany${tableName}`,
      type: 'query',
      category: 'read',
      args: [
        { name: 'where', type: `${tableName}Filter`, required: false },
        { name: 'orderBy', type: `${tableName}OrderBy`, required: false },
        { name: 'limit', type: 'Int', required: false },
        { name: 'offset', type: 'Int', required: false }
      ],
      returnType: { type: `[${tableName}!]!`, list: true },
      generated: true,
      sql: `SELECT * FROM "${tableName}" WHERE $1 ORDER BY $2 LIMIT $3 OFFSET $4`
    });
    
    // INSERT operation
    operations.push({
      name: `create${tableName}`,
      type: 'mutation',
      category: 'create',
      args: [
        { name: 'input', type: `${tableName}CreateInput!`, required: true }
      ],
      returnType: { type: `${tableName}!`, nullable: false },
      generated: true,
      sql: `INSERT INTO "${tableName}" ($fields) VALUES ($values) RETURNING *`
    });
    
    // UPDATE operation
    operations.push({
      name: `update${tableName}`,
      type: 'mutation',
      category: 'update',
      args: [
        ...this.getPrimaryKeyArgs(table),
        { name: 'input', type: `${tableName}UpdateInput!`, required: true }
      ],
      returnType: { type: `${tableName}!`, nullable: false },
      generated: true,
      sql: `UPDATE "${tableName}" SET $updates WHERE id = $1 RETURNING *`
    });
    
    // DELETE operation
    operations.push({
      name: `delete${tableName}`,
      type: 'mutation',
      category: 'delete',
      args: this.getPrimaryKeyArgs(table),
      returnType: { type: 'Boolean!', nullable: false },
      generated: true,
      sql: `DELETE FROM "${tableName}" WHERE id = $1`
    });
    
    // UPSERT operation
    operations.push({
      name: `upsert${tableName}`,
      type: 'mutation',
      category: 'upsert',
      args: [
        { name: 'input', type: `${tableName}UpsertInput!`, required: true },
        { name: 'onConflict', type: 'String', required: false }
      ],
      returnType: { type: `${tableName}!`, nullable: false },
      generated: true,
      sql: `INSERT INTO "${tableName}" ($fields) VALUES ($values) 
            ON CONFLICT ($conflict) DO UPDATE SET $updates RETURNING *`
    });
    
    return operations;
  }
  
  /**
   * Get primary key arguments for a table
   */
  getPrimaryKeyArgs(table) {
    const pkFields = table.getFields().filter(f => f.isPrimaryKey());
    
    if (pkFields.length === 0) {
      // Default to id if no PK specified
      return [{ name: 'id', type: 'ID!', required: true }];
    }
    
    return pkFields.map(field => ({
      name: field.name,
      type: this.formatType(field),
      required: true
    }));
  }
  
  /**
   * Extract table fields for documentation
   */
  extractTableFields(table) {
    return table.getFields().map(field => ({
      name: field.name,
      type: this.formatType(field),
      nullable: !field.nonNull,
      list: field.list || false,
      directives: field.directives || {},
      isPrimaryKey: field.isPrimaryKey(),
      isUnique: field.isUnique(),
      isIndexed: field.isIndexed(),
      isForeignKey: !!field.getForeignKeyRef(),
      foreignKeyRef: field.getForeignKeyRef() || null,
      defaultValue: field.getDefault() || null
    }));
  }
  
  /**
   * Extract relationships from table
   */
  extractRelationships(table) {
    const relationships = [];
    
    for (const field of table.getFields()) {
      if (field.directives?.['@hasOne']) {
        relationships.push({
          type: 'hasOne',
          field: field.name,
          target: field.type,
          foreignKey: field.directives['@hasOne'].foreignKey || null
        });
      }
      
      if (field.directives?.['@hasMany']) {
        relationships.push({
          type: 'hasMany',
          field: field.name,
          target: field.type,
          foreignKey: field.directives['@hasMany'].foreignKey || null
        });
      }
      
      if (field.directives?.['@belongsTo']) {
        relationships.push({
          type: 'belongsTo',
          field: field.name,
          target: field.type,
          foreignKey: field.directives['@belongsTo'].foreignKey || field.name
        });
      }
      
      const fkRef = field.getForeignKeyRef();
      if (fkRef && !field.directives?.['@belongsTo']) {
        const [targetTable] = fkRef.split('.');
        relationships.push({
          type: 'foreignKey',
          field: field.name,
          target: targetTable,
          foreignKey: field.name
        });
      }
    }
    
    return relationships;
  }
  
  /**
   * Extract validation rules from directives
   */
  extractValidation(arg) {
    const validation = {};
    
    if (arg.directives?.['@min']) {
      validation.min = arg.directives['@min'].value;
    }
    if (arg.directives?.['@max']) {
      validation.max = arg.directives['@max'].value;
    }
    if (arg.directives?.['@email']) {
      validation.email = true;
    }
    if (arg.directives?.['@url']) {
      validation.url = true;
    }
    if (arg.directives?.['@pattern']) {
      validation.pattern = arg.directives['@pattern'].value;
    }
    
    return Object.keys(validation).length > 0 ? validation : null;
  }
  
  /**
   * Calculate operation complexity
   */
  calculateComplexity(operation) {
    let complexity = 1;
    
    // Add complexity for arguments
    if (operation.args) {
      complexity += operation.args.length * 0.5;
    }
    
    // Add complexity for return type
    if (operation.returnType?.list) {
      complexity += 2;
    }
    
    // Add complexity for directives
    if (operation.directives?.['@auth']) {
      complexity += 1;
    }
    if (operation.directives?.['@rateLimit']) {
      complexity += 0.5;
    }
    
    return Math.round(complexity * 10) / 10;
  }
  
  /**
   * Extract permission requirements
   */
  extractPermissions(operation) {
    const permissions = {
      authenticated: false,
      roles: [],
      scopes: [],
      custom: null
    };
    
    if (operation.directives?.['@auth']) {
      permissions.authenticated = true;
      
      const auth = operation.directives['@auth'];
      if (auth.roles) {
        permissions.roles = Array.isArray(auth.roles) ? auth.roles : [auth.roles];
      }
      if (auth.scopes) {
        permissions.scopes = Array.isArray(auth.scopes) ? auth.scopes : [auth.scopes];
      }
      if (auth.rule) {
        permissions.custom = auth.rule;
      }
    }
    
    if (operation.directives?.['@public']) {
      permissions.authenticated = false;
    }
    
    return permissions;
  }
  
  /**
   * Export registry as JSON
   */
  toJSON() {
    const harvest = this.metadata.get('harvest') || {};
    
    return {
      version: harvest.version,
      timestamp: harvest.timestamp,
      operations: {
        queries: harvest.queries || [],
        mutations: harvest.mutations || [],
        total: this.operations.size
      },
      tables: harvest.tables || {},
      summary: this.generateSummary()
    };
  }
  
  /**
   * Generate summary statistics
   */
  generateSummary() {
    const harvest = this.metadata.get('harvest') || {};
    
    return {
      totalOperations: this.operations.size,
      queries: harvest.queries?.length || 0,
      mutations: harvest.mutations?.length || 0,
      tables: Object.keys(harvest.tables || {}).length,
      generatedOperations: Array.from(this.operations.values())
        .filter(op => op.generated).length,
      customOperations: Array.from(this.operations.values())
        .filter(op => !op.generated).length,
      complexityStats: this.calculateComplexityStats()
    };
  }
  
  /**
   * Calculate complexity statistics
   */
  calculateComplexityStats() {
    const complexities = Array.from(this.operations.values())
      .map(op => op.complexity || 1);
    
    if (complexities.length === 0) {
      return { min: 0, max: 0, avg: 0 };
    }
    
    return {
      min: Math.min(...complexities),
      max: Math.max(...complexities),
      avg: Math.round((complexities.reduce((a, b) => a + b, 0) / complexities.length) * 10) / 10
    };
  }
  
  /**
   * Get operation by key
   */
  get(key) {
    return this.operations.get(key);
  }
  
  /**
   * Get all operations
   */
  getAll() {
    return Array.from(this.operations.values());
  }
  
  /**
   * Filter operations by criteria
   */
  filter(predicate) {
    return Array.from(this.operations.values()).filter(predicate);
  }
  
  /**
   * Get operations for a specific table
   */
  getTableOperations(tableName) {
    return this.filter(op => op.name.includes(tableName));
  }
  
  /**
   * Export for Watson integration
   */
  exportForWatson() {
    return {
      operations: this.getAll().map(op => ({
        key: `${op.type}.${op.name}`,
        name: op.name,
        type: op.type,
        complexity: op.complexity,
        permissions: op.permissions,
        signature: this.generateSignature(op)
      })),
      metadata: {
        version: '1.0.0',
        generator: 'wesley',
        timestamp: new Date().toISOString()
      }
    };
  }
  
  /**
   * Generate operation signature for Watson
   */
  generateSignature(operation) {
    const args = (operation.args || [])
      .map(arg => `${arg.name}: ${arg.type}`)
      .join(', ');
    
    const returnType = operation.returnType?.type || 'void';
    
    return `${operation.name}(${args}): ${returnType}`;
  }
}