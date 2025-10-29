/**
 * Migration Lock Level Correctness Property Tests
 * Tests that DDL operations have correct PostgreSQL lock levels
 */

import { test } from 'node:test';
import { fc } from 'fast-check';
import { MigrationSafety } from '../../src/domain/MigrationSafety.mjs';
import { sqlGenerators, propertyHelpers } from '../helpers/property-testing.mjs';

/**
 * PostgreSQL lock level hierarchy (from least to most restrictive)
 * ACCESS_SHARE < ROW_SHARE < ROW_EXCLUSIVE < SHARE_UPDATE_EXCLUSIVE < 
 * SHARE < SHARE_ROW_EXCLUSIVE < EXCLUSIVE < ACCESS_EXCLUSIVE
 */
const LOCK_LEVELS = {
  ACCESS_SHARE: 1,
  ROW_SHARE: 2, 
  ROW_EXCLUSIVE: 3,
  SHARE_UPDATE_EXCLUSIVE: 4,
  SHARE: 5,
  SHARE_ROW_EXCLUSIVE: 6,
  EXCLUSIVE: 7,
  ACCESS_EXCLUSIVE: 8
};

/**
 * Expected lock levels for different DDL operations
 */
const EXPECTED_LOCKS = {
  CREATE_TABLE: 'ACCESS_EXCLUSIVE',    // Creates new table, needs exclusive access
  DROP_TABLE: 'ACCESS_EXCLUSIVE',      // Drops table, needs exclusive access
  ALTER_TABLE_ADD_COLUMN: 'SHARE_UPDATE_EXCLUSIVE', // Adds column, allows reads
  ALTER_TABLE_DROP_COLUMN: 'ACCESS_EXCLUSIVE',      // Drops column, needs exclusive
  ALTER_TABLE_ALTER_COLUMN: 'ACCESS_EXCLUSIVE',     // Changes column type, needs exclusive
  CREATE_INDEX: 'SHARE',               // Creates index, allows reads but not writes
  CREATE_INDEX_CONCURRENTLY: 'SHARE_UPDATE_EXCLUSIVE', // Concurrent index, less blocking
  DROP_INDEX: 'ACCESS_EXCLUSIVE',      // Drops index, needs exclusive
  ADD_CONSTRAINT: 'SHARE_ROW_EXCLUSIVE', // Adds constraint, blocks writes
  DROP_CONSTRAINT: 'ACCESS_EXCLUSIVE',  // Drops constraint, needs exclusive
  RENAME_TABLE: 'ACCESS_EXCLUSIVE',     // Renames table, needs exclusive
  RENAME_COLUMN: 'ACCESS_EXCLUSIVE'     // Renames column, needs exclusive
};

test('DDL operations have correct lock levels', async () => {
  await propertyHelpers.runProperty(
    'ddl-lock-levels-correct',
    fc.constantFrom(...Object.keys(EXPECTED_LOCKS)),
    (operationType) => {
      const migrationSafety = new MigrationSafety();
      const lockLevel = migrationSafety.calculateLockLevel(operationType);
      const expectedLock = EXPECTED_LOCKS[operationType];
      
      return lockLevel === expectedLock;
    },
    { numRuns: Object.keys(EXPECTED_LOCKS).length }
  );
});

test('Lock levels are properly ordered by restrictiveness', async () => {
  await propertyHelpers.runProperty(
    'lock-levels-ordered',
    fc.array(fc.constantFrom(...Object.keys(LOCK_LEVELS)), { minLength: 2, maxLength: 5 }),
    (lockLevels) => {
      // Sort by restrictiveness
      const sorted = [...lockLevels].sort((a, b) => LOCK_LEVELS[a] - LOCK_LEVELS[b]);
      
      // Check that each lock is more restrictive than the previous
      for (let i = 1; i < sorted.length; i++) {
        if (LOCK_LEVELS[sorted[i]] < LOCK_LEVELS[sorted[i-1]]) {
          return false;
        }
      }
      
      return true;
    },
    { numRuns: 50 }
  );
});

test('Migration operations produce expected lock levels', async () => {
  const migrationArbitrary = fc.oneof(
    // CREATE TABLE operations
    fc.record({
      type: fc.constant('CREATE_TABLE'),
      tableName: sqlGenerators.identifier(),
      columns: fc.array(fc.record({
        name: sqlGenerators.identifier(),
        type: sqlGenerators.columnType()
      }), { minLength: 1, maxLength: 5 })
    }),
    
    // DROP TABLE operations  
    fc.record({
      type: fc.constant('DROP_TABLE'),
      tableName: sqlGenerators.identifier()
    }),
    
    // ADD COLUMN operations
    fc.record({
      type: fc.constant('ALTER_TABLE_ADD_COLUMN'),
      tableName: sqlGenerators.identifier(),
      column: fc.record({
        name: sqlGenerators.identifier(),
        type: sqlGenerators.columnType(),
        nullable: fc.boolean()
      })
    }),
    
    // DROP COLUMN operations
    fc.record({
      type: fc.constant('ALTER_TABLE_DROP_COLUMN'),
      tableName: sqlGenerators.identifier(),
      columnName: sqlGenerators.identifier()
    }),
    
    // CREATE INDEX operations
    fc.record({
      type: fc.constant('CREATE_INDEX'),
      indexName: sqlGenerators.identifier(),
      tableName: sqlGenerators.identifier(),
      columns: fc.array(sqlGenerators.identifier(), { minLength: 1, maxLength: 3 }),
      unique: fc.boolean(),
      concurrent: fc.boolean()
    })
  );
  
  await propertyHelpers.runProperty(
    'migration-lock-levels',
    migrationArbitrary,
    (operation) => {
      const migrationSafety = new MigrationSafety();
      const lockLevel = migrationSafety.calculateOperationLock(operation);
      
      // Verify lock level is valid
      return Object.keys(LOCK_LEVELS).includes(lockLevel);
    },
    { numRuns: 100 }
  );
});

test('Concurrent operations have compatible lock levels', async () => {
  const concurrentOpsArbitrary = fc.array(
    fc.record({
      operation: fc.constantFrom('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE_INDEX_CONCURRENTLY'),
      tableName: sqlGenerators.identifier()
    }),
    { minLength: 2, maxLength: 5 }
  );
  
  await propertyHelpers.runProperty(
    'concurrent-operations-compatible',
    concurrentOpsArbitrary,
    (operations) => {
      const migrationSafety = new MigrationSafety();
      
      // Check if operations can run concurrently
      const lockLevels = operations.map(op => 
        migrationSafety.calculateOperationLock(op)
      );
      
      // Operations with compatible lock levels can run together
      return migrationSafety.areLocksCompatible(lockLevels);
    },
    { numRuns: 75 }
  );
});

test('Blocking operations have incompatible lock levels', async () => {
  const blockingPairs = fc.constantFrom(
    ['ACCESS_EXCLUSIVE', 'SHARE'],
    ['ACCESS_EXCLUSIVE', 'ROW_EXCLUSIVE'], 
    ['EXCLUSIVE', 'SHARE'],
    ['ACCESS_EXCLUSIVE', 'ACCESS_SHARE']
  );
  
  await propertyHelpers.runProperty(
    'blocking-operations-incompatible',
    blockingPairs,
    ([lock1, lock2]) => {
      const migrationSafety = new MigrationSafety();
      
      // These locks should not be compatible
      return !migrationSafety.areLocksCompatible([lock1, lock2]);
    },
    { numRuns: 20 }
  );
});

test('Lock level calculation is deterministic', async () => {
  const operationArbitrary = fc.record({
    type: fc.constantFrom(...Object.keys(EXPECTED_LOCKS)),
    tableName: sqlGenerators.identifier(),
    columnName: fc.option(sqlGenerators.identifier()),
    indexName: fc.option(sqlGenerators.identifier())
  });
  
  await propertyHelpers.runProperty(
    'lock-calculation-deterministic',
    operationArbitrary,
    (operation) => {
      const migrationSafety = new MigrationSafety();
      
      // Calculate lock level multiple times
      const lock1 = migrationSafety.calculateOperationLock(operation);
      const lock2 = migrationSafety.calculateOperationLock(operation);
      const lock3 = migrationSafety.calculateOperationLock(operation);
      
      // Should be consistent
      return lock1 === lock2 && lock2 === lock3;
    },
    { numRuns: 50 }
  );
});

test('Migration risk assessment considers lock levels', async () => {
  const riskScenarioArbitrary = fc.record({
    operations: fc.array(fc.record({
      type: fc.constantFrom(...Object.keys(EXPECTED_LOCKS)),
      tableName: sqlGenerators.identifier()
    }), { minLength: 1, maxLength: 10 }),
    concurrent: fc.boolean()
  });
  
  await propertyHelpers.runProperty(
    'risk-assessment-considers-locks',
    riskScenarioArbitrary,
    (scenario) => {
      const migrationSafety = new MigrationSafety();
      
      const risk = migrationSafety.assessMigrationRisk(scenario.operations, {
        concurrent: scenario.concurrent
      });
      
      // Risk should be higher for ACCESS_EXCLUSIVE operations
      const hasExclusiveLocks = scenario.operations.some(op => 
        EXPECTED_LOCKS[op.type] === 'ACCESS_EXCLUSIVE'
      );
      
      if (hasExclusiveLocks) {
        return risk >= 50; // High risk threshold
      } else {
        return risk >= 0; // Valid risk score
      }
    },
    { numRuns: 60 }
  );
});

test('Lock compatibility matrix is symmetric', async () => {
  const lockPairArbitrary = fc.tuple(
    fc.constantFrom(...Object.keys(LOCK_LEVELS)),
    fc.constantFrom(...Object.keys(LOCK_LEVELS))
  );
  
  await propertyHelpers.runProperty(
    'lock-compatibility-symmetric',
    lockPairArbitrary,
    ([lock1, lock2]) => {
      const migrationSafety = new MigrationSafety();
      
      // Compatibility should be symmetric
      const compatible1 = migrationSafety.areLocksCompatible([lock1, lock2]);
      const compatible2 = migrationSafety.areLocksCompatible([lock2, lock1]);
      
      return compatible1 === compatible2;
    },
    { numRuns: Object.keys(LOCK_LEVELS).length ** 2 }
  );
});

test('Migration batching respects lock compatibility', async () => {
  const migrationBatchArbitrary = fc.array(
    fc.record({
      type: fc.constantFrom(...Object.keys(EXPECTED_LOCKS)),
      tableName: sqlGenerators.identifier(),
      priority: fc.integer({ min: 1, max: 10 })
    }),
    { minLength: 3, maxLength: 15 }
  );
  
  await propertyHelpers.runProperty(
    'migration-batching-respects-locks',
    migrationBatchArbitrary,
    (operations) => {
      const migrationSafety = new MigrationSafety();
      
      // Batch operations by compatibility
      const batches = migrationSafety.batchOperations(operations);
      
      // Each batch should have compatible locks
      return batches.every(batch => {
        const lockLevels = batch.map(op => 
          migrationSafety.calculateOperationLock(op)
        );
        return migrationSafety.areLocksCompatible(lockLevels);
      });
    },
    { numRuns: 40 }
  );
});
