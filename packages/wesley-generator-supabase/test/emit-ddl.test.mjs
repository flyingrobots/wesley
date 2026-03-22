import test from 'node:test';
import assert from 'node:assert/strict';
import { emitDDL } from '../src/emit.mjs';

test('emitDDL emits real DDL with per-field evidence', async () => {
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
  const out = await emitDDL(ir, { outDir: 'out' });
  const sql = out.files[0].content;
  const posCreateB = sql.indexOf('CREATE TABLE IF NOT EXISTS "bs"');
  const posCreateA = sql.indexOf('CREATE TABLE IF NOT EXISTS "as"');
  const posFk = sql.indexOf('FOREIGN KEY ("b_id") REFERENCES "bs"("id")');
  assert.ok(posCreateA !== -1 && posCreateB !== -1 && posFk !== -1, 'expected statements');
  assert.ok(posCreateA > -1 && posCreateB > -1, 'create statements exist');
  assert.ok(posCreateB < posCreateA, 'referenced table should be emitted before the dependent table');
  assert.deepEqual(out.evidence['col:A.b_id'].artifacts.sql.file, 'out/schema.sql');
  assert.match(out.evidence['col:A.b_id'].artifacts.sql.lines, /^\d+-\d+$/);
});
