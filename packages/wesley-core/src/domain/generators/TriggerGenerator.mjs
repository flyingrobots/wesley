/**
 * TriggerGenerator - Generates PostgreSQL triggers for computed columns
 * 
 * Implements WP2.T007: Computed column trigger generation
 * - Generate triggers for cross-table computed columns
 * - Support same-row GENERATED columns  
 * - Create trigger functions with update cascading
 * - Performance-optimized trigger design
 */

export class TriggerGenerator {
  constructor(schema, options = {}) {
    this.schema = schema;
    this.options = {
      useGeneratedColumns: true,   // Prefer GENERATED columns when possible
      cascadeUpdates: true,        // Auto-update dependent computed columns
      optimizePerformance: true,   // Apply performance optimizations
      validateExpressions: true,   // Validate SQL expressions
      ...options
    };
  }

  /**
   * Generate all triggers for computed columns in the schema
   * @returns {Array<Object>} Generated trigger definitions
   */
  generateAllTriggers() {
    const triggers = [];
    const processedTables = new Set();

    for (const table of this.schema.getTables()) {
      if (processedTables.has(table.name)) continue;

      const computedFields = this.findComputedFields(table);
      if (computedFields.length === 0) continue;

      for (const field of computedFields) {
        const triggerDef = this.generateFieldTrigger(table, field);
        if (triggerDef) {
          triggers.push(triggerDef);
        }
      }

      processedTables.add(table.name);
    }

    // Generate cascading update triggers if enabled
    if (this.options.cascadeUpdates) {
      const cascadeTriggers = this.generateCascadeUpdateTriggers();
      triggers.push(...cascadeTriggers);
    }

    return triggers;
  }

  /**
   * Find computed fields in a table
   * @param {Object} table - Table model
   * @returns {Array<Object>} Computed fields
   */
  findComputedFields(table) {
    return table.getFields().filter(field => {
      const computedDirective = field.directives?.['@computed'];
      const generatedDirective = field.directives?.['@generated']; 
      return computedDirective || generatedDirective;
    });
  }

  /**
   * Generate trigger for a computed field
   * @param {Object} table - Table model
   * @param {Object} field - Computed field
   * @returns {Object|null} Trigger definition
   */
  generateFieldTrigger(table, field) {
    const computedDirective = field.directives?.['@computed'];
    const generatedDirective = field.directives?.['@generated'];
    
    // Determine computation strategy
    if (generatedDirective) {
      return this.generateGeneratedColumnTrigger(table, field, generatedDirective);
    } else if (computedDirective) {
      return this.generateComputedColumnTrigger(table, field, computedDirective);
    }

    return null;
  }

  /**
   * Generate GENERATED column definition (PostgreSQL 12+)
   * @param {Object} table - Table model
   * @param {Object} field - Generated field
   * @param {Object} directive - @generated directive
   * @returns {Object} Generated column definition
   */
  generateGeneratedColumnTrigger(table, field, directive) {
    const { expression, stored = true } = directive;
    
    if (!expression) {
      throw new Error(`@generated field '${field.name}' missing expression`);
    }

    // Check if GENERATED columns are disabled
    if (!this.options.useGeneratedColumns) {
      return this.generateComputedColumnTrigger(table, field, {
        expression,
        dependencies: this.extractDependencies(expression)
      });
    }

    // Validate expression references only same-row columns
    const referencedTables = this.extractTableReferences(expression);
    const crossTableRefs = referencedTables.filter(ref => ref !== table.name);
    
    if (crossTableRefs.length > 0) {
      // GENERATED columns cannot reference other tables, fall back to trigger
      return this.generateComputedColumnTrigger(table, field, {
        expression,
        dependencies: crossTableRefs
      });
    }

    const sqlType = this.getSQLType(field);
    const storageType = stored ? 'STORED' : 'VIRTUAL';

    return {
      type: 'generated_column',
      tableName: table.name,
      fieldName: field.name,
      sql: `"${field.name}" ${sqlType} GENERATED ALWAYS AS (${expression}) ${storageType}`,
      dependencies: [],
      strategy: 'native-generated',
      performance: 'optimal'
    };
  }

  /**
   * Generate trigger-based computed column
   * @param {Object} table - Table model  
   * @param {Object} field - Computed field
   * @param {Object} directive - @computed directive
   * @returns {Object} Trigger definition
   */
  generateComputedColumnTrigger(table, field, directive) {
    const { expression, dependencies = [], when = 'BEFORE' } = directive;
    
    if (!expression) {
      throw new Error(`@computed field '${field.name}' missing expression`);
    }

    // Extract dependencies from expression if not explicitly provided
    const extractedDeps = dependencies.length > 0 ? 
      dependencies : this.extractDependencies(expression);

    const functionName = `compute_${table.name}_${field.name}`;
    const triggerName = `trigger_compute_${table.name}_${field.name}`;

    // Generate trigger function
    const functionSQL = this.generateTriggerFunction(
      table, field, expression, extractedDeps, functionName
    );

    // Generate trigger
    const triggerSQL = this.generateTrigger(
      table, field, functionName, triggerName, when
    );

    // Determine if this is cross-table computation
    const referencedTables = this.extractTableReferences(expression);
    const isCrossTable = referencedTables.some(ref => ref !== table.name);

    return {
      type: 'computed_trigger',
      tableName: table.name,
      fieldName: field.name,
      functionName,
      triggerName,
      functionSQL,
      triggerSQL,
      sql: `${functionSQL}\n\n${triggerSQL}`,
      dependencies: extractedDeps,
      crossTable: isCrossTable,
      referencedTables,
      strategy: isCrossTable ? 'cross-table-trigger' : 'same-row-trigger',
      performance: this.assessTriggerPerformance(expression, extractedDeps, isCrossTable)
    };
  }

  /**
   * Generate trigger function SQL
   * @param {Object} table - Table model
   * @param {Object} field - Computed field
   * @param {string} expression - Computation expression
   * @param {Array<string>} dependencies - Dependent columns
   * @param {string} functionName - Function name
   * @returns {string} Function SQL
   */
  generateTriggerFunction(table, field, expression, dependencies, functionName) {
    const sqlType = this.getSQLType(field);
    
    // Generate change detection logic for performance
    let changeDetection = '';
    if (this.options.optimizePerformance && dependencies.length > 0) {
      const checks = dependencies.map(dep => 
        `OLD."${dep}" IS DISTINCT FROM NEW."${dep}"`
      ).join(' OR ');
      
      changeDetection = `
    -- Performance optimization: only compute if dependencies changed
    IF TG_OP = 'UPDATE' AND NOT (${checks}) THEN
        RETURN NEW;
    END IF;`;
    }

    // Handle cross-table references
    let computeExpression = expression;
    if (this.isExpressionCrossTable(expression)) {
      computeExpression = this.rewriteCrossTableExpression(expression, table);
    }

    return `
-- Computed column function for ${table.name}.${field.name}
CREATE OR REPLACE FUNCTION ${functionName}()
RETURNS TRIGGER AS $$
DECLARE
    computed_value ${sqlType};
BEGIN
    -- Handle DELETE operations
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
${changeDetection}

    -- Compute the new value
    BEGIN
        SELECT ${computeExpression} INTO computed_value;
        NEW."${field.name}" := computed_value;
    EXCEPTION
        WHEN OTHERS THEN
            -- Handle computation errors gracefully
            RAISE WARNING 'Error computing ${table.name}.${field.name}: %', SQLERRM;
            NEW."${field.name}" := NULL;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;`.trim();
  }

  /**
   * Generate trigger SQL
   * @param {Object} table - Table model
   * @param {Object} field - Computed field
   * @param {string} functionName - Function name
   * @param {string} triggerName - Trigger name
   * @param {string} when - Trigger timing (BEFORE/AFTER)
   * @returns {string} Trigger SQL
   */
  generateTrigger(table, field, functionName, triggerName, when) {
    return `
-- Computed column trigger for ${table.name}.${field.name}
DROP TRIGGER IF EXISTS ${triggerName} ON "${table.name}";
CREATE TRIGGER ${triggerName}
    ${when} INSERT OR UPDATE ON "${table.name}"
    FOR EACH ROW
    EXECUTE FUNCTION ${functionName}();`.trim();
  }

  /**
   * Generate cascade update triggers for cross-table dependencies
   * @returns {Array<Object>} Cascade trigger definitions
   */
  generateCascadeUpdateTriggers() {
    const cascadeTriggers = [];
    const crossTableDeps = this.findCrossTableDependencies();

    for (const dep of crossTableDeps) {
      const cascadeTrigger = this.generateCascadeTrigger(dep);
      if (cascadeTrigger) {
        cascadeTriggers.push(cascadeTrigger);
      }
    }

    return cascadeTriggers;
  }

  /**
   * Find cross-table dependencies in computed columns
   * @returns {Array<Object>} Cross-table dependencies
   */
  findCrossTableDependencies() {
    const dependencies = [];

    for (const table of this.schema.getTables()) {
      const computedFields = this.findComputedFields(table);
      
      for (const field of computedFields) {
        const directive = field.directives?.['@computed'] || field.directives?.['@generated'];
        if (!directive?.expression) continue;

        const referencedTables = this.extractTableReferences(directive.expression);
        const crossTableRefs = referencedTables.filter(ref => ref !== table.name);

        for (const refTable of crossTableRefs) {
          dependencies.push({
            sourceTable: refTable,
            targetTable: table.name,
            targetField: field.name,
            expression: directive.expression
          });
        }
      }
    }

    return dependencies;
  }

  /**
   * Generate cascade update trigger
   * @param {Object} dependency - Cross-table dependency
   * @returns {Object} Cascade trigger definition
   */
  generateCascadeTrigger(dependency) {
    const { sourceTable, targetTable, targetField } = dependency;
    
    const functionName = `cascade_update_${sourceTable}_to_${targetTable}_${targetField}`;
    const triggerName = `trigger_cascade_${sourceTable}_to_${targetTable}_${targetField}`;

    // Extract foreign key relationships to determine update scope
    const fkRelations = this.findForeignKeyRelations(sourceTable, targetTable);
    
    if (fkRelations.length === 0) {
      // Cannot cascade without FK relationship
      return null;
    }

    const updateConditions = fkRelations.map(fk => 
      `"${targetTable}"."${fk.foreignKey}" = OLD."${fk.primaryKey}"`
    ).join(' AND ');

    const functionSQL = `
-- Cascade update function for ${sourceTable} -> ${targetTable}.${targetField}
CREATE OR REPLACE FUNCTION ${functionName}()
RETURNS TRIGGER AS $$
BEGIN
    -- Update dependent computed columns in ${targetTable}
    UPDATE "${targetTable}" 
    SET "${targetField}" = (
        -- Trigger the computation by touching a dependency
        SELECT ${this.rewriteCrossTableExpression(dependency.expression, { name: targetTable })}
        FROM "${targetTable}" t2 
        WHERE ${updateConditions.replace(`"${targetTable}".`, 't2.')}
    )
    WHERE ${updateConditions};
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;`.trim();

    const triggerSQL = `
-- Cascade update trigger for ${sourceTable} -> ${targetTable}.${targetField}
DROP TRIGGER IF EXISTS ${triggerName} ON "${sourceTable}";
CREATE TRIGGER ${triggerName}
    AFTER UPDATE OR DELETE ON "${sourceTable}"
    FOR EACH ROW
    EXECUTE FUNCTION ${functionName}();`.trim();

    return {
      type: 'cascade_trigger',
      sourceTable,
      targetTable,
      targetField,
      functionName,
      triggerName,
      functionSQL,
      triggerSQL,
      sql: `${functionSQL}\n\n${triggerSQL}`,
      strategy: 'cascade-update',
      performance: 'moderate'
    };
  }

  /**
   * Extract table references from SQL expression
   * @param {string} expression - SQL expression
   * @returns {Array<string>} Referenced table names
   */
  extractTableReferences(expression) {
    // Simple regex to find table.column references
    const tableRefs = new Set();
    const regex = /(?:^|\W)([a-zA-Z_][a-zA-Z0-9_]*)\./g;
    let match;

    while ((match = regex.exec(expression)) !== null) {
      const tableName = match[1];
      // Verify this is actually a table in our schema
      if (this.schema.getTable(tableName)) {
        tableRefs.add(tableName);
      }
    }

    return Array.from(tableRefs);
  }

  /**
   * Extract column dependencies from expression
   * @param {string} expression - SQL expression
   * @returns {Array<string>} Dependent column names
   */
  extractDependencies(expression) {
    const dependencies = new Set();
    
    // Extract column references (both qualified and unqualified)
    const columnRegex = /(?:^|\W)(?:(?:[a-zA-Z_][a-zA-Z0-9_]*\.)?([a-zA-Z_][a-zA-Z0-9_]*))(?=\W|$)/g;
    let match;

    while ((match = columnRegex.exec(expression)) !== null) {
      const columnName = match[1];
      
      // Filter out SQL keywords and functions
      if (!this.isSQLKeyword(columnName)) {
        dependencies.add(columnName);
      }
    }

    return Array.from(dependencies);
  }

  /**
   * Check if expression references multiple tables
   * @param {string} expression - SQL expression
   * @returns {boolean} True if cross-table
   */
  isExpressionCrossTable(expression) {
    const tableRefs = this.extractTableReferences(expression);
    return tableRefs.length > 1 || (tableRefs.length === 1 && !expression.includes('NEW.'));
  }

  /**
   * Rewrite cross-table expression for trigger context
   * @param {string} expression - Original expression
   * @param {Object} currentTable - Current table context
   * @returns {string} Rewritten expression
   */
  rewriteCrossTableExpression(expression, currentTable) {
    // Replace table.column with subqueries or JOINs as needed
    // This is a simplified implementation - real world would need more sophisticated parsing
    
    const tableRefs = this.extractTableReferences(expression);
    let rewritten = expression;

    for (const tableRef of tableRefs) {
      if (tableRef !== currentTable.name) {
        // Replace with subquery pattern for trigger safety
        const regex = new RegExp(`\\b${tableRef}\\.([a-zA-Z_][a-zA-Z0-9_]*)`, 'g');
        rewritten = rewritten.replace(regex, (match, columnName) => {
          return `(SELECT "${columnName}" FROM "${tableRef}" WHERE /* FK join condition needed */)`;
        });
      }
    }

    return rewritten;
  }

  /**
   * Find foreign key relations between tables
   * @param {string} sourceTable - Source table name
   * @param {string} targetTable - Target table name  
   * @returns {Array<Object>} FK relations
   */
  findForeignKeyRelations(sourceTable, targetTable) {
    const relations = [];
    const targetTableModel = this.schema.getTable(targetTable);
    
    if (!targetTableModel) return relations;

    for (const field of targetTableModel.getFields()) {
      if (field.isForeignKey()) {
        const fkRef = field.getForeignKeyRef();
        if (fkRef) {
          const [refTable, refCol] = fkRef.split('.');
          if (refTable === sourceTable) {
            relations.push({
              foreignKey: field.name,
              primaryKey: refCol || 'id',
              sourceTable,
              targetTable
            });
          }
        }
      }
    }

    return relations;
  }

  /**
   * Assess trigger performance characteristics
   * @param {string} expression - Computation expression
   * @param {Array<string>} dependencies - Column dependencies
   * @param {boolean} isCrossTable - Cross-table computation
   * @returns {string} Performance assessment
   */
  assessTriggerPerformance(expression, dependencies, isCrossTable) {
    if (isCrossTable) {
      return 'moderate'; // Cross-table queries are slower
    }
    
    if (dependencies.length > 5) {
      return 'moderate'; // Many dependencies may impact performance
    }

    // Check for expensive operations
    const expensiveOps = [
      'substring', 'regexp_', 'similar to', 'like', 'ilike',
      'jsonb_', 'json_', 'array_agg', 'string_agg'
    ];

    const hasExpensiveOps = expensiveOps.some(op => 
      expression.toLowerCase().includes(op)
    );

    return hasExpensiveOps ? 'moderate' : 'optimal';
  }

  /**
   * Get SQL type for field
   * @param {Object} field - Field model
   * @returns {string} SQL type
   */
  getSQLType(field) {
    const scalarMap = {
      ID: 'uuid',
      String: 'text', 
      Int: 'integer',
      Float: 'double precision',
      Boolean: 'boolean',
      DateTime: 'timestamptz',
      Date: 'date',
      Time: 'time',
      Decimal: 'numeric',
      UUID: 'uuid',
      JSON: 'jsonb'
    };

    const baseType = scalarMap[field.type] || 'text';
    return field.list ? `${baseType}[]` : baseType;
  }

  /**
   * Check if identifier is SQL keyword
   * @param {string} identifier - Identifier to check
   * @returns {boolean} True if SQL keyword
   */
  isSQLKeyword(identifier) {
    const keywords = [
      'select', 'from', 'where', 'and', 'or', 'not', 'null', 'true', 'false',
      'case', 'when', 'then', 'else', 'end', 'as', 'distinct', 'count',
      'sum', 'avg', 'min', 'max', 'coalesce', 'nullif', 'greatest', 'least'
    ];
    
    return keywords.includes(identifier.toLowerCase());
  }

  /**
   * Validate SQL expression syntax (basic validation)
   * @param {string} expression - Expression to validate
   * @returns {Object} Validation result
   */
  validateExpression(expression) {
    const errors = [];
    const warnings = [];

    // Basic syntax checks
    const parenCount = (expression.match(/\(/g) || []).length - 
                      (expression.match(/\)/g) || []).length;
    if (parenCount !== 0) {
      errors.push('Mismatched parentheses in expression');
    }

    // Check for potential injection risks
    if (expression.includes('--') || expression.includes('/*')) {
      warnings.push('Expression contains SQL comments - verify safety');
    }

    // Check for unquoted identifiers that might be keywords
    const unquotedIdents = expression.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || [];
    const keywordIdents = unquotedIdents.filter(id => this.isSQLKeyword(id));
    if (keywordIdents.length > 0) {
      warnings.push(`Consider quoting identifiers: ${keywordIdents.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}