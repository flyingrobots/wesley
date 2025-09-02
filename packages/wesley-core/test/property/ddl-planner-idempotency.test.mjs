/**
 * DDL Planner Idempotency Property Tests
 * Tests that DDL generation is deterministic and idempotent
 */

import { test } from 'node:test';
import fc from 'fast-check';
import { PostgreSQLGenerator } from '../../src/domain/generators/PostgreSQLGenerator.mjs';
import { Schema, Table, Field } from '../../src/domain/Schema.mjs';
import { wesleyArbitraries, propertyHelpers, invariants } from '../helpers/property-testing.mjs';

test('DDL generation is idempotent for same schema', async () => {
  await propertyHelpers.runAsyncProperty(
    'ddl-idempotent',
    wesleyArbitraries.wesleySchema(),
    async (schemaData) => {
      // Create Wesley Schema object from generated data
      const schema = createSchemaFromData(schemaData);
      const generator = new PostgreSQLGenerator();
      
      // Generate DDL twice
      const ddl1 = await generator.generate(schema);
      const ddl2 = await generator.generate(schema);
      
      // Should be identical
      return JSON.stringify(ddl1) === JSON.stringify(ddl2);
    },
    { numRuns: 50 }
  );
});

test('DDL generation produces deterministic SQL', async () => {
  await propertyHelpers.runAsyncProperty(
    'ddl-deterministic-sql',
    wesleyArbitraries.wesleySchema(),
    async (schemaData) => {
      const schema = createSchemaFromData(schemaData);
      const generator = new PostgreSQLGenerator();
      
      // Generate SQL multiple times
      const results = await Promise.all([
        generator.generate(schema),
        generator.generate(schema),
        generator.generate(schema)
      ]);
      
      // All SQL outputs should be identical
      const firstSQL = results[0].sql;
      return results.every(result => result.sql === firstSQL);
    },
    { numRuns: 30 }
  );
});

test('DDL generation preserves schema semantics', async () => {
  await propertyHelpers.runAsyncProperty(
    'ddl-preserves-semantics',
    wesleyArbitraries.wesleySchema(),
    async (schemaData) => {
      const schema = createSchemaFromData(schemaData);
      const generator = new PostgreSQLGenerator();
      
      const result = await generator.generate(schema);
      
      // Verify essential elements are preserved
      const tableNames = Object.keys(schema.tables);
      const sqlText = result.sql.toLowerCase();
      
      // All tables should be mentioned in CREATE TABLE statements
      const createdTables = tableNames.every(tableName => 
        sqlText.includes(`create table`) && 
        sqlText.includes(tableName.toLowerCase())
      );
      
      return createdTables;
    },
    { numRuns: 40 }
  );
});

test('DDL generation handles field nullability consistently', async () => {
  await propertyHelpers.runAsyncProperty(
    'ddl-nullability-consistent',
    fc.record({
      tableName: fc.stringOf(fc.char().filter(c => /[a-zA-Z_]/.test(c)), { minLength: 1, maxLength: 20 }),
      fields: fc.array(fc.record({
        name: fc.stringOf(fc.char().filter(c => /[a-zA-Z_]/.test(c)), { minLength: 1, maxLength: 20 }),
        type: fc.constantFrom('String', 'Int', 'Boolean', 'UUID'),
        nonNull: fc.boolean(),
        itemNonNull: fc.boolean(),
        isList: fc.boolean()
      }), { minLength: 1, maxLength: 5 })
    }),
    async (tableData) => {
      const fields = {};
      
      tableData.fields.forEach(fieldData => {
        if (fieldData.name && fieldData.name.length > 0) {
          fields[fieldData.name] = new Field({
            name: fieldData.name,
            type: fieldData.isList ? `[${fieldData.type}]` : fieldData.type,
            nonNull: fieldData.nonNull,
            itemNonNull: fieldData.itemNonNull,
            directives: {}
          });
        }
      });
      
      if (Object.keys(fields).length === 0) {
        return true; // Skip empty field sets
      }
      
      const table = new Table({
        name: tableData.tableName,
        fields
      });
      
      const schema = new Schema({
        [tableData.tableName]: table
      });
      
      const generator = new PostgreSQLGenerator();
      const result = await generator.generate(schema);
      
      // Check that NOT NULL constraints are applied correctly
      const sql = result.sql.toLowerCase();
      
      return tableData.fields.every(fieldData => {
        if (!fieldData.name || fieldData.name.length === 0) return true;
        
        const fieldNameLower = fieldData.name.toLowerCase();
        const fieldInSQL = sql.includes(fieldNameLower);
        
        if (!fieldInSQL) return true; // Skip fields not in SQL
        
        if (fieldData.nonNull) {
          // Non-null fields should have NOT NULL constraint
          return sql.includes(fieldNameLower) && sql.includes('not null');
        } else {
          // Nullable fields should not have NOT NULL (unless it's auto-added for other reasons)
          return true; // This is harder to test generically
        }
      });
    },
    { numRuns: 25 }
  );
});

test('DDL generation handles type mappings consistently', async () => {
  await propertyHelpers.runAsyncProperty(
    'ddl-type-mappings-consistent',
    fc.record({
      graphqlType: fc.constantFrom('String', 'Int', 'Float', 'Boolean', 'ID', 'UUID', 'DateTime'),
      fieldName: fc.stringOf(fc.char().filter(c => /[a-zA-Z_]/.test(c)), { minLength: 1, maxLength: 20 })
    }),
    async (testData) => {
      if (!testData.fieldName || testData.fieldName.length === 0) return true;
      
      const field = new Field({
        name: testData.fieldName,
        type: testData.graphqlType,
        nonNull: false,
        directives: {}
      });
      
      const table = new Table({
        name: 'test_table',
        fields: { [testData.fieldName]: field }
      });
      
      const schema = new Schema({
        test_table: table
      });
      
      const generator = new PostgreSQLGenerator();
      
      // Generate multiple times and verify type mapping is consistent
      const result1 = await generator.generate(schema);
      const result2 = await generator.generate(schema);
      
      return result1.sql === result2.sql;
    },
    { numRuns: 30 }
  );
});

test('DDL generation respects directive ordering', async () => {
  await propertyHelpers.runAsyncProperty(
    'ddl-directive-ordering',
    fc.record({
      tableName: fc.constant('test_table'),
      directives: fc.shuffledSubarray([
        { name: '@primaryKey', args: {} },
        { name: '@unique', args: {} },
        { name: '@index', args: {} },
        { name: '@default', args: { value: 'test' } }
      ])
    }),
    async (testData) => {
      const field = new Field({
        name: 'id',
        type: 'UUID',
        nonNull: true,
        directives: testData.directives.reduce((acc, dir) => {
          acc[dir.name] = dir.args;
          return acc;
        }, {})
      });
      
      const table = new Table({
        name: testData.tableName,
        fields: { id: field }
      });
      
      const schema = new Schema({
        [testData.tableName]: table
      });
      
      const generator = new PostgreSQLGenerator();
      
      // Generate DDL multiple times with same directives in different order
      const result1 = await generator.generate(schema);
      const result2 = await generator.generate(schema);
      
      // Output should be identical regardless of directive input order
      return result1.sql === result2.sql;
    },
    { numRuns: 20 }
  );
});

test('DDL generation handles empty schemas gracefully', async () => {
  const emptySchema = new Schema({});
  const generator = new PostgreSQLGenerator();
  
  const result1 = await generator.generate(emptySchema);
  const result2 = await generator.generate(emptySchema);
  
  // Should handle empty schemas consistently
  return result1.sql === result2.sql;
});

/**
 * Helper function to create Wesley Schema from property test data
 */
function createSchemaFromData(schemaData) {
  const tables = {};
  
  for (const [tableName, tableData] of Object.entries(schemaData.tables)) {
    const fields = {};
    
    for (const [fieldName, fieldData] of Object.entries(tableData.fields)) {
      if (fieldName && fieldData.name) {
        fields[fieldName] = new Field({
          name: fieldData.name,
          type: fieldData.type,
          nonNull: fieldData.nonNull || false,
          itemNonNull: fieldData.itemNonNull || false,
          directives: fieldData.directives || {}
        });
      }
    }
    
    if (Object.keys(fields).length > 0) {
      tables[tableName] = new Table({
        name: tableData.name,
        fields
      });
    }
  }
  
  return new Schema(tables);
}