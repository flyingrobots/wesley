/**
 * Wesley GraphQL → Migration DSL Generator
 * Bridges Wesley core with Chaos Mode for live schema editing
 * @module WesleyGenerator
 */

import { corsHeaders } from '../_shared/cors.js';

/**
 * GraphQL schema differ and migration DSL generator
 */
class WesleyMigrationGenerator {
  constructor() {
    // Current demo schema state (loaded from database)
    this.currentSchema = null;
    
    // Basic GraphQL type mappings to SQL
    this.typeMapping = {
      'String': 'text',
      'String!': 'text',
      'Int': 'integer', 
      'Int!': 'integer',
      'Float': 'numeric',
      'Float!': 'numeric',
      'Boolean': 'boolean',
      'Boolean!': 'boolean',
      'DateTime': 'timestamptz',
      'DateTime!': 'timestamptz',
      'UUID': 'uuid',
      'UUID!': 'uuid',
      'JSON': 'jsonb',
      'JSON!': 'jsonb'
    };
  }

  /**
   * Parse GraphQL schema into structured format
   * @param {string} schemaText - GraphQL schema text
   * @returns {Object} Parsed schema structure
   */
  parseSchema(schemaText) {
    const types = new Map();
    const enums = new Map();
    
    // Simple regex-based parser (production would use proper GraphQL parser)
    const typeBlocks = schemaText.match(/type\s+\w+[^}]*}/g) || [];
    const enumBlocks = schemaText.match(/enum\s+\w+[^}]*}/g) || [];
    
    // Parse enums
    for (const enumBlock of enumBlocks) {
      const enumMatch = enumBlock.match(/enum\s+(\w+)\s*{([^}]*)}/);
      if (enumMatch) {
        const [, name, values] = enumMatch;
        const enumValues = values.match(/\w+/g) || [];
        enums.set(name, enumValues);
      }
    }
    
    // Parse types
    for (const typeBlock of typeBlocks) {
      const typeMatch = typeBlock.match(/type\s+(\w+)([^{]*){([^}]*)}/);
      if (!typeMatch) continue;
      
      const [, name, directives, fieldsText] = typeMatch;
      const isTable = directives.includes('@table');
      
      if (!isTable) continue; // Only process @table types
      
      const fields = new Map();
      const fieldLines = fieldsText.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
      
      for (const fieldLine of fieldLines) {
        const fieldMatch = fieldLine.match(/(\w+):\s*([^@\s]+)(.*)$/);
        if (!fieldMatch) continue;
        
        const [, fieldName, fieldType, fieldDirectives] = fieldMatch;
        
        // Parse directives
        const isPrimaryKey = fieldDirectives.includes('@pk');
        const isUnique = fieldDirectives.includes('@unique');
        const defaultMatch = fieldDirectives.match(/@default\(value:\s*"([^"]+)"\)/);
        const checkMatch = fieldDirectives.match(/@check\(expr:\s*"([^"]+)"\)/);
        const fkMatch = fieldDirectives.match(/@fk\(ref:\s*"([^"]+)"\)/);
        
        fields.set(fieldName, {
          type: fieldType,
          nullable: !fieldType.endsWith('!'),
          isPrimaryKey,
          isUnique,
          default: defaultMatch ? defaultMatch[1] : null,
          check: checkMatch ? checkMatch[1] : null,
          foreignKey: fkMatch ? fkMatch[1] : null
        });
      }
      
      // Parse table directives
      const rlsEnabled = directives.includes('@rls(enable: true)');
      const realtimeEnabled = directives.includes('@realtime');
      
      types.set(name, {
        name: name.toLowerCase(), // Table name convention
        fields,
        rlsEnabled,
        realtimeEnabled,
        directives
      });
    }
    
    return { types, enums };
  }

  /**
   * Compare two schemas and generate diff operations
   * @param {Object} oldSchema - Previous schema structure
   * @param {Object} newSchema - New schema structure  
   * @returns {Object} Schema diff operations
   */
  generateSchemaDiff(oldSchema, newSchema) {
    const operations = [];
    
    if (!oldSchema) {
      // Initial schema - create all tables
      for (const [typeName, typeData] of newSchema.types) {
        operations.push(...this.generateCreateTableOps(typeData));
      }
      return { operations, hasChanges: operations.length > 0 };
    }
    
    // Compare types
    for (const [typeName, newType] of newSchema.types) {
      const oldType = oldSchema.types.get(typeName);
      
      if (!oldType) {
        // New table
        operations.push(...this.generateCreateTableOps(newType));
      } else {
        // Compare fields
        operations.push(...this.generateFieldDiffOps(oldType, newType));
      }
    }
    
    // Check for dropped tables (in production, this would be handled carefully)
    for (const [typeName, oldType] of oldSchema.types) {
      if (!newSchema.types.has(typeName)) {
        console.warn(`Table ${oldType.name} was removed - manual review needed`);
        // In chaos mode, we don't auto-drop tables
      }
    }
    
    return { operations, hasChanges: operations.length > 0 };
  }

  /**
   * Generate operations to create a new table
   * @private
   * @param {Object} typeData - Type definition
   * @returns {Array} Migration operations
   */
  generateCreateTableOps(typeData) {
    const operations = [];
    
    // 1. Create table with columns
    const columns = [];
    let primaryKey = null;
    
    for (const [fieldName, field] of typeData.fields) {
      const sqlType = this.getSqlType(field.type);
      const nullable = field.nullable ? 'NULL' : 'NOT NULL';
      const defaultClause = field.default ? ` DEFAULT ${field.default}` : '';
      
      columns.push({
        name: fieldName,
        type: sqlType,
        nullable: field.nullable,
        default: field.default
      });
      
      if (field.isPrimaryKey) {
        primaryKey = fieldName;
      }
    }
    
    operations.push({
      op: 'create_table',
      name: typeData.name,
      cols: columns,
      pkey: primaryKey || 'id' // Default to 'id' if no @pk specified
    });
    
    // 2. Add indexes for unique fields
    for (const [fieldName, field] of typeData.fields) {
      if (field.isUnique && !field.isPrimaryKey) {
        operations.push({
          op: 'add_index_concurrently',
          table: typeData.name,
          cols: [fieldName]
        });
      }
    }
    
    // 3. Add foreign key constraints (NOT VALID for safety)
    for (const [fieldName, field] of typeData.fields) {
      if (field.foreignKey) {
        const [targetTable, targetCol] = field.foreignKey.split('.');
        operations.push({
          op: 'add_foreign_key_not_valid',
          src: typeData.name,
          col: fieldName,
          tgt: targetTable.toLowerCase(),
          tgt_col: targetCol
        });
      }
    }
    
    return operations;
  }

  /**
   * Generate operations for field differences
   * @private  
   * @param {Object} oldType - Old type definition
   * @param {Object} newType - New type definition
   * @returns {Array} Migration operations
   */
  generateFieldDiffOps(oldType, newType) {
    const operations = [];
    
    // Check for new fields
    for (const [fieldName, newField] of newType.fields) {
      if (!oldType.fields.has(fieldName)) {
        operations.push({
          op: 'add_column',
          table: newType.name,
          name: fieldName,
          type: this.getSqlType(newField.type),
          nullable: newField.nullable,
          default: newField.default,
          comment: `Added via Wesley schema evolution`
        });
        
        // Add unique index if needed
        if (newField.isUnique) {
          operations.push({
            op: 'add_index_concurrently',
            table: newType.name,
            cols: [fieldName]
          });
        }
        
        // Add foreign key if needed
        if (newField.foreignKey) {
          const [targetTable, targetCol] = newField.foreignKey.split('.');
          operations.push({
            op: 'add_foreign_key_not_valid',
            src: newType.name,
            col: fieldName,
            tgt: targetTable.toLowerCase(),
            tgt_col: targetCol
          });
        }
      }
    }
    
    // Check for field type changes (simplified - production would be more complex)
    for (const [fieldName, newField] of newType.fields) {
      const oldField = oldType.fields.get(fieldName);
      if (oldField) {
        const oldSqlType = this.getSqlType(oldField.type);
        const newSqlType = this.getSqlType(newField.type);
        
        if (oldSqlType !== newSqlType) {
          console.warn(`Field ${fieldName} type changed from ${oldSqlType} to ${newSqlType} - manual review needed`);
          // Type changes are complex and not auto-generated in chaos mode
        }
        
        // Check nullable changes
        if (oldField.nullable && !newField.nullable) {
          // Adding NOT NULL constraint - need to validate data first
          console.warn(`Field ${fieldName} changing to NOT NULL - will require validation step`);
        }
      }
    }
    
    return operations;
  }

  /**
   * Convert GraphQL type to SQL type
   * @private
   * @param {string} graphqlType - GraphQL type name
   * @returns {string} SQL type name
   */
  getSqlType(graphqlType) {
    // Remove array brackets and non-null indicators for base type lookup
    const baseType = graphqlType.replace(/[\[\]!]/g, '');
    return this.typeMapping[graphqlType] || this.typeMapping[baseType] || 'text';
  }

  /**
   * Generate Wesley migration DSL from schema diff
   * @param {string} oldSchemaText - Previous GraphQL schema
   * @param {string} newSchemaText - New GraphQL schema  
   * @param {string} title - Migration title
   * @param {string} reason - Migration reason
   * @returns {Object} Wesley migration DSL
   */
  generateMigrationDSL(oldSchemaText, newSchemaText, title, reason) {
    const oldSchema = oldSchemaText ? this.parseSchema(oldSchemaText) : null;
    const newSchema = this.parseSchema(newSchemaText);
    
    const diff = this.generateSchemaDiff(oldSchema, newSchema);
    
    if (!diff.hasChanges) {
      return {
        hasChanges: false,
        message: 'No schema changes detected'
      };
    }
    
    // Organize operations into waves
    const waves = this.organizeIntoWaves(diff.operations);
    
    return {
      hasChanges: true,
      dsl: {
        title,
        reason,
        waves
      }
    };
  }

  /**
   * Organize operations into safe execution waves
   * @private
   * @param {Array} operations - Migration operations
   * @returns {Array} Wave definitions
   */
  organizeIntoWaves(operations) {
    const waves = [];
    
    // Separate operations by type
    const tableCreations = operations.filter(op => op.op === 'create_table');
    const columnAdditions = operations.filter(op => op.op === 'add_column');
    const indexCreations = operations.filter(op => op.op === 'add_index_concurrently');
    const foreignKeys = operations.filter(op => op.op === 'add_foreign_key_not_valid');
    
    // Wave 1: EXPAND - Table and column creation (safe, non-blocking)
    const expandOps = [...tableCreations, ...columnAdditions, ...indexCreations];
    if (expandOps.length > 0) {
      waves.push({
        name: 'expand',
        steps: expandOps,
        limits: {
          max_lock_ms: 2000,
          max_stmt_ms: 10000
        }
      });
    }
    
    // Wave 2: VALIDATE - Foreign key validation (requires validation step)
    if (foreignKeys.length > 0) {
      waves.push({
        name: 'validate',
        steps: foreignKeys,
        limits: {
          max_lock_ms: 5000,
          max_stmt_ms: 30000
        }
      });
    }
    
    return waves;
  }
}

/**
 * Main Edge Function handler
 * @param {Request} req - Incoming request
 * @returns {Response} JSON response
 */
export default async function handler(req) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const generator = new WesleyMigrationGenerator();
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    switch (path) {
      case 'diff':
        return await handleDiff(req, generator);
      case 'generate':
        return await handleGenerate(req, generator);
      default:
        return new Response(JSON.stringify({ error: 'Route not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

  } catch (error) {
    console.error('Wesley generator error:', error);
    
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle schema diff request
 * POST /diff
 */
async function handleDiff(req, generator) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { oldSchema, newSchema } = await req.json();

  if (!newSchema) {
    return new Response(JSON.stringify({
      error: 'Missing newSchema parameter'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const oldParsed = oldSchema ? generator.parseSchema(oldSchema) : null;
    const newParsed = generator.parseSchema(newSchema);
    const diff = generator.generateSchemaDiff(oldParsed, newParsed);

    return new Response(JSON.stringify({
      success: true,
      hasChanges: diff.hasChanges,
      operations: diff.operations,
      summary: {
        newTables: diff.operations.filter(op => op.op === 'create_table').length,
        newColumns: diff.operations.filter(op => op.op === 'add_column').length,
        newIndexes: diff.operations.filter(op => op.op === 'add_index_concurrently').length,
        newConstraints: diff.operations.filter(op => op.op === 'add_foreign_key_not_valid').length
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Schema diff failed:', error);
    
    return new Response(JSON.stringify({
      error: 'SCHEMA_DIFF_FAILED',
      message: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle migration DSL generation request
 * POST /generate
 */
async function handleGenerate(req, generator) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { oldSchema, newSchema, title, reason } = await req.json();

  if (!newSchema || !title || !reason) {
    return new Response(JSON.stringify({
      error: 'Missing required fields: newSchema, title, reason'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const result = generator.generateMigrationDSL(oldSchema, newSchema, title, reason);

    return new Response(JSON.stringify({
      success: true,
      ...result
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Migration DSL generation failed:', error);
    
    return new Response(JSON.stringify({
      error: 'DSL_GENERATION_FAILED',
      message: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Edge Function configuration
 */
export const config = {
  path: '/wesley/*'
};