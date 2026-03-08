/**
 * Regression tests for shared migration plan helpers (_migration-plan.mjs).
 *
 * Each test targets a bug that existed in the diverged local copies formerly
 * in up.mjs but was already fixed in the shared module.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAdditivePlan,
  lockFor,
  emitMigrations,
} from '../src/commands/_migration-plan.mjs';

// ── Bug 1: Index dedup ignores USING method ─────────────────────────

test('buildAdditivePlan distinguishes indexes with different USING methods', () => {
  const prev = {
    tables: [{
      name: 'events',
      fields: [],
      indexes: [{ fields: ['payload'], using: 'btree' }],
    }],
  };
  const curr = {
    tables: [{
      name: 'events',
      fields: [],
      indexes: [
        { fields: ['payload'], using: 'btree' },
        { fields: ['payload'], using: 'gin' },
      ],
    }],
  };

  const plan = buildAdditivePlan(prev, curr);
  const indexSteps = plan.phases[0].steps.filter(s => s.op === 'create_index_concurrently');

  assert.equal(indexSteps.length, 1, 'should create exactly the new gin index');
  assert.equal(indexSteps[0].using, 'gin');
});

// ── Bug 2: Falsy default coercion ───────────────────────────────────

test('lockFor treats falsy defaults (0) as present', () => {
  const step = { op: 'add_column', nullable: false, default: 0 };
  const lock = lockFor(step);

  assert.equal(lock.name, 'SHARE ROW EXCLUSIVE',
    'a NOT NULL column with DEFAULT 0 should avoid ACCESS EXCLUSIVE');
  assert.equal(lock.blocksReads, false);
});

// ── Bug 3: NOT NULL and DEFAULT emitted independently ───────────────

test('emitMigrations emits NOT NULL and DEFAULT independently', () => {
  // Nullable column WITH a default — should emit DEFAULT but not NOT NULL
  const planA = {
    phases: [{
      name: 'expand',
      steps: [{
        op: 'add_column', table: 'users', column: 'score',
        type: 'integer', nullable: true, default: 0,
      }],
    }],
  };
  const filesA = emitMigrations(planA);
  const sqlA = filesA[0].content;
  assert.match(sqlA, /DEFAULT 0/, 'nullable column should still get DEFAULT');
  assert.doesNotMatch(sqlA, /NOT NULL/, 'nullable column should not get NOT NULL');

  // Non-nullable column WITHOUT a default — should emit NOT NULL but not DEFAULT
  const planB = {
    phases: [{
      name: 'expand',
      steps: [{
        op: 'add_column', table: 'users', column: 'name',
        type: 'text', nullable: false, default: null,
      }],
    }],
  };
  const filesB = emitMigrations(planB);
  const sqlB = filesB[0].content;
  assert.match(sqlB, /NOT NULL/, 'non-nullable column should get NOT NULL');
  assert.doesNotMatch(sqlB, /DEFAULT/, 'column without default should not get DEFAULT');
});

// ── Bug 4: SQL injection guards ─────────────────────────────────────

test('emitMigrations rejects unsafe type, using, and default values', () => {
  // Unsafe type
  assert.throws(() => {
    emitMigrations({
      phases: [{
        name: 'expand',
        steps: [{ op: 'add_column', table: 't', column: 'c', type: "text; DROP TABLE users--", nullable: true, default: null }],
      }],
    });
  }, /Unsafe PostgreSQL type/);

  // Unsafe USING method
  assert.throws(() => {
    emitMigrations({
      phases: [{
        name: 'expand',
        steps: [{ op: 'create_index_concurrently', table: 't', columns: ['c'], using: "btree; DROP TABLE users--" }],
      }],
    });
  }, /Unsafe index method/);

  // Unsafe DEFAULT value
  assert.throws(() => {
    emitMigrations({
      phases: [{
        name: 'expand',
        steps: [{ op: 'add_column', table: 't', column: 'c', type: 'text', nullable: true, default: "'; DROP TABLE users--" }],
      }],
    });
  }, /Unsafe DEFAULT value/);
});
