/**
 * Golden snapshot tests for migration generation
 * Ensures migrations are generated consistently
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { MigrationDiffEngine } from '../../src/domain/generators/MigrationDiffEngine.mjs';

test('generates add table migration', () => {
  const engine = new MigrationDiffEngine();
  
  const oldSchema = {
    tables: {}
  };
  
  const newSchema = {
    tables: {
      User: {
        name: 'User',
        uid: 'user_001',
        fields: [
          { name: 'id', type: 'ID', required: true, directives: { primaryKey: true } },
          { name: 'email', type: 'String', required: true }
        ]
      }
    }
  };
  
  const migration = engine.generateMigration(oldSchema, newSchema);
  
  assert(migration.up.includes('CREATE TABLE IF NOT EXISTS "User"'));
  assert(migration.down.includes('DROP TABLE IF EXISTS "User"'));
  assert.strictEqual(migration.operations.length, 1);
  assert.strictEqual(migration.operations[0].type, 'CREATE_TABLE');
});

test('generates add column migration', () => {
  const engine = new MigrationDiffEngine();
  
  const oldSchema = {
    tables: {
      User: {
        name: 'User',
        uid: 'user_001',
        fields: [
          { name: 'id', type: 'ID', required: true, directives: { primaryKey: true } }
        ]
      }
    }
  };
  
  const newSchema = {
    tables: {
      User: {
        name: 'User',
        uid: 'user_001',
        fields: [
          { name: 'id', type: 'ID', required: true, directives: { primaryKey: true } },
          { name: 'email', type: 'String', required: true }
        ]
      }
    }
  };
  
  const migration = engine.generateMigration(oldSchema, newSchema);
  
  assert(migration.up.includes('ALTER TABLE "User" ADD COLUMN "email"'));
  assert(migration.down.includes('ALTER TABLE "User" DROP COLUMN "email"'));
});

test('generates rename detection with @uid', () => {
  const engine = new MigrationDiffEngine();
  
  const oldSchema = {
    tables: {
      Users: {
        name: 'Users',
        uid: 'user_001',
        fields: [
          { name: 'id', type: 'ID', uid: 'field_001', required: true }
        ]
      }
    }
  };
  
  const newSchema = {
    tables: {
      User: {  // Renamed from Users
        name: 'User',
        uid: 'user_001',  // Same UID = rename
        fields: [
          { name: 'id', type: 'ID', uid: 'field_001', required: true }
        ]
      }
    }
  };
  
  const migration = engine.generateMigration(oldSchema, newSchema);
  
  assert(migration.up.includes('ALTER TABLE "Users" RENAME TO "User"'));
  assert(migration.down.includes('ALTER TABLE "User" RENAME TO "Users"'));
  assert.strictEqual(migration.operations[0].type, 'RENAME_TABLE');
});

test('generates index migrations', () => {
  const engine = new MigrationDiffEngine();
  
  const oldSchema = {
    tables: {
      Product: {
        name: 'Product',
        uid: 'product_001',
        fields: [
          { name: 'id', type: 'ID', required: true, directives: { primaryKey: true } },
          { name: 'sku', type: 'String', required: true }
        ]
      }
    }
  };
  
  const newSchema = {
    tables: {
      Product: {
        name: 'Product',
        uid: 'product_001',
        fields: [
          { name: 'id', type: 'ID', required: true, directives: { primaryKey: true } },
          { name: 'sku', type: 'String', required: true, directives: { index: true } }
        ]
      }
    }
  };
  
  const migration = engine.generateMigration(oldSchema, newSchema);
  
  assert(migration.up.includes('CREATE INDEX IF NOT EXISTS "idx_Product_sku"'));
  assert(migration.down.includes('DROP INDEX IF EXISTS "idx_Product_sku"'));
});

test('calculates migration risk correctly', () => {
  const engine = new MigrationDiffEngine();
  
  // High risk: dropping table
  const dropTableMigration = {
    operations: [
      { type: 'DROP_TABLE', risk: 'high' }
    ]
  };
  
  const risk1 = engine.calculateRisk(dropTableMigration);
  assert(risk1 > 0.8, 'Dropping table should be high risk');
  
  // Low risk: adding column
  const addColumnMigration = {
    operations: [
      { type: 'ADD_COLUMN', risk: 'low' }
    ]
  };
  
  const risk2 = engine.calculateRisk(addColumnMigration);
  assert(risk2 < 0.3, 'Adding column should be low risk');
  
  // Medium risk: changing column type
  const changeTypeMigration = {
    operations: [
      { type: 'ALTER_COLUMN_TYPE', risk: 'medium' }
    ]
  };
  
  const risk3 = engine.calculateRisk(changeTypeMigration);
  assert(risk3 > 0.3 && risk3 < 0.7, 'Changing type should be medium risk');
});