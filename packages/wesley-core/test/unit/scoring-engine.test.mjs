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

  const scsDetails = scoring.calculateSCSDetails(schema);
  const scsBreakdown = scsDetails.breakdown;
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
    const uid = `migration:${step.kind}:${step.table}:${step.column || ''}`;
    record(uid, 'test');
  }

  const tciDetails = scoring.calculateTCIDetails(schema, { migrations: { passed: 1, total: 1 } });
  const tciBreakdown = tciDetails.breakdown;
  assert.ok(tciBreakdown.unit_constraints.score > 0.5, 'Unit constraints score should reflect recorded tests');
  assert.equal(tciBreakdown.unit_rls.score, 1, 'RLS coverage should be complete');

  const mriDetails = scoring.calculateMRIDetails(migrationSteps);
  assert.ok(mriDetails.breakdown.drops.points >= 25, 'Drop risk captured');
  assert.ok(mriDetails.breakdown.add_not_null_without_default.points >= 10, 'NOT NULL without default risk captured');
  assert.ok(mriDetails.score > 0, 'MRI score should be non-zero');
});

test('TCI incorporates test results health factors', () => {
  const evidence = new EvidenceMap();
  evidence.setSha('sha');

  const fields = [
    createField('id', { directives: { '@primaryKey': {} }, primaryKey: true }),
    createField('email', { directives: { '@unique': {} }, unique: true })
  ];

  const table = {
    name: 'Account',
    directives: { '@rls': {} },
    getFields: () => fields
  };

  const schema = { getTables: () => [table] };
  const step = { kind: 'add_column', table: 'account', column: 'status', field: { nonNull: true, directives: {} } };

  const record = (uid, kind) => evidence.record(uid, kind, { file: `${kind}.sql`, lines: '1-1' });
  const fieldUid = (field) => `col:${table.name}.${field.name}`;
  ['sql', 'typescript', 'zod', 'test'].forEach(kind => record(fieldUid(fields[0]), kind));
  record(`${fieldUid(fields[0])}.pk`, 'test');
  ['sql', 'typescript', 'zod', 'test'].forEach(kind => record(fieldUid(fields[1]), kind));
  record(`${fieldUid(fields[1])}.unique`, 'test');
  record('tbl:Account.rls', 'test');
  record(`migration:${step.kind}:${step.table}:${step.column}`, 'test');

  const scoring = new ScoringEngine(evidence);
  const tciHealthy = scoring.calculateTCI(schema, { passed: 2, total: 2, migrations: { passed: 1, total: 1 } }, [step]);
  assert.ok(tciHealthy > 0.6, 'Healthy suites should yield high TCI');

  const failingResults = {
    passed: 1,
    total: 2,
    migrations: { passed: 0, total: 2 }
  };
  const tciDegraded = scoring.calculateTCI(schema, failingResults, [step]);
  assert.ok(tciDegraded < tciHealthy, 'Failing suites should reduce TCI');
  assert.ok(tciDegraded < 0.7, 'Failing suites should reduce TCI');
});
