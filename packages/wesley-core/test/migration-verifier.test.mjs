/**
 * Migration Verifier Tests
 * Tests for post-migration validation, checksum verification, and schema comparison
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { 
  MigrationVerifier, 
  MigrationVerificationError, 
  ChecksumMismatchError, 
  SchemaComparisonError,
  DataIntegrityError,
  migrationVerifier 
} from '../src/domain/verification/MigrationVerifier.mjs';

test('MigrationVerifier can be constructed with default options', () => {
  const verifier = new MigrationVerifier();
  
  assert.equal(verifier.options.checksumAlgorithm, 'sha256');
  assert.equal(verifier.options.enableSchemaComparison, true);
  assert.equal(verifier.options.enableDataIntegrityChecks, true);
  assert.equal(verifier.options.enablePerformanceBaselines, true);
  assert.equal(verifier.options.enableRollbackValidation, true);
  assert.equal(verifier.options.strictMode, false);
});

test('MigrationVerifier can be constructed with custom options', () => {
  const verifier = new MigrationVerifier({
    checksumAlgorithm: 'sha1',
    enableSchemaComparison: false,
    strictMode: true,
    timeout: 60000
  });
  
  assert.equal(verifier.options.checksumAlgorithm, 'sha1');
  assert.equal(verifier.options.enableSchemaComparison, false);
  assert.equal(verifier.options.strictMode, true);
  assert.equal(verifier.options.timeout, 60000);
});

test('verifyMigration performs complete verification', async () => {
  const verifier = new MigrationVerifier();
  
  const migrationContext = {
    migrationId: 'test_migration_001',
    beforeSnapshot: {
      schema: {
        users: {
          columns: { id: { type: 'INTEGER' }, email: { type: 'VARCHAR' } },
          constraints: []
        }
      },
      metadata: { timestamp: Date.now() }
    },
    afterSnapshot: {
      schema: {
        users: {
          columns: { 
            id: { type: 'INTEGER' }, 
            email: { type: 'VARCHAR' },
            name: { type: 'VARCHAR' }  // Added column
          },
          constraints: []
        }
      },
      metadata: { timestamp: Date.now() }
    },
    expectedChecksum: null
  };

  const result = await verifier.verifyMigration(migrationContext);
  
  assert.equal(result.migrationId, 'test_migration_001');
  assert(['passed', 'passed_with_warnings', 'partial'].includes(result.overall));
  assert(result.schemaComparison);
  assert(result.dataIntegrityCheck);
  assert(result.rollbackValidation);
  assert(result.performanceBaseline);
});

test('checksum validation passes with correct checksum', async () => {
  const verifier = new MigrationVerifier();
  
  const snapshot = {
    schema: { users: { columns: { id: { type: 'INTEGER' } } } },
    metadata: { timestamp: Date.now() }
  };
  
  // Calculate expected checksum
  const expectedChecksum = await verifier.calculateSchemaChecksum(snapshot);
  
  const result = await verifier.validateChecksums(snapshot, expectedChecksum);
  
  assert.equal(result.status, 'passed');
  assert.equal(result.expected, expectedChecksum);
  assert.equal(result.actual, expectedChecksum);
});

test('checksum validation fails with incorrect checksum', async () => {
  const verifier = new MigrationVerifier();
  
  const snapshot = {
    schema: { users: { columns: { id: { type: 'INTEGER' } } } },
    metadata: { timestamp: Date.now() }
  };
  
  const wrongChecksum = 'incorrect_checksum_value';
  
  const result = await verifier.validateChecksums(snapshot, wrongChecksum);
  
  assert.equal(result.status, 'failed');
  assert.equal(result.expected, wrongChecksum);
  assert.notEqual(result.actual, wrongChecksum);
});

test('checksum validation throws in strict mode', async () => {
  const verifier = new MigrationVerifier({ strictMode: true });
  
  const snapshot = {
    schema: { users: { columns: { id: { type: 'INTEGER' } } } },
    metadata: { timestamp: Date.now() }
  };
  
  await assert.rejects(
    async () => {
      await verifier.validateChecksums(snapshot, 'wrong_checksum');
    },
    ChecksumMismatchError
  );
});

test('schema comparison detects added tables', async () => {
  const verifier = new MigrationVerifier();
  
  const beforeSnapshot = {
    schema: {
      users: { columns: { id: { type: 'INTEGER' } }, constraints: [] }
    }
  };
  
  const afterSnapshot = {
    schema: {
      users: { columns: { id: { type: 'INTEGER' } }, constraints: [] },
      posts: { columns: { id: { type: 'INTEGER' }, title: { type: 'VARCHAR' } }, constraints: [] }
    }
  };
  
  const result = await verifier.compareSchemas(beforeSnapshot, afterSnapshot);
  
  assert.equal(result.status, 'changes_detected');
  assert.equal(result.addedTables.length, 1);
  assert.equal(result.addedTables[0].table, 'posts');
  assert.deepEqual(result.addedTables[0].columns, ['id', 'title']);
});

test('schema comparison detects dropped tables', async () => {
  const verifier = new MigrationVerifier();
  
  const beforeSnapshot = {
    schema: {
      users: { columns: { id: { type: 'INTEGER' } }, constraints: [] },
      old_table: { columns: { id: { type: 'INTEGER' } }, constraints: [] }
    }
  };
  
  const afterSnapshot = {
    schema: {
      users: { columns: { id: { type: 'INTEGER' } }, constraints: [] }
    }
  };
  
  const result = await verifier.compareSchemas(beforeSnapshot, afterSnapshot);
  
  assert.equal(result.status, 'changes_detected');
  assert.equal(result.droppedTables.length, 1);
  assert.equal(result.droppedTables[0].table, 'old_table');
});

test('schema comparison detects modified tables', async () => {
  const verifier = new MigrationVerifier();
  
  const beforeSnapshot = {
    schema: {
      users: { columns: { id: { type: 'INTEGER' }, email: { type: 'VARCHAR' } }, constraints: [] }
    }
  };
  
  const afterSnapshot = {
    schema: {
      users: { 
        columns: { 
          id: { type: 'INTEGER' }, 
          email: { type: 'VARCHAR' },
          name: { type: 'VARCHAR' }  // Added column
        }, 
        constraints: [] 
      }
    }
  };
  
  const result = await verifier.compareSchemas(beforeSnapshot, afterSnapshot);
  
  assert.equal(result.status, 'changes_detected');
  assert.equal(result.modifiedTables.length, 1);
  assert.equal(result.modifiedTables[0].table, 'users');
  assert.equal(result.modifiedTables[0].addedColumns.length, 1);
  assert.equal(result.modifiedTables[0].addedColumns[0], 'name');
});

test('schema comparison reports no changes for identical schemas', async () => {
  const verifier = new MigrationVerifier();
  
  const schema = {
    schema: {
      users: { columns: { id: { type: 'INTEGER' }, email: { type: 'VARCHAR' } }, constraints: [] }
    }
  };
  
  const result = await verifier.compareSchemas(schema, schema);
  
  assert.equal(result.status, 'no_changes');
  assert.equal(result.differences.length, 0);
  assert.equal(result.addedTables.length, 0);
  assert.equal(result.droppedTables.length, 0);
  assert.equal(result.modifiedTables.length, 0);
});

test('data integrity check passes with valid data', async () => {
  const verifier = new MigrationVerifier();
  
  const snapshot = {
    schema: {
      users: {
        columns: { id: { type: 'INTEGER' }, email: { type: 'VARCHAR' } },
        foreignKeys: [],
        uniqueConstraints: [],
        checkConstraints: []
      }
    }
  };
  
  const result = await verifier.verifyDataIntegrity(snapshot);
  
  assert.equal(result.status, 'passed');
  assert.equal(result.violations.length, 0);
});

test('rollback validation checks trigger validity', async () => {
  const verifier = new MigrationVerifier();
  
  const migrationContext = {
    rollbackTriggers: [
      { name: 'rollback_001', type: 'sql_trigger' },
      { name: 'rollback_002', type: 'function_trigger' }
    ]
  };
  
  const result = await verifier.validateRollbackTriggers(migrationContext);
  
  assert.equal(result.status, 'passed');
  assert.equal(result.validTriggers, 2);
  assert.equal(result.invalidTriggers, 0);
  assert.equal(result.triggers.length, 2);
});

test('performance baseline comparison detects improvements', async () => {
  const verifier = new MigrationVerifier();
  
  const migrationContext = {
    performanceBaseline: {
      queries: {
        'select_users': { executionTime: 100 },
        'insert_user': { executionTime: 50 }
      }
    },
    currentPerformance: {
      queries: {
        'select_users': { executionTime: 75 },  // 25% improvement (>10% threshold)
        'insert_user': { executionTime: 40 }    // 20% improvement (>10% threshold)
      }
    }
  };
  
  const result = await verifier.comparePerformanceBaselines(migrationContext);
  
  assert.equal(result.status, 'passed');
  assert.equal(result.comparison.improvements.length, 2);
  assert.equal(result.comparison.regressions.length, 0);
});

test('performance baseline comparison detects regressions', async () => {
  const verifier = new MigrationVerifier();
  
  const migrationContext = {
    performanceBaseline: {
      queries: {
        'select_users': { executionTime: 100 },
        'insert_user': { executionTime: 50 }
      }
    },
    currentPerformance: {
      queries: {
        'select_users': { executionTime: 150 },  // Regressed
        'insert_user': { executionTime: 55 }     // Slight regression within threshold
      }
    }
  };
  
  const result = await verifier.comparePerformanceBaselines(migrationContext);
  
  assert.equal(result.status, 'degraded');
  assert.equal(result.comparison.regressions.length, 1);
  assert.equal(result.comparison.regressions[0].query, 'select_users');
});

test('calculateOverallResult determines correct status', () => {
  const verifier = new MigrationVerifier();
  
  // All passed
  let results = {
    checksumValidation: { status: 'passed' },
    schemaComparison: { status: 'no_changes' },
    dataIntegrityCheck: { status: 'passed' },
    rollbackValidation: { status: 'passed' },
    performanceBaseline: { status: 'passed' }
  };
  assert.equal(verifier.calculateOverallResult(results), 'passed');
  
  // One failed
  results.checksumValidation.status = 'failed';
  assert.equal(verifier.calculateOverallResult(results), 'failed');
  
  // One error
  results.checksumValidation.status = 'error';
  assert.equal(verifier.calculateOverallResult(results), 'error');
  
  // Mixed results
  results = {
    checksumValidation: { status: 'passed' },
    schemaComparison: { status: 'skipped' }
  };
  assert.equal(verifier.calculateOverallResult(results), 'passed');
});

test('event emission works correctly', async () => {
  const verifier = new MigrationVerifier();
  const events = [];
  
  verifier.on('MIGRATION_VERIFICATION_STARTED', (event) => {
    events.push(event.type);
  });
  
  verifier.on('MIGRATION_VERIFICATION_COMPLETED', (event) => {
    events.push(event.type);
  });
  
  const migrationContext = {
    migrationId: 'test_migration_events',
    beforeSnapshot: { schema: {}, metadata: {} },
    afterSnapshot: { schema: {}, metadata: {} }
  };

  await verifier.verifyMigration(migrationContext);
  
  assert.equal(events.length, 2);
  assert.equal(events[0], 'MIGRATION_VERIFICATION_STARTED');
  assert.equal(events[1], 'MIGRATION_VERIFICATION_COMPLETED');
});

test('table structure comparison detects column changes', () => {
  const verifier = new MigrationVerifier();
  
  const before = {
    columns: {
      id: { type: 'INTEGER' },
      name: { type: 'VARCHAR' },
      old_field: { type: 'TEXT' }
    }
  };
  
  const after = {
    columns: {
      id: { type: 'INTEGER' },
      name: { type: 'VARCHAR(100)' },  // Modified
      email: { type: 'VARCHAR' }       // Added
    }
  };
  
  const diff = verifier.compareTableStructure(before, after);
  
  assert.equal(diff.hasChanges, true);
  assert.equal(diff.addedColumns.length, 1);
  assert.equal(diff.addedColumns[0], 'email');
  assert.equal(diff.droppedColumns.length, 1);
  assert.equal(diff.droppedColumns[0], 'old_field');
  assert.equal(diff.modifiedColumns.length, 1);
  assert.equal(diff.modifiedColumns[0].column, 'name');
});

test('schema checksum calculation is deterministic', async () => {
  const verifier = new MigrationVerifier();
  
  const snapshot = {
    schema: {
      users: { columns: { id: { type: 'INTEGER' }, email: { type: 'VARCHAR' } } },
      posts: { columns: { id: { type: 'INTEGER' }, title: { type: 'VARCHAR' } } }
    }
  };
  
  const checksum1 = await verifier.calculateSchemaChecksum(snapshot);
  const checksum2 = await verifier.calculateSchemaChecksum(snapshot);
  
  assert.equal(checksum1, checksum2);
  assert(typeof checksum1 === 'string');
  assert(checksum1.length > 0);
});

test('singleton instance is available', () => {
  assert(migrationVerifier instanceof MigrationVerifier);
  assert.equal(migrationVerifier.options.checksumAlgorithm, 'sha256');
});

test('custom error types have correct properties', () => {
  const checksumError = new ChecksumMismatchError('expected', 'actual', { table: 'users' });
  assert.equal(checksumError.name, 'MigrationVerificationError');
  assert.equal(checksumError.code, 'CHECKSUM_MISMATCH');
  assert.equal(checksumError.details.expected, 'expected');
  assert.equal(checksumError.details.actual, 'actual');
  assert.equal(checksumError.details.table, 'users');
  
  const schemaError = new SchemaComparisonError('Schema mismatch', ['diff1'], { context: 'test' });
  assert.equal(schemaError.name, 'MigrationVerificationError');
  assert.equal(schemaError.code, 'SCHEMA_COMPARISON_ERROR');
  assert.deepEqual(schemaError.details.differences, ['diff1']);
  
  const integrityError = new DataIntegrityError('Data violation', ['violation1'], { table: 'users' });
  assert.equal(integrityError.name, 'MigrationVerificationError');
  assert.equal(integrityError.code, 'DATA_INTEGRITY_ERROR');
  assert.deepEqual(integrityError.details.violations, ['violation1']);
});

test('strict mode throws on validation failures', async () => {
  const verifier = new MigrationVerifier({ strictMode: true });
  
  const migrationContext = {
    migrationId: 'strict_test',
    beforeSnapshot: { schema: {}, metadata: {} },
    afterSnapshot: { schema: {}, metadata: {} },
    expectedChecksum: 'wrong_checksum'
  };

  await assert.rejects(
    async () => {
      await verifier.verifyMigration(migrationContext);
    },
    ChecksumMismatchError
  );
});