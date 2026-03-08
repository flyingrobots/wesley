import test from 'node:test';
import assert from 'node:assert/strict';
import { emitDDL } from '../src/emit.mjs';

test('emitDDL orders table creates before FKs', () => {
  const ir = {
    tables: [
      {
        name: 'B',
        directives: { table: true },
        fields: [{ name: 'id', type: { base: 'ID', isList: false }, nullable: false, directives: { pk: true } }],
        indexes: [],
        constraints: []
      },
      {
        name: 'A',
        directives: { table: true },
        fields: [
          { name: 'id', type: { base: 'ID', isList: false }, nullable: false, directives: { pk: true } },
          { name: 'b_id', type: { base: 'ID', isList: false }, nullable: false, directives: { fk: { targetTable: 'B', targetField: 'id' } } }
        ],
        indexes: [],
        constraints: []
      }
    ]
  };
  const out = emitDDL(ir);
  const sql = out.files[0].content;
  const posCreateB = sql.indexOf('CREATE TABLE IF NOT EXISTS "b"');
  const posCreateA = sql.indexOf('CREATE TABLE IF NOT EXISTS "a"');
  const posFk = sql.indexOf('ALTER TABLE "a" ADD CONSTRAINT');
  assert.ok(posCreateA !== -1 && posCreateB !== -1 && posFk !== -1, 'expected statements');
  assert.ok(posCreateA > -1 && posCreateB > -1, 'create statements exist');
  assert.ok(posFk > posCreateA && posFk > posCreateB, 'FK emitted after both tables');
});
