/**
 * Migration Checkpoint Recovery Integration Tests
 * Tests for checkpoint creation, recovery, and state management
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { createHash } from 'node:crypto';
import { Schema, Table, Field } from '../../src/domain/Schema.mjs';
import { MockDatabase, createTestSchema } from '../helpers/database.mjs';

/**
 * Checkpoint manager for managing migration checkpoints
 */
class CheckpointManager {
  constructor(database) {
    this.db = database;
    this.checkpoints = new Map();
  }
  
  /**
   * Create a checkpoint of the current schema state
   */
  async createCheckpoint(name, schema, metadata = {}) {
    const checkpointId = this.generateCheckpointId(name);
    const timestamp = new Date();
    
    const checkpoint = {
      id: checkpointId,
      name,
      timestamp,
      schema: this.serializeSchema(schema),
      metadata,
      hash: this.generateSchemaHash(schema)
    };
    
    // Store checkpoint in database (simulated)
    await this.db.query(
      'INSERT INTO wesley_checkpoints (id, name, timestamp, schema_data, metadata, schema_hash) VALUES ($1, $2, $3, $4, $5, $6)',
      [checkpointId, name, timestamp, JSON.stringify(checkpoint.schema), JSON.stringify(metadata), checkpoint.hash]
    );
    
    this.checkpoints.set(checkpointId, checkpoint);
    return checkpoint;
  }
  
  /**
   * Restore to a specific checkpoint
   */
  async restoreToCheckpoint(checkpointId) {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint ${checkpointId} not found`);
    }
    
    const schema = this.deserializeSchema(checkpoint.schema);
    
    // In real implementation, this would generate and execute rollback DDL
    await this.db.query('-- Restore to checkpoint: ' + checkpoint.name);
    
    return schema;
  }
  
  /**
   * List all available checkpoints
   */
  async listCheckpoints() {
    const result = await this.db.query(
      'SELECT id, name, timestamp, metadata, schema_hash FROM wesley_checkpoints ORDER BY timestamp DESC'
    );
    
    return result.rows;
  }
  
  /**
   * Delete a checkpoint
   */
  async deleteCheckpoint(checkpointId) {
    await this.db.query('DELETE FROM wesley_checkpoints WHERE id = $1', [checkpointId]);
    this.checkpoints.delete(checkpointId);
  }
  
  generateCheckpointId(name) {
    return createHash('sha256')
      .update(name + Date.now() + Math.random())
      .digest('hex')
      .substring(0, 16);
  }
  
  generateSchemaHash(schema) {
    const serialized = this.serializeSchema(schema);
    return createHash('sha256')
      .update(JSON.stringify(serialized))
      .digest('hex');
  }
  
  serializeSchema(schema) {
    return {
      tables: Object.fromEntries(
        Object.entries(schema.tables).map(([name, table]) => [
          name,
          {
            name: table.name,
            fields: Object.fromEntries(
              Object.entries(table.fields).map(([fieldName, field]) => [
                fieldName,
                {
                  name: field.name,
                  type: field.type,
                  nonNull: field.nonNull,
                  itemNonNull: field.itemNonNull,
                  directives: field.directives
                }
              ])
            )
          }
        ])
      )
    };
  }
  
  deserializeSchema(schemaData) {
    const tables = {};
    
    for (const [tableName, tableData] of Object.entries(schemaData.tables)) {
      const fields = {};
      
      for (const [fieldName, fieldData] of Object.entries(tableData.fields)) {
        fields[fieldName] = new Field({
          name: fieldData.name,
          type: fieldData.type,
          nonNull: fieldData.nonNull,
          itemNonNull: fieldData.itemNonNull,
          directives: fieldData.directives
        });
      }
      
      tables[tableName] = new Table({
        name: tableData.name,
        fields
      });
    }
    
    return new Schema(tables);
  }
}

test('checkpoint: create and restore simple checkpoint', async () => {
  const db = new MockDatabase();
  const checkpointManager = new CheckpointManager(db);
  
  // Mock checkpoint storage
  db.mockResult('insert into wesley_checkpoints', { rowCount: 1 });
  db.mockResult('-- restore to checkpoint', { rowCount: 0 });
  
  const schema = new Schema({
    User: new Table({
      name: 'User',
      fields: {
        id: new Field({
          name: 'id',
          type: 'UUID',
          nonNull: true,
          directives: { '@primaryKey': {} }
        }),
        email: new Field({
          name: 'email',
          type: 'String',
          nonNull: true
        })
      }
    })
  });
  
  // Create checkpoint
  const checkpoint = await checkpointManager.createCheckpoint('initial-schema', schema, {
    migration: 'v1.0.0',
    author: 'test-automator'
  });
  
  assert(checkpoint.id);
  assert.equal(checkpoint.name, 'initial-schema');
  assert(checkpoint.timestamp instanceof Date);
  assert(checkpoint.schema.tables.User);
  assert.equal(checkpoint.metadata.migration, 'v1.0.0');
  
  // Restore from checkpoint
  const restoredSchema = await checkpointManager.restoreToCheckpoint(checkpoint.id);
  
  assert(restoredSchema.tables.User);
  assert(restoredSchema.tables.User.fields.id);
  assert(restoredSchema.tables.User.fields.email);
  
  // Verify database operations
  const queries = db.getQueries();
  assert(queries.some(q => q.sql.includes('INSERT INTO wesley_checkpoints')));
  assert(queries.some(q => q.sql.includes('-- Restore to checkpoint')));
});

test('checkpoint: multiple checkpoints with evolution tracking', async () => {
  const db = new MockDatabase();
  const checkpointManager = new CheckpointManager(db);
  
  db.mockResult('insert into wesley_checkpoints', { rowCount: 1 });
  
  // Checkpoint 1: Initial schema
  const schemaV1 = new Schema({
    User: new Table({
      name: 'User',
      fields: {
        id: new Field({
          name: 'id',
          type: 'UUID',
          nonNull: true,
          directives: { '@primaryKey': {} }
        })
      }
    })
  });
  
  const checkpoint1 = await checkpointManager.createCheckpoint('v1-initial', schemaV1, {
    version: '1.0.0',
    migration_count: 1
  });
  
  // Checkpoint 2: Added email field
  const schemaV2 = new Schema({
    User: new Table({
      name: 'User',
      fields: {
        id: new Field({
          name: 'id',
          type: 'UUID',
          nonNull: true,
          directives: { '@primaryKey': {} }
        }),
        email: new Field({
          name: 'email',
          type: 'String',
          nonNull: true,
          directives: { '@unique': {} }
        })
      }
    })
  });
  
  const checkpoint2 = await checkpointManager.createCheckpoint('v2-add-email', schemaV2, {
    version: '1.1.0',
    migration_count: 2,
    changes: ['add_column: User.email']
  });
  
  // Checkpoint 3: Added Organization table
  const schemaV3 = new Schema({
    User: new Table({
      name: 'User',
      fields: {
        id: new Field({
          name: 'id',
          type: 'UUID',
          nonNull: true,
          directives: { '@primaryKey': {} }
        }),
        email: new Field({
          name: 'email',
          type: 'String',
          nonNull: true,
          directives: { '@unique': {} }
        })
      }
    }),
    Organization: new Table({
      name: 'Organization',
      fields: {
        id: new Field({
          name: 'id',
          type: 'UUID',
          nonNull: true,
          directives: { '@primaryKey': {} }
        }),
        name: new Field({
          name: 'name',
          type: 'String',
          nonNull: true
        })
      }
    })
  });
  
  const checkpoint3 = await checkpointManager.createCheckpoint('v3-add-org', schemaV3, {
    version: '1.2.0',
    migration_count: 3,
    changes: ['create_table: Organization']
  });
  
  // Verify checkpoints are different
  assert.notEqual(checkpoint1.hash, checkpoint2.hash);
  assert.notEqual(checkpoint2.hash, checkpoint3.hash);
  assert.notEqual(checkpoint1.hash, checkpoint3.hash);
  
  // Verify checkpoint progression
  assert.equal(checkpoint1.metadata.migration_count, 1);
  assert.equal(checkpoint2.metadata.migration_count, 2);
  assert.equal(checkpoint3.metadata.migration_count, 3);
  
  // Restore to middle checkpoint
  db.mockResult('-- restore to checkpoint', { rowCount: 0 });
  const restoredV2 = await checkpointManager.restoreToCheckpoint(checkpoint2.id);
  
  // Should have User with email but no Organization
  assert(restoredV2.tables.User);
  assert(restoredV2.tables.User.fields.email);
  assert(!restoredV2.tables.Organization);
  
  const queries = db.getQueries();
  assert.equal(queries.filter(q => q.sql.includes('INSERT INTO wesley_checkpoints')).length, 3);
});

test('checkpoint: recovery from corrupted migration', async () => {
  const db = new MockDatabase();
  const checkpointManager = new CheckpointManager(db);
  
  db.mockResult('insert into wesley_checkpoints', { rowCount: 1 });
  
  // Create checkpoint before risky migration
  const stableSchema = new Schema({
    User: new Table({
      name: 'User',
      fields: {
        id: new Field({
          name: 'id',
          type: 'UUID',
          nonNull: true,
          directives: { '@primaryKey': {} }
        }),
        email: new Field({
          name: 'email',
          type: 'String',
          nonNull: true
        })
      }
    })
  });
  
  const preRiskyCheckpoint = await checkpointManager.createCheckpoint('pre-risky-migration', stableSchema, {
    version: '1.5.0',
    risk_level: 'high',
    description: 'Before attempting column type change'
  });
  
  // Simulate failed migration attempt
  db.mockError('column "email" cannot be cast automatically to type uuid');
  
  let migrationFailed = false;
  try {
    // This would be a risky migration (changing email from text to uuid)
    await db.query('ALTER TABLE users ALTER COLUMN email TYPE uuid USING email::uuid');
  } catch (error) {
    migrationFailed = true;
    
    // Recovery: restore from checkpoint
    db.reset(); // Clear error state
    db.mockResult('-- restore to checkpoint', { rowCount: 0 });
    
    const recoveredSchema = await checkpointManager.restoreToCheckpoint(preRiskyCheckpoint.id);
    
    // Verify recovery worked
    assert(recoveredSchema.tables.User);
    assert.equal(recoveredSchema.tables.User.fields.email.type, 'String');
  }
  
  assert(migrationFailed, 'Expected migration to fail');
  
  const queries = db.getQueries();
  assert(queries.some(q => q.sql.includes('-- Restore to checkpoint')));
});

test('checkpoint: automatic checkpoint creation before destructive operations', async () => {
  const db = new MockDatabase();
  const checkpointManager = new CheckpointManager(db);
  
  db.mockResult('insert into wesley_checkpoints', { rowCount: 1 });
  
  const schema = new Schema({
    User: new Table({
      name: 'User',
      fields: {
        id: new Field({
          name: 'id',
          type: 'UUID',
          nonNull: true,
          directives: { '@primaryKey': {} }
        }),
        email: new Field({
          name: 'email',
          type: 'String',
          nonNull: true
        }),
        deprecated_field: new Field({
          name: 'deprecated_field',
          type: 'String',
          nonNull: false
        })
      }
    })
  });
  
  // Create automatic checkpoint before destructive operation
  const destructiveOps = ['DROP_TABLE', 'DROP_COLUMN', 'ALTER_COLUMN_TYPE'];
  const plannedOperation = 'DROP_COLUMN';
  
  if (destructiveOps.includes(plannedOperation)) {
    const autoCheckpoint = await checkpointManager.createCheckpoint(
      `auto-before-${plannedOperation.toLowerCase()}-${Date.now()}`,
      schema,
      {
        auto_created: true,
        operation_type: plannedOperation,
        target: 'User.deprecated_field',
        risk_level: 'high'
      }
    );
    
    assert(autoCheckpoint.metadata.auto_created);
    assert.equal(autoCheckpoint.metadata.operation_type, 'DROP_COLUMN');
    assert.equal(autoCheckpoint.metadata.risk_level, 'high');
  }
  
  // Mock the destructive operation
  db.mockResult('alter table drop column', { rowCount: 0 });
  await db.query('ALTER TABLE users DROP COLUMN deprecated_field');
  
  const queries = db.getQueries();
  assert(queries.some(q => q.sql.includes('INSERT INTO wesley_checkpoints')));
  assert(queries.some(q => q.sql.includes('DROP COLUMN')));
});

test('checkpoint: cleanup old checkpoints', async () => {
  const db = new MockDatabase();
  const checkpointManager = new CheckpointManager(db);
  
  db.mockResult('insert into wesley_checkpoints', { rowCount: 1 });
  db.mockResult('delete from wesley_checkpoints', { rowCount: 1 });
  
  const schema = new Schema({
    User: new Table({
      name: 'User',
      fields: {
        id: new Field({
          name: 'id',
          type: 'UUID',
          nonNull: true,
          directives: { '@primaryKey': {} }
        })
      }
    })
  });
  
  // Create multiple checkpoints
  const checkpoints = [];
  for (let i = 0; i < 5; i++) {
    const checkpoint = await checkpointManager.createCheckpoint(`test-checkpoint-${i}`, schema, {
      sequence: i
    });
    checkpoints.push(checkpoint);
  }
  
  // Delete old checkpoints (keep only latest 3)
  const keepCount = 3;
  const toDelete = checkpoints.slice(0, checkpoints.length - keepCount);
  
  for (const checkpoint of toDelete) {
    await checkpointManager.deleteCheckpoint(checkpoint.id);
  }
  
  // Verify deletions
  const queries = db.getQueries();
  const deleteQueries = queries.filter(q => q.sql.includes('DELETE FROM wesley_checkpoints'));
  assert.equal(deleteQueries.length, toDelete.length);
});

test('checkpoint: checkpoint integrity verification', async () => {
  const db = new MockDatabase();
  const checkpointManager = new CheckpointManager(db);
  
  db.mockResult('insert into wesley_checkpoints', { rowCount: 1 });
  
  const schema = new Schema({
    User: new Table({
      name: 'User',
      fields: {
        id: new Field({
          name: 'id',
          type: 'UUID',
          nonNull: true,
          directives: { '@primaryKey': {} }
        }),
        email: new Field({
          name: 'email',
          type: 'String',
          nonNull: true
        })
      }
    })
  });
  
  const checkpoint = await checkpointManager.createCheckpoint('integrity-test', schema);
  
  // Verify schema hash
  const recomputedHash = checkpointManager.generateSchemaHash(schema);
  assert.equal(checkpoint.hash, recomputedHash, 'Schema hash should be consistent');
  
  // Serialize and deserialize to test integrity
  const serialized = checkpointManager.serializeSchema(schema);
  const deserialized = checkpointManager.deserializeSchema(serialized);
  
  // Compare key properties
  assert.equal(Object.keys(schema.tables).length, Object.keys(deserialized.tables).length);
  assert(deserialized.tables.User);
  assert(deserialized.tables.User.fields.id);
  assert(deserialized.tables.User.fields.email);
  
  // Field properties should be preserved
  const originalField = schema.tables.User.fields.email;
  const deserializedField = deserialized.tables.User.fields.email;
  
  assert.equal(originalField.name, deserializedField.name);
  assert.equal(originalField.type, deserializedField.type);
  assert.equal(originalField.nonNull, deserializedField.nonNull);
});

test('checkpoint: concurrent checkpoint operations', async () => {
  const db = new MockDatabase();
  const checkpointManager = new CheckpointManager(db);
  
  db.mockResult('insert into wesley_checkpoints', { rowCount: 1 });
  
  const schema1 = new Schema({
    User: new Table({
      name: 'User',
      fields: {
        id: new Field({
          name: 'id',
          type: 'UUID',
          nonNull: true,
          directives: { '@primaryKey': {} }
        })
      }
    })
  });
  
  const schema2 = new Schema({
    Organization: new Table({
      name: 'Organization',
      fields: {
        id: new Field({
          name: 'id',
          type: 'UUID',
          nonNull: true,
          directives: { '@primaryKey': {} }
        })
      }
    })
  });
  
  // Simulate concurrent checkpoint creation
  const [checkpoint1, checkpoint2] = await Promise.all([
    checkpointManager.createCheckpoint('concurrent-1', schema1, { thread: 1 }),
    checkpointManager.createCheckpoint('concurrent-2', schema2, { thread: 2 })
  ]);
  
  // Should create different checkpoints
  assert.notEqual(checkpoint1.id, checkpoint2.id);
  assert.notEqual(checkpoint1.hash, checkpoint2.hash);
  assert.equal(checkpoint1.metadata.thread, 1);
  assert.equal(checkpoint2.metadata.thread, 2);
  
  // Should both be stored
  const queries = db.getQueries();
  assert.equal(queries.filter(q => q.sql.includes('INSERT INTO wesley_checkpoints')).length, 2);
});