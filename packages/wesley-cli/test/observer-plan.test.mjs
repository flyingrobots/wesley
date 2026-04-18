import test from 'node:test';
import assert from 'node:assert/strict';

import {
  generateObserverPlanTypeScript,
  normalizeObserverSpec
} from '../src/utils/observer-plan.mjs';

test('normalizeObserverSpec produces a deterministic plan id and source block', () => {
  const plan = normalizeObserverSpec({
    observerName: 'worldlineSnapshot',
    kind: 'WORLDLINE_SNAPSHOT',
    operationName: 'worldlineSnapshot',
    aperture: {
      kind: 'CANONICAL_WORLDLINE_SLICE',
      historyWindow: 'CANONICAL_HEAD_ONLY',
      maxWorldlines: 1
    },
    basis: {
      kind: 'JEDIT_HOT_TEXT',
      nodeKinds: ['BufferWorldline', 'RopeHead', 'Checkpoint']
    },
    state: {
      mode: 'MEMORYLESS',
      schemaId: 'jedit.worldlineSnapshot.state.v1'
    },
    update: {
      kind: 'REPLACE_WITH_LATEST_SLICE'
    },
    emit: {
      kind: 'WORLDLINE_SNAPSHOT_READING',
      readingSchemaId: 'jedit.worldlineSnapshot.reading.v1'
    },
    budgets: {
      materialization: 'SLICE_ONLY',
      historyWindow: 'CANONICAL_HEAD_ONLY',
      maxWorldlines: 1
    },
    rights: {
      schemaId: 'jedit.worldlineSnapshot.rights.v1',
      exposureTier: 'AUTHOR_VISIBLE',
      revelationTier: 'CANONICAL_TEXT_ONLY',
      redactionPolicy: 'HIDE_NON_CANONICAL_LANES'
    }
  }, {
    specPath: 'src/app/jedit-observer-spec.ts',
    exportName: 'createWorldlineSnapshotObserverSpec'
  });

  assert.match(plan.planId, /^observer-plan:worldlineSnapshot:/);
  assert.equal(plan.source.specPath, 'src/app/jedit-observer-spec.ts');
  assert.equal(plan.source.exportName, 'createWorldlineSnapshotObserverSpec');
});

test('generateObserverPlanTypeScript emits a plan constant and interface', () => {
  const code = generateObserverPlanTypeScript(normalizeObserverSpec({
    observerName: 'worldlineSnapshot',
    kind: 'WORLDLINE_SNAPSHOT',
    operationName: 'worldlineSnapshot',
    aperture: {
      kind: 'CANONICAL_WORLDLINE_SLICE',
      historyWindow: 'CANONICAL_HEAD_ONLY',
      maxWorldlines: 1
    },
    basis: {
      kind: 'JEDIT_HOT_TEXT',
      nodeKinds: ['BufferWorldline']
    },
    state: {
      mode: 'MEMORYLESS',
      schemaId: 'jedit.worldlineSnapshot.state.v1'
    },
    update: {
      kind: 'REPLACE_WITH_LATEST_SLICE'
    },
    emit: {
      kind: 'WORLDLINE_SNAPSHOT_READING',
      readingSchemaId: 'jedit.worldlineSnapshot.reading.v1'
    },
    budgets: {
      materialization: 'SLICE_ONLY',
      historyWindow: 'CANONICAL_HEAD_ONLY',
      maxWorldlines: 1
    },
    rights: {
      schemaId: 'jedit.worldlineSnapshot.rights.v1',
      exposureTier: 'AUTHOR_VISIBLE',
      revelationTier: 'CANONICAL_TEXT_ONLY',
      redactionPolicy: 'HIDE_NON_CANONICAL_LANES'
    }
  }));

  assert.match(code, /export interface ObserverPlan/);
  assert.match(code, /export const worldlinesnapshotobserverplan/i);
  assert.match(code, /"operationName": "worldlineSnapshot"/);
});
