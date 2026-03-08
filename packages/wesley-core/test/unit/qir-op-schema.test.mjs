import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { opJsonSchema } from '../../src/domain/qir/op.schema.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..', '..', '..', '..');

function readFixture(rel) {
  return JSON.parse(readFileSync(resolve(root, rel), 'utf8'));
}

const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
const validate = ajv.compile(opJsonSchema);

// ─── Smoke ──────────────────────────────────────────────────────────

test('opJsonSchema compiles under Ajv 2020-12', () => {
  assert.equal(typeof validate, 'function');
});

// ─── Valid ops (golden path) ────────────────────────────────────────

test('minimal valid op: { table }', () => {
  assert.ok(validate({ table: 'product' }));
});

test('full-featured op: all_products fixture', () => {
  const op = readFixture('example/ops/all_products.op.json');
  assert.ok(validate(op), JSON.stringify(validate.errors));
});

test('parameterised filter: orders_by_user fixture', () => {
  const op = readFixture('test/fixtures/examples/ops/orders_by_user.op.json');
  assert.ok(validate(op), JSON.stringify(validate.errors));
});

test('nested lists: orders_with_items_by_user fixture', () => {
  const op = readFixture('test/fixtures/examples/ops/orders_with_items_by_user.op.json');
  assert.ok(validate(op), JSON.stringify(validate.errors));
});

test('filter without op but with value is valid', () => {
  const op = { table: 't', filters: [{ column: 'x', value: 1 }] };
  assert.ok(validate(op), JSON.stringify(validate.errors));
});

// ─── Invalid ops (rejection) ───────────────────────────────────────

test('missing table is rejected', () => {
  assert.equal(validate({ columns: ['id'] }), false);
});

test('extra unknown property is rejected', () => {
  assert.equal(validate({ table: 't', bogus: true }), false);
});

test('invalid filter op enum is rejected', () => {
  const op = { table: 't', filters: [{ column: 'x', op: 'banana', value: 1 }] };
  assert.equal(validate(op), false);
});

test('invalid param type pattern is rejected', () => {
  const op = {
    table: 't',
    filters: [{ column: 'x', op: 'eq', param: { name: 'x', type: 'varchar' } }]
  };
  assert.equal(validate(op), false);
});

test('isNull filter with value present is rejected', () => {
  const op = { table: 't', filters: [{ column: 'x', op: 'isNull', value: true }] };
  assert.equal(validate(op), false);
});

test('colRef tuple with 3 elements is rejected', () => {
  const op = {
    table: 't',
    joins: [{
      table: 'u',
      on: { left: ['a', 'b', 'c'] }
    }]
  };
  assert.equal(validate(op), false);
});

// ─── Regression guards (Codex fixes) ───────────────────────────────

test('regression: filter without op + with value must not be rejected by conditionals', () => {
  const op = { table: 't', filters: [{ column: 'status', value: 'active' }] };
  assert.ok(validate(op), JSON.stringify(validate.errors));
});

test('regression: colRef as 2-element tuple is valid', () => {
  const op = {
    table: 't',
    joins: [{
      table: 'u',
      on: { left: ['t', 'id'] }
    }]
  };
  assert.ok(validate(op), JSON.stringify(validate.errors));
});

test('regression: colRef as 3-element tuple is rejected', () => {
  const op = {
    table: 't',
    joins: [{
      table: 'u',
      on: { left: ['a', 'b', 'c'] }
    }]
  };
  assert.equal(validate(op), false);
});
