import test from 'node:test';
import assert from 'node:assert/strict';
import { emitDDL } from '../src/emit.mjs';

test('emitDDL orders table creates before FKs', () => {
  const ir = {
    tables: [
      { name: 'B', columns: [{ name: 'id', type:'uuid', nullable:false }], primaryKey:'id', foreignKeys:[], indexes:[] },
      { name: 'A', columns: [{ name: 'id', type:'uuid', nullable:false }, { name:'b_id', type:'uuid', nullable:false }], primaryKey:'id', foreignKeys:[{ column:'b_id', refTable:'B', refColumn:'id' }], indexes:[] }
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

