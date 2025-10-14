import test from 'node:test';
import assert from 'node:assert/strict';

import { ScoringEngine } from '../../src/application/Scoring.mjs';
import { EvidenceMap } from '../../src/application/EvidenceMap.mjs';

function createField(name, options = {}) {
  return {
    name,
    directives: options.directives || {},
    type: options.type || 'String',
    list: options.list ?? false,
    nonNull: options.nonNull ?? true,
    isVirtual: () => Boolean(options.virtual),
    isPrimaryKey: () => Boolean(options.primaryKey || options.directives?.['@primaryKey']),
    isForeignKey: () => Boolean(options.foreignKey || options.directives?.['@foreignKey']),
    isUnique: () => Boolean(options.unique || options.directives?.['@unique']),
    isIndexed: () => Boolean(options.indexed),
    getForeignKeyRef: () => options.foreignKey || null,
    getDefault: () => options.defaultValue ? { value: options.defaultValue } : (options.defaultExpr ? { expr: options.defaultExpr } : null),
    getCheckConstraint: () => options.check || null
  };
}

test('ScoringEngine computes breakdown metrics with evidence', () => {
  const evidence = new EvidenceMap();
  evidence.setSha('testsha');

  const fields = [
    createField('id', { directives: { '@primaryKey': {} }, primaryKey: true, type: 'ID' }),
    createField('email', { directives: { '@unique': {} }, unique: true }),
    createField('org_id', { directives: { '@foreignKey': { ref: 'Org.id' } }, foreignKey: 'Org.id' }),
    createField('status', { defaultValue: 'pending' })
  ];

  const table = {
    name: 'User',
    directives: { '@rls': {} },
    getFields: () => fields
  };

  const schema = {
    getTables: () => [table]
  };

  // Record evidence for fields (matching EvidenceMap expectations)
  const fieldUid = (field) => `col:${table.name}.${field.name}`;
  const record = (uid, kind) => {
    evidence.record(uid, kind, {
      file: `${kind}.sql`,
      lines: '1-1'
    });
  };

  // id -> full coverage
  ['sql', 'typescript', 'zod', 'test'].forEach(kind => record(fieldUid(fields[0]), kind));
  record(`${fieldUid(fields[0])}.pk`, 'test');

  // email -> missing types
  ['sql', 'zod'].forEach(kind => record(fieldUid(fields[1]), kind));
  record(`${fieldUid(fields[1])}.unique`, 'test');
  record(`${fieldUid(fields[1])}.index`, 'test');

  // org_id -> full coverage including FK
  ['sql', 'typescript', 'zod', 'test'].forEach(kind => record(fieldUid(fields[2]), kind));
  record(`${fieldUid(fields[2])}.fk`, 'test');

  // status -> only types + validation (no tests)
  ['sql', 'typescript', 'zod'].forEach(kind => record(fieldUid(fields[3]), kind));
  record(`${fieldUid(fields[3])}.default`, 'test');

  // table-level RLS evidence
  record('tbl:User.rls', 'test');

  const scoring = new ScoringEngine(evidence);

  const scsBreakdown = scoring.calculateSCSBreakdown(schema);
  assert.ok(scsBreakdown.sql.score <= 1 && scsBreakdown.sql.score > 0.9, 'SQL coverage should be high');
  assert.ok(scsBreakdown.types.score < 1, 'Types coverage should reflect missing email types');
  assert.ok(scsBreakdown.tests.score < 1, 'Tests coverage should reflect missing status tests');

  const migrationSteps = [
    { kind: 'drop_column', table: 'users', column: 'legacy' },
    { kind: 'add_column', table: 'users', column: 'enabled', field: { nonNull: true, directives: {} } },
    { kind: 'rename_table', table: 'users', uidContinuity: false },
    { kind: 'create_index', table: 'users', column: 'email', concurrent: false }
  ];

  // Record migration evidence for e2e coverage
  for (const step of migrationSteps) {
    const uid = scoring.migrationStepUid(step);
    record(uid, 'test');
  }

  const tciBreakdown = scoring.calculateTCIBreakdown(schema, migrationSteps);
  assert.ok(tciBreakdown.unitConstraints.score > 0.5, 'Unit constraints score should reflect recorded tests');
  assert.equal(tciBreakdown.rls.score, 1, 'RLS coverage should be complete');
  assert.ok(tciBreakdown.e2eOps.score > 0, 'E2E coverage should be recorded');

  const mriMetrics = scoring.calculateMRIMetrics(migrationSteps);
  assert.ok(mriMetrics.breakdown.drops.points >= 25, 'Drop risk captured');
  assert.ok(mriMetrics.breakdown.defaults.points >= 10, 'Default risk captured');
  assert.ok(mriMetrics.score > 0, 'MRI score should be non-zero');
});
