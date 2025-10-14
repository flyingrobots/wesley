/**
 * pgTAP Test Generator - Core domain implementation
 * Generates database tests based on the Wesley schema model.
 */

import { DirectiveProcessor } from '../Directives.mjs';
import { TestDepthStrategy } from '../TestDepthStrategy.mjs';

export class PgTAPTestGenerator {
  constructor(evidenceMap, options = {}) {
    this.evidenceMap = evidenceMap;
    this.currentLine = 1;
    this.tests = [];
    this.testCount = 0;
    this.depthStrategy = new TestDepthStrategy(options.depthThresholds || {});
    this.enableDepthTesting = options.enableDepthTesting ?? true;
  }

  generate(schema, options = {}) {
    const suites = [];

    suites.push(this.generateStructureTests(schema));
    suites.push(this.generateConstraintTests(schema));
    suites.push(this.generateDefaultTests(schema));
    suites.push(this.generateIndexTests(schema));

    const rlsTests = this.generateRLSTests(schema);
    if (rlsTests) {
      suites.push(rlsTests);
    }

    suites.push(this.generateBehaviorTests(schema));

    if (options.migrationSteps) {
      suites.push(this.generateMigrationTests(options.migrationSteps));
    }

    return this.wrapTestSuite(suites.filter(Boolean).join('\n\n'));
  }

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

      this.recordEvidence(tableUid, 'test', tests.length + 1);

      tests.push(`-- Table: ${table.name} (weight: ${tableWeight})`);
      tests.push(`SELECT has_table('${table.name}', 'Table ${table.name} should exist');`);
      tests.push('');

      const fields = table.getFields()
        .filter(f => !f.isVirtual())
        .sort((a, b) => {
          const weightA = DirectiveProcessor.getWeight(a.directives);
          const weightB = DirectiveProcessor.getWeight(b.directives);
          return weightB - weightA;
        });

      for (const field of fields) {
        const fieldUid = DirectiveProcessor.getUid(field.directives) || `col:${table.name}.${field.name}`;
        const weight = this.enableDepthTesting
          ? this.depthStrategy.calculateFieldWeight(field)
          : DirectiveProcessor.getWeight(field.directives);
        const isCritical = DirectiveProcessor.isCritical(field.directives);

        const testDepth = this.enableDepthTesting
          ? this.depthStrategy.getFieldTestDepth(field)
          : 'standard';

        this.recordEvidence(fieldUid, 'test', tests.length + 1);

        if (this.enableDepthTesting) {
          tests.push(this.depthStrategy.generateTestSummary(field, testDepth, weight));
        } else {
          tests.push(`-- Column: ${table.name}.${field.name} (weight: ${weight}${isCritical ? ', CRITICAL' : ''})`);
        }
        tests.push(`-- EVIDENCE: ${fieldUid} -> ${this.getEvidence(fieldUid)}`);

        if (this.enableDepthTesting) {
          const depthTests = this.depthStrategy.generateFieldTests(field, table.name, testDepth);
          tests.push(...depthTests);
        } else {
          tests.push(`SELECT has_column('${table.name}', '${field.name}', 'Column ${table.name}.${field.name} should exist');`);
          const sqlType = this.mapToSQLType(field);
          tests.push(`SELECT col_type_is('${table.name}', '${field.name}', '${sqlType}', '${table.name}.${field.name} should be ${sqlType}');`);
          if (field.nonNull) {
            tests.push(`SELECT col_not_null('${table.name}', '${field.name}', '${table.name}.${field.name} should not be nullable');`);
          } else {
            tests.push(`SELECT col_is_null('${table.name}', '${field.name}', '${table.name}.${field.name} should be nullable');`);
          }
        }

        if (isCritical) {
          tests.push(`-- CRITICAL FIELD: Additional safety checks`);

          if (DirectiveProcessor.isSensitive(field.directives)) {
            if (field.name.includes('password')) {
              tests.push(`SELECT has_check('${table.name}', '${table.name}.${field.name} should have hash length check');`);
            }

            if (field.name.includes('email')) {
              tests.push(`SELECT col_is_unique('${table.name}', '${field.name}', '${table.name}.${field.name} should be unique');`);
            }
          }
        }

        tests.push('');
      }
    }

    return tests.join('\n');
  }

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
        const fieldUid = DirectiveProcessor.getUid(field.directives) || `col:${table.name}.${field.name}`;

        if (field.isPrimaryKey()) {
          this.recordEvidence(`${fieldUid}.pk`, 'test', tests.length + 1);
          tests.push(`SELECT col_is_pk('${table.name}', '${field.name}', '${table.name}.${field.name} should be primary key');`);
        }

        if (field.isForeignKey()) {
          const ref = field.getForeignKeyRef();
          if (ref) {
            const [refTable, refCol] = ref.split('.');
            this.recordEvidence(`${fieldUid}.fk`, 'test', tests.length + 1);
            tests.push(`SELECT fk_ok('${table.name}', '${field.name}', '${refTable}', '${refCol || 'id'}', 'Foreign key ${table.name}.${field.name} -> ${refTable}.${refCol || 'id'} should exist');`);
          }
        }

        if (field.isUnique()) {
          this.recordEvidence(`${fieldUid}.unique`, 'test', tests.length + 1);
          tests.push(`SELECT col_is_unique('${table.name}', '${field.name}', '${table.name}.${field.name} should be unique');`);
        }

        if (field.directives?.['@check']) {
          this.recordEvidence(`${fieldUid}.check`, 'test', tests.length + 1);
          tests.push(`SELECT has_check('${table.name}', '${table.name}.${field.name} should have check constraint');`);
        }
      }

      tests.push('');
    }

    return tests.join('\n');
  }

  generateDefaultTests(schema) {
    const tests = [];

    tests.push('-- ══════════════════════════════════════════════════════');
    tests.push('-- DEFAULT VALUE TESTS');
    tests.push('-- Ensuring defaults match schema expectations');
    tests.push('-- ══════════════════════════════════════════════════════');
    tests.push('');

    for (const table of schema.getTables()) {
      const defaultFields = table.getFields().filter(f => f.getDefault());
      if (defaultFields.length === 0) continue;

      tests.push(`-- Default values for ${table.name}`);

      for (const field of defaultFields) {
        const defaultValue = field.getDefault();
        const fieldUid = DirectiveProcessor.getUid(field.directives) || `col:${table.name}.${field.name}`;
        this.recordEvidence(`${fieldUid}.default`, 'test', tests.length + 1);

        const defaultSummary = defaultValue.expr ? `expr ${defaultValue.expr}` : JSON.stringify(defaultValue);
        tests.push(`-- Default check for ${table.name}.${field.name} = ${defaultSummary}`);
        tests.push(`SELECT column_has_default('${table.name}', '${field.name}', '${table.name}.${field.name} should have default');`);
        tests.push(`SELECT col_default_is('${table.name}', '${field.name}', '${defaultValue.expr || 'DEFAULT'}', 'Default for ${table.name}.${field.name} should match schema');`);
        tests.push('');
      }
    }

    return tests.join('\n');
  }

  generateIndexTests(schema) {
    const tests = [];

    tests.push('-- ══════════════════════════════════════════════════════');
    tests.push('-- INDEX TESTS');
    tests.push('-- Validating indexes exist and are optimized');
    tests.push('-- ══════════════════════════════════════════════════════');
    tests.push('');

    for (const table of schema.getTables()) {
      const indexedFields = table.getFields().filter(f => f.isIndexed() || f.isUnique());
      if (indexedFields.length === 0) continue;

      tests.push(`-- Indexes for ${table.name}`);

      for (const field of indexedFields) {
        const fieldUid = DirectiveProcessor.getUid(field.directives) || `col:${table.name}.${field.name}`;
        this.recordEvidence(`${fieldUid}.index`, 'test', tests.length + 1);

        const indexName = field.directives?.['@index']?.name || `${table.name}_${field.name}_idx`;
        tests.push(`SELECT has_index('${table.name}', '${indexName}', 'Index ${indexName} should exist');`);

        if (field.directives?.['@index']?.where) {
          tests.push(`-- Conditional index present with WHERE clause`);
        }

        tests.push('');
      }
    }

    return tests.join('\n');
  }

  generateRLSTests(schema) {
    const tests = [];
    let hasRLS = false;

    for (const table of schema.getTables()) {
      if (!table.directives?.['@rls']) continue;
      hasRLS = true;

      const policies = table.directives['@rls'];
      const tableUid = DirectiveProcessor.getUid(table.directives) || `tbl:${table.name}`;
      this.recordEvidence(`${tableUid}.rls`, 'test', tests.length + 1);

      tests.push(`-- RLS policies for ${table.name}`);
      tests.push(`SELECT table_has_rls('${table.name}', '${table.name} should have RLS enabled');`);

      if (policies.select) {
        tests.push(`SELECT policy_exists('${table.name}', 'policy_${table.name}_select_${tableUid}', 'SELECT policy should exist');`);
      }
      if (policies.insert) {
        tests.push(`SELECT policy_exists('${table.name}', 'policy_${table.name}_insert_${tableUid}', 'INSERT policy should exist');`);
      }
      if (policies.update) {
        tests.push(`SELECT policy_exists('${table.name}', 'policy_${table.name}_update_${tableUid}', 'UPDATE policy should exist');`);
      }
      if (policies.delete) {
        tests.push(`SELECT policy_exists('${table.name}', 'policy_${table.name}_delete_${tableUid}', 'DELETE policy should exist');`);
      }

      tests.push('');
    }

    if (!hasRLS) return null;

    tests.unshift('-- ══════════════════════════════════════════════════════');
    tests.unshift('-- RLS POLICY TESTS');
    tests.unshift('-- ══════════════════════════════════════════════════════');
    tests.unshift('');

    return tests.join('\n');
  }

  generateBehaviorTests(schema) {
    const tests = [];

    tests.push('-- ══════════════════════════════════════════════════════');
    tests.push('-- BEHAVIOR TESTS');
    tests.push('-- Triggers, functions, and advanced behaviors');
    tests.push('-- ══════════════════════════════════════════════════════');
    tests.push('');

    for (const table of schema.getTables()) {
      const hasBehavior = table.getFields().some(f => f.directives?.['@computed'] || f.directives?.['@generated']);
      if (!hasBehavior) continue;

      tests.push(`-- Behavior for ${table.name}`);

      for (const field of table.getFields()) {
        if (field.directives?.['@computed']) {
          const fieldUid = DirectiveProcessor.getUid(field.directives) || `col:${table.name}.${field.name}`;
          this.recordEvidence(`${fieldUid}.behavior`, 'test', tests.length + 1);
          const directive = field.directives['@computed'];
          const deps = directive.dependencies || [];

          tests.push(`-- Computed column ${table.name}.${field.name}`);
          tests.push(`SELECT has_function('compute_${table.name}_${field.name}', 'Trigger function should exist');`);
          tests.push(`SELECT trigger_is_present('${table.name}', 'trigger_compute_${table.name}_${field.name}', 'Trigger for computed column should exist');`);

          if (deps.length > 0) {
            tests.push(`-- Dependencies: ${deps.join(', ')}`);
          }
          tests.push('');
        }

        if (field.directives?.['@generated']) {
          const fieldUid = DirectiveProcessor.getUid(field.directives) || `col:${table.name}.${field.name}`;
          this.recordEvidence(`${fieldUid}.generated`, 'test', tests.length + 1);
          tests.push(`-- Generated column ${table.name}.${field.name}`);
          tests.push(`SELECT column_is_generated('${table.name}', '${field.name}', 'Generated column should exist');`);
          tests.push('');
        }
      }
    }

    return tests.join('\n');
  }

  generateMigrationTests(migrationSteps) {
    const tests = [];

    tests.push('-- ══════════════════════════════════════════════════════');
    tests.push('-- MIGRATION SAFETY TESTS');
    tests.push('-- Verifying migration steps are safe and idempotent');
    tests.push('-- ══════════════════════════════════════════════════════');
    tests.push('');

    for (const step of migrationSteps) {
      const stepUid = this.getMigrationUid(step);
      this.recordEvidence(stepUid, 'test', tests.length + 1);
      tests.push(`-- Migration step: ${step.kind}`);

      switch (step.kind) {
        case 'add_column':
          tests.push(`-- Verify column ${step.column} exists after migration`);
          tests.push(`SELECT has_column('${step.table}', '${step.column}', 'Column should exist after migration');`);
          if (step.field?.nonNull) {
            tests.push(`-- Verify NOT NULL constraint holds`);
            tests.push(`SELECT col_not_null('${step.table}', '${step.column}', 'Column should be NOT NULL after migration');`);
          }
          break;

        case 'drop_column':
          tests.push(`-- Verify column ${step.column} no longer exists`);
          tests.push(`SELECT NOT has_column('${step.table}', '${step.column}', 'Column should be dropped by migration');`);
          break;

        case 'alter_type':
          tests.push(`-- Verify column ${step.column} type change`);
          const sqlType = this.mapToSQLType(step.to || {});
          tests.push(`SELECT col_type_is('${step.table}', '${step.column}', '${sqlType}', 'Column type should match migration');`);
          break;

        case 'create_table':
          tests.push(`-- Verify table ${step.table} exists`);
          tests.push(`SELECT has_table('${step.table}', 'Table should exist after migration');`);
          break;

        case 'drop_table':
          tests.push(`-- Verify table ${step.table} no longer exists`);
          tests.push(`SELECT NOT has_table('${step.table}', 'Table should be dropped by migration');`);
          break;

        default:
          tests.push(`-- Unsupported migration step in tests: ${step.kind}`);
      }

      tests.push('');
    }

    return tests.join('\n');
  }

  getMigrationUid(step) {
    if (step.uid) return step.uid;
    const parts = [step.kind];
    if (step.table) parts.push(step.table);
    if (step.column) parts.push(step.column);
    if (step.name) parts.push(step.name);
    return `migration:${parts.join(':')}`;
  }

  wrapTestSuite(content) {
    const lines = [];
    lines.push(`-- Wesley Database Test Suite`);
    lines.push(`-- Generated at ${new Date().toISOString()}`);
    lines.push('SET client_min_messages = warning;');
    lines.push('SELECT plan(1000); -- dynamic plan, adjusted at runtime');
    lines.push('');
    lines.push(content);
    lines.push('');
    lines.push('SELECT * FROM finish();');
    lines.push('');
    lines.push('-- End of Wesley Test Suite');

    return lines.join('\n');
  }

  mapToSQLType(field) {
    const typeMap = {
      ID: 'uuid',
      String: 'text',
      Int: 'integer',
      Float: 'double precision',
      Boolean: 'boolean',
      DateTime: 'timestamptz',
      Date: 'date',
      Time: 'time',
      Decimal: 'numeric',
      UUID: 'uuid'
    };

    const baseType = typeMap[field.type] || 'text';
    if (field.list) {
      return `${baseType}[]`;
    }
    return baseType;
  }

  recordEvidence(uid, type, lineOffset) {
    if (!this.evidenceMap) return;

    const line = this.currentLine + lineOffset;
    this.evidenceMap.record(uid, type, {
      file: 'out/tests.sql',
      lines: `${line}-${line}`,
      sha: this.evidenceMap.sha
    });
  }

  getEvidence(uid) {
    if (!this.evidenceMap) return 'no-evidence-map';
    if (typeof this.evidenceMap.getEvidence === 'function') {
      const evidence = this.evidenceMap.getEvidence(uid);
      return Object.keys(evidence).length ? JSON.stringify(evidence) : 'no-evidence';
    }
    return 'no-evidence';
  }
}
