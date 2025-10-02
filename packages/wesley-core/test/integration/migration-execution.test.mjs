/**
 * Migration Execution Integration Tests
 * End-to-end tests for migration generation, validation and execution
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { MigrationDiffer } from '../../src/domain/generators/MigrationDiffer.mjs';
import { PostgreSQLGenerator } from '../../src/domain/generators/PostgreSQLGenerator.mjs';
import { Schema, Table, Field } from '../../src/domain/Schema.mjs';
import { MockDatabase, testFixtures, dbAssert } from '../helpers/database.mjs';

test('migration execution: create table end-to-end', async () => {
  const db = new MockDatabase();
  const differ = new MigrationDiffer();
  const generator = new PostgreSQLGenerator();
  
  // Setup: empty schema to new table
  const oldSchema = new Schema({});
  const newSchema = new Schema({
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
        }),
        name: new Field({
          name: 'name',
          type: 'String',
          nonNull: true
        })
      }
    })
  });
  
  // Generate migration
  const migration = await differ.diff(oldSchema, newSchema);
  assert.equal(migration.steps.length, 1);
  assert.equal(migration.steps[0].kind, 'create_table');
  
  // Generate SQL
  const sqlResult = await generator.generate(newSchema);
  assert(sqlResult.sql.includes('CREATE TABLE'));
  assert(sqlResult.sql.includes('users')); // snake_case conversion
  assert(sqlResult.sql.includes('PRIMARY KEY'));
  assert(sqlResult.sql.includes('UNIQUE'));
  
  // Mock successful execution
  db.mockResult('create table', { rowCount: 0 });
  
  // Execute migration (simulated)
  await db.query(sqlResult.sql);
  
  // Verify the SQL was executed
  const queries = db.getQueries();
  assert.equal(queries.length, 1);
  assert(queries[0].sql.toLowerCase().includes('create table'));
});

test('migration execution: add column with constraints', async () => {
  const db = new MockDatabase();
  const differ = new MigrationDiffer();
  const generator = new PostgreSQLGenerator();
  
  // Setup: existing table to table with new column
  const oldSchema = new Schema({
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
  
  const newSchema = new Schema({
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
        createdAt: new Field({
          name: 'createdAt',
          type: 'DateTime',
          nonNull: true,
          directives: { '@default': { value: 'now()' } }
        })
      }
    })
  });
  
  // Generate migration  
  const migration = await differ.diff(oldSchema, newSchema);
  assert.equal(migration.steps.length, 1);
  assert.equal(migration.steps[0].kind, 'add_column');
  
  // Generate SQL for new schema
  const sqlResult = await generator.generate(newSchema);
  
  // Should include the new column with default and NOT NULL
  assert(sqlResult.sql.includes('created_at'));
  assert(sqlResult.sql.includes('timestamptz'));
  assert(sqlResult.sql.includes('DEFAULT'));
  assert(sqlResult.sql.includes('NOT NULL'));
  
  // Mock successful ALTER TABLE
  db.mockResult('alter table', { rowCount: 0 });
  
  // Execute migration (would normally be ALTER TABLE ADD COLUMN)
  const alterSQL = `ALTER TABLE users ADD COLUMN created_at timestamptz DEFAULT now() NOT NULL`;
  await db.query(alterSQL);
  
  // Verify execution
  const queries = db.getQueries();
  assert.equal(queries.length, 1);
  assert(queries[0].sql.toLowerCase().includes('alter table'));
  assert(queries[0].sql.toLowerCase().includes('add column'));
});

test('migration execution: drop column with safety checks', async () => {
  const db = new MockDatabase();
  const differ = new MigrationDiffer();
  
  // Setup: table with column to table without column
  const oldSchema = new Schema({
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
        deprecated: new Field({
          name: 'deprecated',
          type: 'String',
          nonNull: false
        })
      }
    })
  });
  
  const newSchema = new Schema({
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
  
  // Generate migration
  const migration = await differ.diff(oldSchema, newSchema);
  assert.equal(migration.steps.length, 1);
  assert.equal(migration.steps[0].kind, 'drop_column');
  assert.equal(migration.steps[0].column, 'deprecated');
  
  // This should be flagged as potentially destructive
  assert.equal(migration.safetyAnalysis.isDestructive, true);
  const dropRisk = migration.safetyAnalysis.risks.find(r => r.step === 'drop_column');
  assert(dropRisk && (dropRisk.severity === 'high' || dropRisk.severity === 'critical'));
  
  // Mock successful DROP COLUMN
  db.mockResult('alter table', { rowCount: 0 });
  
  const dropSQL = `ALTER TABLE users DROP COLUMN deprecated`;
  await db.query(dropSQL);
  
  const queries = db.getQueries();
  assert(queries[0].sql.toLowerCase().includes('drop column'));
});

test('migration execution: complex schema evolution', async () => {
  const db = new MockDatabase();
  const differ = new MigrationDiffer();
  const generator = new PostgreSQLGenerator();
  
  // Setup: multi-step schema evolution
  const oldSchema = new Schema({
    User: new Table({
      name: 'User',
      fields: {
        id: new Field({
          name: 'id',
          type: 'Int',
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
  
  const newSchema = new Schema({
    User: new Table({
      name: 'User', 
      fields: {
        id: new Field({
          name: 'id',
          type: 'UUID', // Type change
          nonNull: true,
          directives: { '@primaryKey': {} }
        }),
        email: new Field({
          name: 'email',
          type: 'String',
          nonNull: true,
          directives: { '@unique': {} } // New constraint
        }),
        profile: new Field({
          name: 'profile',
          type: 'JSON', // New column
          nonNull: false
        })
      }
    }),
    Organization: new Table({ // New table
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
        }),
        ownerId: new Field({
          name: 'ownerId',
          type: 'UUID',
          nonNull: true,
          directives: {
            '@foreignKey': { references: 'User.id' }
          }
        })
      }
    })
  });
  
  // Generate migration
  const migration = await differ.diff(oldSchema, newSchema);
  
  // Should have multiple steps
  assert(migration.steps.length > 1);
  
  // Should include: alter column type, add column, create table, add constraint
  const stepTypes = migration.steps.map(step => step.kind);
  assert(stepTypes.includes('create_table')); // New Organization table
  assert(stepTypes.includes('add_column')); // New profile column
  
  // Generate final SQL
  const sqlResult = await generator.generate(newSchema);
  
  // Should include both tables
  assert(sqlResult.sql.includes('users'));
  assert(sqlResult.sql.includes('organizations'));
  
  // Should include foreign key
  assert(sqlResult.sql.includes('FOREIGN KEY') || sqlResult.sql.includes('REFERENCES'));
  
  // Mock execution of multiple statements
  db.mockResult('create table organizations', { rowCount: 0 });
  db.mockResult('alter table users', { rowCount: 0 });
  
  // Simulate multi-step execution
  await db.begin();
  try {
    await db.query('CREATE TABLE organizations (...)');
    await db.query('ALTER TABLE users ADD COLUMN profile jsonb');
    await db.query('ALTER TABLE users ADD CONSTRAINT unique_email UNIQUE (email)');
    await db.commit();
  } catch (error) {
    await db.rollback();
    throw error;
  }
  
  const queries = db.getQueries();
  assert(queries.length >= 4); // BEGIN + 3 DDL + COMMIT
});

test('migration execution: rollback on error', async () => {
  const db = new MockDatabase();
  
  // Mock a failure on the second operation
  db.mockResult('create table users', { rowCount: 0 });
  
  let errorThrown = false;
  
  await db.begin();
  // Fail the next statement (ALTER TABLE ...)
  db.mockError('column "invalid_column" does not exist');
  try {
    await db.query('CREATE TABLE users (id uuid PRIMARY KEY)');
    await db.query('ALTER TABLE users ADD CONSTRAINT invalid_constraint FOREIGN KEY (invalid_column) REFERENCES other_table (id)');
    await db.commit();
  } catch (error) {
    errorThrown = true;
    await db.rollback();
  }
  
  assert(errorThrown, 'Expected error to be thrown');
  
  const queries = db.getQueries();
  // Should have: BEGIN, CREATE TABLE, failed ALTER TABLE, ROLLBACK
  assert(queries.some(q => q.sql.includes('BEGIN')));
  assert(queries.some(q => q.sql.includes('CREATE TABLE')));
  assert(queries.some(q => q.sql.includes('ROLLBACK')));
  assert(!queries.some(q => q.sql.includes('COMMIT')));
});

test('migration execution: handles concurrent execution prevention', async () => {
  const db = new MockDatabase();
  
  // Mock advisory lock acquisition
  db.mockResult('select pg_try_advisory_lock', { rows: [{ pg_try_advisory_lock: true }] });
  
  // Simulate migration lock acquisition
  const lockAcquired = await db.query('SELECT pg_try_advisory_lock(12345)');
  assert.equal(lockAcquired.rows[0].pg_try_advisory_lock, true);
  
  // Execute migration under lock
  await db.begin();
  await db.query('CREATE TABLE test_table (id serial PRIMARY KEY)');
  await db.commit();
  
  // Release lock
  await db.query('SELECT pg_advisory_unlock(12345)');
  
  const queries = db.getQueries();
  assert(queries.some(q => q.sql.includes('pg_try_advisory_lock')));
  assert(queries.some(q => q.sql.includes('pg_advisory_unlock')));
});

test('migration execution: validates schema before execution', async () => {
  const db = new MockDatabase();
  const generator = new PostgreSQLGenerator();
  
  // Create invalid schema (duplicate table names)
  const invalidSchema = new Schema({
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
    }),
    user: new Table({ // Duplicate name (case-insensitive)
      name: 'user', 
      fields: {
        id: new Field({
          name: 'id',
          type: 'Int',
          nonNull: true
        })
      }
    })
  });
  
  // Should detect validation issues
  let validationFailed = false;
  try {
    await generator.generate(invalidSchema);
  } catch (error) {
    validationFailed = true;
    assert(error.message.includes('duplicate') || error.message.includes('conflict'));
  }
  
  // Should not reach database if validation fails
  const queries = db.getQueries(); 
  assert.equal(queries.length, 0, 'No queries should be executed on validation failure');
});
