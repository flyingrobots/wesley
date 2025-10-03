import test from 'node:test';
import assert from 'node:assert/strict';
import { compileFilter } from '../../../src/domain/qir/PredicateCompiler.mjs';

const env = {
  resolveColumn: (path) => {
    const col = path.split('.').pop();
    let type = 'text';
    if (String(col).includes('created_at')) type = 'timestamptz';
    if (String(col).includes('tags')) type = 'text[]';
    return { table: 'o', column: col, type };
  },
  param: (name, type) => ({ kind: 'ParamRef', name, typeHint: type })
};

test('eq null compiles to IS NULL', () => {
  const p = compileFilter({ 'o.deleted_at': { eq: null } }, env);
  assert.equal(p.kind, 'Compare');
  assert.equal(p.op, 'isNull');
});

test('in [] compiles to FALSE eq TRUE sentinel', () => {
  const p = compileFilter({ 'o.name': { in: [] } }, env);
  assert.equal(p.kind, 'Compare');
});

test('contains on text[] stays contains', () => {
  const p = compileFilter({ 'o.tags': { contains: ['a'] } }, env);
  assert.equal(p.kind, 'Compare');
  assert.equal(p.op, 'contains');
});

