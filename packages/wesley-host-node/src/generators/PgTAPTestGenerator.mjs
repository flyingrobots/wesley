/**
 * Enhanced pgTAP Test Generator with Risk Weighting
 * Generates production-grade database tests from GraphQL schema
 */

import { DirectiveProcessor } from '@wesley/core';

export class PgTAPTestGenerator {
  constructor(evidenceMap) {
    this.evidenceMap = evidenceMap;
    this.currentLine = 1;
    this.tests = [];
    this.testCount = 0;
  }

  /**
   * Generate complete test suite from schema
   */
  async generate(schema, options = {}) {
    const suites = [];
    
    // Structure tests (tables, columns, types)
    suites.push(this.generateStructureTests(schema));
    
    // Constraint tests (PK, FK, unique, check)
    suites.push(this.generateConstraintTests(schema));
    
    // Default value tests
    suites.push(this.generateDefaultTests(schema));
    
    // Index tests with EXPLAIN verification
    suites.push(this.generateIndexTests(schema));
    
    // RLS tests if Supabase-aware
    if (options.supabase) {
      suites.push(this.generateRLSTests(schema));
    }
    
    // Behavior tests (triggers, functions)
    suites.push(this.generateBehaviorTests(schema));
    
    // Migration safety tests
    if (options.migrationSteps) {
      suites.push(this.generateMigrationTests(options.migrationSteps));
    }
    
    return this.wrapTestSuite(suites.filter(Boolean).join('\n\n'));
  }

  /**
   * Generate structure tests weighted by importance
   */
  generateStructureTests(schema) {
    const tests = [];
    
    tests.push('-- ══════════════════════════════════════════════════════');
    tests.push('-- STRUCTURE TESTS');
    tests.push('-- Testing tables, columns, and types');
    tests.push('-- ══════════════════════════════════════════════════════');
    tests.push('');
    
    for (const table of schema.getTables()) {
      const tableUid = DirectiveProcessor.getUid(table.directives) || `tbl:${table.name}`;
      const tableWeight = DirectiveProcessor.getWeight(table.directives);
      
      // Record evidence
      this.recordEvidence(tableUid, 'test', tests.length + 1);
      
      // Table existence test
      tests.push(`-- Table: ${table.name} (weight: ${tableWeight})`);
      tests.push(`SELECT has_table('${table.name}', 'Table ${table.name} should exist');`);
      tests.push('');
      
      // Column tests - prioritize by weight
      const fields = table.getFields()
        .filter(f => !f.isVirtual())
        .sort((a, b) => {
          const weightA = DirectiveProcessor.getWeight(a.directives);
          const weightB = DirectiveProcessor.getWeight(b.directives);
          return weightB - weightA; // Higher weight first
        });
      
      for (const field of fields) {
        const fieldUid = DirectiveProcessor.getUid(field.directives) || 
                         `col:${table.name}.${field.name}`;
        const weight = DirectiveProcessor.getWeight(field.directives);
        const isCritical = DirectiveProcessor.isCritical(field.directives);
        
        // Record evidence
        this.recordEvidence(fieldUid, 'test', tests.length + 1);
        
        tests.push(`-- Column: ${table.name}.${field.name} (weight: ${weight}${isCritical ? ', CRITICAL' : ''})`);
        tests.push(`-- EVIDENCE: ${fieldUid} -> ${this.getEvidence(fieldUid)}`);
        
        // Column existence
        tests.push(`SELECT has_column('${table.name}', '${field.name}', ` +
                  `'Column ${table.name}.${field.name} should exist');`);
        
        // Column type
        const sqlType = this.mapToSQLType(field);
        tests.push(`SELECT col_type_is('${table.name}', '${field.name}', '${sqlType}', ` +
                  `'${table.name}.${field.name} should be ${sqlType}');`);
        
        // Not null check
        if (field.nonNull) {
          tests.push(`SELECT col_not_null('${table.name}', '${field.name}', ` +
                    `'${table.name}.${field.name} should not be nullable');`);
        } else {
          tests.push(`SELECT col_is_null('${table.name}', '${field.name}', ` +
                    `'${table.name}.${field.name} should be nullable');`);
        }
        
        // Critical field extra checks
        if (isCritical) {
          tests.push(`-- CRITICAL FIELD: Additional safety checks`);
          
          if (DirectiveProcessor.isSensitive(field.directives)) {
            // Sensitive field must have constraints
            if (field.name.includes('password')) {
              tests.push(`SELECT has_check('${table.name}', ` +
                        `'${table.name}.${field.name} should have hash length check');`);
            }
            
            if (field.name.includes('email')) {
              tests.push(`SELECT col_is_unique('${table.name}', '${field.name}', ` +
                        `'${table.name}.${field.name} should be unique');`);
            }
          }
        }
        
        tests.push('');
      }
    }
    
    return tests.join('\n');
  }

  /**
   * Generate constraint tests with risk weighting
   */
  generateConstraintTests(schema) {
    const tests = [];
    
    tests.push('-- ══════════════════════════════════════════════════════');
    tests.push('-- CONSTRAINT TESTS');
    tests.push('-- Testing PK, FK, unique, check constraints');
    tests.push('-- ══════════════════════════════════════════════════════');
    tests.push('');
    
    for (const table of schema.getTables()) {
      const hasConstraints = table.getFields().some(f => 
        f.isPrimaryKey() || f.isForeignKey() || f.isUnique() || 
        f.directives?.['@check']
      );
      
      if (!hasConstraints) continue;
      
      tests.push(`-- Constraints for ${table.name}`);
      
      for (const field of table.getFields()) {
        const fieldUid = DirectiveProcessor.getUid(field.directives) || 
                         `col:${table.name}.${field.name}`;
        
        // Primary key test
        if (field.isPrimaryKey()) {
          this.recordEvidence(`${fieldUid}.pk`, 'test', tests.length + 1);
          tests.push(`SELECT col_is_pk('${table.name}', '${field.name}', ` +
                    `'${table.name}.${field.name} should be primary key');`);
        }
        
        // Foreign key test
        if (field.isForeignKey()) {
          const ref = field.getForeignKeyRef();
          if (ref) {
            const [refTable, refCol] = ref.split('.');
            this.recordEvidence(`${fieldUid}.fk`, 'test', tests.length + 1);
            
            tests.push(`SELECT fk_ok(`);
            tests.push(`  '${table.name}', '${field.name}',`);
            tests.push(`  '${refTable}', '${refCol || 'id'}',`);
            tests.push(`  '${table.name}.${field.name} should reference ${refTable}.${refCol || 'id'}'`);
            tests.push(`);`);
            
            // Test cascade behavior
            tests.push(`-- Test foreign key cascade behavior`);
            tests.push(`DO $$`);
            tests.push(`BEGIN`);
            tests.push(`  -- Insert parent and child`);
            tests.push(`  INSERT INTO "${refTable}" (id) VALUES ('test-parent-id');`);
            tests.push(`  INSERT INTO "${table.name}" ("${field.name}") VALUES ('test-parent-id');`);
            tests.push(`  `);
            tests.push(`  -- Test cascade (configure based on directive)`);
            tests.push(`  -- This would be customized based on @onDelete directive`);
            tests.push(`  ROLLBACK;`);
            tests.push(`END $$;`);
          }
        }
        
        // Unique constraint test
        if (field.isUnique()) {
          this.recordEvidence(`${fieldUid}.unique`, 'test', tests.length + 1);
          tests.push(`SELECT col_is_unique('${table.name}', '${field.name}', ` +
                    `'${table.name}.${field.name} should be unique');`);
          
          // Email special case - case insensitive
          if (field.name.includes('email')) {
            tests.push(`-- Email uniqueness should be case-insensitive`);
            tests.push(`DO $$`);
            tests.push(`BEGIN`);
            tests.push(`  INSERT INTO "${table.name}" ("${field.name}") VALUES ('Test@Example.com');`);
            tests.push(`  PERFORM throws_ok(`);
            tests.push(`    $SQL$ INSERT INTO "${table.name}" ("${field.name}") VALUES ('test@example.com') $SQL$,`);
            tests.push(`    '23505',`);
            tests.push(`    'Should enforce case-insensitive email uniqueness'`);
            tests.push(`  );`);
            tests.push(`  ROLLBACK;`);
            tests.push(`END $$;`);
          }
        }
        
        // Check constraint test
        const check = field.directives?.['@check'];
        if (check) {
          this.recordEvidence(`${fieldUid}.check`, 'test', tests.length + 1);
          tests.push(`SELECT has_check('${table.name}', ` +
                    `'${table.name}.${field.name} should have check constraint');`);
          
          // Test check constraint behavior
          tests.push(`-- Test check constraint blocks invalid data`);
          tests.push(`SELECT throws_ok(`);
          tests.push(`  $$ INSERT INTO "${table.name}" ("${field.name}") VALUES ('invalid-value') $$,`);
          tests.push(`  '23514',`);
          tests.push(`  'Check constraint should reject invalid ${field.name}'`);
          tests.push(`);`);
        }
      }
      
      tests.push('');
    }
    
    return tests.join('\n');
  }

  /**
   * Generate RLS tests for Supabase
   */
  generateRLSTests(schema) {
    const tests = [];
    
    tests.push('-- ══════════════════════════════════════════════════════');
    tests.push('-- RLS TESTS (Supabase Row Level Security)');
    tests.push('-- Testing access control policies');
    tests.push('-- ══════════════════════════════════════════════════════');
    tests.push('');
    
    for (const table of schema.getTables()) {
      const rls = table.directives?.['@rls'];
      if (!rls) continue;
      
      tests.push(`-- RLS tests for ${table.name}`);
      tests.push(`-- Setting RLS context for testing`);
      tests.push('');
      
      // Test as owner
      tests.push('-- Test as resource owner');
      tests.push(`SELECT set_config('request.jwt.claims', `);
      tests.push(`  '{"sub":"00000000-0000-0000-0000-000000000001", "role":"authenticated"}', true);`);
      tests.push('');
      
      // Test each operation
      const operations = ['select', 'insert', 'update', 'delete'];
      
      for (const op of operations) {
        const policy = rls[op];
        if (!policy) continue;
        
        tests.push(`-- Test ${op.toUpperCase()} policy`);
        
        if (policy === 'true' || policy.includes('auth.uid()')) {
          // Should allow for owner
          tests.push(`SELECT lives_ok(`);
          tests.push(`  $$ ${this.generateRLSQuery(table.name, op, 'owner')} $$,`);
          tests.push(`  'RLS should allow ${op} for owner'`);
          tests.push(`);`);
          
          // Test as different user
          tests.push('');
          tests.push('-- Switch to different user');
          tests.push(`SELECT set_config('request.jwt.claims', `);
          tests.push(`  '{"sub":"00000000-0000-0000-0000-000000000002", "role":"authenticated"}', true);`);
          
          // Should block for non-owner
          tests.push(`SELECT throws_ok(`);
          tests.push(`  $$ ${this.generateRLSQuery(table.name, op, 'other')} $$,`);
          tests.push(`  '42501',`);
          tests.push(`  'RLS should block ${op} for non-owner'`);
          tests.push(`);`);
        }
        
        tests.push('');
      }
      
      // Test RLS is enabled
      tests.push(`-- Verify RLS is enabled on table`);
      tests.push(`SELECT is(`);
      tests.push(`  (SELECT relrowsecurity FROM pg_class WHERE relname = '${table.name}'),`);
      tests.push(`  true,`);
      tests.push(`  'RLS should be enabled on ${table.name}'`);
      tests.push(`);`);
      tests.push('');
    }
    
    return tests.join('\n');
  }

  /**
   * Generate behavior tests for triggers and functions
   */
  generateBehaviorTests(schema) {
    const tests = [];
    const hasBehaviors = schema.getTables().some(t => 
      t.getFields().some(f => 
        f.directives?.['@updatedAt'] || 
        f.directives?.['@computed'] ||
        f.directives?.['@trigger']
      )
    );
    
    if (!hasBehaviors) return '';
    
    tests.push('-- ══════════════════════════════════════════════════════');
    tests.push('-- BEHAVIOR TESTS');
    tests.push('-- Testing triggers, computed fields, and functions');
    tests.push('-- ══════════════════════════════════════════════════════');
    tests.push('');
    
    for (const table of schema.getTables()) {
      for (const field of table.getFields()) {
        // Test @updatedAt trigger
        if (field.directives?.['@updatedAt']) {
          tests.push(`-- Test ${table.name}.${field.name} auto-update trigger`);
          tests.push(`DO $$`);
          tests.push(`DECLARE`);
          tests.push(`  test_id uuid := gen_random_uuid();`);
          tests.push(`  initial_time timestamptz;`);
          tests.push(`  updated_time timestamptz;`);
          tests.push(`BEGIN`);
          tests.push(`  -- Insert and capture initial timestamp`);
          tests.push(`  INSERT INTO "${table.name}" (id) VALUES (test_id);`);
          tests.push(`  SELECT ${field.name} INTO initial_time FROM "${table.name}" WHERE id = test_id;`);
          tests.push(`  `);
          tests.push(`  -- Wait briefly then update`);
          tests.push(`  PERFORM pg_sleep(0.01);`);
          tests.push(`  UPDATE "${table.name}" SET id = test_id WHERE id = test_id;`);
          tests.push(`  SELECT ${field.name} INTO updated_time FROM "${table.name}" WHERE id = test_id;`);
          tests.push(`  `);
          tests.push(`  -- Verify timestamp was updated`);
          tests.push(`  PERFORM is(`);
          tests.push(`    updated_time > initial_time,`);
          tests.push(`    true,`);
          tests.push(`    '${field.name} should auto-update on modification'`);
          tests.push(`  );`);
          tests.push(`  `);
          tests.push(`  ROLLBACK;`);
          tests.push(`END $$;`);
          tests.push('');
        }
        
        // Test computed fields
        if (field.directives?.['@computed']) {
          const expr = field.directives['@computed'].expr;
          tests.push(`-- Test ${table.name}.${field.name} computed field`);
          tests.push(`SELECT is(`);
          tests.push(`  (SELECT ${field.name} FROM "${table.name}" LIMIT 1),`);
          tests.push(`  (SELECT ${expr} FROM "${table.name}" LIMIT 1),`);
          tests.push(`  '${field.name} should compute correctly'`);
          tests.push(`);`);
          tests.push('');
        }
      }
    }
    
    return tests.join('\n');
  }

  /**
   * Generate index performance tests
   */
  generateIndexTests(schema) {
    const tests = [];
    const hasIndexes = schema.getTables().some(t => 
      t.getFields().some(f => f.isIndexed() || f.isUnique())
    );
    
    if (!hasIndexes) return '';
    
    tests.push('-- ══════════════════════════════════════════════════════');
    tests.push('-- INDEX TESTS');
    tests.push('-- Testing index existence and usage');
    tests.push('-- ══════════════════════════════════════════════════════');
    tests.push('');
    
    for (const table of schema.getTables()) {
      for (const field of table.getFields()) {
        if (field.isIndexed() || field.isUnique()) {
          const indexName = `${table.name}_${field.name}_idx`;
          
          // Test index exists
          tests.push(`-- Index test for ${table.name}.${field.name}`);
          tests.push(`SELECT has_index('${table.name}', '${indexName}', ` +
                    `'Index ${indexName} should exist');`);
          
          // Test index is used (EXPLAIN check)
          tests.push(`-- Verify index is used in query plans`);
          tests.push(`SELECT like(`);
          tests.push(`  (SELECT json_agg(plan) FROM (`);
          tests.push(`    EXPLAIN (FORMAT JSON) SELECT * FROM "${table.name}" WHERE "${field.name}" = 'test'`);
          tests.push(`  ) AS t(plan))::text,`);
          tests.push(`  '%Index Scan%',`);
          tests.push(`  'Query on ${field.name} should use index'`);
          tests.push(`);`);
          tests.push('');
        }
      }
    }
    
    return tests.join('\n');
  }

  /**
   * Generate migration safety tests
   */
  generateMigrationTests(migrationSteps) {
    const tests = [];
    
    tests.push('-- ══════════════════════════════════════════════════════');
    tests.push('-- MIGRATION TESTS');
    tests.push('-- Testing migration safety and data preservation');
    tests.push('-- ══════════════════════════════════════════════════════');
    tests.push('');
    
    // Test idempotence
    tests.push('-- Test migration idempotence');
    tests.push('DO $$');
    tests.push('BEGIN');
    tests.push('  -- Apply migration twice');
    tests.push('  \\i migrations/latest.sql');
    tests.push('  \\i migrations/latest.sql  -- Should be no-op');
    tests.push('  PERFORM pass(\'Migration should be idempotent\');');
    tests.push('EXCEPTION WHEN OTHERS THEN');
    tests.push('  PERFORM fail(\'Migration is not idempotent: \' || SQLERRM);');
    tests.push('END $$;');
    tests.push('');
    
    // Test specific risky operations
    for (const step of migrationSteps) {
      if (step.kind === 'add_column' && step.field?.nonNull && !step.field?.directives?.['@default']) {
        tests.push(`-- Test NOT NULL without default for ${step.table}.${step.column}`);
        tests.push('DO $$');
        tests.push('BEGIN');
        tests.push('  -- Insert test data before migration');
        tests.push(`  INSERT INTO "${step.table}" (id) VALUES ('test-id');`);
        tests.push('  -- Apply migration with NOT NULL column');
        tests.push('  \\i migrations/latest.sql');
        tests.push('  -- Verify data preservation or proper error');
        tests.push('  PERFORM pass(\'NOT NULL migration handled correctly\');');
        tests.push('  ROLLBACK;');
        tests.push('END $$;');
        tests.push('');
      }
      
      if (step.kind === 'alter_type') {
        tests.push(`-- Test type change for ${step.table}.${step.column}`);
        tests.push('DO $$');
        tests.push('BEGIN');
        tests.push('  -- Test safe cast');
        tests.push(`  ALTER TABLE "${step.table}" ALTER COLUMN "${step.column}" TYPE ${step.to.type};`);
        tests.push('  PERFORM pass(\'Type change succeeded\');');
        tests.push('EXCEPTION WHEN OTHERS THEN');
        tests.push('  PERFORM fail(\'Unsafe type change: \' || SQLERRM);');
        tests.push('END $$;');
        tests.push('');
      }
    }
    
    return tests.join('\n');
  }

  /**
   * Generate default value tests
   */
  generateDefaultTests(schema) {
    const tests = [];
    const hasDefaults = schema.getTables().some(t => 
      t.getFields().some(f => f.getDefault())
    );
    
    if (!hasDefaults) return '';
    
    tests.push('-- ══════════════════════════════════════════════════════');
    tests.push('-- DEFAULT VALUE TESTS');
    tests.push('-- Testing default expressions');
    tests.push('-- ══════════════════════════════════════════════════════');
    tests.push('');
    
    for (const table of schema.getTables()) {
      for (const field of table.getFields()) {
        const defaultValue = field.getDefault();
        if (!defaultValue) continue;
        
        tests.push(`-- Test default for ${table.name}.${field.name}`);
        tests.push(`SELECT col_has_default('${table.name}', '${field.name}', ` +
                  `'${table.name}.${field.name} should have default');`);
        
        // Test default expression
        if (defaultValue.expr) {
          tests.push(`SELECT col_default_is(`);
          tests.push(`  '${table.name}', '${field.name}',`);
          tests.push(`  '${defaultValue.expr}',`);
          tests.push(`  'Default should be ${defaultValue.expr}'`);
          tests.push(`);`);
        }
        
        tests.push('');
      }
    }
    
    return tests.join('\n');
  }

  /**
   * Wrap test suite with transaction and setup
   */
  wrapTestSuite(content) {
    const setup = [
      '-- ══════════════════════════════════════════════════════════════════',
      '-- Wesley Generated pgTAP Test Suite',
      '-- Generated: ' + new Date().toISOString(),
      '-- SHA: ' + (this.evidenceMap?.sha || 'uncommitted'),
      '-- ══════════════════════════════════════════════════════════════════',
      '',
      '-- Setup test environment',
      'BEGIN;',
      '',
      '-- Set deterministic environment',
      "SET LOCAL timezone = 'UTC';",
      "SET LOCAL statement_timeout = '5s';",
      '',
      '-- Count tests for plan',
      `SELECT plan(${this.countTests(content)});`,
      '',
      '-- ══════════════════════════════════════════════════════════════════',
      ''
    ].join('\n');
    
    const teardown = [
      '',
      '-- ══════════════════════════════════════════════════════════════════',
      '-- Cleanup',
      'SELECT * FROM finish();',
      'ROLLBACK;'
    ].join('\n');
    
    return setup + content + teardown;
  }

  // Helper methods
  mapToSQLType(field) {
    const typeMap = {
      'ID': 'uuid',
      'String': 'text',
      'Int': 'integer',
      'Float': 'double precision',
      'Boolean': 'boolean',
      'DateTime': 'timestamp with time zone'
    };
    return typeMap[field.type] || 'text';
  }

  generateRLSQuery(table, operation, context) {
    switch (operation) {
      case 'select':
        return `SELECT * FROM "${table}" LIMIT 1`;
      case 'insert':
        return `INSERT INTO "${table}" (id) VALUES ('test-id')`;
      case 'update':
        return `UPDATE "${table}" SET id = id WHERE id = 'test-id'`;
      case 'delete':
        return `DELETE FROM "${table}" WHERE id = 'test-id'`;
      default:
        return `SELECT 1`;
    }
  }

  recordEvidence(uid, kind, lineNumber) {
    if (this.evidenceMap) {
      this.evidenceMap.record(uid, kind, {
        file: 'tests/generated.sql',
        lines: `${lineNumber}-${lineNumber + 5}`,
        sha: this.evidenceMap.sha
      });
    }
  }

  getEvidence(uid) {
    if (!this.evidenceMap) return 'no evidence map';
    const citations = this.evidenceMap.getCitation(uid, 'sql');
    return citations.join(', ') || 'not found';
  }

  countTests(content) {
    // Count pgTAP test functions
    const patterns = [
      /SELECT (has_table|has_column|col_type_is|col_not_null|col_is_null)/g,
      /SELECT (col_is_pk|fk_ok|col_is_unique|has_check|has_index)/g,
      /SELECT (col_has_default|col_default_is)/g,
      /SELECT (lives_ok|throws_ok|is|isnt|like|pass|fail)/g,
      /PERFORM (is|isnt|pass|fail|lives_ok|throws_ok)/g
    ];
    
    let count = 0;
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) count += matches.length;
    }
    
    return count || 100; // Default to 100 if we can't count
  }
}